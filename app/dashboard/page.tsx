'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'
import styles from './page.module.css'

// ── Types ──────────────────────────────────────────────────────────────────

type StatGlobale = {
  nbEleves: number
  nbClasses: number
  nbPassations: number
  scoreMoyen: number | null
  txNE: number
}

type Activite = {
  eleve_nom: string
  eleve_prenom: string
  classe: string
  score: number | null
  non_evalue: boolean
  periode: string
  created_at: string
}

type StatClasse = {
  classeId: string
  classeNom: string
  niveau: string
  periode: string
  nbEleves: number
  nbEvalues: number
  nbNE: number         // non_evalue = true
  nbNonRenseignes: number  // pas de passation du tout
  moyenne: number | null
  min: number | null
  max: number | null
}

type EleveAlert = {
  id: string
  nom: string
  prenom: string
  classeNom: string
  type: 'non_evalue' | 'non_renseigne'
}

type EnseignantSansSaisie = {
  nom: string
  prenom: string
  classes: string[]
}

type EtabStat = {
  id: string
  nom: string
  nbEleves: number
  nbEvalues: number
  nbNE: number
  nbNonRens: number
  moyenne: number | null
  pctFragiles: number
  ensSansSaisie: number
}

// ── Composant ──────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [stats, setStats]                     = useState<StatGlobale | null>(null)
  const [activite, setActivite]               = useState<Activite[]>([])
  const [statsClasses, setStatsClasses]       = useState<StatClasse[]>([])
  const [alertes, setAlertes]                 = useState<EleveAlert[]>([])
  const [ensSansSaisie, setEnsSansSaisie]     = useState<EnseignantSansSaisie[]>([])
  const [periodeCode, setPeriodeCode]         = useState('—')
  const [etabsStats, setEtabsStats]           = useState<EtabStat[]>([])
  const [coordoPeriodes, setCoordoPeriodes]   = useState<{code: string}[]>([])
  const [coordoPeriodeCode, setCoordoPeriodeCode] = useState('')
  const [periodesEns, setPeriodesEns]         = useState<{id:string, code:string}[]>([])
  const [periodeEnsId, setPeriodeEnsId]       = useState('')
  const [loading, setLoading]                 = useState(true)
  const { profil, loading: profilLoading } = useProfil()
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!profilLoading && profil) chargerDonnees()
  }, [profil, profilLoading])

  useEffect(() => {
    if (periodeEnsId && profil?.role === 'enseignant') {
      chargerDonneesEnseignant(periodeEnsId)
    }
  }, [periodeEnsId])

  async function chargerDonnees() {
    if (!profil) return

    if (profil.role === 'enseignant') {
      await chargerDonneesEnseignant()
    } else if (['directeur', 'principal'].includes(profil.role)) {
      await chargerDonneesDirection()
    } else if (['coordo_rep', 'ien', 'ia_dasen', 'recteur'].includes(profil.role)) {
      await chargerDonneesReseau()
    } else {
      await chargerStatsGlobales()
    }
    setLoading(false)
  }

  // ── Vue enseignant ─────────────────────────────────────────────────────

  async function chargerDonneesEnseignant(selectedPeriodeId?: string) {
    // 1. Classes assignées — 1 requête
    const { data: assignees } = await supabase
      .from('enseignant_classes')
      .select('classe_id, classe:classes(id, nom, niveau, etablissement_id)')
      .eq('enseignant_id', profil!.id)

    if (!assignees || assignees.length === 0) {
      setStats({ nbEleves: 0, nbClasses: 0, nbPassations: 0, scoreMoyen: null, txNE: 0 })
      return
    }

    const classeIds = (assignees as any[]).map(a => a.classe_id)
    const etabIds   = [...new Set((assignees as any[])
      .map(a => (a.classe as any)?.etablissement_id).filter(Boolean))]

    // 2. Toutes les périodes actives pour ces établissements (dédupliquées par code)
    let perQ = supabase.from('periodes').select('id, code, label')
      .eq('actif', true).order('code', { ascending: false })
    if (etabIds.length > 0) perQ = perQ.in('etablissement_id', etabIds as string[])
    const { data: periodesBrutes } = await perQ
    const seen = new Set<string>()
    const deduped = (periodesBrutes || []).filter(p => {
      if (seen.has(p.code)) return false; seen.add(p.code); return true
    })
    setPeriodesEns(deduped)

    const periodeActuelle = (selectedPeriodeId
      ? deduped.find(p => p.id === selectedPeriodeId)
      : null) ?? deduped[0] ?? null
    if (periodeActuelle && !periodeEnsId) setPeriodeEnsId(periodeActuelle.id)

    // 3. TOUS les élèves actifs en une seule requête (remplace N requêtes)
    const { data: tousElevesData } = await supabase
      .from('eleves').select('id, nom, prenom, classe_id')
      .in('classe_id', classeIds).eq('actif', true)
    const tousEleves = tousElevesData || []
    const eleveIds = tousEleves.map((e: any) => e.id)

    // 4. TOUTES les passations (toutes périodes) — filtre par code en mémoire comme la page statistiques
    let toutesPassBrutes: any[] = []
    if (eleveIds.length > 0) {
      const { data: passData } = await supabase
        .from('passations').select('eleve_id, score, non_evalue, periode:periodes(code)')
        .in('eleve_id', eleveIds)
      toutesPassBrutes = passData || []
    }
    const periodeCodeActuelle = periodeActuelle?.code || ''
    const toutesPass = toutesPassBrutes.filter(p => p.periode?.code === periodeCodeActuelle)

    // 5. Calcul par classe en mémoire (zéro requête supplémentaire)
    const alertesGlobal: EleveAlert[] = []
    const statsC: StatClasse[] = (assignees as any[]).map(a => {
      const cid        = a.classe_id
      const cInfo      = a.classe
      const elevesC    = tousEleves.filter((e: any) => e.classe_id === cid)
      const idsClasse  = new Set(elevesC.map((e: any) => e.id))
      const passC      = toutesPass.filter(p => idsClasse.has(p.eleve_id))
      const idsAvecP   = new Set(passC.map(p => p.eleve_id))
      const evalues    = passC.filter(p => !p.non_evalue && p.score != null && p.score > 0)
      const ne         = passC.filter(p => p.non_evalue)
      const scores     = evalues.map(p => p.score as number)

      ne.forEach((p: any) => {
        const el = tousEleves.find((e: any) => e.id === p.eleve_id)
        if (el) alertesGlobal.push({ id: el.id, nom: el.nom, prenom: el.prenom, classeNom: cInfo?.nom || '', type: 'non_evalue' })
      })
      elevesC.filter((e: any) => !idsAvecP.has(e.id)).forEach((e: any) => {
        alertesGlobal.push({ id: e.id, nom: e.nom, prenom: e.prenom, classeNom: cInfo?.nom || '', type: 'non_renseigne' })
      })

      return {
        classeId:        cid,
        classeNom:       cInfo?.nom || cid,
        niveau:          cInfo?.niveau || '',
        periode:         periodeActuelle?.code || '—',
        nbEleves:        elevesC.length,
        nbEvalues:       evalues.length,
        nbNE:            ne.length,
        nbNonRenseignes: Math.max(0, elevesC.length - passC.length),
        moyenne:         scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        min:             scores.length > 0 ? Math.min(...scores) : null,
        max:             scores.length > 0 ? Math.max(...scores) : null,
      }
    })

    setStatsClasses(statsC)
    setAlertes(alertesGlobal)
    setPeriodeCode(periodeCodeActuelle)

    // 6. KPIs globaux calculés en mémoire
    const totalEvalues = statsC.reduce((s, c) => s + c.nbEvalues, 0)
    const totalNE      = statsC.reduce((s, c) => s + c.nbNE, 0)
    const totalNR      = statsC.reduce((s, c) => s + c.nbNonRenseignes, 0)
    const totalPass    = totalEvalues + totalNE
    const tousScores   = statsC.flatMap(c => c.moyenne != null ? [c.moyenne] : [])
    const totalEleves  = tousEleves.length
    setStats({
      nbEleves:     totalEleves,
      nbClasses:    statsC.length,
      nbPassations: totalPass,
      scoreMoyen:   tousScores.length > 0 ? Math.round(tousScores.reduce((a, b) => a + b, 0) / tousScores.length) : null,
      txNE:         totalEleves > 0 ? Math.round((totalNE + totalNR) / totalEleves * 100) : 0,
    })

    // 7. Activité récente — 1 requête (au lieu de N)
    if (eleveIds.length > 0) {
      const { data: recentes } = await supabase
        .from('passations')
        .select('score, non_evalue, created_at, eleve:eleves(nom, prenom, classe:classes(nom)), periode:periodes(code)')
        .in('eleve_id', eleveIds)
        .order('created_at', { ascending: false }).limit(8)
      setActivite((recentes || []).filter((p: any) => p.eleve).map((p: any) => ({
        eleve_nom:    p.eleve?.nom || '',
        eleve_prenom: p.eleve?.prenom || '',
        classe:       p.eleve?.classe?.nom || '',
        score:        p.score,
        non_evalue:   p.non_evalue,
        periode:      p.periode?.code || '',
        created_at:   p.created_at,
      })))
    }
  }

  // ── Vue direction ─────────────────────────────────────────────────────

  async function chargerDonneesDirection() {
    if (!profil?.etablissement_id) return

    // Classes de l'établissement
    const { data: classesData } = await supabase
      .from('classes').select('id, nom, niveau')
      .eq('etablissement_id', profil.etablissement_id).order('niveau')
    const classeIds = (classesData || []).map((c: any) => c.id)
    if (classeIds.length === 0) {
      setStats({ nbEleves: 0, nbClasses: 0, nbPassations: 0, scoreMoyen: null, txNE: 0 })
      return
    }

    // Période active la plus récente
    const { data: periodes } = await supabase
      .from('periodes').select('id, code').eq('actif', true)
      .order('code', { ascending: false }).limit(1)
    const periodeActive = periodes?.[0] || null
    if (periodeActive) setPeriodeCode(periodeActive.code)

    // Assignations enseignants
    const { data: assignations } = await supabase
      .from('enseignant_classes')
      .select('classe_id, enseignant_id, enseignant:profils(nom, prenom)')
      .in('classe_id', classeIds)

    // Élèves actifs
    const { data: elevesData } = await supabase
      .from('eleves').select('id, classe_id')
      .in('classe_id', classeIds).eq('actif', true)
    const eleveIds = (elevesData || []).map((e: any) => e.id)

    // Passations de la période active
    let passData: any[] = []
    if (periodeActive && eleveIds.length > 0) {
      const { data } = await supabase
        .from('passations')
        .select('eleve_id, score, non_evalue, enseignant_id')
        .eq('periode_id', periodeActive.id)
        .in('eleve_id', eleveIds)
      passData = data || []
    }

    // Stats par classe
    const statsC: StatClasse[] = (classesData || []).map((c: any) => {
      const elevesClasse = (elevesData || []).filter((e: any) => e.classe_id === c.id)
      const idsClasse = new Set(elevesClasse.map((e: any) => e.id))
      const passClasse = passData.filter(p => idsClasse.has(p.eleve_id))
      const idsAvecPass = new Set(passClasse.map(p => p.eleve_id))
      const evalues = passClasse.filter(p => !p.non_evalue && p.score != null && p.score > 0)
      const ne = passClasse.filter(p => p.non_evalue)
      const scores = evalues.map(p => p.score as number)
      const assign = (assignations || []).find((a: any) => a.classe_id === c.id) as any
      const enseignant = assign
        ? `${assign.enseignant?.prenom || ''} ${assign.enseignant?.nom || ''}`.trim() || '—'
        : '—'
      return {
        classeId: c.id, classeNom: c.nom, niveau: c.niveau,
        periode: periodeActive?.code || '—',
        nbEleves: elevesClasse.length,
        nbEvalues: evalues.length, nbNE: ne.length,
        nbNonRenseignes: elevesClasse.length - idsAvecPass.size,
        moyenne: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        min: scores.length > 0 ? Math.min(...scores) : null,
        max: scores.length > 0 ? Math.max(...scores) : null,
        enseignant, sansSaisie: passClasse.length === 0,
      }
    })
    setStatsClasses(statsC)

    // Enseignants sans saisie sur la période
    if (periodeActive) {
      const ensAvecPass = new Set(passData.map(p => p.enseignant_id).filter(Boolean))
      const ensMap: Record<string, EnseignantSansSaisie> = {}
      ;(assignations || []).forEach((a: any) => {
        const id = a.enseignant_id
        if (!ensMap[id]) ensMap[id] = { nom: a.enseignant?.nom || '', prenom: a.enseignant?.prenom || '', classes: [] }
        const c = (classesData || []).find((c: any) => c.id === a.classe_id) as any
        if (c) ensMap[id].classes.push(c.nom)
      })
      setEnsSansSaisie(Object.entries(ensMap).filter(([id]) => !ensAvecPass.has(id)).map(([, v]) => v))
    }

    // Activité récente (10 dernières passations de l'établissement)
    if (eleveIds.length > 0) {
      const { data: recentes } = await supabase
        .from('passations')
        .select('score, non_evalue, created_at, eleve:eleves(nom, prenom, classe:classes(nom)), periode:periodes(code)')
        .in('eleve_id', eleveIds)
        .order('created_at', { ascending: false }).limit(10)
      setActivite((recentes || []).filter((p: any) => p.eleve).map((p: any) => ({
        eleve_nom: p.eleve?.nom || '', eleve_prenom: p.eleve?.prenom || '',
        classe: p.eleve?.classe?.nom || '', score: p.score,
        non_evalue: p.non_evalue, periode: p.periode?.code || '',
        created_at: p.created_at,
      })))
    }

    // KPIs globaux
    const totalEval = statsC.reduce((s, c) => s + c.nbEvalues, 0)
    const totalNE   = statsC.reduce((s, c) => s + c.nbNE, 0)
    const totalPass = totalEval + totalNE
    const moyennes  = statsC.flatMap(c => c.moyenne != null ? [c.moyenne] : [])
    const nbElevesSansPass = statsC.reduce((s, c) => s + c.nbNonRenseignes, 0)
    setStats({
      nbEleves: eleveIds.length,
      nbClasses: classeIds.length,
      nbPassations: totalPass,
      scoreMoyen: moyennes.length > 0 ? Math.round(moyennes.reduce((a, b) => a + b, 0) / moyennes.length) : null,
      txNE: totalPass > 0 ? Math.round(totalNE / totalPass * 100) : 0,
    })
    // Réutiliser nbNonRenseignes global pour afficher dans les KPIs
    // (on le passe via setStats avec un hack sur txNE non utilisé directement)
  }

  // ── Vue réseau (coordo REP/REP+ et IEN) ──────────────────────────────

  function getReseauConfig(): { table: string; field: string } | null {
    if (profil?.role === 'ien') return { table: 'ien_etablissements', field: 'ien_id' }
    if (profil?.role === 'coordo_rep') return { table: 'coordo_etablissements', field: 'coordo_id' }
    return null  // ia_dasen, recteur : tous les établissements
  }

  async function chargerDonneesReseau(codeParam?: string) {
    const config = getReseauConfig()
    let ceData: any[]
    if (config) {
      const { data } = await supabase
        .from(config.table)
        .select('etablissement_id, etablissement:etablissements(id, nom)')
        .eq(config.field, profil!.id)
      ceData = data || []
    } else {
      // ia_dasen / recteur : tous les établissements
      const { data } = await supabase
        .from('etablissements').select('id, nom').order('nom')
      ceData = (data || []).map((e: any) => ({ etablissement_id: e.id, etablissement: e }))
    }

    if (!ceData.length) {
      setStats({ nbEleves: 0, nbClasses: 0, nbPassations: 0, scoreMoyen: null, txNE: 0 })
      return
    }

    const etabIds = ceData.map(ce => ce.etablissement_id)

    // Périodes actives — déduplication par code
    const { data: perData } = await supabase
      .from('periodes').select('id, code').eq('actif', true).order('code')
    const seenCodes = new Set<string>()
    const periodesDedup = (perData || []).filter(p => {
      if (seenCodes.has(p.code)) return false
      seenCodes.add(p.code); return true
    })
    setCoordoPeriodes(periodesDedup.map(p => ({ code: p.code })))

    const codeChoisi = codeParam || periodesDedup[periodesDedup.length - 1]?.code || ''
    setCoordoPeriodeCode(codeChoisi)
    setPeriodeCode(codeChoisi)

    const allPeriodeIds = (perData || []).filter(p => p.code === codeChoisi).map(p => p.id)

    // Classes et élèves
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
    const eleveToClasseId: Record<string, string> = {}
    ;(elevesData || []).forEach((e: any) => { eleveToClasseId[e.id] = e.classe_id })

    // Passations de la période choisie
    let passData: any[] = []
    if (allPeriodeIds.length > 0 && eleveIds.length > 0) {
      const { data } = await supabase
        .from('passations').select('eleve_id, score, non_evalue, enseignant_id')
        .in('periode_id', allPeriodeIds).in('eleve_id', eleveIds)
      passData = data || []
    }

    // Normes (seuil_min pour classer "fragile")
    const { data: normesData } = await supabase
      .from('config_normes').select('niveau, seuil_min')
    const normes = normesData || []

    // Assignations enseignants
    const { data: assignData } = await supabase
      .from('enseignant_classes').select('classe_id, enseignant_id')
      .in('classe_id', classeIds)

    // ── Stats par établissement ────────────────────────────────────────────
    const etabsS: EtabStat[] = (ceData as any[]).map(ce => {
      const etabId       = ce.etablissement_id
      const etabClasses  = (classesData || []).filter((c: any) => c.etablissement_id === etabId)
      const etabClasseIds = new Set(etabClasses.map((c: any) => c.id))
      const etabEleves   = (elevesData || []).filter((e: any) => etabClasseIds.has(e.classe_id))
      const etabEleveIds = new Set(etabEleves.map((e: any) => e.id))
      const etabPass     = passData.filter(p => etabEleveIds.has(p.eleve_id))
      const evalues      = etabPass.filter(p => !p.non_evalue && p.score != null && p.score > 0)
      const ne           = etabPass.filter(p => p.non_evalue)
      const scores       = evalues.map(p => p.score as number)

      // Fragiles : score < seuil_min du niveau
      let fragiles = 0
      evalues.forEach((p: any) => {
        const cl    = classeMap[eleveToClasseId[p.eleve_id]]
        const norme = normes.find(n => n.niveau === cl?.niveau)
        if (norme && p.score < norme.seuil_min) fragiles++
      })

      // Enseignants sans saisie
      const ensAvecPass  = new Set(etabPass.map((p: any) => p.enseignant_id).filter(Boolean))
      const ensAssignes  = new Set((assignData || [])
        .filter((a: any) => etabClasseIds.has(a.classe_id))
        .map((a: any) => a.enseignant_id))
      const nbEnsSS = [...ensAssignes].filter(id => !ensAvecPass.has(id)).length

      return {
        id: etabId,
        nom: ce.etablissement?.nom || '—',
        nbEleves:    etabEleves.length,
        nbEvalues:   evalues.length,
        nbNE:        ne.length,
        nbNonRens:   Math.max(0, etabEleves.length - etabPass.length),
        moyenne:     scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        pctFragiles: evalues.length > 0 ? Math.round(fragiles / evalues.length * 100) : 0,
        ensSansSaisie: nbEnsSS,
      }
    })
    setEtabsStats(etabsS)

    // KPIs réseau globaux
    const totalEleves  = etabsS.reduce((s, e) => s + e.nbEleves, 0)
    const totalEvalues = etabsS.reduce((s, e) => s + e.nbEvalues, 0)
    const totalNE      = etabsS.reduce((s, e) => s + e.nbNE, 0)
    const totalPass    = totalEvalues + totalNE
    const moyennes     = etabsS.flatMap(e => e.moyenne != null ? [e.moyenne] : [])
    setStats({
      nbEleves:     totalEleves,
      nbClasses:    classeIds.length,
      nbPassations: totalPass,
      scoreMoyen:   moyennes.length > 0 ? Math.round(moyennes.reduce((a, b) => a + b, 0) / moyennes.length) : null,
      txNE:         totalPass > 0 ? Math.round(totalNE / totalPass * 100) : 0,
    })
  }

  // ── Vue autres rôles ───────────────────────────────────────────────────

  async function chargerStatsGlobales() {
    let classeQuery = supabase.from('classes').select('id, nom')
    if (profil && ['directeur', 'principal'].includes(profil.role) && profil.etablissement_id) {
      classeQuery = classeQuery.eq('etablissement_id', profil.etablissement_id)
    }
    const { data: classes } = await classeQuery
    const classeIds = (classes || []).map((c: any) => c.id)

    if (classeIds.length === 0) {
      setStats({ nbEleves: 0, nbClasses: 0, nbPassations: 0, scoreMoyen: null, txNE: 0 })
      return
    }

    const { count: nbEleves } = await supabase
      .from('eleves').select('*', { count: 'exact', head: true })
      .in('classe_id', classeIds).eq('actif', true)

    const { data: passations } = await supabase
      .from('passations')
      .select('score, non_evalue, created_at, eleve:eleves(nom, prenom, classe:classes(nom)), periode:periodes(code)')
      .order('created_at', { ascending: false })
      .limit(200)

    const pass    = (passations || []).filter((p: any) => p.eleve)
    const evalues = pass.filter((p: any) => !p.non_evalue && p.score && p.score > 0)
    const ne      = pass.filter((p: any) => p.non_evalue)
    const scores  = evalues.map((p: any) => p.score as number)
    const moyenne = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

    setStats({
      nbEleves:     nbEleves || 0,
      nbClasses:    classeIds.length,
      nbPassations: pass.length,
      scoreMoyen:   moyenne,
      txNE:         pass.length > 0 ? Math.round(ne.length / pass.length * 100) : 0,
    })
    setActivite(pass.slice(0, 8).map((p: any) => ({
      eleve_nom:    p.eleve?.nom || '',
      eleve_prenom: p.eleve?.prenom || '',
      classe:       p.eleve?.classe?.nom || '',
      score:        p.score,
      non_evalue:   p.non_evalue,
      periode:      p.periode?.code || '',
      created_at:   p.created_at,
    })))
  }

  const isEnseignant = profil?.role === 'enseignant'
  const isDirection  = profil && ['directeur', 'principal'].includes(profil.role)
  const isReseau     = profil && ['coordo_rep', 'ien', 'ia_dasen', 'recteur'].includes(profil.role)

  return (
    <div className={styles.page}>
      <Sidebar />
      <ImpersonationBar />

      <main className={styles.main}>
        <h1 className={styles.greeting}>
          Bonjour, <em>{profil?.prenom || '—'}</em>
        </h1>
        <p className={styles.date}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        {loading ? (
          <div className={styles.loading}>Chargement...</div>
        ) : isEnseignant && (stats?.nbClasses ?? 0) === 0 ? (
          /* ── Onboarding enseignant sans classe ── */
          <div style={{
            background: 'white', border: '2px dashed var(--border-main)',
            borderRadius: 20, padding: '48px 40px', textAlign: 'center',
            maxWidth: 520, margin: '0 auto',
          }}>
            <div style={{ fontSize: 52, marginBottom: 20 }}>👋</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary-dark)', marginBottom: 10 }}>
              Bienvenue sur Fluence+
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 36, lineHeight: 1.7 }}>
              Pour commencer, associez vos classes à votre compte.<br />
              Cela ne prend que quelques secondes.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 36, textAlign: 'left' }}>
              {[
                { n: 1, titre: 'Choisissez vos classes', desc: 'Sélectionnez les classes dont vous êtes responsable dans votre établissement.' },
                { n: 2, titre: 'Saisissez les scores', desc: 'Entrez les résultats des élèves après chaque passation de fluence.' },
                { n: 3, titre: 'Suivez la progression', desc: 'Consultez les statistiques et générez des rapports PDF par classe.' },
              ].map(step => (
                <div key={step.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'var(--accent-gold)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 13, flexShrink: 0,
                  }}>{step.n}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary-dark)', marginBottom: 3 }}>{step.titre}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => router.push('/dashboard/eleves')}
              style={{
                background: 'var(--accent-gold)', color: 'white', border: 'none',
                borderRadius: 12, padding: '14px 32px', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}>
              Choisir mes classes →
            </button>
          </div>
        ) : (
          <>
            {/* ── Alerte direction : enseignants sans saisie ── */}
            {isDirection && ensSansSaisie.length > 0 && (
              <div className={styles.alertBanner}>
                <div className={styles.alertIcon}>⚠️</div>
                <div style={{ flex: 1 }}>
                  <div className={styles.alertTitle}>
                    {ensSansSaisie.length} enseignant{ensSansSaisie.length > 1 ? 's' : ''} sans saisie · {periodeCode}
                  </div>
                  <div className={styles.alertList}>
                    {ensSansSaisie.map((e, i) => (
                      <span key={i} className={styles.alertChip}>
                        {e.prenom} {e.nom}
                        <span style={{ opacity: 0.6, marginLeft: 4 }}>· {e.classes.join(', ')}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Alerte élèves non évalués / non renseignés ── */}
            {isEnseignant && alertes.length > 0 && (
              <div className={styles.alertBanner}>
                <div className={styles.alertIcon}>⚠️</div>
                <div style={{ flex: 1 }}>
                  <div className={styles.alertTitle}>
                    {alertes.length} élève{alertes.length > 1 ? 's' : ''} à évaluer
                  </div>
                  <div className={styles.alertList}>
                    {alertes.slice(0, 12).map((a, i) => (
                      <span key={i} className={styles.alertChip}>
                        {a.nom} {a.prenom}
                        <span style={{ opacity: 0.6, marginLeft: 4 }}>
                          {a.type === 'non_evalue' ? '· N.É.' : '· non renseigné'}
                        </span>
                      </span>
                    ))}
                    {alertes.length > 12 && (
                      <span className={styles.alertChip}>+{alertes.length - 12} autres</span>
                    )}
                  </div>
                  <button
                    onClick={() => router.push('/dashboard/saisie' + (statsClasses[0]?.classeId ? '?classe=' + statsClasses[0].classeId : ''))}
                    style={{
                      marginTop: 12, background: '#C2410C', color: 'white',
                      border: 'none', borderRadius: 8, padding: '8px 16px',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                    }}>
                    ✏️ Saisir les scores manquants
                  </button>
                </div>
              </div>
            )}

            {/* ── Sélecteur de période (enseignant) ── */}
            {isEnseignant && periodesEns.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginRight: 4 }}>
                  Période :
                </span>
                {periodesEns.map(p => (
                  <button key={p.id}
                    onClick={() => setPeriodeEnsId(p.id)}
                    style={{
                      padding: '7px 16px', borderRadius: 8, border: '1.5px solid',
                      borderColor: periodeEnsId === p.id ? 'var(--accent-gold)' : 'var(--border-main)',
                      background:  periodeEnsId === p.id ? 'var(--accent-gold)' : 'white',
                      color:       periodeEnsId === p.id ? 'white' : 'var(--text-secondary)',
                      fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}>
                    {p.code}
                  </button>
                ))}
              </div>
            )}

            {/* ── KPI globaux ── */}
            <div className={styles.statsGrid}>
              <div className={`${styles.statCard} ${styles.featured}`}>
                <div className={styles.statLabel}>Score moyen</div>
                <div className={styles.statNum}>{stats?.scoreMoyen ?? '—'}</div>
                <div className={styles.statUnit}>mots / minute</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Élèves</div>
                <div className={styles.statNum}>{stats?.nbEleves ?? '—'}</div>
                <div className={styles.statUnit}>{stats?.nbClasses} classe{(stats?.nbClasses || 0) > 1 ? 's' : ''}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Passations</div>
                <div className={styles.statNum}>{stats?.nbPassations ?? '—'}</div>
                <div className={styles.statUnit}>scores enregistrés</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Non évalués</div>
                <div className={`${styles.statNum} ${(stats?.txNE || 0) > 10 ? styles.statGold : ''}`}>
                  {stats?.txNE ?? 0}%
                </div>
                <div className={styles.statUnit}>des passations</div>
              </div>
            </div>

            {/* ── Stats par classe (enseignant uniquement) ── */}
            {isEnseignant && statsClasses.length > 0 && (
              <>
                <div className={styles.sectionHeader} style={{ marginBottom: 16 }}>
                  <h2 className={styles.sectionTitle}>Mes classes · période {statsClasses[0].periode}</h2>
                  <a href="/dashboard/statistiques" className={styles.sectionLink}>Voir statistiques →</a>
                </div>
                <div className={styles.classeStatsGrid}>
                  {statsClasses.map(c => {
                    const total = c.nbEleves || 1
                    const pctEval = Math.round(c.nbEvalues / total * 100)
                    const pctNE   = Math.round(c.nbNE / total * 100)
                    const pctNR   = Math.round(c.nbNonRenseignes / total * 100)
                    return (
                      <div key={c.classeId} className={styles.classeCard}>
                        <div className={styles.classeCardHeader}>
                          <div className={styles.classeNom}>{c.classeNom}</div>
                          <div className={styles.classeNiveau}>{c.niveau}</div>
                        </div>
                        <div className={styles.classeKpis}>
                          <div className={styles.classeKpi}>
                            <div className={styles.kpiVal}>{c.moyenne ?? '—'}</div>
                            <div className={styles.kpiLabel}>moy. m/min</div>
                          </div>
                          <div className={styles.classeKpi}>
                            <div className={styles.kpiVal}>{c.min ?? '—'}</div>
                            <div className={styles.kpiLabel}>min</div>
                          </div>
                          <div className={styles.classeKpi}>
                            <div className={styles.kpiVal}>{c.max ?? '—'}</div>
                            <div className={styles.kpiLabel}>max</div>
                          </div>
                        </div>
                        <div className={styles.classeJauges}>
                          <div className={styles.jaugeRow}>
                            <div className={styles.jaugeDot} style={{ background: '#16A34A' }} />
                            <span className={styles.jaugeLabel}>Évalués</span>
                            <div className={styles.jaugeBar}>
                              <div className={styles.jaugeFill} style={{ width: `${pctEval}%`, background: '#16A34A' }} />
                            </div>
                            <span className={styles.jaugePct}>{pctEval}%</span>
                          </div>
                          <div className={styles.jaugeRow}>
                            <div className={styles.jaugeDot} style={{ background: '#EA580C' }} />
                            <span className={styles.jaugeLabel}>Non évalués</span>
                            <div className={styles.jaugeBar}>
                              <div className={styles.jaugeFill} style={{ width: `${pctNE}%`, background: '#EA580C' }} />
                            </div>
                            <span className={styles.jaugePct}>{pctNE}%</span>
                          </div>
                          <div className={styles.jaugeRow}>
                            <div className={styles.jaugeDot} style={{ background: '#94A3B8' }} />
                            <span className={styles.jaugeLabel}>Non renseignés</span>
                            <div className={styles.jaugeBar}>
                              <div className={styles.jaugeFill} style={{ width: `${pctNR}%`, background: '#94A3B8' }} />
                            </div>
                            <span className={styles.jaugePct}>{pctNR}%</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* ── Tableau des classes (direction) ── */}
            {isDirection && statsClasses.length > 0 && (
              <>
                <div className={styles.sectionHeader} style={{ marginBottom: 16 }}>
                  <h2 className={styles.sectionTitle}>Classes · période {periodeCode}</h2>
                  <a href="/dashboard/statistiques" className={styles.sectionLink}>Statistiques détaillées →</a>
                </div>
                <div className={styles.activiteTable} style={{ marginBottom: 28 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Classe</th>
                        <th>Niveau</th>
                        <th>Enseignant</th>
                        <th style={{ textAlign: 'center' }}>Élèves</th>
                        <th style={{ textAlign: 'center' }}>Évalués</th>
                        <th style={{ textAlign: 'center' }}>Moyenne</th>
                        <th style={{ textAlign: 'center' }}>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statsClasses.map(c => {
                        const pctEval = c.nbEleves > 0 ? Math.round(c.nbEvalues / c.nbEleves * 100) : 0
                        return (
                          <tr key={c.classeId} style={{ cursor: 'pointer' }}
                            onClick={() => router.push(`/dashboard/eleves/${c.classeId}`)}>
                            <td className={styles.tdNom}>{c.classeNom}</td>
                            <td>{c.niveau}</td>
                            <td style={{ color: '#4A4540' }}>{(c as any).enseignant || '—'}</td>
                            <td style={{ textAlign: 'center' }}>{c.nbEleves}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ fontWeight: 600, color: pctEval >= 80 ? '#16A34A' : pctEval >= 50 ? '#D97706' : '#DC2626' }}>
                                {c.nbEvalues} <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-secondary)' }}>({pctEval}%)</span>
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {c.moyenne != null
                                ? <span className={styles.scoreVal}>{c.moyenne} m/min</span>
                                : <span className={styles.scoreNe}>—</span>}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {(c as any).sansSaisie
                                ? <span style={{ background: '#FEF2F2', color: '#DC2626', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>Aucune saisie</span>
                                : pctEval < 80
                                  ? <span style={{ background: '#FFF7ED', color: '#C2410C', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>En cours</span>
                                  : <span style={{ background: 'rgba(22,163,74,0.08)', color: '#16A34A', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>Complet</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ── Vue coordo REP/REP+ ── */}
            {isReseau && (
              <>
                {/* Sélecteur de période */}
                {coordoPeriodes.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginRight: 4 }}>
                      Période :
                    </span>
                    {coordoPeriodes.map(p => (
                      <button key={p.code}
                        onClick={() => chargerDonneesReseau(p.code)}
                        style={{
                          padding: '7px 16px', borderRadius: 8, border: '1.5px solid',
                          borderColor: coordoPeriodeCode === p.code ? 'var(--accent-gold)' : 'var(--border-main)',
                          background:  coordoPeriodeCode === p.code ? 'var(--accent-gold)' : 'white',
                          color:       coordoPeriodeCode === p.code ? 'white' : 'var(--text-secondary)',
                          fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}>
                        {p.code}
                      </button>
                    ))}
                  </div>
                )}

                {/* Alerte : enseignants sans saisie agrégés par établissement */}
                {etabsStats.some(e => e.ensSansSaisie > 0) && (
                  <div className={styles.alertBanner} style={{ marginBottom: 28 }}>
                    <div className={styles.alertIcon}>⚠️</div>
                    <div style={{ flex: 1 }}>
                      <div className={styles.alertTitle}>
                        Enseignants sans saisie · {coordoPeriodeCode}
                      </div>
                      <div className={styles.alertList}>
                        {etabsStats.filter(e => e.ensSansSaisie > 0).map(e => (
                          <span key={e.id} className={styles.alertChip}>
                            {e.nom}
                            <span style={{ opacity: 0.7, marginLeft: 4 }}>· {e.ensSansSaisie} sans saisie</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tableau réseau */}
                <div className={styles.sectionHeader} style={{ marginBottom: 16 }}>
                  <h2 className={styles.sectionTitle}>
                    Réseau · {coordoPeriodeCode || '—'}
                  </h2>
                  <a href="/dashboard/statistiques" className={styles.sectionLink}>
                    Statistiques réseau →
                  </a>
                </div>
                <div className={styles.activiteTable} style={{ marginBottom: 28 }}>
                  {etabsStats.length === 0 ? (
                    <div className={styles.emptyState}>
                      Aucun établissement dans votre réseau. Contactez l'administrateur.
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Établissement</th>
                          <th style={{ textAlign: 'center' }}>Élèves</th>
                          <th style={{ textAlign: 'center' }}>Évalués</th>
                          <th style={{ textAlign: 'center' }}>Moyenne</th>
                          <th style={{ textAlign: 'center' }}>Fragiles</th>
                          <th style={{ textAlign: 'center' }}>Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {etabsStats.map(e => {
                          const pctEval = e.nbEleves > 0
                            ? Math.round((e.nbEvalues + e.nbNE) / e.nbEleves * 100)
                            : 0
                          return (
                            <tr key={e.id} style={{ cursor: 'pointer' }}
                              onClick={() => router.push(`/dashboard/statistiques`)}>
                              <td className={styles.tdNom}>{e.nom}</td>
                              <td style={{ textAlign: 'center' }}>{e.nbEleves}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{
                                  fontWeight: 600,
                                  color: pctEval >= 80 ? '#16A34A' : pctEval >= 50 ? '#D97706' : '#DC2626',
                                }}>
                                  {e.nbEvalues}{' '}
                                  <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-secondary)' }}>
                                    ({pctEval}%)
                                  </span>
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {e.moyenne != null
                                  ? <span className={styles.scoreVal}>{e.moyenne} m/min</span>
                                  : <span className={styles.scoreNe}>—</span>}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {e.pctFragiles > 0 ? (
                                  <span style={{
                                    fontWeight: 700, fontSize: 13,
                                    color: e.pctFragiles > 40 ? '#DC2626' : e.pctFragiles > 20 ? '#D97706' : '#16A34A',
                                  }}>
                                    {e.pctFragiles}%
                                  </span>
                                ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {pctEval >= 80
                                  ? <span style={{ background: 'rgba(22,163,74,0.08)', color: '#16A34A', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>Complet</span>
                                  : pctEval > 0
                                    ? <span style={{ background: '#FFF7ED', color: '#C2410C', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>En cours</span>
                                    : <span style={{ background: '#FEF2F2', color: '#DC2626', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>Non démarré</span>
                                }
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}

            {/* ── Actions rapides (autres rôles non-enseignant, non-direction) ── */}
            {!isEnseignant && !isDirection && !isReseau && (
              <div className={styles.actionsGrid}>
                <a href="/dashboard/eleves" className={styles.actionCard}>
                  <div className={styles.actionIcon}>👥</div>
                  <div>
                    <div className={styles.actionTitle}>Mes classes</div>
                    <div className={styles.actionSub}>Gérer les élèves</div>
                  </div>
                </a>
                <a href="/dashboard/saisie" className={styles.actionCard}>
                  <div className={styles.actionIcon}>✏️</div>
                  <div>
                    <div className={styles.actionTitle}>Saisie manuelle</div>
                    <div className={styles.actionSub}>Entrer les scores</div>
                  </div>
                </a>
                <a href="/dashboard/statistiques" className={styles.actionCard}>
                  <div className={styles.actionIcon}>📈</div>
                  <div>
                    <div className={styles.actionTitle}>Statistiques</div>
                    <div className={styles.actionSub}>Analyser les résultats</div>
                  </div>
                </a>
              </div>
            )}

            {/* ── Activité récente ── */}
            <div>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Activité récente</h2>
                <a href="/dashboard/statistiques" className={styles.sectionLink}>Voir tout →</a>
              </div>
              <div className={styles.activiteTable}>
                {activite.length === 0 ? (
                  <div className={styles.emptyState}>Aucune saisie pour le moment</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Élève</th>
                        <th>Classe</th>
                        <th>Période</th>
                        <th>Score</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activite.map((a, i) => (
                        <tr key={i}>
                          <td className={styles.tdNom}>{a.eleve_nom} {a.eleve_prenom}</td>
                          <td>{a.classe}</td>
                          <td><span className={styles.badgePeriode}>{a.periode}</span></td>
                          <td>
                            {a.non_evalue
                              ? <span className={styles.scoreNe}>N.É.</span>
                              : <span className={styles.scoreVal}>{a.score} m/min</span>
                            }
                          </td>
                          <td>{new Date(a.created_at).toLocaleDateString('fr-FR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
