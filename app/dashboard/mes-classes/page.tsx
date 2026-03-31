'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'
import { classerEleve } from '@/app/lib/fluenceUtils'

type EleveData = {
  id: string; nom: string; prenom: string; score: number | null
  ne: boolean; absent: boolean; groupe: number // 1=très fragile, 2=fragile, 3=en cours, 4=attendu
  qcmScore: number | null // /6 pour la période courante
  evolution: { code: string; annee: string; score: number | null; ne: boolean; absent: boolean; qcm: number | null }[]
}

type ClasseData = {
  id: string; nom: string; niveau: string
  eleves: EleveData[]
  moyenne: number | null; nbEvalues: number; nbFragiles: number
}

type PeriodeOpt = { id: string; code: string; label: string }

export default function MesClasses() {
  const [classes, setClasses] = useState<ClasseData[]>([])
  const [periodes, setPeriodes] = useState<PeriodeOpt[]>([])
  const [periodeCode, setPeriodeCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedClasse, setSelectedClasse] = useState<string | null>(null)
  const [openEleve, setOpenEleve] = useState<string | null>(null)
  const [filtreGroupe, setFiltreGroupe] = useState<number | null>(null)
  const [classeTab, setClasseTab] = useState<'eleves' | 'groupes'>('eleves')
  const { profil, profilReel, loading: profilLoading } = useProfil()
  const router = useRouter()
  const supabase = createClient()
  const loadedRef = useRef<string | null>(null)

  useEffect(() => {
    if (profilLoading || !profil) return
    const canImpersonate = profilReel && ['admin', 'ia_dasen', 'recteur'].includes(profilReel.role)
    if (profil.role !== 'enseignant') {
      if (canImpersonate) return
      router.push('/dashboard'); return
    }
    if (loadedRef.current === profil.id) return
    loadedRef.current = profil.id
    charger()
  }, [profil, profilLoading])

  async function charger(selectedCode?: string) {
    if (!profil) return

    // 1. Classes de l'enseignant
    const { data: assignees } = await supabase
      .from('enseignant_classes')
      .select('classe_id, classe:classes(id, nom, niveau, etablissement_id)')
      .eq('enseignant_id', profil.id)
    const classesList = (assignees || []).map((a: any) => a.classe).filter(Boolean)
    if (classesList.length === 0) { setLoading(false); return }
    const classeIds = classesList.map((c: any) => c.id)
    const etabId = classesList[0]?.etablissement_id

    // 2. Périodes
    if (etabId) {
      const { data: rawPer } = await supabase.from('periodes').select('id, code, label')
        .eq('etablissement_id', etabId).eq('actif', true).order('code')
      const seen = new Set<string>()
      const perDedup: PeriodeOpt[] = []
      for (const p of (rawPer || [])) {
        if (!seen.has(p.code) && /^T\d/.test(p.code)) { seen.add(p.code); perDedup.push(p) }
      }
      const prio = (c: string) => { const m = c.match(/^T(\d)/); return m ? parseInt(m[1]) : 99 }
      perDedup.sort((a, b) => prio(a.code) - prio(b.code))
      setPeriodes(perDedup)
      if (!selectedCode && !periodeCode && perDedup.length > 0) {
        const lastT = perDedup[perDedup.length - 1]
        setPeriodeCode(lastT.code)
        selectedCode = lastT.code
      }
    }
    const codeActuel = selectedCode || periodeCode

    // 3. Élèves
    const { data: elevesData } = await supabase.from('eleves').select('id, nom, prenom, classe_id')
      .in('classe_id', classeIds).eq('actif', true).order('nom')
    const tousEleves = elevesData || []
    const eleveIds = tousEleves.map(e => e.id)

    // 4. Passations — TOUTES (pour l'évolution multi-années)
    let allPass: any[] = []
    if (eleveIds.length > 0) {
      const { data } = await supabase.from('passations')
        .select('eleve_id, score, non_evalue, absent, q1, q2, q3, q4, q5, q6, periode:periodes(id, code, annee_scolaire)')
        .in('eleve_id', eleveIds)
      allPass = data || []
    }

    // 5. Normes
    const { data: normesData } = await supabase.from('config_normes').select('niveau, seuil_min, seuil_attendu')
    const normesMap: Record<string, { seuil_min: number; seuil_attendu: number }> = {}
    const defaultNorms: Record<string, { seuil_min: number; seuil_attendu: number }> = {
      '5eme': { seuil_min: 70, seuil_attendu: 110 }, '4eme': { seuil_min: 75, seuil_attendu: 120 },
      '3eme': { seuil_min: 80, seuil_attendu: 130 }, '6eme': { seuil_min: 65, seuil_attendu: 100 },
    }
    for (const n of (normesData || [])) normesMap[n.niveau] = { seuil_min: n.seuil_min, seuil_attendu: n.seuil_attendu }

    // Helper QCM score
    const calcQcm = (p: any): number | null => {
      const qs = [p.q1, p.q2, p.q3, p.q4, p.q5, p.q6]
      if (qs.every((q: any) => q == null)) return null
      return qs.filter((q: any) => q === 'Correct').length
    }

    // 6. Construire les classes avec données
    const prio = (c: string) => { const m = c.match(/^T(\d)/); return m ? parseInt(m[1]) : 99 }
    const result: ClasseData[] = classesList.map((c: any) => {
      const elevesC = tousEleves.filter(e => e.classe_id === c.id)
      const norme = normesMap[c.niveau] || defaultNorms[c.niveau] || { seuil_min: 80, seuil_attendu: 130 }

      const elevesResult: EleveData[] = elevesC.map(e => {
        // Passation courante
        const passCurrent = allPass.find((p: any) => p.eleve_id === e.id && p.periode?.code === codeActuel)
        const score = passCurrent && !passCurrent.non_evalue && !passCurrent.absent ? passCurrent.score : null
        const ne = passCurrent?.non_evalue || false
        const absent = passCurrent?.absent || false
        const groupe = score != null ? classerEleve(score, norme) : 0
        const qcmScore = passCurrent ? calcQcm(passCurrent) : null

        // Évolution multi-années
        const evoRaw = allPass.filter((p: any) => p.eleve_id === e.id && /^T\d/.test(p.periode?.code || ''))
        const evolution = evoRaw.map((p: any) => ({
          code: p.periode?.code || '', annee: p.periode?.annee_scolaire || '',
          score: p.non_evalue || p.absent ? null : p.score, ne: p.non_evalue || false, absent: p.absent || false,
          qcm: calcQcm(p),
        })).sort((a, b) => a.annee.localeCompare(b.annee) || prio(a.code) - prio(b.code))

        return { id: e.id, nom: e.nom, prenom: e.prenom, score, ne, absent, groupe, qcmScore, evolution }
      })

      const scores = elevesResult.filter(e => e.score != null).map(e => e.score!)
      return {
        id: c.id, nom: c.nom, niveau: c.niveau,
        eleves: elevesResult,
        moyenne: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        nbEvalues: scores.length,
        nbFragiles: elevesResult.filter(e => e.groupe === 1 || e.groupe === 2).length,
      }
    })

    setClasses(result)
    if (!selectedClasse && result.length === 1) setSelectedClasse(result[0].id)
    setLoading(false)
  }

  function changerPeriode(code: string) {
    setPeriodeCode(code)
    setOpenEleve(null)
    setFiltreGroupe(null)
    charger(code)
  }

  const groupeConfig = [
    { id: 1, label: 'Besoin d\'accompagnement', color: '#DC2626', bg: '#fef2f2' },
    { id: 2, label: 'Fragile', color: '#D97706', bg: '#fffbeb' },
    { id: 3, label: 'En cours d\'acquisition', color: '#2563EB', bg: '#eff6ff' },
    { id: 4, label: 'Satisfaisant', color: '#16A34A', bg: '#f0fdf4' },
  ]

  const classeActive = classes.find(c => c.id === selectedClasse)
  const elevesFiltres = classeActive ? (filtreGroupe ? classeActive.eleves.filter(e => e.groupe === filtreGroupe) : classeActive.eleves) : []

  // Drawer élève
  const eleveDrawer = openEleve ? classes.flatMap(c => c.eleves).find(e => e.id === openEleve) : null

  if (loading || profilLoading) return (
    <><Sidebar /><div style={{ marginLeft: 'var(--sidebar-width)', padding: 48, color: 'var(--text-tertiary)', fontSize: 14 }}>Chargement...</div></>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <ImpersonationBar />
      <main style={{ marginLeft: 'var(--sidebar-width)', flex: 1, padding: '32px 40px', background: 'var(--bg-gray)', fontFamily: 'var(--font-sans)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary-dark)', margin: 0 }}>Mes classes</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 14 }}>
              {classes.length} classe{classes.length > 1 ? 's' : ''} · {periodeCode}
            </p>
          </div>
          {/* Sélecteur période */}
          <div style={{ display: 'flex', gap: 6 }}>
            {periodes.map(p => (
              <button key={p.code} onClick={() => changerPeriode(p.code)} style={{
                padding: '7px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                border: `1.5px solid ${periodeCode === p.code ? 'var(--primary-dark)' : 'var(--border-light)'}`,
                background: periodeCode === p.code ? 'var(--primary-dark)' : 'white',
                color: periodeCode === p.code ? 'white' : 'var(--text-secondary)',
              }}>{p.code}</button>
            ))}
          </div>
        </div>

        {/* ═══ CARTES CLASSES ═══ */}
        {!selectedClasse && (
          <div style={{ display: 'grid', gridTemplateColumns: classes.length > 2 ? 'repeat(3, 1fr)' : classes.length === 2 ? '1fr 1fr' : '1fr', gap: 16 }}>
            {classes.map(c => {
              const total = c.eleves.length
              const pctEval = total > 0 ? Math.round(c.nbEvalues / total * 100) : 0
              const groupes = groupeConfig.map(g => ({ ...g, count: c.eleves.filter(e => e.groupe === g.id).length }))
              return (
                <button key={c.id} onClick={() => { setSelectedClasse(c.id); setFiltreGroupe(null); setOpenEleve(null) }} style={{
                  background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', padding: 24,
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-dark)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-dark)' }}>{c.nom.replace('[TEST] ', '')}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{c.niveau} · {total} élèves</div>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: c.moyenne != null ? 'var(--primary-dark)' : 'var(--text-tertiary)' }}>
                      {c.moyenne ?? '—'}
                    </div>
                  </div>
                  {/* Mini jauges */}
                  <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
                    {groupes.filter(g => g.count > 0).map(g => (
                      <div key={g.id} style={{ width: `${Math.round(g.count / total * 100)}%`, background: g.color, minWidth: 2 }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>{pctEval}% évalués</span>
                    {c.nbFragiles > 0 && <span style={{ color: '#dc2626', fontWeight: 700 }}>{c.nbFragiles} fragile{c.nbFragiles > 1 ? 's' : ''}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* ═══ VUE CLASSE DÉTAILLÉE ═══ */}
        {selectedClasse && classeActive && (
          <div>
            {/* Retour + titre */}
            {classes.length > 1 && (
              <button onClick={() => { setSelectedClasse(null); setOpenEleve(null); setFiltreGroupe(null) }} style={{
                background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16,
              }}>← Retour aux classes</button>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary-dark)', margin: 0 }}>{classeActive.nom.replace('[TEST] ', '')}</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
                  {classeActive.niveau} · {classeActive.eleves.length} élèves · Moyenne : {classeActive.moyenne ?? '—'} m/min
                </p>
              </div>
            </div>

            {/* Onglets Élèves / Groupes & Remédiation */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'white', borderRadius: 10, padding: 3, border: '1.5px solid var(--border-light)', width: 'fit-content' }}>
              <button onClick={() => setClasseTab('eleves')} style={{
                padding: '8px 18px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: classeTab === 'eleves' ? 'var(--primary-dark)' : 'transparent',
                color: classeTab === 'eleves' ? 'white' : 'var(--text-secondary)',
              }}>Élèves</button>
              <button onClick={() => setClasseTab('groupes')} style={{
                padding: '8px 18px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: classeTab === 'groupes' ? 'var(--primary-dark)' : 'transparent',
                color: classeTab === 'groupes' ? 'white' : 'var(--text-secondary)',
              }}>Groupes & Remédiation</button>
            </div>

            {/* ── TAB ÉLÈVES ── */}
            {classeTab === 'eleves' && (<>
            {/* Filtres par groupe */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              <button onClick={() => setFiltreGroupe(null)} style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1.5px solid ${!filtreGroupe ? 'var(--primary-dark)' : 'var(--border-light)'}`,
                background: !filtreGroupe ? 'var(--primary-dark)' : 'white',
                color: !filtreGroupe ? 'white' : 'var(--text-secondary)',
              }}>Tous ({classeActive.eleves.length})</button>
              {groupeConfig.map(g => {
                const count = classeActive.eleves.filter(e => e.groupe === g.id).length
                if (count === 0) return null
                return (
                  <button key={g.id} onClick={() => setFiltreGroupe(filtreGroupe === g.id ? null : g.id)} style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: `1.5px solid ${filtreGroupe === g.id ? g.color : 'var(--border-light)'}`,
                    background: filtreGroupe === g.id ? g.bg : 'white',
                    color: filtreGroupe === g.id ? g.color : 'var(--text-secondary)',
                  }}>{g.label} ({count})</button>
                )
              })}
              {/* Non évalués */}
              {(() => {
                const neCount = classeActive.eleves.filter(e => e.groupe === 0).length
                return neCount > 0 ? (
                  <button onClick={() => setFiltreGroupe(filtreGroupe === 0 ? null : 0)} style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: `1.5px solid ${filtreGroupe === 0 ? '#94a3b8' : 'var(--border-light)'}`,
                    background: filtreGroupe === 0 ? '#f8fafc' : 'white',
                    color: filtreGroupe === 0 ? '#64748b' : 'var(--text-secondary)',
                  }}>Non évalués ({neCount})</button>
                ) : null
              })()}
            </div>

            {/* Liste élèves */}
            <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid var(--border-light)', overflow: 'hidden' }}>
              {elevesFiltres.map((e, i) => {
                const gc = groupeConfig.find(g => g.id === e.groupe)
                const evo = e.evolution || []
                const scores = evo.filter(x => x.score != null).map(x => x.score!)
                const progression = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : null
                return (
                  <button key={e.id} onClick={() => setOpenEleve(openEleve === e.id ? null : e.id)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 20px', width: '100%', border: 'none', cursor: 'pointer',
                    borderBottom: i < elevesFiltres.length - 1 ? '1px solid var(--border-light)' : 'none',
                    background: openEleve === e.id ? 'rgba(37,99,235,0.04)' : 'transparent',
                    textAlign: 'left', transition: 'background 0.1s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Pastille groupe */}
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: gc?.color || '#d1d5db', flexShrink: 0 }} />
                      <span style={{ fontSize: 14, color: 'var(--primary-dark)' }}>
                        <strong>{e.nom}</strong> {e.prenom}
                      </span>
                      {/* Mini évolution inline */}
                      {evo.length > 1 && (
                        <div style={{ display: 'flex', gap: 2, marginLeft: 6 }}>
                          {evo.slice(-4).map((ev, idx) => (
                            <span key={`${ev.annee}-${ev.code}`} style={{
                              fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                              background: ev.score != null ? (ev.score >= 130 ? '#dcfce7' : ev.score >= 80 ? '#fef9c3' : '#fef2f2') : '#fef2f2',
                              color: ev.score != null ? (ev.score >= 130 ? '#16a34a' : ev.score >= 80 ? '#a16207' : '#dc2626') : '#dc2626',
                            }}>{ev.score ?? (ev.absent ? 'A' : 'NÉ')}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {progression !== null && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: progression > 0 ? '#16a34a' : progression < 0 ? '#dc2626' : '#94a3b8' }}>
                          {progression > 0 ? '+' : ''}{progression}
                        </span>
                      )}
                      {e.qcmScore != null && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                          background: e.qcmScore >= 4 ? '#dcfce7' : e.qcmScore >= 2 ? '#fef9c3' : '#fef2f2',
                          color: e.qcmScore >= 4 ? '#16a34a' : e.qcmScore >= 2 ? '#a16207' : '#dc2626',
                        }}>{e.qcmScore}/6</span>
                      )}
                      <span style={{ fontSize: 13, fontWeight: 700, minWidth: 65, textAlign: 'right',
                        color: e.score != null ? (gc?.color || 'var(--primary-dark)') : '#94a3b8',
                      }}>
                        {e.score != null ? `${e.score} m/min` : e.ne ? 'N.É.' : e.absent ? 'Absent' : '—'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
            </>)}

            {/* ── TAB GROUPES & REMÉDIATION ── */}
            {classeTab === 'groupes' && (() => {
              const total = classeActive.eleves.length
              const groupesData = groupeConfig.map(g => ({
                ...g,
                eleves: classeActive.eleves.filter(e => e.groupe === g.id),
                count: classeActive.eleves.filter(e => e.groupe === g.id).length,
              }))
              const nonEval = classeActive.eleves.filter(e => e.groupe === 0)
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Barre de répartition */}
                  <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid var(--border-light)', padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 12, letterSpacing: 0.5, textTransform: 'uppercase' }}>Répartition</div>
                    <div style={{ display: 'flex', height: 28, borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
                      {groupesData.filter(g => g.count > 0).map(g => (
                        <div key={g.id} style={{ width: `${Math.round(g.count / total * 100)}%`, background: g.color, minWidth: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {g.count / total >= 0.1 && <span style={{ fontSize: 11, fontWeight: 800, color: 'white' }}>{g.count}</span>}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {groupesData.map(g => (
                        <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: g.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{g.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: g.color, marginLeft: 'auto' }}>{g.count}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{total > 0 ? Math.round(g.count / total * 100) : 0}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Groupes détaillés */}
                  {groupesData.filter(g => g.count > 0).map(g => (
                    <div key={g.id} style={{ background: 'white', borderRadius: 14, border: `1.5px solid ${g.color}22`, overflow: 'hidden' }}>
                      <div style={{ padding: '14px 20px', background: g.bg, borderBottom: `1px solid ${g.color}22`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 12, height: 12, borderRadius: 3, background: g.color }} />
                          <span style={{ fontSize: 15, fontWeight: 800, color: g.color }}>{g.label}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{g.count} élève{g.count > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div>
                        {g.eleves.map((e, i) => {
                          const evoScores = e.evolution.filter(x => x.score != null).map(x => x.score!)
                          const prog = evoScores.length >= 2 ? evoScores[evoScores.length - 1] - evoScores[0] : null
                          return (
                            <button key={e.id} onClick={() => setOpenEleve(e.id)} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '9px 20px', width: '100%', border: 'none', cursor: 'pointer',
                              borderBottom: i < g.eleves.length - 1 ? '1px solid var(--border-light)' : 'none',
                              background: 'transparent', textAlign: 'left',
                            }}>
                              <span style={{ fontSize: 13, color: 'var(--primary-dark)' }}><strong>{e.nom}</strong> {e.prenom}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {e.qcmScore != null && (
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: '#fff7ed', color: '#f97316' }}>{e.qcmScore}/6</span>
                                )}
                                {prog != null && (
                                  <span style={{ fontSize: 11, fontWeight: 700, color: prog > 0 ? '#16a34a' : prog < 0 ? '#dc2626' : '#94a3b8' }}>
                                    {prog > 0 ? '+' : ''}{prog}
                                  </span>
                                )}
                                <span style={{ fontSize: 13, fontWeight: 700, color: g.color }}>{e.score ?? '—'} m/min</span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                      {/* Placeholder remédiation IA */}
                      <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>💡</span>
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                          Suggestions de remédiation — bientôt disponible
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Non évalués */}
                  {nonEval.length > 0 && (
                    <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid var(--border-light)', overflow: 'hidden' }}>
                      <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border-light)' }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: '#64748b' }}>Non évalués</span>
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 8 }}>{nonEval.length} élève{nonEval.length > 1 ? 's' : ''}</span>
                      </div>
                      {nonEval.map((e, i) => (
                        <div key={e.id} style={{ padding: '9px 20px', borderBottom: i < nonEval.length - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13, color: '#94a3b8' }}>
                          {e.nom} {e.prenom} — {e.ne ? 'Non évalué' : e.absent ? 'Absent' : 'En attente'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* ═══ DRAWER FICHE ÉLÈVE ═══ */}
        {openEleve && eleveDrawer && (() => {
          const evo = eleveDrawer.evolution.filter(e => /^T\d/.test(e.code))
          const scores = evo.filter(e => e.score != null).map(e => e.score!)
          const progression = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : null
          const maxS = Math.max(...scores, 1)
          const minS = Math.min(...scores, 0)
          const range = Math.max(maxS - minS, 20)
          const annees = [...new Set(evo.map(e => e.annee))].sort()
          const shortAnnee = (a: string) => a.replace(/^20(\d\d)-20(\d\d)$/, '$1-$2')

          const svgW = 320, svgH = 140, padX = 30, padY = 20
          const plotW = svgW - padX * 2, plotH = svgH - padY * 2
          const scoreToY = (s: number) => padY + plotH - ((s - minS + 10) / (range + 20)) * plotH
          const hasQcm = evo.some(e => e.qcm != null)

          let lastScore: number | null = null
          const points = evo.map((e, i) => {
            const hasScore = e.score != null
            const displayScore = hasScore ? e.score! : lastScore
            const y = displayScore != null ? scoreToY(displayScore) : padY + plotH
            if (hasScore) lastScore = e.score
            return {
              x: padX + (evo.length > 1 ? (i / (evo.length - 1)) * plotW : plotW / 2),
              y, score: e.score, displayScore, code: e.code, annee: e.annee, ne: e.ne, absent: e.absent,
              isMissing: !hasScore && (e.ne || e.absent),
              label: `${e.code}${annees.length > 1 ? ' ' + shortAnnee(e.annee) : ''}`,
              qcm: e.qcm,
            }
          })
          const polyline = points.filter(p => p.displayScore != null).map(p => `${p.x},${p.y}`).join(' ')
          // QCM courbe séparée
          const qcmSvgH = 100
          const qcmPlotH = qcmSvgH - padY * 2
          const qcmToY = (q: number) => padY + qcmPlotH - (q / 6) * qcmPlotH
          const qcmPoints = evo.map((e, i) => ({
            x: padX + (evo.length > 1 ? (i / (evo.length - 1)) * plotW : plotW / 2),
            y: e.qcm != null ? qcmToY(e.qcm) : null,
            qcm: e.qcm, label: `${e.code}${annees.length > 1 ? ' ' + shortAnnee(e.annee) : ''}`,
          }))
          const qcmPolyline = qcmPoints.filter(p => p.y != null).map(p => `${p.x},${p.y}`).join(' ')

          return (
            <>
              <div onClick={() => setOpenEleve(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 998 }} />
              <div style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, background: 'white', zIndex: 999,
                boxShadow: '-8px 0 32px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', overflowY: 'auto',
              }}>
                {/* Header */}
                <div style={{ padding: '24px 28px 16px', borderBottom: '1.5px solid var(--border-light)' }}>
                  <button onClick={() => setOpenEleve(null)} style={{ float: 'right', background: 'none', border: 'none', fontSize: 20, color: 'var(--text-tertiary)', cursor: 'pointer' }}>✕</button>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Fiche élève</div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary-dark)', margin: 0 }}>{eleveDrawer.nom} {eleveDrawer.prenom}</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {classeActive?.nom.replace('[TEST] ', '')} · {classeActive?.niveau}
                  </p>
                </div>

                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, padding: '16px 28px' }}>
                  <div style={{ background: 'rgba(0,24,69,0.04)', borderRadius: 12, padding: '10px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary-dark)' }}>{eleveDrawer.score ?? '—'}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>Fluence</div>
                  </div>
                  <div style={{ background: 'rgba(249,115,22,0.06)', borderRadius: 12, padding: '10px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: eleveDrawer.qcmScore != null ? '#f97316' : 'var(--text-tertiary)' }}>
                      {eleveDrawer.qcmScore != null ? `${eleveDrawer.qcmScore}/6` : '—'}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>Compréhension</div>
                  </div>
                  <div style={{ background: progression != null && progression > 0 ? 'rgba(22,163,74,0.06)' : 'rgba(0,24,69,0.04)', borderRadius: 12, padding: '10px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: progression != null ? (progression > 0 ? '#16a34a' : '#dc2626') : 'var(--text-tertiary)' }}>
                      {progression != null ? `${progression > 0 ? '+' : ''}${progression}` : '—'}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>Progression</div>
                  </div>
                  <div style={{ background: 'rgba(37,99,235,0.06)', borderRadius: 12, padding: '10px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb' }}>{evo.length}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>Passations</div>
                  </div>
                </div>

                {/* Courbe SVG */}
                {evo.length > 0 && (
                  <div style={{ padding: '8px 28px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      Courbe d'évolution
                    </div>
                    {/* Courbe Fluence */}
                    <div style={{ background: 'var(--bg-gray)', borderRadius: 14, padding: '12px 12px 8px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#2563eb', marginBottom: 4, textAlign: 'center' }}>Fluence (mots/min)</div>
                      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: 'block', margin: '0 auto' }}>
                        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                          const y = padY + plotH * (1 - pct)
                          const val = Math.round(minS - 10 + (range + 20) * pct)
                          return <g key={pct}>
                            <line x1={padX} x2={svgW - padX} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
                            <text x={padX - 4} y={y + 4} fontSize={9} fill="#94a3b8" textAnchor="end">{val}</text>
                          </g>
                        })}
                        {polyline && <polyline points={polyline} fill="none" stroke="#2563eb" strokeWidth={2.5} strokeLinejoin="round" />}
                        {points.map((p, i) => (
                          <g key={i}>
                            {p.isMissing ? (
                              <>
                                <rect x={p.x - 12} y={p.y - 10} width={24} height={20} rx={4} fill="#dc2626" stroke="white" strokeWidth={2} />
                                <text x={p.x} y={p.y + 4} fontSize={8} fontWeight={800} fill="white" textAnchor="middle">{p.absent ? 'ABS' : 'NÉ'}</text>
                              </>
                            ) : (
                              <>
                                <circle cx={p.x} cy={p.y} r={5} fill={p.score != null ? (p.score >= 130 ? '#16a34a' : p.score >= 80 ? '#eab308' : '#dc2626') : '#d1d5db'} stroke="white" strokeWidth={2} />
                                <text x={p.x} y={p.y - 10} fontSize={10} fontWeight={700} fill="var(--primary-dark)" textAnchor="middle">{p.score ?? '—'}</text>
                              </>
                            )}
                            <text x={p.x} y={svgH - 4} fontSize={annees.length > 1 ? 7 : 9} fontWeight={600} fill="#64748b" textAnchor="middle">{p.label}</text>
                          </g>
                        ))}
                      </svg>
                    </div>
                    {/* Courbe Compréhension QCM */}
                    {hasQcm && (
                      <div style={{ background: 'var(--bg-gray)', borderRadius: 14, padding: '12px 12px 8px', marginTop: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316', marginBottom: 4, textAlign: 'center' }}>Compréhension (/6)</div>
                        <svg width={svgW} height={qcmSvgH} viewBox={`0 0 ${svgW} ${qcmSvgH}`} style={{ display: 'block', margin: '0 auto' }}>
                          {[0, 2, 4, 6].map(q => {
                            const y = qcmToY(q)
                            return <g key={q}>
                              <line x1={padX} x2={svgW - padX} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
                              <text x={padX - 4} y={y + 4} fontSize={9} fill="#94a3b8" textAnchor="end">{q}</text>
                            </g>
                          })}
                          {qcmPolyline && <polyline points={qcmPolyline} fill="none" stroke="#f97316" strokeWidth={2.5} strokeLinejoin="round" />}
                          {qcmPoints.map((p, i) => (
                            <g key={i}>
                              {p.qcm != null && p.y != null && (
                                <>
                                  <circle cx={p.x} cy={p.y} r={5} fill={p.qcm >= 4 ? '#16a34a' : p.qcm >= 2 ? '#f97316' : '#dc2626'} stroke="white" strokeWidth={2} />
                                  <text x={p.x} y={p.y - 8} fontSize={10} fontWeight={700} fill={p.qcm >= 4 ? '#16a34a' : p.qcm >= 2 ? '#f97316' : '#dc2626'} textAnchor="middle">{p.qcm}/6</text>
                                </>
                              )}
                              <text x={p.x} y={qcmSvgH - 4} fontSize={annees.length > 1 ? 7 : 9} fontWeight={600} fill="#64748b" textAnchor="middle">{p.label}</text>
                            </g>
                          ))}
                        </svg>
                      </div>
                    )}
                  </div>
                )}

                {/* Détail par période */}
                <div style={{ padding: '0 28px 24px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Détail par période
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {evo.map((e, idx) => {
                      const prev = idx > 0 ? evo[idx - 1].score : null
                      const diff = e.score != null && prev != null ? e.score - prev : null
                      const showAnnee = annees.length > 1 && (idx === 0 || e.annee !== evo[idx - 1].annee)
                      return (
                        <div key={`${e.annee}-${e.code}`}>
                          {showAnnee && (
                            <div style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', marginBottom: 4, marginTop: idx > 0 ? 6 : 0, padding: '3px 8px', background: 'rgba(37,99,235,0.06)', borderRadius: 6, display: 'inline-block' }}>
                              {e.annee}
                            </div>
                          )}
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px', borderRadius: 8,
                            background: e.score != null ? (e.score >= 130 ? '#f0fdf4' : e.score >= 80 ? '#fefce8' : '#fef2f2') : e.absent ? '#fef2f2' : '#fff7ed',
                            border: `1px solid ${e.score != null ? (e.score >= 130 ? '#bbf7d0' : e.score >= 80 ? '#fde68a' : '#fecaca') : '#fecaca'}`,
                          }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary-dark)' }}>{e.code}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {diff != null && (
                                <span style={{ fontSize: 11, fontWeight: 700, color: diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#94a3b8' }}>
                                  {diff > 0 ? '+' : ''}{diff}
                                </span>
                              )}
                              {e.qcm != null && (
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                                  background: e.qcm >= 4 ? '#fff7ed' : '#fef2f2', color: '#f97316',
                                }}>{e.qcm}/6</span>
                              )}
                              <span style={{ fontSize: 16, fontWeight: 800, color: e.score != null ? (e.score >= 130 ? '#16a34a' : e.score >= 80 ? '#a16207' : '#dc2626') : '#dc2626' }}>
                                {e.ne ? 'N.É.' : e.absent ? 'Abs.' : e.score ?? '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </>
          )
        })()}
      </main>
    </div>
  )
}
