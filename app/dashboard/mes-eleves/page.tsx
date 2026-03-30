'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'
import type { Periode } from '@/app/lib/types'

type EleveStatut = 'evalue' | 'ne' | 'absent' | 'non_renseigne'

type EleveRow = {
  id: string
  nom: string
  prenom: string
  statut: EleveStatut
  score: number | null
  evolution: { code: string; score: number | null; ne: boolean; absent: boolean }[]
}

type ClasseGroup = {
  id: string
  nom: string
  niveau: string
  eleves: EleveRow[]
}

export default function MesEleves() {
  const [classes, setClasses]     = useState<ClasseGroup[]>([])
  const [periodes, setPeriodes]   = useState<Periode[]>([])
  const [periodeCode, setPeriodeCode] = useState<string>('')
  const [loading, setLoading]     = useState(true)
  const { profil, profilReel, loading: profilLoading } = useProfil()
  const router = useRouter()
  const supabase = createClient()
  const loadedRef = useRef<string | null>(null)

  useEffect(() => {
    if (profilLoading || !profil) return
    // Si admin/ia_dasen/recteur → attendre l'impersonation (ne pas rediriger tout de suite)
    const canImpersonate = profilReel && ['admin', 'ia_dasen', 'recteur'].includes(profilReel.role)
    if (profil.role !== 'enseignant') {
      if (canImpersonate) return // attendre que l'impersonation hydrate
      router.push('/dashboard'); return
    }
    if (loadedRef.current === profil.id) return
    loadedRef.current = profil.id
    charger()
  }, [profil, profilLoading])

  useEffect(() => {
    if (profil && periodeCode && classes.length > 0) chargerPassations()
  }, [periodeCode, classes])

  async function charger() {
    if (!profil) return

    // Classes de l'enseignant
    const { data: assignees } = await supabase
      .from('enseignant_classes')
      .select('classe_id, classe:classes(id, nom, niveau, etablissement_id)')
      .eq('enseignant_id', profil.id)

    const classesList = (assignees || []).map((a: any) => a.classe).filter(Boolean)
    if (classesList.length === 0) { setLoading(false); return }

    // Élèves de toutes ces classes
    const classeIds = classesList.map((c: any) => c.id)
    const { data: elevesData } = await supabase
      .from('eleves')
      .select('id, nom, prenom, classe_id')
      .in('classe_id', classeIds)
      .eq('actif', true)
      .order('nom')

    // Périodes (depuis le premier établissement)
    const etabId = classesList[0]?.etablissement_id
    if (etabId) {
      const { data: rawPer } = await supabase
        .from('periodes').select('id, code, label')
        .eq('etablissement_id', etabId).eq('actif', true).order('code')
      const seen = new Set<string>()
      const perDedup: Periode[] = []
      for (const p of (rawPer || [])) {
        if (!seen.has(p.code)) { seen.add(p.code); perDedup.push(p) }
      }
      // Trier T1, T2, T3 en premier
      const prio = (c: string) => { const m = c.match(/^T(\d)/); return m ? parseInt(m[1]) : 99 }
      perDedup.sort((a, b) => prio(a.code) - prio(b.code))
      setPeriodes(perDedup)
      // Sélectionner la dernière période T* par défaut
      if (!periodeCode) {
        const lastT = [...perDedup].reverse().find(p => /^T\d/.test(p.code))
        if (lastT) setPeriodeCode(lastT.code)
        else if (perDedup[0]) setPeriodeCode(perDedup[0].code)
      }
    }

    // Construire les groupes par classe (sans passations pour l'instant)
    const groupes: ClasseGroup[] = classesList.map((c: any) => ({
      id: c.id, nom: c.nom, niveau: c.niveau,
      eleves: (elevesData || [])
        .filter((e: any) => e.classe_id === c.id)
        .map((e: any) => ({ id: e.id, nom: e.nom, prenom: e.prenom, statut: 'non_renseigne' as EleveStatut, score: null, evolution: [] }))
    }))
    setClasses(groupes)
    setLoading(false)
  }

  async function chargerPassations() {
    if (!profil || classes.length === 0) return
    const tousEleves = classes.flatMap(c => c.eleves)
    if (tousEleves.length === 0) return

    const { data: passData } = await supabase
      .from('passations')
      .select('eleve_id, score, non_evalue, absent, periode:periodes(code)')
      .in('eleve_id', tousEleves.map(e => e.id))

    // Construire la map période courante + évolution complète
    const passMap: Record<string, { score: number | null; non_evalue: boolean; absent: boolean }> = {}
    const evoMap: Record<string, { code: string; score: number | null; ne: boolean; absent: boolean }[]> = {}
    for (const p of (passData || []) as any[]) {
      const code = p.periode?.code
      if (!code) continue
      if (code === periodeCode) {
        passMap[p.eleve_id] = { score: p.score, non_evalue: p.non_evalue, absent: p.absent }
      }
      if (!evoMap[p.eleve_id]) evoMap[p.eleve_id] = []
      evoMap[p.eleve_id].push({ code, score: p.score, ne: p.non_evalue, absent: p.absent })
    }
    // Trier l'évolution par code période
    const prio = (c: string) => { const m = c.match(/^T(\d)/); return m ? parseInt(m[1]) : 99 }
    for (const arr of Object.values(evoMap)) arr.sort((a, b) => prio(a.code) - prio(b.code))

    setClasses(prev => prev.map(c => ({
      ...c,
      eleves: c.eleves.map(e => {
        const p = passMap[e.id]
        const evolution = evoMap[e.id] || []
        if (!p) return { ...e, statut: 'non_renseigne' as EleveStatut, score: null, evolution }
        if (p.absent) return { ...e, statut: 'absent' as EleveStatut, score: null, evolution }
        if (p.non_evalue) return { ...e, statut: 'ne' as EleveStatut, score: null, evolution }
        return { ...e, statut: 'evalue' as EleveStatut, score: p.score, evolution }
      })
    })))
  }

  const statutConfig: Record<EleveStatut, { label: string; bg: string; color: string }> = {
    evalue:        { label: '',      bg: '#f0fdf4', color: '#16a34a' },
    ne:            { label: 'N.É.',  bg: '#fff7ed', color: '#c2410c' },
    absent:        { label: 'Abs.',  bg: '#fef2f2', color: '#dc2626' },
    non_renseigne: { label: '—',     bg: 'var(--bg-gray)', color: 'var(--text-tertiary)' },
  }

  if (loading) return (
    <>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar-width)', padding: 48, color: 'var(--text-tertiary)', fontSize: 14 }}>Chargement...</div>
    </>
  )

  const [openEleve, setOpenEleve] = useState<string | null>(null)
  const totalEleves  = classes.reduce((n, c) => n + c.eleves.length, 0)
  const totalEvalues = classes.reduce((n, c) => n + c.eleves.filter(e => e.statut === 'evalue').length, 0)

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <ImpersonationBar />
      <main style={{ marginLeft: 'var(--sidebar-width)', flex: 1, padding: 48, background: 'var(--bg-gray)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>Mes élèves</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 15, fontFamily: 'var(--font-sans)' }}>
              {totalEvalues} / {totalEleves} élèves évalués
              {periodeCode ? ` · ${periodeCode}` : ''}
            </p>
          </div>

          {/* Sélecteur période */}
          {periodes.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              {periodes.map(p => (
                <button key={p.code} onClick={() => setPeriodeCode(p.code)}
                  style={{
                    padding: '8px 18px', borderRadius: 10, fontWeight: 700, fontSize: 14,
                    fontFamily: 'var(--font-sans)', cursor: 'pointer', transition: 'all 0.15s',
                    background: periodeCode === p.code ? 'var(--primary-dark)' : 'white',
                    color: periodeCode === p.code ? 'white' : 'var(--text-secondary)',
                    border: periodeCode === p.code ? '1.5px solid var(--primary-dark)' : '1.5px solid var(--border-light)',
                  }}>
                  {p.code}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Classes */}
        {classes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>
            Aucune classe assignée
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {classes.map(classe => {
              const nbEval    = classe.eleves.filter(e => e.statut === 'evalue').length
              const nbNE      = classe.eleves.filter(e => e.statut === 'ne').length
              const nbAbsent  = classe.eleves.filter(e => e.statut === 'absent').length
              const nbNR      = classe.eleves.filter(e => e.statut === 'non_renseigne').length
              const pctEval   = classe.eleves.length > 0 ? Math.round(nbEval / classe.eleves.length * 100) : 0

              return (
                <div key={classe.id} style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', overflow: 'hidden' }}>
                  {/* En-tête classe */}
                  <div style={{ padding: '16px 24px', borderBottom: '1.5px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: 17, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)' }}>{classe.nom}</span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 13, marginLeft: 10, fontFamily: 'var(--font-sans)' }}>{classe.niveau}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                      <span style={{ color: '#16a34a', fontWeight: 700 }}>{nbEval} éval.</span>
                      {nbNE > 0 && <span style={{ color: '#c2410c', fontWeight: 700 }}>{nbNE} N.É.</span>}
                      {nbAbsent > 0 && <span style={{ color: '#dc2626', fontWeight: 700 }}>{nbAbsent} abs.</span>}
                      {nbNR > 0 && <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>{nbNR} en attente</span>}
                      <span style={{ color: 'var(--text-tertiary)', background: 'var(--bg-gray)', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>{pctEval}%</span>
                    </div>
                  </div>

                  {/* Barre de progression */}
                  <div style={{ height: 4, background: 'var(--border-light)' }}>
                    <div style={{ height: 4, background: '#16a34a', width: `${pctEval}%`, transition: 'width 0.3s' }} />
                  </div>

                  {/* Liste élèves */}
                  <div style={{ padding: '4px 0' }}>
                    {classe.eleves.map((eleve, i) => {
                      const cfg = statutConfig[eleve.statut]
                      const isOpen = openEleve === eleve.id
                      const evo = eleve.evolution || []
                      // Progression entre premières et dernière passation
                      const scores = evo.filter(e => e.score != null).map(e => e.score!)
                      const progression = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : null
                      return (
                        <div key={eleve.id}>
                          <button onClick={() => setOpenEleve(isOpen ? null : eleve.id)} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 24px', width: '100%', border: 'none', cursor: 'pointer',
                            borderBottom: (i < classe.eleves.length - 1 && !isOpen) ? '1px solid var(--border-light)' : 'none',
                            background: isOpen ? 'rgba(0,24,69,0.03)' : eleve.statut === 'evalue' ? 'transparent' : cfg.bg,
                            transition: 'background 0.1s', textAlign: 'left',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--primary-dark)' }}>
                                <strong>{eleve.nom}</strong> {eleve.prenom}
                              </span>
                              {/* Mini évolution inline */}
                              {evo.length > 1 && (
                                <div style={{ display: 'flex', gap: 3, marginLeft: 8 }}>
                                  {evo.filter(e => /^T\d/.test(e.code)).map(e => (
                                    <span key={e.code} style={{
                                      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                                      background: e.score != null ? (e.score >= 130 ? '#dcfce7' : e.score >= 80 ? '#fef9c3' : '#fef2f2') : '#f3f4f6',
                                      color: e.score != null ? (e.score >= 130 ? '#16a34a' : e.score >= 80 ? '#a16207' : '#dc2626') : '#94a3b8',
                                      fontFamily: 'var(--font-sans)',
                                    }}>{e.score ?? '—'}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {progression !== null && (
                                <span style={{
                                  fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-sans)',
                                  color: progression > 0 ? '#16a34a' : progression < 0 ? '#dc2626' : '#94a3b8',
                                }}>
                                  {progression > 0 ? '+' : ''}{progression}
                                </span>
                              )}
                              <span style={{
                                fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700,
                                color: cfg.color, minWidth: 70, textAlign: 'right',
                              }}>
                                {eleve.statut === 'evalue' ? `${eleve.score} m/min` : cfg.label}
                              </span>
                            </div>
                          </button>
                          {/* Panel évolution dépliable */}
                          {isOpen && (
                            <div style={{ padding: '12px 24px 16px 48px', background: 'rgba(0,24,69,0.02)', borderBottom: '1px solid var(--border-light)' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 10, fontFamily: 'var(--font-sans)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                                Évolution
                              </div>
                              {evo.length === 0 ? (
                                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>Aucune passation enregistrée</p>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0 }}>
                                  {evo.filter(e => /^T\d/.test(e.code)).map((e, idx, arr) => {
                                    const maxScore = Math.max(...arr.filter(x => x.score != null).map(x => x.score!), 1)
                                    const barH = e.score != null ? Math.max(8, (e.score / maxScore) * 80) : 8
                                    const prev = idx > 0 ? arr[idx - 1].score : null
                                    const diff = e.score != null && prev != null ? e.score - prev : null
                                    return (
                                      <div key={e.code} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 70 }}>
                                        {/* Score */}
                                        <span style={{
                                          fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-sans)', marginBottom: 4,
                                          color: e.score != null ? (e.score >= 130 ? '#16a34a' : e.score >= 80 ? '#a16207' : '#dc2626') : '#94a3b8',
                                        }}>
                                          {e.ne ? 'N.É.' : e.absent ? 'Abs.' : e.score ?? '—'}
                                        </span>
                                        {/* Barre */}
                                        <div style={{
                                          width: 32, height: barH, borderRadius: '6px 6px 0 0',
                                          background: e.score != null ? (e.score >= 130 ? '#16a34a' : e.score >= 80 ? '#eab308' : '#dc2626') : '#e2e8f0',
                                          transition: 'height 0.3s',
                                        }} />
                                        {/* Période */}
                                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginTop: 6, fontFamily: 'var(--font-sans)' }}>{e.code}</span>
                                        {/* Diff */}
                                        {diff !== null && (
                                          <span style={{ fontSize: 10, fontWeight: 700, color: diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#94a3b8', fontFamily: 'var(--font-sans)' }}>
                                            {diff > 0 ? '+' : ''}{diff}
                                          </span>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
