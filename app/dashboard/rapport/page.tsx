'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'
import styles from './rapport.module.css'
import { RapportPDF, RapportEtabPDF, RapportCompletPDF, RapportReseauPDF, RapportElevePDF } from './RapportPDF'
import { classerEleve } from '@/app/lib/fluenceUtils'

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFDownloadLink),
  { ssr: false, loading: () => <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Préparation…</span> }
)

// ── Types ──────────────────────────────────────────────────────────────────

type ModeRapport = 'classe' | 'etablissement' | 'complet' | 'reseau' | 'eleve'
type ClasseOption  = { id: string; nom: string; niveau: string; etablissement: { id: string; nom: string } }
type PeriodeOption = { id: string; code: string; label: string }

type DonneesClasse = {
  classe: string; niveau: string; etablissement: string; periode: string
  periodeComp: string | null; enseignant: string; dateGeneration: string
  eleves: {
    nom: string; prenom: string; score: number | null; ne: boolean
    groupe: string; progression: number | null
    q1: string|null; q2: string|null; q3: string|null
    q4: string|null; q5: string|null; q6: string|null
  }[]
  stats: { moyenne: number|null; min: number|null; max: number|null; nbEvalues: number; nbNE: number; total: number }
  normes: { seuil_min: number; seuil_attendu: number } | null
  groupesBesoins: { nom: string; couleur: string; eleves: string[]; suggestions: string }[]
}

type ClasseEtabData = {
  nom: string; niveau: string; nbEleves: number; nbEvalues: number; nbNE: number
  moyenne: number|null; min: number|null; max: number|null; fragiles: number
}

type DonneesEtab = {
  etablissement: string; periode: string; dateGeneration: string; directeur: string
  classes: ClasseEtabData[]
  totaux: { nbEleves: number; nbEvalues: number; moyenne: number|null; fragiles: number }
}

type ClasseCompletData = {
  nom: string; niveau: string
  periodes: { code: string; nbEleves: number; nbEvalues: number; moyenne: number|null; fragiles: number }[]
}

type DonneesComplet = {
  etablissement: string; dateGeneration: string; directeur: string
  periodes: string[]
  classes: ClasseCompletData[]
}

type DonneesEleve = {
  nom: string; prenom: string; dateNaissance: string | null; sexe: string | null
  classe: string; niveau: string; etablissement: string
  dateGeneration: string
  passations: { periode: string; annee: string; score: number | null; ne: boolean; groupe: string; q1: string|null; q2: string|null; q3: string|null; q4: string|null; q5: string|null; q6: string|null }[]
  scoreMoyen: number | null
  dernierGroupe: string
}

type EtabReseauRow = {
  nom: string; type_reseau: string
  nbEleves: number; nbEvalues: number; moyenne: number | null; pctFragiles: number
}

type DonneesReseau = {
  titre: string; periode: string; dateGeneration: string; responsable: string
  nbEtablissements: number; nbEleves: number; nbEvalues: number; scoreMoyen: number | null
  etablissements: EtabReseauRow[]
  scoreParNiveau: { niveau: string; nbEleves: number; nbEvalues: number; moyenne: number | null }[]
  groupes: { label: string; count: number; pct: number }[]
  repVsHorsRep: { rep: number | null; horsRep: number | null } | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function computeFragiles(scores: number[], seuil_min: number): number {
  return scores.filter(s => s < seuil_min).length
}

// ── Composant principal ────────────────────────────────────────────────────

function RapportContent() {
  const [mode, setMode]               = useState<ModeRapport>('complet')
  const [classes, setClasses]         = useState<ClasseOption[]>([])
  const [periodes, setPeriodes]       = useState<PeriodeOption[]>([])
  const [classeId, setClasseId]       = useState('')
  const [periodeId, setPeriodeId]     = useState('')
  const [periodeCompId, setPeriodeCompId] = useState('')
  const [periodeEtabId, setPeriodeEtabId] = useState('')
  const [loading, setLoading]         = useState(true)
  const [generating, setGenerating]   = useState(false)

  const [donneesClasse,     setDonneesClasse]     = useState<DonneesClasse | null>(null)
  const [donneesEtab,       setDonneesEtab]       = useState<DonneesEtab | null>(null)
  const [donneesComplet,    setDonneesComplet]    = useState<DonneesComplet | null>(null)
  // Admin filtres entonnoir
  const [allEtabs, setAllEtabs]       = useState<{ id: string; nom: string; ville: string | null; circonscription: string | null }[]>([])
  const [filtreCirco, setFiltreCirco] = useState('')
  const [filtreVille, setFiltreVille] = useState('')
  const [filtreEtabId, setFiltreEtabId] = useState('')
  const [allClasses, setAllClasses]   = useState<ClasseOption[]>([])
  const [donneesReseau,     setDonneesReseau]     = useState<DonneesReseau | null>(null)
  const [donneesEleve,      setDonneesEleve]      = useState<DonneesEleve | null>(null)
  const [rechercheEleve, setRechercheEleve] = useState('')
  const [resultatsEleve, setResultatsEleve] = useState<{ id: string; nom: string; prenom: string; classe: string }[]>([])
  const [eleveId, setEleveId]         = useState('')

  const { profil } = useProfil()
  const supabase   = createClient()

  useEffect(() => { if (profil) chargerOptions() }, [profil])

  // ── Chargement initial ────────────────────────────────────────────────

  async function chargerOptions() {
    if (!profil) return
    let classesData: ClasseOption[] = []
    if (profil.role === 'enseignant') {
      const { data } = await supabase.from('enseignant_classes')
        .select('classe:classes(id, nom, niveau, etablissement:etablissements(id, nom))')
        .eq('enseignant_id', profil.id)
      classesData = (data || []).map((r: any) => r.classe).filter(Boolean)
    } else if (profil.etablissement_id) {
      const { data } = await supabase.from('classes')
        .select('id, nom, niveau, etablissement:etablissements(id, nom)')
        .eq('etablissement_id', profil.etablissement_id).order('nom')
      classesData = (data as unknown as ClasseOption[]) || []
    } else if (['coordo_rep', 'ien'].includes(profil.role)) {
      const table = profil.role === 'ien' ? 'ien_etablissements' : 'coordo_etablissements'
      const field = profil.role === 'ien' ? 'ien_id' : 'coordo_id'
      const { data: ceData } = await supabase.from(table).select('etablissement_id').eq(field, profil.id)
      const etabIds = (ceData || []).map((e: any) => e.etablissement_id)
      if (etabIds.length > 0) {
        const { data } = await supabase.from('classes')
          .select('id, nom, niveau, etablissement:etablissements(id, nom)')
          .in('etablissement_id', etabIds).order('nom')
        classesData = (data as unknown as ClasseOption[]) || []
      }
    } else {
      // admin, ia_dasen, recteur — charger les établissements + toutes les classes
      const { data: etabsData } = await supabase.from('etablissements').select('id, nom, ville, circonscription').order('nom')
      setAllEtabs(etabsData || [])
      // Charger toutes les classes (pagination)
      let allCls: any[] = []
      let off = 0
      while (true) {
        const { data: batch } = await supabase.from('classes')
          .select('id, nom, niveau, etablissement:etablissements(id, nom)').order('nom').range(off, off + 999)
        if (!batch || batch.length === 0) break
        allCls = allCls.concat(batch)
        if (batch.length < 1000) break
        off += 1000
      }
      classesData = allCls as ClasseOption[]
      setAllClasses(classesData)
    }
    setClasses(classesData)
    if (classesData[0]) setClasseId(classesData[0].id)

    // Périodes — pour admin, charger TOUTES les périodes (pas juste actives)
    const isAdminRole = ['admin', 'ia_dasen', 'recteur'].includes(profil.role)
    const etabId = profil.etablissement_id || (classesData[0] as any)?.etablissement?.id || null
    let perQuery = supabase.from('periodes').select('id, code, label, annee_scolaire').order('annee_scolaire', { ascending: false }).order('code')
    if (!isAdminRole) perQuery = perQuery.eq('actif', true)
    if (etabId && !isAdminRole) perQuery = perQuery.eq('etablissement_id', etabId)
    const { data: rawPer } = await perQuery
    const seen = new Set<string>()
    const perDedup: PeriodeOption[] = []
    for (const p of (rawPer || [])) {
      const key = `${(p as any).annee_scolaire || ''}_${p.code}`
      if (!seen.has(key)) { seen.add(key); perDedup.push(p) }
    }
    setPeriodes(perDedup)
    if (perDedup[0]) { setPeriodeId(perDedup[0].id); setPeriodeEtabId(perDedup[0].id) }
    setLoading(false)
  }

  function filtrerParEtab(etabId: string) {
    setFiltreEtabId(etabId)
    if (!etabId) {
      setClasses(allClasses)
      if (allClasses[0]) setClasseId(allClasses[0].id)
    } else {
      const filtered = allClasses.filter((c: any) => c.etablissement?.id === etabId)
      setClasses(filtered)
      if (filtered[0]) setClasseId(filtered[0].id)
    }
    setDonneesClasse(null); setDonneesEtab(null); setDonneesComplet(null); setDonneesReseau(null); setDonneesEleve(null)
  }

  // ── Génération rapport par classe ─────────────────────────────────────

  async function genererClasse() {
    if (!classeId || !periodeId) return
    setGenerating(true); setDonneesClasse(null)

    const { data: classeData } = await supabase.from('classes')
      .select('nom, niveau, etablissement_id, etablissement:etablissements(nom)').eq('id', classeId).single()
    const { data: periodeData } = await supabase.from('periodes')
      .select('code, label, annee_scolaire').eq('id', periodeId).single()
    // Trouver la période correspondante pour l'établissement de la classe
    const { data: perCorrespondante } = await supabase.from('periodes').select('id')
      .eq('code', periodeData?.code || '').eq('etablissement_id', (classeData as any)?.etablissement_id || '')
      .eq('annee_scolaire', (periodeData as any)?.annee_scolaire || '').limit(1)
    const perIdEffectif = perCorrespondante?.[0]?.id || periodeId
    const { data: elevesIds } = await supabase.from('eleves').select('id').eq('classe_id', classeId).eq('actif', true)
    const { data: passData } = await supabase.from('passations')
      .select('eleve_id, score, non_evalue, groupe_lecture, q1, q2, q3, q4, q5, q6, eleve:eleves(nom, prenom)')
      .eq('periode_id', perIdEffectif).in('eleve_id', (elevesIds || []).map(e => e.id))
    const { data: normesData } = await supabase.from('config_normes')
      .select('seuil_min, seuil_attendu').eq('niveau', classeData?.niveau || '').limit(1)
    const { data: groupesConfig } = await supabase.from('config_groupes')
      .select('nom, couleur, seuil_bas, seuil_haut, suggestions').order('ordre')

    let compScores: Record<string, number> = {}
    let periodeCompCode = ''
    if (periodeCompId && periodeCompId !== periodeId) {
      const { data: periodeCompData } = await supabase.from('periodes').select('code').eq('id', periodeCompId).single()
      periodeCompCode = periodeCompData?.code || ''
      const { data: compData } = await supabase.from('passations').select('eleve_id, score, non_evalue')
        .eq('periode_id', periodeCompId).in('eleve_id', (elevesIds || []).map((e: any) => e.id))
      ;(compData || []).forEach((p: any) => { if (!p.non_evalue && p.score) compScores[p.eleve_id] = p.score })
    }

    const pass   = passData || []
    const normes = normesData?.[0] || null
    const scores = pass.filter(p => !p.non_evalue && p.score && p.score > 0).map(p => p.score as number)

    function getGroupe(score: number | null) {
      if (!score || !normes || !groupesConfig) return null
      for (const g of groupesConfig) {
        const bas  = g.seuil_bas  === 'min' ? normes.seuil_min : g.seuil_bas === 'norme' ? normes.seuil_attendu : Number(g.seuil_bas)
        const haut = g.seuil_haut === 'min' ? normes.seuil_min : g.seuil_haut === 'norme' ? normes.seuil_attendu : g.seuil_haut === '999' ? 9999 : Number(g.seuil_haut)
        if (score >= bas && score < haut) return g
      }
      return null
    }

    const groupesMap: Record<string, any> = {}
    pass.forEach(p => {
      const g = getGroupe(p.score)
      if (!g) return
      if (!groupesMap[g.nom]) groupesMap[g.nom] = { nom: g.nom, couleur: g.couleur, eleves: [], suggestions: g.suggestions || '' }
      groupesMap[g.nom].eleves.push(`${(p.eleve as any)?.nom} ${(p.eleve as any)?.prenom}`)
    })

    setDonneesClasse({
      classe: classeData?.nom || '', niveau: classeData?.niveau || '',
      etablissement: (classeData?.etablissement as any)?.nom || '',
      periode: periodeData?.code || '', periodeComp: periodeCompCode || null,
      enseignant: `${profil?.prenom} ${profil?.nom}`,
      dateGeneration: new Date().toLocaleDateString('fr-FR'),
      eleves: pass.map(p => {
        const scoreComp = compScores[(p as any).eleve_id] ?? null
        return {
          nom: (p.eleve as any)?.nom || '', prenom: (p.eleve as any)?.prenom || '',
          score: p.score, ne: p.non_evalue,
          groupe: getGroupe(p.score)?.nom || '—',
          progression: p.score != null && scoreComp != null ? p.score - scoreComp : null,
          q1: p.q1, q2: p.q2, q3: p.q3, q4: p.q4, q5: p.q5, q6: p.q6,
        }
      }).sort((a, b) => (b.score || 0) - (a.score || 0)),
      stats: {
        moyenne: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        min: scores.length > 0 ? Math.min(...scores) : null,
        max: scores.length > 0 ? Math.max(...scores) : null,
        nbEvalues: scores.length,
        nbNE: pass.filter(p => p.non_evalue).length,
        total: pass.length,
      },
      normes, groupesBesoins: Object.values(groupesMap),
    })
    setGenerating(false)
  }

  // ── Génération rapport établissement ─────────────────────────────────

  async function genererEtab() {
    const etabIdPourRapport = filtreEtabId || profil?.etablissement_id
    if (!etabIdPourRapport || !periodeEtabId) { setGenerating(false); return }
    setGenerating(true); setDonneesEtab(null)

    const { data: etabData } = await supabase.from('etablissements')
      .select('nom').eq('id', etabIdPourRapport).single()
    const { data: periodeData } = await supabase.from('periodes')
      .select('code, annee_scolaire').eq('id', periodeEtabId).single()
    const { data: classesData } = await supabase.from('classes')
      .select('id, nom, niveau').eq('etablissement_id', etabIdPourRapport).order('niveau')
    const { data: normesData } = await supabase.from('config_normes')
      .select('niveau, seuil_min, seuil_attendu')

    const classeIds = (classesData || []).map((c: any) => c.id)
    const { data: elevesData } = await supabase.from('eleves')
      .select('id, classe_id').in('classe_id', classeIds).eq('actif', true)

    // Trouver tous les IDs de période correspondant au code+année pour cet établissement
    let perQuery = supabase.from('periodes').select('id').eq('code', periodeData?.code || '')
    if (periodeData?.annee_scolaire) perQuery = perQuery.eq('annee_scolaire', periodeData.annee_scolaire)
    perQuery = perQuery.eq('etablissement_id', etabIdPourRapport)
    const { data: perIds } = await perQuery
    const periodeIds = (perIds || []).map((p: any) => p.id)

    const eleveIds = (elevesData || []).map((e: any) => e.id)
    let passData: any[] = []
    if (periodeIds.length > 0 && eleveIds.length > 0) {
      const { data } = await supabase.from('passations')
        .select('eleve_id, score, non_evalue').in('periode_id', periodeIds).in('eleve_id', eleveIds)
      passData = data || []
    }

    const eleveToClasse: Record<string, string> = {}
    ;(elevesData || []).forEach((e: any) => { eleveToClasse[e.id] = e.classe_id })

    const classesResult: ClasseEtabData[] = (classesData || []).map((c: any) => {
      const classeEleves = (elevesData || []).filter((e: any) => e.classe_id === c.id)
      const eleveIdsClasse = new Set(classeEleves.map((e: any) => e.id))
      const classePass = passData.filter((p: any) => eleveIdsClasse.has(p.eleve_id))
      const evalues    = classePass.filter((p: any) => !p.non_evalue && p.score != null && p.score > 0)
      const ne         = classePass.filter((p: any) => p.non_evalue)
      const scores     = evalues.map((p: any) => p.score as number)
      const norme      = (normesData || []).find((n: any) => n.niveau === c.niveau)
      return {
        nom: c.nom, niveau: c.niveau,
        nbEleves:  classeEleves.length,
        nbEvalues: evalues.length,
        nbNE:      ne.length,
        moyenne:   scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        min:       scores.length > 0 ? Math.min(...scores) : null,
        max:       scores.length > 0 ? Math.max(...scores) : null,
        fragiles:  norme ? computeFragiles(scores, norme.seuil_min) : 0,
      }
    })

    const allScores   = classesResult.flatMap(c => c.moyenne !== null ? [c.moyenne] : [])
    const totalEleves = classesResult.reduce((a, c) => a + c.nbEleves, 0)
    const totalEval   = classesResult.reduce((a, c) => a + c.nbEvalues, 0)
    const totalFrag   = classesResult.reduce((a, c) => a + c.fragiles, 0)

    setDonneesEtab({
      etablissement: etabData?.nom || '',
      periode: periodeData?.code || '',
      dateGeneration: new Date().toLocaleDateString('fr-FR'),
      directeur: `${profil?.prenom} ${profil?.nom}`,
      classes: classesResult,
      totaux: {
        nbEleves:  totalEleves,
        nbEvalues: totalEval,
        moyenne:   allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null,
        fragiles:  totalFrag,
      },
    })
    setGenerating(false)
  }

  // ── Génération rapport complet ────────────────────────────────────────

  async function genererComplet() {
    const etabIdPourComplet = filtreEtabId || profil?.etablissement_id
    if (!etabIdPourComplet || periodes.length === 0) { setGenerating(false); return }
    setGenerating(true); setDonneesComplet(null)

    const { data: etabData } = await supabase.from('etablissements')
      .select('nom').eq('id', etabIdPourComplet).single()
    const { data: classesData } = await supabase.from('classes')
      .select('id, nom, niveau').eq('etablissement_id', etabIdPourComplet).order('niveau')
    const { data: normesData } = await supabase.from('config_normes')
      .select('niveau, seuil_min, seuil_attendu')

    const classeIds = (classesData || []).map((c: any) => c.id)
    const { data: elevesData } = await supabase.from('eleves')
      .select('id, classe_id').in('classe_id', classeIds).eq('actif', true)
    const eleveIds = (elevesData || []).map((e: any) => e.id)

    // Périodes de cet établissement
    const { data: etabPeriodes } = await supabase.from('periodes').select('id, code')
      .eq('etablissement_id', etabIdPourComplet).eq('type', 'regular')
    const etabPerIds = (etabPeriodes || []).map((p: any) => p.id)

    // Toutes les passations pour ces périodes
    let allPassData: any[] = []
    if (eleveIds.length > 0 && etabPerIds.length > 0) {
      // Pagination par 1000
      let off = 0
      while (true) {
        const { data } = await supabase.from('passations')
          .select('eleve_id, score, non_evalue, periode:periodes(id, code)')
          .in('periode_id', etabPerIds).in('eleve_id', eleveIds).range(off, off + 999)
        if (!data || data.length === 0) break
        allPassData = allPassData.concat(data)
        if (data.length < 1000) break
        off += 1000
      }
    }
    const allPass = allPassData

    const passAll = allPass as any[]

    const classesResult: ClasseCompletData[] = (classesData || []).map((c: any) => {
      const classeEleves   = (elevesData || []).filter((e: any) => e.classe_id === c.id)
      const eleveIdsClasse = new Set(classeEleves.map((e: any) => e.id))
      const norme          = (normesData || []).find((n: any) => n.niveau === c.niveau)

      const periodesData = periodes.map(per => {
        const passP   = passAll.filter((p: any) => p.periode?.code === per.code && eleveIdsClasse.has(p.eleve_id))
        const evalues = passP.filter((p: any) => !p.non_evalue && p.score != null && p.score > 0)
        const scores  = evalues.map((p: any) => p.score as number)
        return {
          code:      per.code,
          nbEleves:  classeEleves.length,
          nbEvalues: evalues.length,
          moyenne:   scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
          fragiles:  norme ? computeFragiles(scores, norme.seuil_min) : 0,
        }
      }).filter(p => p.nbEvalues > 0)

      return { nom: c.nom, niveau: c.niveau, periodes: periodesData }
    })

    setDonneesComplet({
      etablissement:  etabData?.nom || '',
      dateGeneration: new Date().toLocaleDateString('fr-FR'),
      directeur:      `${profil?.prenom} ${profil?.nom}`,
      periodes:       periodes.map(p => p.code),
      classes:        classesResult,
    })
    setGenerating(false)
  }

  // ── Déclencheur selon le mode ─────────────────────────────────────────

  async function genererReseau() {
    if (!profil) return
    setGenerating(true)

    // Utiliser la même année que la période sélectionnée
    const selPeriode = periodes.find(p => p.id === periodeId) || periodes[0]
    const annee = (selPeriode as any)?.annee_scolaire || '2025-2026'

    // Appel à la fonction SQL pré-agrégée
    const { data: raw } = await supabase.rpc('get_admin_dashboard', { p_annee: annee })
    if (!raw) { setGenerating(false); return }

    const d = raw as any
    const totaux = d.totaux || {}
    const statsEtab = (d.stats_etab || []) as any[]
    const statsNiveau = (d.stats_niveau || []) as any[]
    const groupesRaw = (d.groupes || []) as any[]
    const rolesRaw = (d.roles || []) as any[]

    const gMap: Record<string, number> = {}
    groupesRaw.forEach((g: any) => { gMap[g.groupe] = g.nb })
    const totalG = Object.values(gMap).reduce((s: number, n: number) => s + n, 0)

    const etabRows: EtabReseauRow[] = statsEtab.map((e: any) => ({
      nom: e.etab_nom, type_reseau: e.type_reseau || 'Hors REP',
      nbEleves: e.nb_eleves, nbEvalues: e.nb_evalues,
      moyenne: e.moyenne,
      pctFragiles: e.nb_evalues > 0 ? Math.round((e.nb_eleves - e.nb_evalues) / e.nb_eleves * 100) : 0,
    }))

    const scoreParNiveau = statsNiveau.map((n: any) => ({
      niveau: n.niveau, nbEleves: n.nb_eleves, nbEvalues: n.nb_evalues, moyenne: n.moyenne,
    }))

    setDonneesReseau({
      titre: profil.role === 'ien' ? 'Rapport de circonscription' : profil.role === 'coordo_rep' ? 'Rapport réseau REP' : 'Rapport académique',
      periode: selPeriode?.code || '—',
      dateGeneration: new Date().toLocaleDateString('fr-FR'),
      responsable: `${profil.prenom} ${profil.nom}`,
      nbEtablissements: totaux.nb_etablissements || 0,
      nbEleves: totaux.nb_eleves || 0,
      nbEvalues: totaux.nb_evalues || 0,
      scoreMoyen: totaux.score_moyen,
      etablissements: etabRows,
      scoreParNiveau,
      groupes: [
        { label: 'Très fragile', count: gMap['tres_fragile'] || 0, pct: totalG > 0 ? Math.round((gMap['tres_fragile'] || 0) / totalG * 100) : 0 },
        { label: 'Fragile', count: gMap['fragile'] || 0, pct: totalG > 0 ? Math.round((gMap['fragile'] || 0) / totalG * 100) : 0 },
        { label: "En cours d'acq.", count: gMap['en_cours'] || 0, pct: totalG > 0 ? Math.round((gMap['en_cours'] || 0) / totalG * 100) : 0 },
        { label: 'Attendu', count: gMap['attendu'] || 0, pct: totalG > 0 ? Math.round((gMap['attendu'] || 0) / totalG * 100) : 0 },
      ],
      repVsHorsRep: null,
    })
    setGenerating(false)
  }

  async function rechercherElevePDF(query: string) {
    setRechercheEleve(query)
    if (query.trim().length < 2) { setResultatsEleve([]); return }
    const { data } = await supabase.from('eleves')
      .select('id, nom, prenom, classe:classes(nom)')
      .or(`nom.ilike.%${query}%,prenom.ilike.%${query}%,numero_ine.ilike.%${query}%`)
      .eq('actif', true).limit(10)
    setResultatsEleve((data || []).map((e: any) => ({ id: e.id, nom: e.nom, prenom: e.prenom, classe: e.classe?.nom || '' })))
  }

  async function genererEleve() {
    if (!eleveId) return
    setGenerating(true); setDonneesEleve(null)

    const { data: eleve } = await supabase.from('eleves')
      .select('id, nom, prenom, date_naissance, sexe, classe:classes(nom, niveau, etablissement:etablissements(nom))')
      .eq('id', eleveId).single()
    if (!eleve) { setGenerating(false); return }

    const { data: passData } = await supabase.from('passations')
      .select('score, non_evalue, q1, q2, q3, q4, q5, q6, periode:periodes(code, label, annee_scolaire)')
      .eq('eleve_id', eleveId)
      .order('created_at')

    const { data: normesData } = await supabase.from('config_normes')
      .select('niveau, seuil_min, seuil_attendu')
    const norme = (normesData || []).find((n: any) => n.niveau === (eleve as any).classe?.niveau)

    const passations = (passData || []).map((p: any) => {
      let groupe = '—'
      if (p.score && !p.non_evalue && norme) {
        const s = p.score
        if (s < Math.round(norme.seuil_min * 0.7)) groupe = 'Très fragile'
        else if (s < norme.seuil_min) groupe = 'Fragile'
        else if (s < norme.seuil_attendu) groupe = "En cours d'acq."
        else groupe = 'Attendu'
      }
      return {
        periode: p.periode?.code || '', annee: p.periode?.annee_scolaire || '',
        score: p.score, ne: p.non_evalue, groupe,
        q1: p.q1, q2: p.q2, q3: p.q3, q4: p.q4, q5: p.q5, q6: p.q6,
      }
    })

    const scores = passations.filter(p => p.score && !p.ne).map(p => p.score!)
    const dernierP = passations[passations.length - 1]

    setDonneesEleve({
      nom: (eleve as any).nom, prenom: (eleve as any).prenom,
      dateNaissance: (eleve as any).date_naissance, sexe: (eleve as any).sexe,
      classe: (eleve as any).classe?.nom || '', niveau: (eleve as any).classe?.niveau || '',
      etablissement: (eleve as any).classe?.etablissement?.nom || '',
      dateGeneration: new Date().toLocaleDateString('fr-FR'),
      passations,
      scoreMoyen: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      dernierGroupe: dernierP?.groupe || '—',
    })
    setGenerating(false)
  }

  function generer() {
    if (mode === 'classe')             genererClasse()
    else if (mode === 'etablissement') genererEtab()
    else if (mode === 'reseau')        genererReseau()
    else if (mode === 'eleve')         genererEleve()
    else                               genererComplet()
  }

  function onModeChange(m: ModeRapport) {
    setMode(m)
    setDonneesClasse(null); setDonneesEtab(null); setDonneesComplet(null); setDonneesReseau(null); setDonneesEleve(null)
  }

  const isDirection = profil && ['directeur', 'principal'].includes(profil.role)
  const canMultiRapport = profil && ['directeur', 'principal', 'admin', 'coordo_rep', 'ien', 'ia_dasen', 'recteur'].includes(profil.role)
  const isReseauRole = profil && ['coordo_rep', 'ien', 'ia_dasen', 'recteur', 'admin'].includes(profil.role)
  const donneesPrete = mode === 'classe' ? donneesClasse : mode === 'etablissement' ? donneesEtab : mode === 'reseau' ? donneesReseau : mode === 'eleve' ? donneesEleve : donneesComplet

  return (
    <div className={styles.page}>
      <Sidebar />
      <ImpersonationBar />

      <main className={styles.main}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <h1 className={styles.title}>Rapports PDF</h1>
          <p className={styles.subtitle}>Générez des rapports de fluence pour votre établissement</p>
        </div>

        {loading ? (
          <div className={styles.loading}>Chargement…</div>
        ) : isReseauRole ? (
          /* VUE ENTONNOIR */
          (() => {
            const circos = [...new Set(allEtabs.map(e => e.circonscription).filter(Boolean))].sort() as string[]
            const villes = [...new Set(allEtabs.filter(e => !filtreCirco || e.circonscription === filtreCirco).map(e => e.ville).filter(Boolean))].sort() as string[]
            const etabsFiltres = allEtabs.filter(e => (!filtreCirco || e.circonscription === filtreCirco) && (!filtreVille || e.ville === filtreVille))
            const classesFiltrees = filtreEtabId ? classes : []

            return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', padding: 28 }}>
                <h3 style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary-dark)', marginBottom: 20, fontFamily: 'var(--font-sans)' }}>
                  Sélectionnez le périmètre du rapport
                </h3>

                {/* Période */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '10px 16px', background: 'var(--bg-gray)', borderRadius: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>Période :</label>
                  <select value={periodeId} onChange={e => { setPeriodeId(e.target.value); setPeriodeEtabId(e.target.value) }} className={styles.select} style={{ width: 'auto', flex: 1 }}>
                    {periodes.map(p => <option key={p.id} value={p.id}>{p.code}{(p as any).annee_scolaire ? ` (${(p as any).annee_scolaire})` : ''}</option>)}
                  </select>
                </div>

                {/* 1. Circonscription */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', display: 'block', marginBottom: 8 }}>1. Circonscription</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                    <button onClick={() => { setFiltreCirco(''); setFiltreVille(''); setFiltreEtabId(''); setClasseId(''); setEleveId('') }} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', border: '1.5px solid', borderColor: !filtreCirco ? 'var(--primary-dark)' : 'var(--border-main)', background: !filtreCirco ? 'var(--primary-dark)' : 'white', color: !filtreCirco ? 'white' : 'var(--text-secondary)' }}>Toutes</button>
                    {circos.map(c => (
                      <button key={c} onClick={() => { setFiltreCirco(c); setFiltreVille(''); setFiltreEtabId(''); setClasseId(''); setEleveId('') }} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', border: '1.5px solid', borderColor: filtreCirco === c ? 'var(--primary-dark)' : 'var(--border-main)', background: filtreCirco === c ? 'var(--primary-dark)' : 'white', color: filtreCirco === c ? 'white' : 'var(--text-secondary)' }}>{c}</button>
                    ))}
                  </div>
                </div>

                {/* 2. Ville */}
                {filtreCirco && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', display: 'block', marginBottom: 8 }}>2. Ville</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                      <button onClick={() => { setFiltreVille(''); setFiltreEtabId(''); setClasseId('') }} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', border: '1.5px solid', borderColor: !filtreVille ? 'var(--primary-dark)' : 'var(--border-main)', background: !filtreVille ? 'var(--primary-dark)' : 'white', color: !filtreVille ? 'white' : 'var(--text-secondary)' }}>Toutes</button>
                      {villes.map(v => (
                        <button key={v} onClick={() => { setFiltreVille(v); setFiltreEtabId(''); setClasseId('') }} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', border: '1.5px solid', borderColor: filtreVille === v ? 'var(--primary-dark)' : 'var(--border-main)', background: filtreVille === v ? 'var(--primary-dark)' : 'white', color: filtreVille === v ? 'white' : 'var(--text-secondary)' }}>{v}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Établissement */}
                {(filtreCirco || filtreVille) && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', display: 'block', marginBottom: 8 }}>3. Établissement</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                      {etabsFiltres.map(e => (
                        <button key={e.id} onClick={() => { filtrerParEtab(filtreEtabId === e.id ? '' : e.id); setClasseId(''); setEleveId('') }} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', border: '1.5px solid', borderColor: filtreEtabId === e.id ? '#2563EB' : 'var(--border-main)', background: filtreEtabId === e.id ? '#EFF6FF' : 'white', color: filtreEtabId === e.id ? '#2563EB' : 'var(--text-secondary)' }}>{e.nom.replace('[TEST] ', '')}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Classe */}
                {filtreEtabId && classesFiltrees.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', display: 'block', marginBottom: 8 }}>4. Classe</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                      {classesFiltrees.map(c => (
                        <button key={c.id} onClick={() => { setClasseId(classeId === c.id ? '' : c.id); setEleveId(''); setRechercheEleve('') }} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', border: '1.5px solid', borderColor: classeId === c.id ? '#D97706' : 'var(--border-main)', background: classeId === c.id ? '#FFFBEB' : 'white', color: classeId === c.id ? '#D97706' : 'var(--text-secondary)' }}>{c.nom} · {c.niveau}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Élève */}
                {classeId && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', display: 'block', marginBottom: 8 }}>5. Élève (optionnel)</label>
                    <input value={rechercheEleve} onChange={e => rechercherElevePDF(e.target.value)} placeholder="Rechercher un élève…" style={{ width: '100%', border: '1.5px solid var(--border-main)', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' as const }} />
                    {resultatsEleve.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginTop: 8 }}>
                        {resultatsEleve.map(r => (
                          <button key={r.id} onClick={() => { setEleveId(r.id); setRechercheEleve(r.nom + ' ' + r.prenom); setResultatsEleve([]) }} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', border: '1.5px solid', borderColor: eleveId === r.id ? '#DC2626' : 'var(--border-main)', background: eleveId === r.id ? '#FEF2F2' : 'white', color: eleveId === r.id ? '#DC2626' : 'var(--text-secondary)' }}><strong>{r.nom}</strong> {r.prenom}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bouton Générer */}
              <button onClick={() => {
                if (eleveId) { onModeChange('eleve'); genererEleve() }
                else if (classeId) { onModeChange('classe'); genererClasse() }
                else if (filtreEtabId) { onModeChange('etablissement'); setPeriodeEtabId(periodeId); setTimeout(genererEtab, 100) }
                else { onModeChange('reseau'); genererReseau() }
              }} disabled={generating} style={{
                width: '100%', padding: '14px 28px', borderRadius: 12, border: 'none',
                background: generating ? 'var(--bg-gray)' : 'var(--primary-dark)',
                color: generating ? 'var(--text-secondary)' : 'white',
                fontSize: 15, fontWeight: 700, cursor: generating ? 'default' : 'pointer', fontFamily: 'var(--font-sans)',
              }}>
                {generating ? '⏳ Génération en cours…' : '📄 Générer le rapport ' + (eleveId ? 'élève' : classeId ? 'classe' : filtreEtabId ? 'établissement' : filtreCirco ? 'circonscription' : 'global')}
              </button>

              {/* Téléchargement */}
              {donneesPrete && (
                <div style={{ background: 'white', borderRadius: 16, padding: 28, border: '2px solid #16A34A' }}>
                  <h3 style={{ fontWeight: 800, fontSize: 16, color: '#16A34A', fontFamily: 'var(--font-sans)', margin: '0 0 16px 0' }}>Rapport prêt ✅</h3>
                  <PDFDownloadLink
                    document={
                      mode === 'classe' && donneesClasse ? <RapportPDF donnees={donneesClasse} />
                      : mode === 'etablissement' && donneesEtab ? <RapportEtabPDF donnees={donneesEtab} />
                      : mode === 'reseau' && donneesReseau ? <RapportReseauPDF donnees={donneesReseau} />
                      : mode === 'eleve' && donneesEleve ? <RapportElevePDF donnees={donneesEleve} />
                      : donneesComplet ? <RapportCompletPDF donnees={donneesComplet} /> : <></>
                    }
                    fileName={mode === 'eleve' && donneesEleve ? 'rapport-eleve-' + donneesEleve.nom + '.pdf' : mode === 'classe' && donneesClasse ? 'rapport-classe-' + donneesClasse.classe + '.pdf' : mode === 'etablissement' && donneesEtab ? 'rapport-etab.pdf' : 'rapport-reseau.pdf'}
                  >
                    {({ loading: pdfLoading }: { loading: boolean }) => (
                      <button style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: pdfLoading ? 'var(--bg-gray)' : '#16A34A', fontFamily: 'var(--font-sans)', color: pdfLoading ? 'var(--text-secondary)' : 'white', fontWeight: 700, fontSize: 15, cursor: pdfLoading ? 'default' : 'pointer' }}>
                        {pdfLoading ? '⏳ Préparation du PDF…' : '⬇ Télécharger le PDF'}
                      </button>
                    )}
                  </PDFDownloadLink>
                </div>
              )}
            </div>
            )
          })()
        ) : (
          /* ══════════════════════════════════════════
             VUE CLASSIQUE (enseignant, directeur, principal)
          ══════════════════════════════════════════ */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* ── Sélecteur de type ── */}
            {canMultiRapport && (
              <div style={{ display: 'grid', gridTemplateColumns: isReseauRole ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: 14 }}>
                {[
                  { id: 'complet'      as ModeRapport, icon: '📊', titre: 'Rapport complet',   desc: 'Toutes les classes sur toutes les périodes avec progression T1→T2→T3' },
                  { id: 'etablissement'as ModeRapport, icon: '🏫', titre: 'Par établissement', desc: 'Vue globale de toutes les classes pour une période donnée' },
                  { id: 'classe'       as ModeRapport, icon: '📋', titre: 'Par classe',        desc: 'Rapport détaillé d\'une classe pour une période avec liste des élèves' },
                  { id: 'eleve' as ModeRapport, icon: '👤', titre: 'Par élève', desc: 'Fiche complète d\'un élève avec toutes ses passations et sa progression' },
                  ...(isReseauRole ? [{ id: 'reseau' as ModeRapport, icon: '🌐', titre: 'Rapport réseau',   desc: 'Vue globale de tous les établissements du réseau avec comparaisons' }] : []),
                ].map(m => (
                  <button key={m.id} onClick={() => onModeChange(m.id)} style={{
                    background: 'white',
                    borderRadius: 14, padding: '20px 18px', textAlign: 'left', cursor: 'pointer',
                    border: `2px solid ${mode === m.id ? 'var(--primary-dark)' : 'var(--border-light)'}`,
                    boxShadow: mode === m.id ? '0 0 0 4px rgba(0,24,69,0.06)' : 'none',
                    transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
                  }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>{m.icon}</div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--primary-dark)', marginBottom: 6 }}>{m.titre}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{m.desc}</div>
                    {mode === m.id && (
                      <div style={{ marginTop: 10, display: 'inline-block', background: 'var(--primary-dark)', color: 'white', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6 }}>
                        Sélectionné
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* ── Paramètres selon le mode ── */}
            <div style={{ background: 'white', borderRadius: 16, padding: 28, border: '1.5px solid var(--border-light)' }}>
              <h3 style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary-dark)', marginBottom: 20, fontFamily: 'var(--font-sans)' }}>
                Paramètres
              </h3>

              {/* Entonnoir admin : circo → ville → établissement */}
              {allEtabs.length > 0 && (mode === 'classe' || mode === 'etablissement' || mode === 'complet') && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16, padding: '16px 20px', background: 'var(--bg-gray)', borderRadius: 12 }}>
                  <div>
                    <label className={styles.label}>Circonscription</label>
                    <select value={filtreCirco} onChange={e => { setFiltreCirco(e.target.value); setFiltreVille(''); setFiltreEtabId(''); setClasses(allClasses) }} className={styles.select}>
                      <option value="">— Toutes —</option>
                      {[...new Set(allEtabs.map(e => e.circonscription).filter(Boolean))].sort().map(c => (
                        <option key={c!} value={c!}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={styles.label}>Ville</label>
                    <select value={filtreVille} onChange={e => { setFiltreVille(e.target.value); setFiltreEtabId(''); setClasses(allClasses.filter((c: any) => !e.target.value || allEtabs.find(et => et.id === c.etablissement?.id)?.ville === e.target.value)) }} className={styles.select}>
                      <option value="">— Toutes —</option>
                      {[...new Set(allEtabs.filter(e => !filtreCirco || e.circonscription === filtreCirco).map(e => e.ville).filter(Boolean))].sort().map(v => (
                        <option key={v!} value={v!}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={styles.label}>Établissement</label>
                    <select value={filtreEtabId} onChange={e => filtrerParEtab(e.target.value)} className={styles.select}>
                      <option value="">— Tous —</option>
                      {allEtabs.filter(e => (!filtreCirco || e.circonscription === filtreCirco) && (!filtreVille || e.ville === filtreVille)).map(e => (
                        <option key={e.id} value={e.id}>{e.nom}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: mode === 'classe' ? 'repeat(3,1fr)' : '1fr', gap: 16 }}>

                {/* Mode classe */}
                {mode === 'classe' && (<>
                  <div>
                    <label className={styles.label}>Classe</label>
                    <select value={classeId} onChange={e => { setClasseId(e.target.value); setDonneesClasse(null) }} className={styles.select}>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.nom} · {c.niveau}{c.etablissement ? ` · ${c.etablissement.nom.replace('[TEST] ', '')}` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={styles.label}>Période</label>
                    <select value={periodeId} onChange={e => { setPeriodeId(e.target.value); setDonneesClasse(null) }} className={styles.select}>
                      {periodes.map(p => <option key={p.id} value={p.id}>{p.code} — {p.label}{(p as any).annee_scolaire ? ` (${(p as any).annee_scolaire})` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={styles.label}>Comparer avec <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 11 }}>(optionnel)</span></label>
                    <select value={periodeCompId} onChange={e => { setPeriodeCompId(e.target.value); setDonneesClasse(null) }} className={styles.select}>
                      <option value="">— Aucune comparaison —</option>
                      {periodes.filter(p => p.id !== periodeId).map(p => <option key={p.id} value={p.id}>{p.code} — {p.label}</option>)}
                    </select>
                  </div>
                </>)}

                {/* Mode établissement */}
                {mode === 'etablissement' && (
                  <div style={{ maxWidth: 320 }}>
                    <label className={styles.label}>Période</label>
                    <select value={periodeEtabId} onChange={e => { setPeriodeEtabId(e.target.value); setDonneesEtab(null) }} className={styles.select}>
                      {periodes.map(p => <option key={p.id} value={p.id}>{p.code} — {p.label}{(p as any).annee_scolaire ? ` (${(p as any).annee_scolaire})` : ''}</option>)}
                    </select>
                  </div>
                )}

                {/* Mode élève */}
                {mode === 'eleve' && (
                  <div>
                    <label className={styles.label}>Rechercher un élève (nom, prénom ou INE)</label>
                    <input value={rechercheEleve} onChange={e => rechercherElevePDF(e.target.value)}
                      placeholder="Tapez un nom, prénom ou INE…"
                      style={{ width: '100%', border: '1.5px solid var(--border-main)', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
                    {resultatsEleve.length > 0 && (
                      <div style={{ background: 'var(--bg-gray)', borderRadius: 10, border: '1px solid var(--border-light)', maxHeight: 200, overflowY: 'auto' }}>
                        {resultatsEleve.map(r => (
                          <button key={r.id} onClick={() => { setEleveId(r.id); setRechercheEleve(`${r.nom} ${r.prenom}`); setResultatsEleve([]); setDonneesEleve(null) }}
                            style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '10px 16px', border: 'none', borderBottom: '1px solid var(--border-light)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, textAlign: 'left', color: 'var(--primary-dark)' }}>
                            <span><strong>{r.nom}</strong> {r.prenom}</span>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{r.classe}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {eleveId && <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>Élève sélectionné — cliquez sur Générer</p>}
                  </div>
                )}

                {/* Mode réseau */}
                {mode === 'reseau' && (
                  <div style={{ padding: '12px 16px', background: 'var(--bg-gray)', borderRadius: 10, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>🌐</span>
                    Le rapport réseau inclut tous les établissements de votre périmètre pour la dernière période active ({periodes[periodes.length - 1]?.code || '—'}).
                  </div>
                )}

                {/* Mode complet */}
                {mode === 'complet' && (
                  <div style={{ padding: '12px 16px', background: 'var(--bg-gray)', borderRadius: 10, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>ℹ️</span>
                    Le rapport complet inclut automatiquement toutes les périodes disponibles ({periodes.map(p => p.code).join(', ')}).
                  </div>
                )}
              </div>

              <button
                onClick={generer}
                disabled={generating || (mode === 'classe' && !classeId) || (mode === 'etablissement' && !periodeEtabId)}
                style={{
                  marginTop: 20, background: 'var(--primary-dark)', color: 'white',
                  border: 'none', borderRadius: 12, padding: '12px 28px',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  opacity: generating ? 0.6 : 1, transition: 'opacity 0.15s',
                }}
              >
                {generating ? '⏳ Génération en cours…' : '📊 Générer le rapport'}
              </button>
            </div>

            {/* ── Résultat ── */}
            {donneesPrete && (
              <div style={{ background: 'white', borderRadius: 16, padding: 28, border: '1.5px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontWeight: 800, fontSize: 16, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>
                      Rapport prêt ✅
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {mode === 'classe' && donneesClasse && `${donneesClasse.classe} · ${donneesClasse.periode}`}
                      {mode === 'etablissement' && donneesEtab && `${donneesEtab.etablissement} · ${donneesEtab.periode}`}
                      {mode === 'eleve' && donneesEleve && `${donneesEleve.prenom} ${donneesEleve.nom} · ${donneesEleve.classe}`}
                      {mode === 'reseau' && donneesReseau && `${donneesReseau.titre} · ${donneesReseau.periode}`}
                      {mode === 'complet' && donneesComplet && `${donneesComplet.etablissement} · ${donneesComplet.periodes.join(', ')}`}
                    </p>
                  </div>
                </div>

                {/* KPIs résumé */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                  {mode === 'classe' && donneesClasse && [
                    { label: 'Score moyen', val: donneesClasse.stats.moyenne ?? '—', color: 'var(--primary-dark)', bg: 'rgba(0,24,69,0.05)' },
                    { label: 'Évalués',     val: donneesClasse.stats.nbEvalues,       color: '#16A34A',            bg: 'rgba(22,163,74,0.06)' },
                    { label: 'Non évalués', val: donneesClasse.stats.nbNE,            color: '#EA580C',            bg: 'rgba(234,88,12,0.06)' },
                  ].map(k => (
                    <div key={k.label} style={{ background: k.bg, borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: k.color, fontFamily: 'var(--font-serif)' }}>{k.val}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{k.label}</div>
                    </div>
                  ))}
                  {mode === 'etablissement' && donneesEtab && [
                    { label: 'Classes',     val: donneesEtab.classes.length,          color: 'var(--primary-dark)', bg: 'rgba(0,24,69,0.05)' },
                    { label: 'Élèves évalués', val: donneesEtab.totaux.nbEvalues,     color: '#16A34A',             bg: 'rgba(22,163,74,0.06)' },
                    { label: 'Élèves fragiles', val: donneesEtab.totaux.fragiles,     color: '#DC2626',             bg: 'rgba(220,38,38,0.06)' },
                  ].map(k => (
                    <div key={k.label} style={{ background: k.bg, borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: k.color, fontFamily: 'var(--font-serif)' }}>{k.val}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{k.label}</div>
                    </div>
                  ))}
                  {mode === 'eleve' && donneesEleve && [
                    { label: 'Score moyen', val: donneesEleve.scoreMoyen ?? '—', color: 'var(--primary-dark)', bg: 'rgba(0,24,69,0.05)' },
                    { label: 'Passations',  val: donneesEleve.passations.length,  color: '#2563EB',             bg: 'rgba(37,99,235,0.06)' },
                    { label: 'Groupe actuel', val: donneesEleve.dernierGroupe,     color: '#16A34A',             bg: 'rgba(22,163,74,0.06)' },
                  ].map(k => (
                    <div key={k.label} style={{ background: k.bg, borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: k.color, fontFamily: 'var(--font-serif)' }}>{k.val}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{k.label}</div>
                    </div>
                  ))}
                  {mode === 'reseau' && donneesReseau && [
                    { label: 'Établissements', val: donneesReseau.nbEtablissements, color: 'var(--primary-dark)', bg: 'rgba(0,24,69,0.05)' },
                    { label: 'Élèves évalués', val: donneesReseau.nbEvalues,        color: '#16A34A',             bg: 'rgba(22,163,74,0.06)' },
                    { label: 'Score moyen',     val: donneesReseau.scoreMoyen ?? '—', color: '#2563EB',            bg: 'rgba(37,99,235,0.06)' },
                  ].map(k => (
                    <div key={k.label} style={{ background: k.bg, borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: k.color, fontFamily: 'var(--font-serif)' }}>{k.val}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{k.label}</div>
                    </div>
                  ))}
                  {mode === 'complet' && donneesComplet && [
                    { label: 'Classes',   val: donneesComplet.classes.length,   color: 'var(--primary-dark)', bg: 'rgba(0,24,69,0.05)' },
                    { label: 'Périodes',  val: donneesComplet.periodes.length,   color: '#2563EB',             bg: 'rgba(37,99,235,0.06)' },
                    { label: 'Généré le', val: donneesComplet.dateGeneration,    color: 'var(--text-secondary)', bg: 'var(--bg-gray)' },
                  ].map(k => (
                    <div key={k.label} style={{ background: k.bg, borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
                      <div style={{ fontSize: k.label === 'Généré le' ? 14 : 26, fontWeight: 800, color: k.color, fontFamily: k.label === 'Généré le' ? 'var(--font-sans)' : 'var(--font-serif)' }}>{k.val}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{k.label}</div>
                    </div>
                  ))}
                </div>

                {/* Bouton téléchargement */}
                <PDFDownloadLink
                  document={
                    mode === 'classe' && donneesClasse
                      ? <RapportPDF donnees={donneesClasse} />
                      : mode === 'etablissement' && donneesEtab
                        ? <RapportEtabPDF donnees={donneesEtab} />
                        : mode === 'reseau' && donneesReseau
                          ? <RapportReseauPDF donnees={donneesReseau} />
                          : mode === 'eleve' && donneesEleve
                            ? <RapportElevePDF donnees={donneesEleve} />
                            : donneesComplet
                              ? <RapportCompletPDF donnees={donneesComplet} />
                              : <></>
                  }
                  fileName={
                    mode === 'classe' && donneesClasse
                      ? `rapport-fluence-${donneesClasse.classe}-${donneesClasse.periode}.pdf`
                      : mode === 'etablissement' && donneesEtab
                        ? `rapport-etab-${donneesEtab.periode}.pdf`
                        : mode === 'reseau' && donneesReseau
                          ? `rapport-reseau-${donneesReseau.periode}.pdf`
                          : mode === 'eleve' && donneesEleve
                            ? `rapport-eleve-${donneesEleve.nom}-${donneesEleve.prenom}.pdf`
                            : `rapport-complet-${new Date().toLocaleDateString('fr-FR').replace(/\//g,'-')}.pdf`
                  }
                >
                  {({ loading: pdfLoading }: { loading: boolean }) => (
                    <button style={{
                      width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                      background: pdfLoading ? 'var(--bg-gray)' : '#16A34A', fontFamily: 'var(--font-sans)',
                      color: pdfLoading ? 'var(--text-secondary)' : 'white',
                      fontWeight: 700, fontSize: 15, cursor: pdfLoading ? 'default' : 'pointer',
                      transition: 'background 0.15s',
                    }}>
                      {pdfLoading ? '⏳ Préparation du PDF…' : '⬇ Télécharger le PDF'}
                    </button>
                  )}
                </PDFDownloadLink>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  )
}

export default function Rapport() {
  return (
    <Suspense fallback={<div style={{ marginLeft: 260, padding: 48, color: 'var(--text-tertiary)' }}>Chargement…</div>}>
      <RapportContent />
    </Suspense>
  )
}
