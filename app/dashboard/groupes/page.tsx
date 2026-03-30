'use client'

import { useEffect, useState } from 'react'
import { useAnneesScolaires } from '@/app/lib/useAnneesScolaires'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'
import type { Classe, Periode, Norme } from '@/app/lib/types'
import { classerEleve } from '@/app/lib/fluenceUtils'

// ── Types ──────────────────────────────────────────────────────────────────

type EleveScore = {
  id: string
  nom: string
  prenom: string
  score: number | null
  non_evalue: boolean
  q1: string | null
  q2: string | null
  q3: string | null
  q4: string | null
  q5: string | null
  q6: string | null
}

type Groupe = {
  id: 1 | 2 | 3 | 4
  label: string
  description: string
  couleur: string
  fond: string
  eleves: EleveScore[]
}

// ── Helpers ────────────────────────────────────────────────────────────────


function scoreComprehension(eleve: EleveScore): string {
  const reponses = [eleve.q1, eleve.q2, eleve.q3, eleve.q4, eleve.q5, eleve.q6]
  const renseignees = reponses.filter(r => r !== null)
  if (renseignees.length === 0) return '—'
  const correctes = renseignees.filter(r => r === 'Correct').length
  return `${correctes}/${renseignees.length}`
}

// ── Définition des 4 groupes ───────────────────────────────────────────────

const GROUPES_DEF: Omit<Groupe, 'eleves'>[] = [
  {
    id:          1,
    label:       'Groupe 1 — Très fragile',
    description: 'Score inférieur à 70 % du seuil minimum attendu. Besoin d\'un accompagnement intensif.',
    couleur:     '#B91C1C',
    fond:        '#FEF2F2',
  },
  {
    id:          2,
    label:       'Groupe 2 — Fragile',
    description: 'Score entre 70 % et 100 % du seuil minimum. Besoin d\'un soutien ciblé.',
    couleur:     '#C2410C',
    fond:        '#FFF7ED',
  },
  {
    id:          3,
    label:       'Groupe 3 — En cours d\'acquisition',
    description: 'Score entre le seuil minimum et le score attendu. Consolidation nécessaire.',
    couleur:     '#A16207',
    fond:        '#FEFCE8',
  },
  {
    id:          4,
    label:       'Groupe 4 — Attendu',
    description: 'Score égal ou supérieur au score attendu. Objectif atteint.',
    couleur:     '#15803D',
    fond:        '#F0FDF4',
  },
]

// ── Composant principal ────────────────────────────────────────────────────

export default function Groupes() {
  const anneesDispo = useAnneesScolaires()
  const [classes, setClasses]       = useState<Classe[]>([])
  const [periodes, setPeriodes]     = useState<Periode[]>([])
  const [niveauFilter, setNiveauFilter] = useState<string>('tous')
  const [niveaux, setNiveaux]       = useState<string[]>([])
  const [classeId, setClasseId]     = useState('')
  const [periodeId, setPeriodeId]   = useState('')
  const [groupes, setGroupes]       = useState<Groupe[]>([])
  const [nonEvalues, setNonEvalues] = useState<EleveScore[]>([])
  const [norme, setNorme]           = useState<Norme | null>(null)
  const [loading, setLoading]       = useState(true)
  const [calcul, setCalcul]         = useState(false)
  const [ouvert, setOuvert]         = useState<number | null>(null)
  // Vue admin globale
  const [vueAdmin, setVueAdmin]     = useState(false)
  const [adminData, setAdminData]   = useState<any>(null)
  const [adminAnnee, setAdminAnnee] = useState('2025-2026')
  const [adminLoading, setAdminLoading] = useState(false)
  const [etabOuvert, setEtabOuvert] = useState<string | null>(null)
  const [etabDetail, setEtabDetail] = useState<any[]>([])
  const [etabDetailLoading, setEtabDetailLoading] = useState(false)

  const { profil, loading: profilLoading } = useProfil()
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!profilLoading && profil) {
      if (['admin', 'ia_dasen', 'recteur'].includes(profil.role)) {
        setVueAdmin(true)
        chargerVueAdmin()
      } else {
        chargerSelections()
      }
    }
  }, [profil, profilLoading])

  async function chargerDetailEtab(etabNom: string) {
    if (etabOuvert === etabNom) { setEtabOuvert(null); return }
    setEtabOuvert(etabNom)
    setEtabDetailLoading(true)
    // Trouver l'ID de l'établissement
    const { data: etabData } = await supabase.from('etablissements').select('id').eq('nom', etabNom).single()
    if (!etabData) { setEtabDetailLoading(false); return }
    // Charger via la même fonction mais avec un seul étab
    const { data } = await supabase.rpc('get_groupes_overview', { p_annee: adminAnnee, p_etab_ids: [etabData.id] })
    setEtabDetail((data as any)?.fragiles || [])
    // Charger aussi tous les élèves évalués (pas juste les fragiles)
    const periode = (data as any)?.periode
    if (periode) {
      const { data: perIds } = await supabase.from('periodes').select('id').eq('code', periode).eq('annee_scolaire', adminAnnee).eq('etablissement_id', etabData.id)
      if (perIds && perIds.length > 0) {
        const { data: allEleves } = await supabase
          .from('passations')
          .select('score, non_evalue, eleve:eleves(id, nom, prenom, classe:classes(nom, niveau))')
          .in('periode_id', perIds.map(p => p.id))
          .not('score', 'is', null)
          .gt('score', 0)
          .eq('non_evalue', false)
          .order('score')
        // Classifier chaque élève
        const { data: normes } = await supabase.from('config_normes').select('niveau, seuil_min, seuil_attendu')
        const normesMap: Record<string, any> = {}
        for (const n of (normes || [])) normesMap[n.niveau] = n
        const detail = (allEleves || []).map((p: any) => {
          const niv = p.eleve?.classe?.niveau || ''
          const norme = normesMap[niv]
          let groupe = 0
          if (norme && p.score > 0) {
            if (p.score < Math.round(norme.seuil_min * 0.7)) groupe = 1
            else if (p.score < norme.seuil_min) groupe = 2
            else if (p.score < norme.seuil_attendu) groupe = 3
            else groupe = 4
          }
          return { id: p.eleve?.id, nom: p.eleve?.nom, prenom: p.eleve?.prenom, classe: p.eleve?.classe?.nom, score: p.score, groupe }
        })
        setEtabDetail(detail)
      }
    }
    setEtabDetailLoading(false)
  }

  async function chargerVueAdmin(annee?: string) {
    setAdminLoading(true)
    setLoading(false) // Débloquer l'affichage principal
    const { data, error } = await supabase.rpc('get_groupes_overview', { p_annee: annee || adminAnnee })
    if (error) console.error('Erreur groupes:', error)
    setAdminData(data)
    setAdminLoading(false)
  }

  // ── Chargement des listes de sélection ──────────────────────────────────

  async function chargerSelections() {
    if (!profil) return

    // Classes accessibles
    let classesData: Classe[] = []
    let etabId: string | null = profil.etablissement_id || null

    if (profil.role === 'enseignant') {
      const { data } = await supabase
        .from('enseignant_classes')
        .select('classe:classes(id, nom, niveau, etablissement_id)')
        .eq('enseignant_id', profil.id)
      classesData = (data || []).map((r: any) => r.classe).filter(Boolean)
      if (!etabId && classesData.length > 0) etabId = (classesData[0] as any).etablissement_id || null
    } else {
      const q = supabase.from('classes').select('id, nom, niveau, etablissement_id').order('niveau')
      const query = profil.etablissement_id
        ? q.eq('etablissement_id', profil.etablissement_id)
        : q
      const { data } = await query
      classesData = data || []
    }
    setClasses(classesData)
    const niveauxUniq = [...new Set((classesData as any[]).map((c: any) => c.niveau).filter(Boolean))].sort()
    setNiveaux(niveauxUniq)
    if (classesData.length > 0) setClasseId(classesData[0].id)

    // Périodes — filtrées par établissement pour éviter les doublons T1/T2/T3
    let perQuery = supabase.from('periodes').select('id, code, label').eq('actif', true).order('code')
    if (etabId) perQuery = perQuery.eq('etablissement_id', etabId)
    const { data: rawPer } = await perQuery

    // Dédupliquer par code (sécurité si plusieurs établissements)
    const seenCodes = new Set<string>()
    const perDedup: Periode[] = []
    for (const p of (rawPer || [])) {
      if (!seenCodes.has(p.code)) {
        seenCodes.add(p.code)
        perDedup.push({ id: p.id, code: p.code, label: p.label })
      }
    }
    setPeriodes(perDedup)
    if (perDedup.length > 0) setPeriodeId(perDedup[0].id)

    setLoading(false)
  }

  // ── Calcul des groupes ───────────────────────────────────────────────────

  useEffect(() => {
    if (classeId && periodeId) calculerGroupes().catch(() => setCalcul(false))
  }, [classeId, periodeId])

  async function calculerGroupes() {
    setCalcul(true)

    // Récupérer le niveau de la classe
    const classe = classes.find(c => c.id === classeId)
    if (!classe) { setCalcul(false); return }

    // Norme pour ce niveau : période spécifique d'abord, sinon globale (periode_id IS NULL)
    const { data: normeSpec } = await supabase
      .from('config_normes')
      .select('niveau, seuil_min, seuil_attendu')
      .eq('niveau', classe.niveau)
      .eq('periode_id', periodeId)
      .maybeSingle()
    const { data: normeGlob } = !normeSpec ? await supabase
      .from('config_normes')
      .select('niveau, seuil_min, seuil_attendu')
      .eq('niveau', classe.niveau)
      .is('periode_id', null)
      .maybeSingle() : { data: null }

    const normeActive: Norme = normeSpec || normeGlob || { niveau: classe.niveau, seuil_min: 80, seuil_attendu: 100 }
    setNorme(normeActive)

    // 1. Tous les élèves actifs de la classe
    const { data: tousEleves } = await supabase
      .from('eleves')
      .select('id, nom, prenom')
      .eq('classe_id', classeId)
      .eq('actif', true)

    const eleveMap = new Map<string, { id: string; nom: string; prenom: string }>()
    ;(tousEleves || []).forEach(e => eleveMap.set(e.id, e))
    const eleveIds = [...eleveMap.keys()]

    // 2. Passations pour ces élèves + cette période
    const { data: passData } = eleveIds.length > 0
      ? await supabase
          .from('passations')
          .select('eleve_id, score, non_evalue, q1, q2, q3, q4, q5, q6')
          .eq('periode_id', periodeId)
          .in('eleve_id', eleveIds)
      : { data: [] }

    const pass = (passData || []) as any[]
    const idsAvecPassation = new Set(pass.map(p => p.eleve_id))

    const sansPassation: EleveScore[] = (tousEleves || [])
      .filter(e => !idsAvecPassation.has(e.id))
      .map(e => ({ ...e, score: null, non_evalue: false, q1: null, q2: null, q3: null, q4: null, q5: null, q6: null }))

    // Classer
    const ne: EleveScore[] = [...sansPassation]
    const groupesMap: Record<number, EleveScore[]> = { 1: [], 2: [], 3: [], 4: [] }

    pass.forEach(p => {
      const eleveData = eleveMap.get(p.eleve_id)
      const eleve: EleveScore = {
        id:         p.eleve_id,
        nom:        eleveData?.nom || '',
        prenom:     eleveData?.prenom || '',
        score:      p.score,
        non_evalue: p.non_evalue,
        q1: p.q1, q2: p.q2, q3: p.q3, q4: p.q4, q5: p.q5, q6: p.q6,
      }
      if (p.non_evalue || p.score === null) {
        ne.push(eleve)
      } else {
        const g = classerEleve(p.score, normeActive)
        groupesMap[g].push(eleve)
      }
    })

    // Trier chaque groupe par score croissant
    for (const g of [1, 2, 3, 4]) {
      groupesMap[g].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    }

    setGroupes(GROUPES_DEF.map(def => ({ ...def, eleves: groupesMap[def.id] })))
    setNonEvalues(ne.sort((a, b) => a.nom.localeCompare(b.nom)))
    setCalcul(false)

    // Ouvrir le 1er groupe non vide
    const premierNonVide = GROUPES_DEF.find(g => groupesMap[g.id].length > 0)
    setOuvert(premierNonVide?.id ?? null)
  }

  // ── Rendu ────────────────────────────────────────────────────────────────

  if (profilLoading || loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{ marginLeft: 'var(--sidebar-width)', padding: 48 }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Chargement...</p>
        </main>
      </div>
    )
  }

  const totalEleves = groupes.reduce((s, g) => s + g.eleves.length, 0) + nonEvalues.length

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-gray)' }}>
      <Sidebar />
      <ImpersonationBar />

      <main style={{ marginLeft: 'var(--sidebar-width)', padding: '48px', flex: 1, maxWidth: 960 }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--primary-dark)', marginBottom: 6 }}>
            Groupes de besoin
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Constitution automatique à partir des scores de fluence
          </p>

          {/* Sélecteur année (admin) */}
          {vueAdmin && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {anneesDispo.map(a => (
                <button key={a} onClick={() => { setAdminAnnee(a); chargerVueAdmin(a) }} style={{
                  padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', border: '1.5px solid',
                  borderColor: adminAnnee === a ? 'var(--primary-dark)' : 'var(--border-main)',
                  background: adminAnnee === a ? 'var(--primary-dark)' : 'white',
                  color: adminAnnee === a ? 'white' : 'var(--text-secondary)',
                }}>{a}</button>
              ))}
            </div>
          )}
        </div>

        {/* ══ VUE ADMIN GLOBALE ══ */}
        {vueAdmin && adminData && (() => {
          const d = adminData
          const totauxMap: Record<number, number> = {}
          ;(d.totaux || []).forEach((t: any) => { totauxMap[t.groupe] = t.nb })
          const totalGroupes = Object.values(totauxMap).reduce((s: number, n: number) => s + n, 0)
          const gs = [
            { id: 1, label: 'Très fragile', count: totauxMap[1] || 0, color: '#DC2626', bg: '#fef2f2' },
            { id: 2, label: 'Fragile', count: totauxMap[2] || 0, color: '#D97706', bg: '#fff7ed' },
            { id: 3, label: "En cours d'acq.", count: totauxMap[3] || 0, color: '#2563EB', bg: '#eff6ff' },
            { id: 4, label: 'Attendu', count: totauxMap[4] || 0, color: '#16A34A', bg: '#f0fdf4' },
          ]
          return (
            <>
              {adminLoading && <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Chargement…</p>}

              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
                {gs.map(g => (
                  <div key={g.id} style={{ background: 'white', borderRadius: 16, border: `2px solid ${g.color}20`, padding: '20px 18px', textAlign: 'center' }}>
                    <div style={{ fontSize: 36, fontWeight: 800, color: g.color, lineHeight: 1, fontFamily: 'var(--font-sans)' }}>{g.count}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: g.color, marginTop: 6 }}>{g.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {totalGroupes > 0 ? Math.round(g.count / totalGroupes * 100) : 0}%
                    </div>
                  </div>
                ))}
              </div>

              {/* Barre empilée */}
              {totalGroupes > 0 && (
                <div style={{ display: 'flex', height: 40, borderRadius: 12, overflow: 'hidden', marginBottom: 24, border: '1.5px solid var(--border-light)' }}>
                  {gs.filter(g => g.count > 0).map(g => (
                    <div key={g.id} style={{ width: `${Math.round(g.count / totalGroupes * 100)}%`, background: g.color, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 4 }}>
                      {g.count / totalGroupes > 0.06 && <span style={{ color: 'white', fontSize: 13, fontWeight: 800 }}>{Math.round(g.count / totalGroupes * 100)}%</span>}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {/* Par niveau */}
                <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', padding: 24 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary-dark)', margin: '0 0 16px 0', fontFamily: 'var(--font-sans)' }}>Par niveau</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-sans)' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid var(--border-light)' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, color: 'var(--text-tertiary)' }}>Niveau</th>
                        <th style={{ padding: '6px 4px', textAlign: 'center', fontSize: 11, color: '#DC2626' }}>G1</th>
                        <th style={{ padding: '6px 4px', textAlign: 'center', fontSize: 11, color: '#D97706' }}>G2</th>
                        <th style={{ padding: '6px 4px', textAlign: 'center', fontSize: 11, color: '#2563EB' }}>G3</th>
                        <th style={{ padding: '6px 4px', textAlign: 'center', fontSize: 11, color: '#16A34A' }}>G4</th>
                        <th style={{ padding: '6px 4px', textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(d.par_niveau || []).map((n: any) => (
                        <tr key={n.niveau} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '8px', fontWeight: 700, color: 'var(--primary-dark)' }}>{n.niveau}</td>
                          <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: '#DC2626' }}>{n.g1 || '—'}</td>
                          <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: '#D97706' }}>{n.g2 || '—'}</td>
                          <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: '#2563EB' }}>{n.g3 || '—'}</td>
                          <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: '#16A34A' }}>{n.g4 || '—'}</td>
                          <td style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--text-secondary)' }}>{n.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Par établissement */}
                <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', padding: 24 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary-dark)', margin: '0 0 16px 0', fontFamily: 'var(--font-sans)' }}>Par établissement</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(d.par_etab || []).map((e: any) => {
                      const total = e.total || 1
                      const isOpen = etabOuvert === e.etab_nom
                      const gColors = ['#DC2626', '#D97706', '#2563EB', '#16A34A']
                      const gLabels = ['Très fragile', 'Fragile', 'En cours', 'Attendu']
                      return (
                        <div key={e.etab_nom}>
                          <div style={{ cursor: 'pointer' }} onClick={() => chargerDetailEtab(e.etab_nom)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)' }}>
                                <span style={{ marginRight: 6, fontSize: 10, color: 'var(--text-tertiary)' }}>{isOpen ? '▼' : '▶'}</span>
                                {(e.etab_nom || '').replace('[TEST] ', '')}
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{e.total} élèves</span>
                            </div>
                            <div style={{ display: 'flex', height: 14, borderRadius: 4, overflow: 'hidden' }}>
                              {[e.g1, e.g2, e.g3, e.g4].map((n, i) => (
                                n > 0 ? <div key={i} style={{ width: `${Math.round(n / total * 100)}%`, background: gColors[i], minWidth: 2 }} /> : null
                              ))}
                            </div>
                          </div>
                          {isOpen && (
                            <div style={{ marginTop: 10, padding: '12px 0', borderTop: '1px solid var(--border-light)' }}>
                              {etabDetailLoading ? (
                                <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Chargement…</p>
                              ) : (
                                <>
                                  {[1, 2, 3, 4].map(gId => {
                                    const elevesGroupe = etabDetail.filter((el: any) => el.groupe === gId)
                                    if (elevesGroupe.length === 0) return null
                                    return (
                                      <div key={gId} style={{ marginBottom: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                          <div style={{ width: 10, height: 10, borderRadius: 3, background: gColors[gId - 1] }} />
                                          <span style={{ fontSize: 12, fontWeight: 700, color: gColors[gId - 1], fontFamily: 'var(--font-sans)' }}>
                                            {gLabels[gId - 1]} ({elevesGroupe.length})
                                          </span>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 16 }}>
                                          {elevesGroupe.map((el: any) => (
                                            <a key={el.id} href={`/dashboard/eleve/${el.id}`} style={{
                                              display: 'inline-flex', alignItems: 'center', gap: 4,
                                              padding: '3px 8px', borderRadius: 6, fontSize: 11,
                                              background: gColors[gId - 1] + '12', color: gColors[gId - 1],
                                              fontWeight: 600, fontFamily: 'var(--font-sans)', textDecoration: 'none',
                                              border: `1px solid ${gColors[gId - 1]}25`,
                                            }}>
                                              {el.nom} {el.prenom}
                                              <span style={{ opacity: 0.7 }}>{el.score}m/min</span>
                                            </a>
                                          ))}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Élèves les plus fragiles */}
              {(d.fragiles || []).length > 0 && (
                <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', padding: 24, marginBottom: 24 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: '#DC2626', margin: '0 0 16px 0', fontFamily: 'var(--font-sans)' }}>
                    Élèves les plus fragiles ({(d.fragiles || []).length})
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid var(--border-light)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-tertiary)' }}>Élève</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-tertiary)' }}>Classe</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-tertiary)' }}>Établissement</th>
                        <th style={{ padding: '8px', textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>Score</th>
                        <th style={{ padding: '8px', textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>Groupe</th>
                        <th style={{ padding: '8px', textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>Compréh.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(d.fragiles || []).map((f: any) => {
                        const qs = [f.q1, f.q2, f.q3, f.q4, f.q5, f.q6].filter(q => q !== null)
                        const correct = qs.filter(q => q === 'Correct').length
                        return (
                          <tr key={f.eleve_id} style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}
                            onClick={() => router.push(`/dashboard/eleve/${f.eleve_id}`)}>
                            <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--primary-dark)' }}>{f.nom} {f.prenom}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{(f.classe_nom || '').replace('[TEST] ', '')}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: 12 }}>{(f.etab_nom || '').replace('[TEST] ', '')}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, color: f.score < 30 ? '#DC2626' : '#D97706' }}>{f.score}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: f.groupe === 1 ? '#fef2f2' : '#fff7ed', color: f.groupe === 1 ? '#DC2626' : '#D97706' }}>
                                G{f.groupe}
                              </span>
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
                              {qs.length > 0 ? `${correct}/${qs.length}` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Résumé */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 32 }}>
                <div style={{ background: '#fef2f2', borderRadius: 14, padding: 18, textAlign: 'center', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#DC2626' }}>{(totauxMap[1] || 0) + (totauxMap[2] || 0)}</div>
                  <div style={{ fontSize: 12, color: '#991b1b' }}>Élèves fragiles (G1+G2)</div>
                </div>
                <div style={{ background: '#eff6ff', borderRadius: 14, padding: 18, textAlign: 'center', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#1d4ed8' }}>{d.total_evalues || 0}</div>
                  <div style={{ fontSize: 12, color: '#1e40af' }}>Élèves évalués</div>
                </div>
                <div style={{ background: '#fefce8', borderRadius: 14, padding: 18, textAlign: 'center', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#854d0e' }}>{d.non_evalues || 0}</div>
                  <div style={{ fontSize: 12, color: '#92400e' }}>Non évalués</div>
                </div>
              </div>
            </>
          )
        })()}

        {/* Sélecteurs + contenu (pour les rôles non-admin) */}
        {!vueAdmin && (<>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
          background: 'white', borderRadius: 16, padding: 24,
          border: '1px solid var(--border-main)', marginBottom: 32,
        }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Classe
            </label>
            <select
              value={classeId}
              onChange={e => setClasseId(e.target.value)}
              style={{
                width: '100%', padding: '11px 14px',
                border: '1.5px solid var(--border-main)', borderRadius: 10,
                fontFamily: 'var(--font-sans)', fontSize: 14,
                background: 'white', color: 'var(--primary-dark)', cursor: 'pointer',
              }}>
              {(niveauFilter === 'tous' ? classes : classes.filter(c => c.niveau === niveauFilter))
                .map(c => (
                  <option key={c.id} value={c.id}>{c.nom} — {c.niveau}</option>
                ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Période
            </label>
            <select
              value={periodeId}
              onChange={e => setPeriodeId(e.target.value)}
              style={{
                width: '100%', padding: '11px 14px',
                border: '1.5px solid var(--border-main)', borderRadius: 10,
                fontFamily: 'var(--font-sans)', fontSize: 14,
                background: 'white', color: 'var(--primary-dark)', cursor: 'pointer',
              }}>
              {periodes.map(p => (
                <option key={p.id} value={p.id}>{p.code} — {p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {niveaux.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Filtrer par niveau :</span>
            <button onClick={() => setNiveauFilter('tous')}
              style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', borderColor: niveauFilter === 'tous' ? 'var(--primary-dark)' : 'var(--border-main)', background: niveauFilter === 'tous' ? 'var(--primary-dark)' : 'white', color: niveauFilter === 'tous' ? 'white' : 'var(--text-secondary)' }}>
              Tous
            </button>
            {niveaux.map(niv => (
              <button key={niv} onClick={() => { setNiveauFilter(niv); const first = classes.find(c => c.niveau === niv); if (first) setClasseId(first.id) }}
                style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', borderColor: niveauFilter === niv ? 'var(--primary-dark)' : 'var(--border-main)', background: niveauFilter === niv ? 'var(--primary-dark)' : 'white', color: niveauFilter === niv ? 'white' : 'var(--text-secondary)' }}>
                {niv}
              </button>
            ))}
          </div>
        )}

        {calcul ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Calcul des groupes...</p>
        ) : (
          <>
            {/* Résumé + norme */}
            {norme && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(0,24,69,0.04)', borderRadius: 12,
                padding: '14px 20px', marginBottom: 24, gap: 12,
                border: '1px solid rgba(0,24,69,0.08)',
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--primary-dark)' }}>{totalEleves}</strong> élèves ·{' '}
                  Niveau <strong style={{ color: 'var(--primary-dark)' }}>{norme.niveau}</strong>
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Norme : seuil min{' '}
                  <strong style={{ color: 'var(--primary-dark)' }}>{norme.seuil_min}</strong> m/min · attendu{' '}
                  <strong style={{ color: 'var(--primary-dark)' }}>{norme.seuil_attendu}</strong> m/min
                </span>
              </div>
            )}

            {/* Grille de résumé */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
              {groupes.map(g => (
                <div
                  key={g.id}
                  onClick={() => setOuvert(ouvert === g.id ? null : g.id)}
                  style={{
                    background: g.fond, borderRadius: 14, padding: '18px 20px',
                    border: `2px solid ${ouvert === g.id ? g.couleur : 'transparent'}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  <div style={{ fontSize: 28, fontFamily: 'var(--font-serif)', color: g.couleur, lineHeight: 1, marginBottom: 4 }}>
                    {g.eleves.length}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: g.couleur }}>
                    Groupe {g.id}
                  </div>
                  <div style={{ fontSize: 11, color: g.couleur, opacity: 0.7, marginTop: 2 }}>
                    {g.eleves.length > 0
                      ? `${Math.round(g.eleves.length / (totalEleves || 1) * 100)}% de la classe`
                      : 'Aucun élève'}
                  </div>
                </div>
              ))}
            </div>

            {/* Détail des groupes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {groupes.map(g => (
                <div key={g.id} style={{
                  background: 'white', borderRadius: 16,
                  border: `1.5px solid ${ouvert === g.id ? g.couleur : 'var(--border-main)'}`,
                  overflow: 'hidden', transition: 'border-color 0.15s',
                }}>
                  {/* En-tête accordéon */}
                  <button
                    onClick={() => setOuvert(ouvert === g.id ? null : g.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', padding: '18px 24px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--font-sans)', textAlign: 'left',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {/* Pastille couleur */}
                      <div style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: g.couleur, flexShrink: 0,
                      }} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary-dark)' }}>
                          {g.label}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                          {g.description}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        background: g.fond, color: g.couleur,
                        fontWeight: 700, fontSize: 13,
                        padding: '4px 14px', borderRadius: 20,
                      }}>
                        {g.eleves.length} élève{g.eleves.length > 1 ? 's' : ''}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 16 }}>
                        {ouvert === g.id ? '▲' : '▼'}
                      </span>
                    </div>
                  </button>

                  {/* Liste des élèves */}
                  {ouvert === g.id && g.eleves.length > 0 && (
                    <div style={{ borderTop: `1px solid var(--border-light)` }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-gray)' }}>
                            <th style={{ padding: '10px 24px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Élève</th>
                            <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score</th>
                            <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Compréhension</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.eleves.map((e, i) => (
                            <tr key={e.id} style={{
                              borderTop: '1px solid var(--border-light)',
                              background: i % 2 === 0 ? 'white' : 'var(--bg-gray)',
                            }}>
                              <td style={{ padding: '12px 24px', fontWeight: 500, color: 'var(--primary-dark)' }}>
                                {e.nom} {e.prenom}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <span style={{
                                  background: g.fond, color: g.couleur,
                                  fontWeight: 700, fontSize: 13,
                                  padding: '3px 12px', borderRadius: 8,
                                }}>
                                  {e.score} m/min
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                {scoreComprehension(e)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Zone remédiation (stub) */}
                      <div style={{
                        margin: '16px 24px',
                        padding: '14px 18px',
                        background: 'rgba(201,168,76,0.06)',
                        border: '1px dashed rgba(201,168,76,0.4)',
                        borderRadius: 12,
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <span style={{ fontSize: 18 }}>💡</span>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                          <strong style={{ color: 'var(--accent-gold)' }}>Idées de remédiation</strong> — disponibles dans une prochaine version.
                        </p>
                      </div>
                    </div>
                  )}

                  {ouvert === g.id && g.eleves.length === 0 && (
                    <div style={{ borderTop: '1px solid var(--border-light)', padding: '20px 24px', color: 'var(--text-tertiary)', fontSize: 13 }}>
                      Aucun élève dans ce groupe.
                    </div>
                  )}
                </div>
              ))}

              {/* Non évalués */}
              {nonEvalues.length > 0 && (
                <div style={{
                  background: 'white', borderRadius: 16,
                  border: '1.5px solid var(--border-main)', overflow: 'hidden',
                }}>
                  <button
                    onClick={() => setOuvert(ouvert === 0 ? null : 0)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', padding: '18px 24px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--font-sans)', textAlign: 'left',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#94A3B8', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary-dark)' }}>
                          Non évalués
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                          Élèves sans score pour cette période
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ background: '#F1F5F9', color: '#64748B', fontWeight: 700, fontSize: 13, padding: '4px 14px', borderRadius: 20 }}>
                        {nonEvalues.length} élève{nonEvalues.length > 1 ? 's' : ''}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 16 }}>
                        {ouvert === 0 ? '▲' : '▼'}
                      </span>
                    </div>
                  </button>

                  {ouvert === 0 && (
                    <div style={{ borderTop: '1px solid var(--border-light)', padding: '4px 0' }}>
                      {nonEvalues.map((e, i) => (
                        <div key={e.id} style={{
                          padding: '11px 24px', fontSize: 13,
                          fontWeight: 500, color: 'var(--primary-dark)',
                          borderTop: i > 0 ? '1px solid var(--border-light)' : 'none',
                        }}>
                          {e.nom} {e.prenom}
                        </div>
                      ))}
                      <div style={{ padding: '12px 24px' }}>
                        <button
                          onClick={() => router.push(`/dashboard/saisie?classe=${classeId}`)}
                          style={{
                            background: 'var(--primary-dark)', color: 'white',
                            border: 'none', borderRadius: 10,
                            padding: '10px 20px', fontSize: 13, fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'var(--font-sans)',
                          }}>
                          ✏️ Saisir les scores manquants
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
        </>)}
      </main>
    </div>
  )
}
