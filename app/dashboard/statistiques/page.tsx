'use client'

import { useEffect, useRef, useState } from 'react'
import { Suspense } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'
import styles from './statistiques.module.css'
import type { Classe, Periode, Norme } from '@/app/lib/types'
import { classerEleve as _classerEleve } from '@/app/lib/fluenceUtils'

// ── Types ──────────────────────────────────────────────────────────────────

type PassData = {
  score:  number | null
  ne:     boolean
  comp:   number            // 0-100 ou -1 si non renseigné
  qs:     (boolean | null)[] // Q1-Q6 : true=Correct, false=Incorrect, null=non renseigné
  mode:   string
  groupe: 1 | 2 | 3 | 4 | null
}

type EleveRow = {
  id:     string
  nom:    string
  prenom: string
  data:   Record<string, PassData>  // code_periode → data
}

type StatPeriode = {
  id:         string
  code:       string
  label:      string
  moyenne:    number | null
  min:        number | null
  max:        number | null
  nbEvalues:  number
  nbNE:       number
  nbAbsent:   number
  nbNR:       number
  g1: number; g2: number; g3: number; g4: number
  compQ: { pct: number; n: number; total: number }[]
}

type EtabReseauStat = {
  id: string
  nom: string
  type_reseau?: string
  nbEleves: number
  nbEvalues: number
  nbNE: number
  nbNR: number
  moyenne: number | null
  g1: number; g2: number; g3: number; g4: number
}

type NiveauReseauStat = {
  niveau: string
  nbEleves: number
  nbEvalues: number
  moyenne: number | null
  g1: number; g2: number; g3: number; g4: number
}

// ── Constants ─────────────────────────────────────────────────────────────

const GROUPES = [
  { id: 1, label: 'Très fragile',     color: '#DC2626', bg: 'rgba(220,38,38,0.08)'  },
  { id: 2, label: 'Fragile',          color: '#D97706', bg: 'rgba(217,119,6,0.08)'  },
  { id: 3, label: "En cours d'acq.", color: '#2563EB', bg: 'rgba(37,99,235,0.08)'  },
  { id: 4, label: 'Attendu',          color: '#16A34A', bg: 'rgba(22,163,74,0.08)'  },
]

// ── Helpers ───────────────────────────────────────────────────────────────

function classerEleve(score: number, norme: Norme | undefined): 1 | 2 | 3 | 4 {
  if (!norme) return 4
  return _classerEleve(score, norme)
}

function calcCompPct(qs: (string | null)[]): number {
  const filled = qs.filter(q => q !== null)
  if (filled.length === 0) return -1
  return Math.round(filled.filter(q => q === 'Correct').length / filled.length * 100)
}

function compColor(pct: number): { color: string; background: string } {
  if (pct >= 70) return { color: '#16A34A', background: 'rgba(22,163,74,0.08)' }
  if (pct >= 40) return { color: '#B45309', background: 'rgba(217,119,6,0.08)' }
  return { color: '#DC2626', background: 'rgba(220,38,38,0.08)' }
}

// ── SVG Courbe de progression ─────────────────────────────────────────────

function LineChart({ scores, codes }: { scores: (number | null)[]; codes: string[] }) {
  const W = 400, H = 110, PAD = 22
  const valid = scores.filter(s => s !== null) as number[]
  if (valid.length < 2) return null

  const minV = Math.min(...valid)
  const maxV = Math.max(...valid)
  const range = maxV - minV || 1

  const pts = scores.map((s, i) => ({
    x: PAD + (i / (scores.length - 1)) * (W - 2 * PAD),
    y: s !== null ? H - PAD - ((s - minV) / range) * (H - 2 * PAD) : null,
    v: s,
    code: codes[i],
  }))

  const validPts = pts.filter(p => p.y !== null) as { x: number; y: number; v: number; code: string }[]
  const path = validPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 110 }}>
      <path d={path} fill="none" stroke="var(--accent-gold)" strokeWidth={2.5} strokeLinejoin="round" />
      {validPts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="var(--accent-gold)" />
          <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize={11} fill="var(--primary-dark)" fontWeight={700}>
            {p.v}
          </text>
        </g>
      ))}
      {pts.map((p, i) => (
        <text key={i} x={p.x} y={H - 3} textAnchor="middle" fontSize={10} fill="var(--text-secondary)">
          {p.code}
        </text>
      ))}
    </svg>
  )
}

// ── Modal Fiche Élève ─────────────────────────────────────────────────────

function FicheEleve({
  eleve, periodes, onClose,
}: {
  eleve:    EleveRow
  periodes: Periode[]
  onClose:  () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const scores = periodes.map(p => (eleve.data[p.code] && !eleve.data[p.code].ne) ? (eleve.data[p.code].score ?? null) : null)
  const codes  = periodes.map(p => p.code)

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalSheet} onClick={e => e.stopPropagation()}>

        {/* En-tête */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalName}>{eleve.prenom} {eleve.nom}</h2>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        {/* Courbe de progression */}
        {scores.filter(s => s !== null).length >= 2 && (
          <div className={styles.modalSection}>
            <div className={styles.modalSectionTitle}>Progression</div>
            <LineChart scores={scores} codes={codes} />
          </div>
        )}

        {/* Détail par période */}
        <div className={styles.modalSection}>
          <div className={styles.modalSectionTitle}>Détail par période</div>
          {periodes.map(p => {
            const d = eleve.data[p.code]
            const g = d?.groupe ? GROUPES[d.groupe - 1] : null

            if (!d) {
              return (
                <div key={p.code} className={styles.modalPeriodeRow}>
                  <span className={styles.modalPeriodeBadge}>{p.code}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Non renseigné</span>
                </div>
              )
            }

            return (
              <div key={p.code} className={styles.modalPeriodeCard}>
                {/* Score + groupe */}
                <div className={styles.modalPeriodeCardHeader}>
                  <span className={styles.modalPeriodeBadge}>{p.code}</span>
                  {d.ne ? (
                    <span style={{ background: '#FFF7ED', color: '#C2410C', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6 }}>
                      Non évalué
                    </span>
                  ) : d.score !== null ? (
                    <>
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--primary-dark)', lineHeight: 1 }}>
                        {d.score}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>mots/min</span>
                      {g && (
                        <span style={{ background: g.bg, color: g.color, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6 }}>
                          {g.label}
                        </span>
                      )}
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>—</span>
                  )}
                  <span style={{ marginLeft: 'auto', background: 'var(--bg-gray)', color: 'var(--text-secondary)', fontSize: 11, padding: '2px 8px', borderRadius: 6 }}>
                    {d.mode === 'passation' ? '🎯 Passation' : '✏️ Saisie'}
                  </span>
                </div>

                {/* Compréhension */}
                {d.comp >= 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Compréhension</span>
                      <span style={{ ...compColor(d.comp), padding: '2px 9px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                        {d.comp}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {d.qs.map((q, i) =>
                        q !== null ? (
                          <span key={i} style={{
                            background: q ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.08)',
                            color:      q ? '#16A34A' : '#DC2626',
                            fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6,
                          }}>Q{i + 1} {q ? '✓' : '✗'}</span>
                        ) : (
                          <span key={i} style={{ background: 'var(--bg-gray)', color: 'var(--text-tertiary)', fontSize: 11, padding: '3px 9px', borderRadius: 6 }}>
                            Q{i + 1} —
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Composant principal ────────────────────────────────────────────────────

function Statistiques() {
  const [classes,  setClasses]  = useState<Classe[]>([])
  const [periodes, setPeriodes] = useState<Periode[]>([])
  const [normes,   setNormes]   = useState<Norme[]>([])
  const [classeId, setClasseId] = useState('')
  const [eleves,   setEleves]   = useState<EleveRow[]>([])
  const [statsPer, setStatsPer] = useState<StatPeriode[]>([])
  const [loading,  setLoading]  = useState(true)
  const [calcul,   setCalcul]   = useState(false)

  // UI
  const [mode,           setMode]           = useState<'periode' | 'comparaison'>('periode')
  const [periodeActive,  setPeriodeActive]  = useState('')
  const [compPer1,       setCompPer1]       = useState('')
  const [compPer2,       setCompPer2]       = useState('')
  const [eleveModal,     setEleveModal]     = useState<EleveRow | null>(null)

  // Filtre niveau (direction)
  const [niveauFilter,   setNiveauFilter]   = useState<string>('tous')
  const [niveaux,        setNiveaux]        = useState<string[]>([])
  // Direction : vue établissement
  const [dirVue,         setDirVue]         = useState<'etablissement' | 'classe'>('etablissement')
  const [dirEtabStats,   setDirEtabStats]   = useState<{ classeId: string; classeNom: string; niveau: string; nbEleves: number; nbEvalues: number; moyenne: number | null; pctFragiles: number; groupes: number[] }[]>([])
  const [dirEtabPeriode, setDirEtabPeriode] = useState('')

  // Coordo réseau
  const [vueReseau,      setVueReseau]      = useState(false)
  const [viewMode,       setViewMode]       = useState<'reseau' | 'classe'>('reseau')
  const [reseauToggle,   setReseauToggle]   = useState<'etab' | 'niveau' | 'circo'>('etab')
  const [reseauRepFilter, setReseauRepFilter] = useState<'tous' | 'rep' | 'horsrep'>('tous')
  const [circosReseau,   setCircosReseau]   = useState<{ circo: string; nbEleves: number; nbEvalues: number; moyenne: number | null; g1: number; g2: number; g3: number; g4: number }[]>([])
  const [reseauPeriode,  setReseauPeriode]  = useState('')
  const [etabsReseau,    setEtabsReseau]    = useState<EtabReseauStat[]>([])
  const [niveauxReseau,  setNiveauxReseau]  = useState<NiveauReseauStat[]>([])
  const [coordoEtabs,    setCoordoEtabs]    = useState<{id: string; nom: string}[]>([])
  const [reseauLoading,  setReseauLoading]  = useState(false)

  // Recherche élève globale
  const [rechercheQuery,     setRechercheQuery]     = useState('')
  const [rechercheResultats, setRechercheResultats] = useState<{id: string; nom: string; prenom: string; classeNom: string; niveauClasse: string}[]>([])
  const [rechercheLoading,   setRechercheLoading]   = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { profil, loading: profilLoading } = useProfil()
  const supabase = createClient()

  useEffect(() => {
    if (!profilLoading && profil) init()
  }, [profil, profilLoading])

  useEffect(() => {
    if (classeId && periodes.length > 0) calculer().catch(() => setCalcul(false))
  }, [classeId])

  // ── Init ───────────────────────────────────────────────────────────────

  async function init() {
    if (!profil) return

    // Classes accessibles
    let classesData: Classe[] = []
    if (profil.role === 'enseignant') {
      const { data } = await supabase
        .from('enseignant_classes')
        .select('classe:classes(id, nom, niveau)')
        .eq('enseignant_id', profil.id)
      classesData = (data || []).map((r: any) => r.classe).filter(Boolean)
    } else {
      const q = supabase.from('classes').select('id, nom, niveau').order('niveau')
      const query = profil.etablissement_id ? q.eq('etablissement_id', profil.etablissement_id) : q
      const { data } = await query
      classesData = data || []
    }
    setClasses(classesData)
    const niveauxUniq = [...new Set((classesData as any[]).map((c: any) => c.niveau).filter(Boolean))].sort()
    setNiveaux(niveauxUniq)

    // Périodes — déduplication par code
    const { data: perData } = await supabase.from('periodes').select('id, code, label').order('code')
    const seen = new Set<string>()
    const per: Periode[] = (perData || []).filter(p => {
      if (seen.has(p.code)) return false
      seen.add(p.code)
      return true
    })
    setPeriodes(per)

    // Normes
    const { data: normesData } = await supabase
      .from('config_normes').select('niveau, periode_id, seuil_min, seuil_attendu')
    setNormes(normesData || [])

    // Coordo / IEN / IA-DASEN / Recteur : charger les établissements du réseau
    if (['coordo_rep', 'ien', 'ia_dasen', 'recteur'].includes(profil.role)) {
      let etabs: { id: string; nom: string }[]
      if (profil.role === 'ia_dasen' || profil.role === 'recteur') {
        const { data } = await supabase.from('etablissements').select('id, nom').order('nom')
        etabs = (data || []).map((e: any) => ({ id: e.id, nom: e.nom }))
      } else {
        const reseauTable = profil.role === 'ien' ? 'ien_etablissements' : 'coordo_etablissements'
        const reseauField = profil.role === 'ien' ? 'ien_id' : 'coordo_id'
        const { data: ceData } = await supabase
          .from(reseauTable)
          .select('etablissement_id, etablissement:etablissements(id, nom)')
          .eq(reseauField, profil.id)
        etabs = (ceData || []).map((ce: any) => ({
          id: ce.etablissement_id, nom: ce.etablissement?.nom || '—',
        }))
      }
      setCoordoEtabs(etabs)
      setVueReseau(true)
      const initCode = per[per.length - 1]?.code || ''
      setReseauPeriode(initCode)
      if (etabs.length > 0 && initCode) {
        await calculerReseau(etabs, initCode, normesData || [])
      }
    }

    if (classesData.length > 0) setClasseId(classesData[0].id)
    setLoading(false)
  }

  // ── Calcul ─────────────────────────────────────────────────────────────

  async function calculer() {
    setCalcul(true)
    const classeActuelle = classes.find(c => c.id === classeId)

    const { data: elevesData } = await supabase
      .from('eleves').select('id, nom, prenom')
      .eq('classe_id', classeId).eq('actif', true).order('nom')
    const listeEleves = elevesData || []
    const eleveIds = listeEleves.map(e => e.id)

    if (eleveIds.length === 0) {
      setEleves([]); setStatsPer([])
      setCalcul(false); return
    }

    const { data: passData } = await supabase
      .from('passations')
      .select('eleve_id, score, non_evalue, absent, q1, q2, q3, q4, q5, q6, mode, periode:periodes(id, code)')
      .in('eleve_id', eleveIds)
    const pass = (passData || []) as any[]

    // ── Lignes élèves ────────────────────────────────────────────────────
    const eleveRows: EleveRow[] = listeEleves.map(e => {
      const row: EleveRow = { id: e.id, nom: e.nom, prenom: e.prenom, data: {} }
      pass.filter(p => p.eleve_id === e.id).forEach(p => {
        const code = p.periode?.code
        const pid  = p.periode?.id
        if (!code) return
        const rawQs = [p.q1, p.q2, p.q3, p.q4, p.q5, p.q6]
        const norme  = normes.find(n => n.niveau === classeActuelle?.niveau && n.periode_id === pid)
        const groupe: 1 | 2 | 3 | 4 | null =
          (!p.non_evalue && p.score !== null) ? classerEleve(p.score, norme) : null
        row.data[code] = {
          score:  p.non_evalue ? null : p.score,
          ne:     !!p.non_evalue,
          comp:   calcCompPct(rawQs),
          qs:     rawQs.map((q: string | null) => q === null ? null : q === 'Correct'),
          mode:   p.mode || 'saisie',
          groupe,
        }
      })
      return row
    })
    setEleves(eleveRows)

    // ── Stats par période ────────────────────────────────────────────────
    const statsP: StatPeriode[] = periodes.map(per => {
      const passP       = pass.filter(p => p.periode?.code === per.code)
      const idsAvecPass = new Set(passP.map(p => p.eleve_id))
      const evalues     = passP.filter(p => !p.non_evalue && p.score !== null && p.score > 0)
      const ne          = passP.filter(p => p.non_evalue && !p.absent)
      const absents     = passP.filter(p => p.absent)
      const scores      = evalues.map(p => p.score as number)

      const norme = normes.find(n => n.niveau === classeActuelle?.niveau && n.periode_id === per.id)
      let g1 = 0, g2 = 0, g3 = 0, g4 = 0
      scores.forEach(s => {
        const g = classerEleve(s, norme)
        if (g === 1) g1++; else if (g === 2) g2++; else if (g === 3) g3++; else g4++
      })

      const compQ = ['q1','q2','q3','q4','q5','q6'].map(q => {
        const r = evalues.filter(p => p[q] !== null)
        const c = r.filter(p => p[q] === 'Correct').length
        return { pct: r.length > 0 ? Math.round(c / r.length * 100) : 0, n: c, total: r.length }
      })

      return {
        id: per.id, code: per.code, label: per.label,
        moyenne: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        min:     scores.length > 0 ? Math.min(...scores) : null,
        max:     scores.length > 0 ? Math.max(...scores) : null,
        nbEvalues: evalues.length, nbNE: ne.length, nbAbsent: absents.length,
        nbNR: eleveIds.length - idsAvecPass.size,
        g1, g2, g3, g4, compQ,
      }
    }).filter(s => s.nbEvalues + s.nbNE + s.nbAbsent > 0)

    setStatsPer(statsP)

    if (statsP.length > 0) {
      setPeriodeActive(statsP[statsP.length - 1].code)
      setCompPer1(statsP[0].code)
      setCompPer2(statsP[statsP.length - 1].code)
    }

    setCalcul(false)
  }

  // ── Statistiques réseau (coordo) ────────────────────────────────────────

  async function calculerEtablissement(periodeCode?: string) {
    if (!profil?.etablissement_id) return
    setReseauLoading(true)
    const { data: cls } = await supabase.from('classes').select('id, nom, niveau')
      .eq('etablissement_id', profil.etablissement_id).order('niveau')
    const classeIds = (cls || []).map(c => c.id)
    if (classeIds.length === 0) { setReseauLoading(false); return }

    const { data: elevesData } = await supabase.from('eleves').select('id, classe_id')
      .in('classe_id', classeIds).eq('actif', true)
    const eleveIds = (elevesData || []).map(e => e.id)

    const code = periodeCode || dirEtabPeriode || periodes[periodes.length - 1]?.code || ''
    if (!dirEtabPeriode && code) setDirEtabPeriode(code)

    const { data: periIds } = await supabase.from('periodes').select('id').eq('code', code).eq('actif', true)
    const allPeriIds = (periIds || []).map(p => p.id)

    let passData: any[] = []
    if (allPeriIds.length > 0 && eleveIds.length > 0) {
      const { data } = await supabase.from('passations').select('eleve_id, score, non_evalue').in('periode_id', allPeriIds).in('eleve_id', eleveIds)
      passData = data || []
    }

    const stats = (cls || []).map(c => {
      const elevesC = (elevesData || []).filter(e => e.classe_id === c.id)
      const idsC = new Set(elevesC.map(e => e.id))
      const passC = passData.filter(p => idsC.has(p.eleve_id))
      const evalues = passC.filter(p => !p.non_evalue && p.score > 0)
      const scores = evalues.map(p => p.score as number)
      const norme = normes.find(n => n.niveau === c.niveau)
      const fragiles = norme ? scores.filter(s => s < norme.seuil_min).length : 0
      const groupes = [0, 0, 0, 0]
      if (norme) {
        for (const s of scores) {
          const g = classerEleve(s, norme)
          groupes[g - 1]++
        }
      }
      return {
        classeId: c.id, classeNom: c.nom, niveau: c.niveau,
        nbEleves: elevesC.length, nbEvalues: evalues.length,
        moyenne: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        pctFragiles: evalues.length > 0 ? Math.round(fragiles / evalues.length * 100) : 0,
        groupes,
      }
    })
    setDirEtabStats(stats)
    setReseauLoading(false)
  }

  async function calculerReseau(
    etabsList: {id: string; nom: string}[],
    codeParam: string,
    normesParam: Norme[],
  ) {
    setReseauLoading(true)
    setReseauPeriode(codeParam)

    const etabIds = etabsList.map(e => e.id)
    const { data: perData } = await supabase.from('periodes').select('id').eq('code', codeParam)
    const periodeIds = (perData || []).map(p => p.id)

    const { data: classesData } = await supabase
      .from('classes').select('id, nom, niveau, etablissement_id')
      .in('etablissement_id', etabIds)
    const classeIds = (classesData || []).map((c: any) => c.id)
    const classeMap: Record<string, any> = {}
    ;(classesData || []).forEach((c: any) => { classeMap[c.id] = c })

    const { data: elevesData } = await supabase
      .from('eleves').select('id, classe_id')
      .in('classe_id', classeIds).eq('actif', true)
    const eleveIds = (elevesData || []).map((e: any) => e.id)
    const eleveToClasse: Record<string, any> = {}
    ;(elevesData || []).forEach((e: any) => { eleveToClasse[e.id] = classeMap[e.classe_id] })

    let passData: any[] = []
    if (periodeIds.length > 0 && eleveIds.length > 0) {
      const { data } = await supabase
        .from('passations').select('eleve_id, score, non_evalue')
        .in('periode_id', periodeIds).in('eleve_id', eleveIds)
      passData = data || []
    }

    // Charger type_reseau pour filtre REP
    const { data: etabsTypeData } = await supabase.from('etablissements').select('id, type_reseau').in('id', etabIds)
    const etabTypeMap: Record<string, string> = {}
    for (const e of (etabsTypeData || [])) etabTypeMap[e.id] = e.type_reseau || 'Hors REP'

    // Stats par établissement
    const etabsS: EtabReseauStat[] = etabsList.map(etab => {
      const etabClasses  = (classesData || []).filter((c: any) => c.etablissement_id === etab.id)
      const etabClassIds = new Set(etabClasses.map((c: any) => c.id))
      const etabEleves   = (elevesData || []).filter((e: any) => etabClassIds.has(e.classe_id))
      const etabEleveIds = new Set(etabEleves.map((e: any) => e.id))
      const etabPass     = passData.filter(p => etabEleveIds.has(p.eleve_id))
      const evalues      = etabPass.filter(p => !p.non_evalue && p.score != null && p.score > 0)
      const ne           = etabPass.filter(p => p.non_evalue)
      const scores       = evalues.map(p => p.score as number)
      let g1 = 0, g2 = 0, g3 = 0, g4 = 0
      evalues.forEach((p: any) => {
        const cl  = eleveToClasse[p.eleve_id]
        const nrm = normesParam.find(n => n.niveau === cl?.niveau)
        const g   = classerEleve(p.score, nrm)
        if (g === 1) g1++; else if (g === 2) g2++; else if (g === 3) g3++; else g4++
      })
      return {
        id: etab.id, nom: etab.nom, type_reseau: etabTypeMap[etab.id],
        nbEleves:  etabEleves.length,
        nbEvalues: evalues.length,
        nbNE:      ne.length,
        nbNR:      Math.max(0, etabEleves.length - etabPass.length),
        moyenne:   scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        g1, g2, g3, g4,
      }
    })
    setEtabsReseau(etabsS)

    // Stats par niveau (global réseau)
    type NivData = { nbEleves: number; scores: number[]; g1: number; g2: number; g3: number; g4: number }
    const niveauxMap: Record<string, NivData> = {}
    ;(elevesData || []).forEach((e: any) => {
      const niv = classeMap[e.classe_id]?.niveau || 'Autre'
      if (!niveauxMap[niv]) niveauxMap[niv] = { nbEleves: 0, scores: [], g1: 0, g2: 0, g3: 0, g4: 0 }
      niveauxMap[niv].nbEleves++
    })
    passData.filter(p => !p.non_evalue && p.score != null && p.score > 0).forEach((p: any) => {
      const niv = eleveToClasse[p.eleve_id]?.niveau || 'Autre'
      if (niveauxMap[niv]) {
        niveauxMap[niv].scores.push(p.score)
        const nrm = normesParam.find(n => n.niveau === niv)
        const g   = classerEleve(p.score, nrm)
        if (g === 1) niveauxMap[niv].g1++
        else if (g === 2) niveauxMap[niv].g2++
        else if (g === 3) niveauxMap[niv].g3++
        else niveauxMap[niv].g4++
      }
    })
    const niveauxS: NiveauReseauStat[] = Object.entries(niveauxMap)
      .map(([niv, d]) => ({
        niveau:    niv,
        nbEleves:  d.nbEleves,
        nbEvalues: d.scores.length,
        moyenne:   d.scores.length > 0 ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : null,
        g1: d.g1, g2: d.g2, g3: d.g3, g4: d.g4,
      }))
      .sort((a, b) => a.niveau.localeCompare(b.niveau))
    setNiveauxReseau(niveauxS)

    // Stats par circonscription (IA-DASEN/Recteur)
    if (profil && ['ia_dasen', 'recteur', 'admin'].includes(profil.role)) {
      const { data: etabsFull } = await supabase.from('etablissements').select('id, circonscription, type_reseau').in('id', etabIds)
      const etabFullMap: Record<string, any> = {}
      for (const e of (etabsFull || [])) etabFullMap[e.id] = e

      const circoData: Record<string, { nbEleves: number; scores: number[]; g1: number; g2: number; g3: number; g4: number }> = {}
      for (const e of (elevesData || [])) {
        const cl = classeMap[e.classe_id]
        const etab = cl ? etabFullMap[cl.etablissement_id] : null
        const circo = etab?.circonscription || 'Non définie'
        if (!circoData[circo]) circoData[circo] = { nbEleves: 0, scores: [], g1: 0, g2: 0, g3: 0, g4: 0 }
        circoData[circo].nbEleves++
      }
      for (const p of passData) {
        if (p.non_evalue || !p.score) continue
        const cl = eleveToClasse[p.eleve_id]
        const etab = cl ? etabFullMap[cl.etablissement_id] : null
        const circo = etab?.circonscription || 'Non définie'
        if (circoData[circo]) {
          circoData[circo].scores.push(p.score)
          const nrm = normesParam.find(n => n.niveau === cl?.niveau)
          const g = classerEleve(p.score, nrm)
          if (g === 1) circoData[circo].g1++
          else if (g === 2) circoData[circo].g2++
          else if (g === 3) circoData[circo].g3++
          else circoData[circo].g4++
        }
      }
      setCircosReseau(Object.entries(circoData).map(([circo, d]) => ({
        circo, nbEleves: d.nbEleves, nbEvalues: d.scores.length,
        moyenne: d.scores.length > 0 ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : null,
        g1: d.g1, g2: d.g2, g3: d.g3, g4: d.g4,
      })).sort((a, b) => (b.moyenne || 0) - (a.moyenne || 0)))
    }

    setReseauLoading(false)
  }

  // ── Recherche élève ────────────────────────────────────────────────────

  function exporterCSV() {
    if (eleves.length === 0 || statsPer.length === 0) return
    const sp = statsPer.find(s => s.code === periodeActive) || statsPer[0]
    const headers = ['Nom', 'Prénom', 'Score', 'Groupe', 'Compréhension %', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Mode']
    const rows = eleves.map(e => {
      const d = e.data[periodeActive]
      const g = d?.groupe ? GROUPES[d.groupe - 1]?.label || '' : ''
      return [
        e.nom, e.prenom,
        d ? (d.ne ? 'N.É.' : d.score ?? '') : '',
        g,
        d && d.comp >= 0 ? `${d.comp}%` : '',
        ...(d?.qs || Array(6).fill(null)).map((q: boolean | null) => q === true ? 'Correct' : q === false ? 'Incorrect' : ''),
        d?.mode || '',
      ].join(';')
    })
    const csv = [headers.join(';'), ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `export-${classeId ? 'classe' : 'stats'}-${periodeActive}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  function rechercherEleve(query: string) {
    setRechercheQuery(query)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) { setRechercheResultats([]); return }
    debounceRef.current = setTimeout(async () => {
      setRechercheLoading(true)
      const classeIds = classes.map(c => c.id)
      let q = supabase.from('eleves')
        .select('id, nom, prenom, classe:classes(id, nom, niveau)')
        .or(`nom.ilike.%${query}%,prenom.ilike.%${query}%`)
        .eq('actif', true).limit(15)
      if (classeIds.length > 0) q = q.in('classe_id', classeIds)
      const { data } = await q
      setRechercheResultats((data || []).map((e: any) => ({
        id: e.id, nom: e.nom, prenom: e.prenom,
        classeNom: e.classe?.nom || '—',
        niveauClasse: e.classe?.niveau || '',
      })))
      setRechercheLoading(false)
    }, 300)
  }

  async function ouvrirFicheEleve(r: { id: string; nom: string; prenom: string; niveauClasse: string }) {
    setRechercheQuery(''); setRechercheResultats([])
    const { data: passData } = await supabase
      .from('passations')
      .select('eleve_id, score, non_evalue, absent, q1, q2, q3, q4, q5, q6, mode, periode:periodes(id, code)')
      .eq('eleve_id', r.id)
    const pass = (passData || []) as any[]
    const row: EleveRow = { id: r.id, nom: r.nom, prenom: r.prenom, data: {} }
    pass.forEach((p: any) => {
      const code = p.periode?.code; const pid = p.periode?.id
      if (!code) return
      const rawQs = [p.q1, p.q2, p.q3, p.q4, p.q5, p.q6]
      const norme  = normes.find(n => n.niveau === r.niveauClasse && n.periode_id === pid)
      const groupe: 1|2|3|4|null = (!p.non_evalue && p.score !== null) ? classerEleve(p.score, norme) : null
      row.data[code] = {
        score: p.non_evalue ? null : p.score, ne: !!p.non_evalue,
        comp: calcCompPct(rawQs),
        qs: rawQs.map((q: string|null) => q === null ? null : q === 'Correct'),
        mode: p.mode || 'saisie', groupe,
      }
    })
    setEleveModal(row)
  }

  // ── Rendu ──────────────────────────────────────────────────────────────

  if (profilLoading || loading) {
    return (
      <div className={styles.page}>
        <Sidebar />
        <main className={styles.main}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Chargement…</p>
        </main>
      </div>
    )
  }

  const classeActuelle = classes.find(c => c.id === classeId)
  const spActive  = statsPer.find(s => s.code === periodeActive)
  const spComp1   = statsPer.find(s => s.code === compPer1)
  const spComp2   = statsPer.find(s => s.code === compPer2)
  const nbEleves  = eleves.length

  // Périodes de la fiche élève (seulement celles avec des données)
  const periodesAvecData = periodes.filter(p => statsPer.some(sp => sp.code === p.code))

  return (
    <div className={styles.page}>
      <Sidebar />
      <ImpersonationBar />

      <main className={styles.main}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Statistiques</h1>
            <p className={styles.subtitle}>
              {vueReseau && viewMode === 'reseau'
                ? `Vue réseau · ${coordoEtabs.length} établissement${coordoEtabs.length > 1 ? 's' : ''}`
                : classeActuelle ? `${classeActuelle.nom} · ${classeActuelle.niveau}` : 'Analyse des scores de fluence'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Toggle établissement / classe (direction) */}
            {profil && ['directeur', 'principal'].includes(profil.role) && (
              <div style={{ display: 'flex', background: 'white', borderRadius: 10, padding: 3, border: '1.5px solid var(--border-main)', gap: 2 }}>
                <button
                  onClick={() => { setDirVue('etablissement'); if (!dirEtabStats.length) calculerEtablissement() }}
                  style={{ padding: '8px 16px', borderRadius: 7, border: 'none', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: dirVue === 'etablissement' ? 'var(--primary-dark)' : 'transparent', color: dirVue === 'etablissement' ? 'white' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
                  Vue établissement
                </button>
                <button
                  onClick={() => setDirVue('classe')}
                  style={{ padding: '8px 16px', borderRadius: 7, border: 'none', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: dirVue === 'classe' ? 'var(--primary-dark)' : 'transparent', color: dirVue === 'classe' ? 'white' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
                  Vue classe
                </button>
              </div>
            )}
            {/* Toggle réseau / classe (coordo uniquement) */}
            {vueReseau && (
              <div style={{ display: 'flex', background: 'white', borderRadius: 10, padding: 3, border: '1.5px solid var(--border-main)', gap: 2 }}>
                <button
                  onClick={() => setViewMode('reseau')}
                  style={{ padding: '8px 16px', borderRadius: 7, border: 'none', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: viewMode === 'reseau' ? 'var(--primary-dark)' : 'transparent', color: viewMode === 'reseau' ? 'white' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
                  Vue réseau
                </button>
                <button
                  onClick={() => setViewMode('classe')}
                  style={{ padding: '8px 16px', borderRadius: 7, border: 'none', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: viewMode === 'classe' ? 'var(--primary-dark)' : 'transparent', color: viewMode === 'classe' ? 'white' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
                  Vue classe
                </button>
              </div>
            )}
            {/* Sélecteur de classe (masqué en mode réseau ou vue établissement) */}
            {(!vueReseau || viewMode === 'classe') && dirVue !== 'etablissement' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label className={styles.label} style={{ display: 'block', marginBottom: 6 }}>Classe</label>
                  <select value={classeId} onChange={e => setClasseId(e.target.value)} className={styles.select}>
                    {(niveauFilter === 'tous' ? classes : classes.filter(c => c.niveau === niveauFilter))
                      .map(c => <option key={c.id} value={c.id}>{c.nom} — {c.niveau}</option>)}
                  </select>
                </div>
                {profil && ['directeur', 'principal'].includes(profil.role) && niveaux.length > 1 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Niveau :</span>
                    <button
                      onClick={() => { setNiveauFilter('tous'); const first = classes[0]; if (first) setClasseId(first.id) }}
                      style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', borderColor: niveauFilter === 'tous' ? 'var(--primary-dark)' : 'var(--border-main)', background: niveauFilter === 'tous' ? 'var(--primary-dark)' : 'white', color: niveauFilter === 'tous' ? 'white' : 'var(--text-secondary)' }}>
                      Tous
                    </button>
                    {niveaux.map(niv => (
                      <button key={niv}
                        onClick={() => { setNiveauFilter(niv); const first = classes.find(c => c.niveau === niv); if (first) setClasseId(first.id) }}
                        style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', borderColor: niveauFilter === niv ? 'var(--primary-dark)' : 'var(--border-main)', background: niveauFilter === niv ? 'var(--primary-dark)' : 'white', color: niveauFilter === niv ? 'white' : 'var(--text-secondary)' }}>
                        {niv}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Recherche élève ── */}
        <div style={{ position: 'relative', marginBottom: 24 }}>
          <input
            type="text"
            placeholder="Rechercher un élève par nom ou prénom…"
            value={rechercheQuery}
            onChange={e => rechercherEleve(e.target.value)}
            style={{
              width: '100%', padding: '11px 16px 11px 42px',
              border: '1.5px solid var(--border-main)', borderRadius: 12,
              fontFamily: 'var(--font-sans)', fontSize: 14, background: 'white',
              color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
            }}
          />
          <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 17, pointerEvents: 'none' }}>🔍</span>
          {rechercheQuery.length >= 2 && (
            <div style={{
              position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 20,
              background: 'white', border: '1.5px solid var(--border-main)',
              borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden',
            }}>
              {rechercheLoading ? (
                <div style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text-tertiary)' }}>Recherche…</div>
              ) : rechercheResultats.length === 0 ? (
                <div style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text-tertiary)' }}>Aucun élève trouvé</div>
              ) : rechercheResultats.map(e => (
                <div key={e.id} onClick={() => ouvrirFicheEleve(e)} style={{
                  padding: '12px 18px', cursor: 'pointer', fontSize: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  borderBottom: '1px solid var(--border-light)', transition: 'background 0.1s',
                }}
                onMouseEnter={el => (el.currentTarget.style.background = 'var(--bg-gray)')}
                onMouseLeave={el => (el.currentTarget.style.background = 'white')}>
                  <span style={{ fontWeight: 600, color: 'var(--primary-dark)' }}>{e.prenom} {e.nom}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-gray)', padding: '2px 8px', borderRadius: 6 }}>{e.classeNom}</span>
                    {e.niveauClasse && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', background: 'var(--bg-gray)', padding: '2px 8px', borderRadius: 6 }}>{e.niveauClasse}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ════ VUE RÉSEAU (coordo) ════ */}
        {/* ── Vue établissement (direction) ── */}
        {profil && ['directeur', 'principal'].includes(profil.role) && dirVue === 'etablissement' && (
          <div style={{ padding: '0 32px 32px' }}>
            {/* Sélecteur période */}
            {periodes.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Période :</span>
                {periodes.map(p => (
                  <button key={p.code} onClick={() => { setDirEtabPeriode(p.code); calculerEtablissement(p.code) }}
                    style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', borderColor: dirEtabPeriode === p.code ? 'var(--primary-dark)' : 'var(--border-main)', background: dirEtabPeriode === p.code ? 'var(--primary-dark)' : 'white', color: dirEtabPeriode === p.code ? 'white' : 'var(--text-secondary)' }}>
                    {p.code}
                  </button>
                ))}
              </div>
            )}

            {reseauLoading ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>Chargement…</div>
            ) : (
              <div className={styles.table}>
                <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-main)' }}>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--primary-dark)', margin: 0 }}>Classes · {dirEtabPeriode}</h2>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead className={styles.tableHead}>
                      <tr>
                        <th className={styles.tableHeaderCell}>Classe</th>
                        <th className={styles.tableHeaderCell}>Niveau</th>
                        <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Élèves</th>
                        <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Évalués</th>
                        <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Moyenne</th>
                        <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Fragiles</th>
                        <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Groupes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dirEtabStats.map(c => {
                        const totalG = c.groupes.reduce((s, n) => s + n, 0)
                        const pctEval = c.nbEleves > 0 ? Math.round(c.nbEvalues / c.nbEleves * 100) : 0
                        return (
                          <tr key={c.classeId} className={`${styles.tableRow} ${styles.tableRowClickable}`}
                            onClick={() => { setDirVue('classe'); setClasseId(c.classeId) }}>
                            <td className={styles.tableCell} style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>{c.classeNom}</td>
                            <td className={styles.tableCell}>{c.niveau}</td>
                            <td style={{ textAlign: 'center', padding: '12px 16px' }}>{c.nbEleves}</td>
                            <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                              <span style={{ fontWeight: 600, color: pctEval >= 80 ? '#16a34a' : pctEval >= 50 ? '#d97706' : '#dc2626' }}>{c.nbEvalues} ({pctEval}%)</span>
                            </td>
                            <td style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 700, color: 'var(--primary-dark)' }}>{c.moyenne ?? '—'}</td>
                            <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                              {c.pctFragiles > 0 ? <span style={{ fontWeight: 700, color: c.pctFragiles > 40 ? '#dc2626' : c.pctFragiles > 20 ? '#d97706' : '#16a34a' }}>{c.pctFragiles}%</span> : '—'}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              {totalG > 0 && (
                                <div style={{ display: 'flex', height: 16, borderRadius: 4, overflow: 'hidden', minWidth: 80 }}>
                                  {[{ c: '#DC2626' }, { c: '#D97706' }, { c: '#2563EB' }, { c: '#16A34A' }].map((g, i) => (
                                    c.groupes[i] > 0 ? <div key={i} style={{ width: `${Math.round(c.groupes[i] / totalG * 100)}%`, background: g.c, minWidth: 2 }} /> : null
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '10px 24px', background: 'var(--bg-gray)', fontSize: 12, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-light)' }}>
                  Cliquez sur une classe pour voir le détail par élève
                </div>
              </div>
            )}
          </div>
        )}

        {vueReseau && viewMode === 'reseau' && (
          <>
            {/* Barre de contrôle : toggle etab/niveau + onglets période */}
            <div className={styles.modeBar}>
              <div className={styles.modeTabs}>
                <button
                  className={`${styles.modeTab} ${reseauToggle === 'etab' ? styles.modeTabActive : ''}`}
                  onClick={() => setReseauToggle('etab')}>
                  Par établissement
                </button>
                <button
                  className={`${styles.modeTab} ${reseauToggle === 'niveau' ? styles.modeTabActive : ''}`}
                  onClick={() => setReseauToggle('niveau')}>
                  Par niveau
                </button>
                {profil && ['ia_dasen', 'recteur', 'admin'].includes(profil.role) && (
                  <button
                    className={`${styles.modeTab} ${reseauToggle === 'circo' ? styles.modeTabActive : ''}`}
                    onClick={() => setReseauToggle('circo')}>
                    Par circonscription
                  </button>
                )}
              </div>
              {/* Filtre REP (IA-DASEN/Recteur) */}
              {profil && ['ia_dasen', 'recteur', 'admin'].includes(profil.role) && reseauToggle === 'etab' && (
                <div style={{ display: 'flex', gap: 4, marginLeft: 16 }}>
                  {[
                    { val: 'tous' as const, label: 'Tous' },
                    { val: 'rep' as const, label: 'REP/REP+' },
                    { val: 'horsrep' as const, label: 'Hors REP' },
                  ].map(f => (
                    <button key={f.val} onClick={() => setReseauRepFilter(f.val)}
                      style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', borderColor: reseauRepFilter === f.val ? '#7e22ce' : 'var(--border-main)', background: reseauRepFilter === f.val ? '#f3e8ff' : 'white', color: reseauRepFilter === f.val ? '#7e22ce' : 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
              <div className={styles.periodeTabs}>
                {periodes.map(p => (
                  <button key={p.code}
                    className={`${styles.periodeTab} ${reseauPeriode === p.code ? styles.periodeTabActive : ''}`}
                    onClick={() => calculerReseau(coordoEtabs, p.code, normes)}>
                    {p.code}
                  </button>
                ))}
              </div>
            </div>

            {reseauLoading ? (
              <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Calcul réseau…</p>
            ) : reseauToggle === 'etab' ? (

              /* ── Par établissement ── */
              <div className={styles.table}>
                <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--primary-dark)' }}>
                    Statistiques par établissement · {reseauPeriode}
                  </h2>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead className={styles.tableHead}>
                      <tr>
                        <th className={styles.tableHeaderCell}>Établissement</th>
                        <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Élèves</th>
                        <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Évalués</th>
                        <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Moyenne</th>
                        <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Fragiles</th>
                        <th className={styles.tableHeaderCell}>Groupes de besoin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {etabsReseau.filter(e => {
                        if (reseauRepFilter === 'tous') return true
                        if (reseauRepFilter === 'rep') return e.type_reseau === 'REP' || e.type_reseau === 'REP+'
                        return e.type_reseau !== 'REP' && e.type_reseau !== 'REP+'
                      }).map(e => {
                        const total    = e.nbEvalues || 1
                        const pctEval  = e.nbEleves > 0 ? Math.round((e.nbEvalues + e.nbNE) / e.nbEleves * 100) : 0
                        const fragiles = e.g1 + e.g2
                        const pctFrag  = total > 0 ? Math.round(fragiles / total * 100) : 0
                        return (
                          <tr key={e.id} className={`${styles.tableRow} ${styles.tableRowClickable}`}
                            onClick={async () => {
                              // Drill-down : charger les classes de cet établissement
                              const { data: cls } = await supabase.from('classes').select('id, nom, niveau').eq('etablissement_id', e.id).order('niveau')
                              if (cls && cls.length > 0) {
                                setClasses(cls.map((c: any) => ({ id: c.id, nom: c.nom, niveau: c.niveau })))
                                setClasseId(cls[0].id)
                                setViewMode('classe')
                              }
                            }}>
                            <td className={styles.tableCell} style={{ fontWeight: 600, color: 'var(--primary-dark)', cursor: 'pointer' }}>{e.nom}</td>
                            <td style={{ textAlign: 'center', padding: '12px 16px' }}>{e.nbEleves}</td>
                            <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                              <span style={{ fontWeight: 600, color: pctEval >= 80 ? '#16A34A' : pctEval >= 50 ? '#D97706' : '#DC2626' }}>
                                {e.nbEvalues}{' '}
                                <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-secondary)' }}>({pctEval}%)</span>
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                              {e.moyenne != null
                                ? <span style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>{e.moyenne} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>m/min</span></span>
                                : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                            </td>
                            <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: pctFrag > 40 ? '#DC2626' : pctFrag > 20 ? '#D97706' : '#16A34A' }}>
                                {pctFrag}%
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', minWidth: 160 }}>
                              <div style={{ display: 'flex', gap: 2, height: 18, borderRadius: 4, overflow: 'hidden' }}>
                                {[
                                  { n: e.g1, color: '#DC2626' },
                                  { n: e.g2, color: '#D97706' },
                                  { n: e.g3, color: '#2563EB' },
                                  { n: e.g4, color: '#16A34A' },
                                ].map((g, i) => {
                                  const pct = total > 0 ? Math.round(g.n / total * 100) : 0
                                  return pct > 0 ? (
                                    <div key={i}
                                      style={{ width: `${pct}%`, background: g.color, minWidth: 4 }}
                                      title={`${GROUPES[i].label}: ${g.n} (${pct}%)`} />
                                  ) : null
                                })}
                              </div>
                              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                {[
                                  { n: e.g1, label: 'TF', color: '#DC2626' },
                                  { n: e.g2, label: 'Fr', color: '#D97706' },
                                  { n: e.g3, label: 'EC', color: '#2563EB' },
                                  { n: e.g4, label: 'At', color: '#16A34A' },
                                ].filter(g => g.n > 0).map((g, i) => (
                                  <span key={i} style={{ fontSize: 10, fontWeight: 700, color: g.color }}>{g.label} {g.n}</span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            ) : reseauToggle === 'niveau' ? (

              /* ── Par niveau ── */
              <div className={styles.table}>
                <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-main)' }}>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--primary-dark)' }}>
                    Statistiques par niveau · Réseau · {reseauPeriode}
                  </h2>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead className={styles.tableHead}>
                      <tr>
                        <th className={styles.tableHeaderCell}>Niveau</th>
                        <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Élèves réseau</th>
                        <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Évalués</th>
                        <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Moyenne</th>
                        <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Très fragile</th>
                        <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Fragile</th>
                        <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>En cours</th>
                        <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Attendu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {niveauxReseau.map(n => {
                        const gColors = ['#DC2626','#D97706','#2563EB','#16A34A']
                        const gBgs    = ['rgba(220,38,38,0.08)','rgba(217,119,6,0.08)','rgba(37,99,235,0.08)','rgba(22,163,74,0.08)']
                        return (
                          <tr key={n.niveau} className={styles.tableRow}>
                            <td className={styles.tableCell} style={{ fontWeight: 700, fontSize: 15 }}>{n.niveau}</td>
                            <td style={{ textAlign: 'center', padding: '12px 16px' }}>{n.nbEleves}</td>
                            <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                              <span style={{ fontWeight: 600 }}>
                                {n.nbEvalues}
                                {n.nbEleves > 0 && (
                                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 4 }}>
                                    ({Math.round(n.nbEvalues / n.nbEleves * 100)}%)
                                  </span>
                                )}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                              {n.moyenne != null
                                ? <span style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>{n.moyenne}</span>
                                : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                            </td>
                            {[n.g1, n.g2, n.g3, n.g4].map((g, i) => {
                              const pct = n.nbEvalues > 0 ? Math.round(g / n.nbEvalues * 100) : 0
                              return (
                                <td key={i} style={{ textAlign: 'center', padding: '12px 16px' }}>
                                  {g > 0 ? (
                                    <span style={{ background: gBgs[i], color: gColors[i], fontWeight: 700, padding: '3px 8px', borderRadius: 6, fontSize: 12 }}>
                                      {g} <span style={{ fontWeight: 400, fontSize: 10 }}>({pct}%)</span>
                                    </span>
                                  ) : <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>—</span>}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : reseauToggle === 'circo' ? (

              /* ── Par circonscription ── */
              <div className={styles.table}>
                <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-main)' }}>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--primary-dark)' }}>
                    Statistiques par circonscription · {reseauPeriode}
                  </h2>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead className={styles.tableHead}>
                      <tr>
                        <th className={styles.tableHeaderCell}>Circonscription</th>
                        <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Élèves</th>
                        <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Évalués</th>
                        <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Moyenne</th>
                        <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Fragiles</th>
                        <th className={styles.tableHeaderCell}>Groupes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {circosReseau.map(c => {
                        const total = c.nbEvalues || 1
                        const pctEval = c.nbEleves > 0 ? Math.round(c.nbEvalues / c.nbEleves * 100) : 0
                        const fragiles = c.g1 + c.g2
                        const pctFrag = total > 0 ? Math.round(fragiles / total * 100) : 0
                        return (
                          <tr key={c.circo} className={styles.tableRow}>
                            <td className={styles.tableCell} style={{ fontWeight: 600, color: 'var(--primary-dark)' }}>{c.circo}</td>
                            <td style={{ textAlign: 'center', padding: '12px 16px' }}>{c.nbEleves}</td>
                            <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                              <span style={{ fontWeight: 600, color: pctEval >= 80 ? '#16A34A' : pctEval >= 50 ? '#D97706' : '#DC2626' }}>
                                {c.nbEvalues} <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-secondary)' }}>({pctEval}%)</span>
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                              {c.moyenne != null ? <span style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>{c.moyenne} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>m/min</span></span> : '—'}
                            </td>
                            <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                              <span style={{ fontWeight: 700, color: pctFrag > 40 ? '#DC2626' : pctFrag > 20 ? '#D97706' : '#16A34A' }}>{pctFrag}%</span>
                            </td>
                            <td style={{ padding: '12px 16px', minWidth: 140 }}>
                              {total > 0 && (
                                <div style={{ display: 'flex', gap: 2, height: 18, borderRadius: 4, overflow: 'hidden' }}>
                                  {[{ n: c.g1, color: '#DC2626' }, { n: c.g2, color: '#D97706' }, { n: c.g3, color: '#2563EB' }, { n: c.g4, color: '#16A34A' }].map((g, i) => {
                                    const pct = Math.round(g.n / total * 100)
                                    return pct > 0 ? <div key={i} style={{ width: `${pct}%`, background: g.color, minWidth: 2 }} title={`${g.n} (${pct}%)`} /> : null
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            ) : null}
          </>
        )}

        {/* ════ VUE CLASSE (tous rôles, ou coordo en mode classe) ════ */}
        {(!vueReseau || viewMode === 'classe') && (calcul ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Calcul en cours…</p>
        ) : statsPer.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>📊</div>
            <p className={styles.emptyStateText}>Aucune passation enregistrée pour cette classe.</p>
          </div>
        ) : (
          <>
            {/* ── Barre mode + onglets période ── */}
            <div className={styles.modeBar}>
              <div className={styles.modeTabs}>
                <button
                  className={`${styles.modeTab} ${mode === 'periode' ? styles.modeTabActive : ''}`}
                  onClick={() => setMode('periode')}>
                  Par période
                </button>
                <button
                  className={`${styles.modeTab} ${mode === 'comparaison' ? styles.modeTabActive : ''}`}
                  onClick={() => setMode('comparaison')}>
                  Comparaison
                </button>
              </div>

              {mode === 'periode' && (
                <div className={styles.periodeTabs}>
                  {statsPer.map(sp => (
                    <button key={sp.code}
                      className={`${styles.periodeTab} ${periodeActive === sp.code ? styles.periodeTabActive : ''}`}
                      onClick={() => setPeriodeActive(sp.code)}>
                      {sp.code}
                    </button>
                  ))}
                </div>
              )}

              {mode === 'comparaison' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <select value={compPer1} onChange={e => setCompPer1(e.target.value)} className={styles.select}>
                    {statsPer.map(s => <option key={s.code} value={s.code}>{s.code}</option>)}
                  </select>
                  <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>vs</span>
                  <select value={compPer2} onChange={e => setCompPer2(e.target.value)} className={styles.select}>
                    {statsPer.map(s => <option key={s.code} value={s.code}>{s.code}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* ════════════════════════════════════════
                MODE : PAR PÉRIODE
            ════════════════════════════════════════ */}
            {mode === 'periode' && spActive && (
              <>
                {/* KPI */}
                <div className={styles.statsGrid}>
                  <div className={styles.statCard} style={{ background: 'var(--primary-dark)', border: 'none' }}>
                    <div className={styles.statLabel} style={{ color: 'rgba(255,255,255,0.5)' }}>Moyenne</div>
                    <div className={styles.statValue} style={{ color: 'white' }}>{spActive.moyenne ?? '—'}</div>
                    <div className={styles.statUnit} style={{ color: 'rgba(255,255,255,0.4)' }}>mots / minute</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Minimum</div>
                    <div className={styles.statValue}>{spActive.min ?? '—'}</div>
                    <div className={styles.statUnit}>m/min</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Maximum</div>
                    <div className={styles.statValue}>{spActive.max ?? '—'}</div>
                    <div className={styles.statUnit}>m/min</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Évalués</div>
                    <div className={styles.statValue} style={{ color: '#16A34A' }}>{spActive.nbEvalues}</div>
                    <div className={styles.statUnit}>{nbEleves > 0 ? `${Math.round(spActive.nbEvalues / nbEleves * 100)}%` : '—'} de la classe</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Non évalués</div>
                    <div className={styles.statValue} style={{ color: '#EA580C' }}>{spActive.nbNE}</div>
                    <div className={styles.statUnit}>{nbEleves > 0 ? `${Math.round(spActive.nbNE / nbEleves * 100)}%` : '—'} de la classe</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Absents</div>
                    <div className={styles.statValue} style={{ color: '#DC2626' }}>{spActive.nbAbsent}</div>
                    <div className={styles.statUnit}>{nbEleves > 0 ? `${Math.round(spActive.nbAbsent / nbEleves * 100)}%` : '—'} de la classe</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Non renseignés</div>
                    <div className={styles.statValue} style={{ color: '#94A3B8' }}>{spActive.nbNR}</div>
                    <div className={styles.statUnit}>pas encore passés</div>
                  </div>
                </div>

                {/* Groupes de besoin */}
                <div className={styles.chartContainer}>
                  <h2 className={styles.chartTitle}>Groupes de besoin · {spActive.code}</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {GROUPES.map(g => {
                      const n   = [spActive.g1, spActive.g2, spActive.g3, spActive.g4][g.id - 1]
                      const pct = spActive.nbEvalues > 0 ? Math.round(n / spActive.nbEvalues * 100) : 0
                      return (
                        <div key={g.id} style={{ background: g.bg, borderRadius: 12, padding: '16px 18px', border: `1.5px solid ${g.color}33` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: g.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                            {g.label}
                          </div>
                          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: g.color, lineHeight: 1, marginBottom: 4 }}>{n}</div>
                          <div style={{ fontSize: 12, color: g.color, opacity: 0.8, marginBottom: 8 }}>{pct}% des évalués</div>
                          <div style={{ height: 4, background: `${g.color}22`, borderRadius: 2 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: g.color, borderRadius: 2, transition: 'width 0.5s' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Compréhension par question */}
                {spActive.compQ.some(q => q.total > 0) && (
                  <div className={styles.chartContainer}>
                    <h2 className={styles.chartTitle}>
                      Compréhension par question · {spActive.code}
                      <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 10 }}>
                        % de bonnes réponses
                      </span>
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
                      {spActive.compQ.map((q, i) => (
                        <div key={i} style={{ textAlign: 'center' }}>
                          <div style={{ background: 'var(--bg-gray)', borderRadius: 8, height: 80, display: 'flex', alignItems: 'flex-end', overflow: 'hidden', marginBottom: 8 }}>
                            <div style={{
                              width: '100%', height: `${q.pct}%`, minHeight: q.total > 0 ? 4 : 0,
                              background: q.pct >= 70 ? '#16A34A' : q.pct >= 40 ? '#D97706' : '#DC2626',
                              borderRadius: 8, transition: 'height 0.4s ease',
                            }} />
                          </div>
                          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--primary-dark)', lineHeight: 1, marginBottom: 2 }}>
                            {q.total > 0 ? `${q.pct}%` : '—'}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Q{i + 1}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{q.n}/{q.total}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tableau élèves */}
                <div className={styles.table}>
                  <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--primary-dark)' }}>
                      Élèves · {spActive.code}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Cliquez sur un élève pour sa fiche</span>
                      <button onClick={exporterCSV} style={{
                        background: 'var(--bg-gray)', border: '1.5px solid var(--border-light)', borderRadius: 8,
                        padding: '5px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)',
                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      }}>Exporter CSV</button>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead className={styles.tableHead}>
                        <tr>
                          <th className={styles.tableHeaderCell}>Élève</th>
                          <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Score</th>
                          <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Groupe</th>
                          <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Comp.</th>
                          {['Q1','Q2','Q3','Q4','Q5','Q6'].map(q => (
                            <th key={q} className={styles.tableHeaderCell} style={{ textAlign: 'center', padding: '8px 4px', fontSize: 10 }}>{q}</th>
                          ))}
                          <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Mode</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eleves.map(e => {
                          const d = e.data[periodeActive]
                          const g = d?.groupe ? GROUPES[d.groupe - 1] : null
                          return (
                            <tr key={e.id}
                              className={`${styles.tableRow} ${styles.tableRowClickable}`}
                              onClick={() => setEleveModal(e)}>
                              <td className={styles.tableCell} style={{ fontWeight: 600, color: 'var(--primary-dark)' }}>
                                {e.nom} {e.prenom}
                              </td>
                              <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                                {!d ? (
                                  <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>—</span>
                                ) : d.ne ? (
                                  <span style={{ background: '#FFF7ED', color: '#C2410C', padding: '3px 9px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>N.É.</span>
                                ) : d.score !== null ? (
                                  <span style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>
                                    {d.score} <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-secondary)' }}>m/min</span>
                                  </span>
                                ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                              </td>
                              <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                                {g ? (
                                  <span style={{ background: g.bg, color: g.color, padding: '3px 9px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>{g.label}</span>
                                ) : <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>—</span>}
                              </td>
                              <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                                {d && d.comp >= 0 ? (() => {
                                  const cc = compColor(d.comp)
                                  return <span style={{ ...cc, padding: '2px 6px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{d.comp}%</span>
                                })() : <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>—</span>}
                              </td>
                              {[0,1,2,3,4,5].map(qi => (
                                <td key={qi} style={{ textAlign: 'center', padding: '12px 2px' }}>
                                  {d?.qs[qi] === true ? <span style={{ color: '#16a34a', fontWeight: 800, fontSize: 13 }}>✓</span>
                                    : d?.qs[qi] === false ? <span style={{ color: '#dc2626', fontWeight: 800, fontSize: 13 }}>✗</span>
                                    : <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>—</span>}
                                </td>
                              ))}
                              <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                                {d ? (
                                  <span style={{ background: 'var(--bg-gray)', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: 6, fontSize: 11 }}>
                                    {d.mode === 'passation' ? '🎯 Passation' : '✏️ Saisie'}
                                  </span>
                                ) : <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>—</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ════════════════════════════════════════
                MODE : COMPARAISON
            ════════════════════════════════════════ */}
            {mode === 'comparaison' && spComp1 && spComp2 && (
              <>
                {/* KPI côte à côte */}
                <div className={styles.comparisonGrid}>
                  {[
                    { label: 'Score moyen', v1: spComp1.moyenne, v2: spComp2.moyenne },
                    { label: 'Minimum',     v1: spComp1.min,     v2: spComp2.min     },
                    { label: 'Maximum',     v1: spComp1.max,     v2: spComp2.max     },
                    { label: 'Évalués',     v1: spComp1.nbEvalues, v2: spComp2.nbEvalues },
                  ].map(kpi => {
                    const diff = kpi.v1 !== null && kpi.v2 !== null ? kpi.v2 - kpi.v1 : null
                    return (
                      <div key={kpi.label} className={styles.compCard}>
                        <div className={styles.statLabel}>{kpi.label}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                          <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>{compPer1}</div>
                            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--primary-dark)', lineHeight: 1 }}>{kpi.v1 ?? '—'}</div>
                          </div>
                          <div style={{ textAlign: 'center', minWidth: 32 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>→</div>
                            {diff !== null && diff !== 0 && (
                              <div style={{ fontSize: 11, fontWeight: 700, color: diff > 0 ? '#16A34A' : '#DC2626' }}>
                                {diff > 0 ? '+' : ''}{diff}
                              </div>
                            )}
                          </div>
                          <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>{compPer2}</div>
                            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--primary-dark)', lineHeight: 1 }}>{kpi.v2 ?? '—'}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Mobilité élèves */}
                {compPer1 !== compPer2 && (() => {
                  const progressent = eleves.filter(e => {
                    const s1 = e.data[compPer1]?.score, s2 = e.data[compPer2]?.score
                    return s1 != null && s2 != null && s2 > s1
                  })
                  const stagnent = eleves.filter(e => {
                    const s1 = e.data[compPer1]?.score, s2 = e.data[compPer2]?.score
                    return s1 != null && s2 != null && s2 === s1
                  })
                  const regressent = eleves.filter(e => {
                    const s1 = e.data[compPer1]?.score, s2 = e.data[compPer2]?.score
                    return s1 != null && s2 != null && s2 < s1
                  })
                  return (
                    <div className={styles.chartContainer} style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                      <h2 className={styles.chartTitle} style={{ marginBottom: 0, flexShrink: 0 }}>
                        Mobilité des élèves
                      </h2>
                      <div style={{ display: 'flex', gap: 12, flex: 1 }}>
                        {[
                          { label: 'En progression', n: progressent.length, color: '#16A34A', bg: 'rgba(22,163,74,0.08)', icon: '↑' },
                          { label: 'Stable',          n: stagnent.length,   color: '#2563EB', bg: 'rgba(37,99,235,0.08)', icon: '→' },
                          { label: 'En régression',  n: regressent.length, color: '#DC2626', bg: 'rgba(220,38,38,0.08)', icon: '↓' },
                        ].map(m => (
                          <div key={m.label} style={{ background: m.bg, borderRadius: 12, padding: '14px 20px', textAlign: 'center', flex: 1 }}>
                            <div style={{ fontSize: 24, fontWeight: 700, color: m.color, marginBottom: 2 }}>{m.icon} {m.n}</div>
                            <div style={{ fontSize: 11, color: m.color, fontWeight: 600 }}>{m.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Groupes côte à côte */}
                <div className={styles.chartContainer}>
                  <h2 className={styles.chartTitle}>
                    Groupes de besoin · {compPer1} → {compPer2}
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {GROUPES.map(g => {
                      const n1   = [spComp1.g1, spComp1.g2, spComp1.g3, spComp1.g4][g.id - 1]
                      const n2   = [spComp2.g1, spComp2.g2, spComp2.g3, spComp2.g4][g.id - 1]
                      const diff = n2 - n1
                      const positif = g.id <= 2 ? diff < 0 : diff > 0
                      return (
                        <div key={g.id} style={{ background: g.bg, borderRadius: 12, padding: '14px 16px', border: `1.5px solid ${g.color}33` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: g.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                            {g.label}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                            <div style={{ textAlign: 'center', flex: 1 }}>
                              <div style={{ fontSize: 10, color: g.color, opacity: 0.7, marginBottom: 2 }}>{compPer1}</div>
                              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: g.color, lineHeight: 1 }}>{n1}</div>
                            </div>
                            <span style={{ fontSize: 12, color: g.color, opacity: 0.5 }}>→</span>
                            <div style={{ textAlign: 'center', flex: 1 }}>
                              <div style={{ fontSize: 10, color: g.color, opacity: 0.7, marginBottom: 2 }}>{compPer2}</div>
                              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: g.color, lineHeight: 1 }}>{n2}</div>
                            </div>
                          </div>
                          {diff !== 0 && (
                            <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: positif ? '#16A34A' : '#DC2626', textAlign: 'center' }}>
                              {diff > 0 ? '+' : ''}{diff} élèves
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Tableau comparatif */}
                <div className={styles.table}>
                  <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--primary-dark)' }}>
                      {compPer1} → {compPer2} · par élève
                    </h2>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Cliquez pour la fiche détaillée</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead className={styles.tableHead}>
                        <tr>
                          <th className={styles.tableHeaderCell}>Élève</th>
                          <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Score {compPer1}</th>
                          <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Score {compPer2}</th>
                          <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Progression</th>
                          <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Groupe {compPer1}</th>
                          <th className={styles.tableHeaderCell} style={{ textAlign: 'center' }}>Groupe {compPer2}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eleves.map(e => {
                          const d1 = e.data[compPer1]
                          const d2 = e.data[compPer2]
                          const s1 = d1 && !d1.ne ? d1.score : null
                          const s2 = d2 && !d2.ne ? d2.score : null
                          const prog = s1 !== null && s2 !== null ? s2 - s1 : null
                          const g1 = d1?.groupe ? GROUPES[d1.groupe - 1] : null
                          const g2 = d2?.groupe ? GROUPES[d2.groupe - 1] : null
                          return (
                            <tr key={e.id}
                              className={`${styles.tableRow} ${styles.tableRowClickable}`}
                              onClick={() => setEleveModal(e)}>
                              <td className={styles.tableCell} style={{ fontWeight: 600, color: 'var(--primary-dark)' }}>
                                {e.nom} {e.prenom}
                              </td>
                              <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                                {d1?.ne ? <span style={{ color: '#C2410C', fontSize: 12, fontWeight: 700 }}>N.É.</span>
                                : s1 !== null ? <span style={{ fontWeight: 700 }}>{s1}</span>
                                : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                              </td>
                              <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                                {d2?.ne ? <span style={{ color: '#C2410C', fontSize: 12, fontWeight: 700 }}>N.É.</span>
                                : s2 !== null ? <span style={{ fontWeight: 700 }}>{s2}</span>
                                : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                              </td>
                              <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                                {prog !== null ? (
                                  <span style={{ fontSize: 13, fontWeight: 700, color: prog > 0 ? '#16A34A' : prog < 0 ? '#DC2626' : '#2563EB' }}>
                                    {prog > 0 ? '+' : ''}{prog}
                                  </span>
                                ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                              </td>
                              <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                                {g1 ? <span style={{ background: g1.bg, color: g1.color, padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{g1.label}</span>
                                : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                              </td>
                              <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                                {g2 ? <span style={{ background: g2.bg, color: g2.color, padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{g2.label}</span>
                                : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        ))}
      </main>

      {/* ── Fiche élève ── */}
      {eleveModal && (
        <FicheEleve
          eleve={eleveModal}
          periodes={periodesAvecData}
          onClose={() => setEleveModal(null)}
        />
      )}
    </div>
  )
}

export default function StatistiquesWrapper() {
  return (
    <Suspense fallback={<div style={{ marginLeft: 260, padding: 48, color: 'var(--text-tertiary)' }}>Chargement…</div>}>
      <Statistiques />
    </Suspense>
  )
}
