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
  evolution: { code: string; annee: string; score: number | null; ne: boolean; absent: boolean }[]
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
  const [openEleve, setOpenEleve] = useState<string | null>(null)

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
      .select('eleve_id, score, non_evalue, absent, periode:periodes(code, annee_scolaire)')
      .in('eleve_id', tousEleves.map(e => e.id))

    // Construire la map période courante + évolution complète multi-années
    const passMap: Record<string, { score: number | null; non_evalue: boolean; absent: boolean }> = {}
    const evoMap: Record<string, { code: string; annee: string; score: number | null; ne: boolean; absent: boolean }[]> = {}
    for (const p of (passData || []) as any[]) {
      const code = p.periode?.code
      const annee = p.periode?.annee_scolaire || ''
      if (!code) continue
      if (code === periodeCode) {
        passMap[p.eleve_id] = { score: p.score, non_evalue: p.non_evalue, absent: p.absent }
      }
      if (!evoMap[p.eleve_id]) evoMap[p.eleve_id] = []
      evoMap[p.eleve_id].push({ code, annee, score: p.score, ne: p.non_evalue, absent: p.absent })
    }
    // Trier par année puis par T1<T2<T3
    const prio = (c: string) => { const m = c.match(/^T(\d)/); return m ? parseInt(m[1]) : 99 }
    for (const arr of Object.values(evoMap)) arr.sort((a, b) => a.annee.localeCompare(b.annee) || prio(a.code) - prio(b.code))

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
                      const evo = eleve.evolution?.filter(e => /^T\d/.test(e.code)) || []
                      const scores = evo.filter(e => e.score != null).map(e => e.score!)
                      const progression = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : null
                      return (
                        <button key={eleve.id} onClick={() => setOpenEleve(openEleve === eleve.id ? null : eleve.id)} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 24px', width: '100%', border: 'none', cursor: 'pointer',
                          borderBottom: i < classe.eleves.length - 1 ? '1px solid var(--border-light)' : 'none',
                          background: openEleve === eleve.id ? 'rgba(37,99,235,0.06)' : eleve.statut === 'evalue' ? 'transparent' : cfg.bg,
                          transition: 'background 0.1s', textAlign: 'left',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--primary-dark)' }}>
                              <strong>{eleve.nom}</strong> {eleve.prenom}
                            </span>
                            {evo.length > 1 && (
                              <div style={{ display: 'flex', gap: 3, marginLeft: 6 }}>
                                {evo.map((e, idx) => (
                                  <span key={`${e.annee}-${e.code}`} style={{
                                    fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                                    background: e.score != null ? (e.score >= 130 ? '#dcfce7' : e.score >= 80 ? '#fef9c3' : '#fef2f2') : '#f3f4f6',
                                    color: e.score != null ? (e.score >= 130 ? '#16a34a' : e.score >= 80 ? '#a16207' : '#dc2626') : '#94a3b8',
                                  }}>{e.score ?? '—'}</span>
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
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: cfg.color, minWidth: 70, textAlign: 'right' }}>
                              {eleve.statut === 'evalue' ? `${eleve.score} m/min` : cfg.label}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {/* ── Drawer latéral fiche élève ── */}
        {openEleve && (() => {
          const eleve = classes.flatMap(c => c.eleves).find(e => e.id === openEleve)
          if (!eleve) return null
          const evo = (eleve.evolution || []).filter(e => /^T\d/.test(e.code))
          const scores = evo.filter(e => e.score != null).map(e => e.score!)
          const progression = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : null
          const maxS = Math.max(...scores, 1)
          const minS = Math.min(...scores, 0)
          const range = Math.max(maxS - minS, 20)
          const annees = [...new Set(evo.map(e => e.annee))].sort()
          const shortAnnee = (a: string) => a ? a.replace(/^20(\d\d)-20(\d\d)$/, '$1-$2') : ''

          // SVG courbe — absent/NÉ = carré rouge à la hauteur du score précédent
          const svgW = 320, svgH = 160, padX = 30, padY = 20
          const plotW = svgW - padX * 2, plotH = svgH - padY * 2
          const scoreToY = (s: number) => padY + plotH - ((s - minS + 10) / (range + 20)) * plotH
          let lastScore: number | null = null
          const points = evo.map((e, i) => {
            const hasScore = e.score != null
            // Pour absent/NÉ : utiliser le score précédent pour le Y
            const displayScore = hasScore ? e.score! : lastScore
            const y = displayScore != null ? scoreToY(displayScore) : padY + plotH
            if (hasScore) lastScore = e.score
            return {
              x: padX + (evo.length > 1 ? (i / (evo.length - 1)) * plotW : plotW / 2),
              y, score: e.score, displayScore, code: e.code, annee: e.annee, ne: e.ne, absent: e.absent,
              isMissing: !hasScore && (e.ne || e.absent),
              label: `${e.code}${annees.length > 1 ? ' ' + shortAnnee(e.annee) : ''}`,
            }
          })
          // Polyline inclut les points manquants (à la hauteur du précédent) pour continuité
          const polyline = points.filter(p => p.displayScore != null).map(p => `${p.x},${p.y}`).join(' ')

          return (
            <>
              <div onClick={() => setOpenEleve(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 998 }} />
              <div style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, background: 'white', zIndex: 999,
                boxShadow: '-8px 0 32px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column',
                fontFamily: 'var(--font-sans)', overflowY: 'auto',
              }}>
                {/* Header */}
                <div style={{ padding: '24px 28px 16px', borderBottom: '1.5px solid var(--border-light)' }}>
                  <button onClick={() => setOpenEleve(null)} style={{ float: 'right', background: 'none', border: 'none', fontSize: 20, color: 'var(--text-tertiary)', cursor: 'pointer' }}>✕</button>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Fiche élève</div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary-dark)', margin: 0 }}>{eleve.nom} {eleve.prenom}</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {classes.find(c => c.eleves.some(e => e.id === openEleve))?.nom?.replace('[TEST] ', '')}
                  </p>
                </div>

                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: '16px 28px' }}>
                  <div style={{ background: 'rgba(0,24,69,0.04)', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary-dark)' }}>{eleve.score ?? '—'}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>Score actuel</div>
                  </div>
                  <div style={{ background: progression !== null && progression > 0 ? 'rgba(22,163,74,0.06)' : 'rgba(0,24,69,0.04)', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: progression !== null ? (progression > 0 ? '#16a34a' : '#dc2626') : 'var(--text-tertiary)' }}>
                      {progression !== null ? `${progression > 0 ? '+' : ''}${progression}` : '—'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>Progression</div>
                  </div>
                  <div style={{ background: 'rgba(37,99,235,0.06)', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#2563eb' }}>{evo.length}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>Passations</div>
                  </div>
                </div>

                {/* Courbe SVG */}
                {evo.length > 0 && (
                  <div style={{ padding: '8px 28px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      Courbe d'évolution
                    </div>
                    <div style={{ background: 'var(--bg-gray)', borderRadius: 14, padding: '16px 12px' }}>
                      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: 'block', margin: '0 auto' }}>
                        {/* Grille horizontale */}
                        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                          const y = padY + plotH * (1 - pct)
                          const val = Math.round(minS - 10 + (range + 20) * pct)
                          return <g key={pct}>
                            <line x1={padX} x2={svgW - padX} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
                            <text x={padX - 4} y={y + 4} fontSize={9} fill="#94a3b8" textAnchor="end">{val}</text>
                          </g>
                        })}
                        {/* Courbe */}
                        {polyline && <polyline points={polyline} fill="none" stroke="#2563eb" strokeWidth={2.5} strokeLinejoin="round" />}
                        {/* Points + labels */}
                        {points.map((p, i) => (
                          <g key={i}>
                            {p.isMissing ? (
                              <>
                                {/* Carré rouge pour absent / NÉ */}
                                <rect x={p.x - 12} y={p.y - 10} width={24} height={20} rx={4} fill="#dc2626" stroke="white" strokeWidth={2} />
                                <text x={p.x} y={p.y + 4} fontSize={8} fontWeight={800} fill="white" textAnchor="middle">
                                  {p.absent ? 'ABS' : 'NÉ'}
                                </text>
                              </>
                            ) : (
                              <>
                                {/* Point normal coloré */}
                                <circle cx={p.x} cy={p.y} r={5} fill={p.score != null ? (p.score >= 130 ? '#16a34a' : p.score >= 80 ? '#eab308' : '#dc2626') : '#d1d5db'} stroke="white" strokeWidth={2} />
                                <text x={p.x} y={p.y - 10} fontSize={11} fontWeight={700} fill="var(--primary-dark)" textAnchor="middle">
                                  {p.score ?? '—'}
                                </text>
                              </>
                            )}
                            <text x={p.x} y={svgH - 4} fontSize={annees.length > 1 ? 8 : 10} fontWeight={600} fill="#64748b" textAnchor="middle">{p.label}</text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  </div>
                )}

                {/* Détail par période */}
                <div style={{ padding: '0 28px 24px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Détail par période
                  </div>
                  {evo.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Aucune passation</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {evo.map((e, idx) => {
                        const prev = idx > 0 ? evo[idx - 1].score : null
                        const diff = e.score != null && prev != null ? e.score - prev : null
                        const showAnneeHeader = annees.length > 1 && (idx === 0 || e.annee !== evo[idx - 1].annee)
                        return (
                          <div key={`${e.annee}-${e.code}`}>
                          {showAnneeHeader && (
                            <div style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', marginBottom: 6, marginTop: idx > 0 ? 8 : 0, padding: '4px 10px', background: 'rgba(37,99,235,0.06)', borderRadius: 6, display: 'inline-block' }}>
                              {e.annee}
                            </div>
                          )}
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 14px', borderRadius: 10,
                            background: e.score != null ? (e.score >= 130 ? '#f0fdf4' : e.score >= 80 ? '#fefce8' : '#fef2f2') : '#f8fafc',
                            border: `1px solid ${e.score != null ? (e.score >= 130 ? '#bbf7d0' : e.score >= 80 ? '#fde68a' : '#fecaca') : '#e2e8f0'}`,
                          }}>
                            <div>
                              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--primary-dark)' }}>{e.code}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {diff !== null && (
                                <span style={{ fontSize: 12, fontWeight: 700, color: diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#94a3b8' }}>
                                  {diff > 0 ? '+' : ''}{diff}
                                </span>
                              )}
                              <span style={{
                                fontSize: 18, fontWeight: 800,
                                color: e.score != null ? (e.score >= 130 ? '#16a34a' : e.score >= 80 ? '#a16207' : '#dc2626') : '#94a3b8',
                              }}>
                                {e.ne ? 'N.É.' : e.absent ? 'Abs.' : e.score != null ? `${e.score}` : '—'}
                              </span>
                              {e.score != null && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>m/min</span>}
                            </div>
                          </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )
        })()}
      </main>
    </div>
  )
}
