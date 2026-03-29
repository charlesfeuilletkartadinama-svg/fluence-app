'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'
import styles from './page.module.css'
import { ROLE_LABELS } from '@/app/lib/types'

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
  nbFragiles?: number
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

type AdminOverview = {
  nbEtablissements: number
  nbUtilisateurs: number
  periodesActives: number
  invitationsActives: number
  usersByRole: Record<string, number>
  periodesDetail: { code: string; label: string; actif: boolean; saisie_ouverte: boolean; type: string | null }[]
  // Pilotage pédagogique
  nbElevesTotal: number
  nbElevesEvalues: number
  scoreMoyenGlobal: number | null
  scoreParNiveau: { niveau: string; moyenne: number | null; nbEleves: number; nbEvalues: number }[]
  groupesRepartition: { label: string; count: number; color: string }[]
  evolutionPeriodes: { code: string; moyenne: number | null }[]
  // Suivi opérationnel
  etabsSansActivite: { nom: string; ville: string | null }[]
  enseignantsSansSaisie: { nom: string; prenom: string; etablissement: string }[]
  topEtabs: { nom: string; moyenne: number; pctFragiles: number }[]
  bottomEtabs: { nom: string; moyenne: number; pctFragiles: number }[]
  // QCM
  qcmConfigures: number
  qcmNiveauxTotal: number
  qcmElevesComplete: number
  qcmElevesTotal: number
}

type NiveauStat = {
  niveau: string
  nbEleves: number
  nbEvalues: number
  nbNE: number
  nbNonRens: number
  moyenne: number | null
  nbFragiles: number
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
  const [niveauxStats, setNiveauxStats]       = useState<NiveauStat[]>([])
  const [etabsStats, setEtabsStats]           = useState<EtabStat[]>([])
  const [coordoPeriodes, setCoordoPeriodes]   = useState<{code: string}[]>([])
  const [coordoPeriodeCode, setCoordoPeriodeCode] = useState('')
  const [periodesEns, setPeriodesEns]         = useState<{id:string, code:string}[]>([])
  const [periodeEnsId, setPeriodeEnsId]       = useState('')
  const [loading, setLoading]                 = useState(true)
  const [adminOverview, setAdminOverview]     = useState<AdminOverview | null>(null)
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
      // admin et rôles futurs → vue statistiques globales
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
      .eq('actif', true).order('code', { ascending: true })
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

    const { data: normesData } = await supabase
      .from('config_normes').select('niveau, seuil_min')

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
      const norme = (normesData || []).find((n: any) => n.niveau === c.niveau)
      const fragiles = evalues.filter((p: any) => norme && p.score < norme.seuil_min)
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
        nbFragiles: fragiles.length,
      }
    })
    setStatsClasses(statsC)

    // Agrégation par niveau
    const niveauxMap: Record<string, NiveauStat> = {}
    statsC.forEach(c => {
      const niv = c.niveau || 'Autre'
      if (!niveauxMap[niv]) niveauxMap[niv] = { niveau: niv, nbEleves: 0, nbEvalues: 0, nbNE: 0, nbNonRens: 0, moyenne: null, nbFragiles: 0 }
      niveauxMap[niv].nbEleves    += c.nbEleves
      niveauxMap[niv].nbEvalues   += c.nbEvalues
      niveauxMap[niv].nbNE        += c.nbNE
      niveauxMap[niv].nbNonRens   += c.nbNonRenseignes
      niveauxMap[niv].nbFragiles  += (c.nbFragiles || 0)
    })
    // Moyenne pondérée par niveau
    const niveauxScores: Record<string, number[]> = {}
    statsC.forEach(c => { if (c.moyenne != null) { if (!niveauxScores[c.niveau]) niveauxScores[c.niveau] = []; niveauxScores[c.niveau].push(c.moyenne) }})
    Object.keys(niveauxMap).forEach(niv => {
      const sc = niveauxScores[niv] || []
      niveauxMap[niv].moyenne = sc.length > 0 ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : null
    })
    setNiveauxStats(Object.values(niveauxMap).sort((a, b) => a.niveau.localeCompare(b.niveau)))

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

    // ── Admin overview complet ──
    const [etabsFullRes, profilsRes, periFullRes, invRes, normesRes, qcmTestsRes] = await Promise.all([
      supabase.from('etablissements').select('id, nom, ville'),
      supabase.from('profils').select('id, role, nom, prenom, etablissement_id'),
      supabase.from('periodes').select('id, code, label, actif, saisie_ouverte, type, etablissement_id').order('code'),
      supabase.from('invitations').select('actif'),
      supabase.from('config_normes').select('niveau, seuil_min, seuil_attendu'),
      supabase.from('qcm_tests').select('id, niveau, periode_id'),
    ])
    const allEtabs = etabsFullRes.data || []
    const allProfils = profilsRes.data || []
    const allPeriodes = periFullRes.data || []
    const allNormes = normesRes.data || []

    // Rôles
    const rolesCounts: Record<string, number> = {}
    allProfils.forEach((u: any) => { rolesCounts[u.role] = (rolesCounts[u.role] || 0) + 1 })

    // Dédupliquer périodes par code
    const seenPCodes = new Set<string>()
    const periDedup = allPeriodes.filter((p: any) => {
      if (seenPCodes.has(p.code)) return false
      seenPCodes.add(p.code); return true
    })

    // Période active courante (la dernière active)
    const periodeActive = periDedup.find((p: any) => p.actif && p.type !== 'evaluation_nationale')

    // Charger TOUS les élèves et passations
    const { data: allEleves } = await supabase.from('eleves')
      .select('id, classe_id, classe:classes(niveau, etablissement_id, nom)')
      .eq('actif', true)

    const { data: allPassations } = await supabase.from('passations')
      .select('eleve_id, score, non_evalue, q1, q2, q3, q4, q5, q6, periode:periodes(code, type)')

    const elevesArr = allEleves || []
    const passArr = allPassations || []

    // Score par niveau (période active)
    const niveauxMap: Record<string, { scores: number[]; nbEleves: number; nbEvalues: number }> = {}
    const NIVEAUX_ORDRE = ['CP', 'CE1', 'CE2', 'CM1', 'CM2', '6eme', '5eme', '4eme', '3eme']
    for (const e of elevesArr) {
      const niv = (e as any).classe?.niveau || 'Autre'
      if (!niveauxMap[niv]) niveauxMap[niv] = { scores: [], nbEleves: 0, nbEvalues: 0 }
      niveauxMap[niv].nbEleves++
      const p = passArr.find((pa: any) => pa.eleve_id === e.id && (pa as any).periode?.code === periodeActive?.code)
      if (p && !p.non_evalue && p.score && p.score > 0) {
        niveauxMap[niv].scores.push(p.score as number)
        niveauxMap[niv].nbEvalues++
      }
    }
    const scoreParNiveau = Object.entries(niveauxMap)
      .map(([niveau, d]) => ({
        niveau,
        moyenne: d.scores.length > 0 ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : null,
        nbEleves: d.nbEleves,
        nbEvalues: d.nbEvalues,
      }))
      .sort((a, b) => {
        const ia = NIVEAUX_ORDRE.indexOf(a.niveau), ib = NIVEAUX_ORDRE.indexOf(b.niveau)
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
      })

    // Groupes de besoin (période active)
    const normeDefault: Record<string, { min: number; attendu: number }> = {}
    for (const n of allNormes) normeDefault[(n as any).niveau] = { min: (n as any).seuil_min, attendu: (n as any).seuil_attendu }
    // Fallback norms
    const defaultNorms: Record<string, { min: number; attendu: number }> = {
      CP: { min: 40, attendu: 55 }, CE1: { min: 65, attendu: 80 }, CE2: { min: 80, attendu: 90 },
      CM1: { min: 90, attendu: 100 }, CM2: { min: 100, attendu: 110 }, '6eme': { min: 110, attendu: 120 },
    }
    let gTresFragile = 0, gFragile = 0, gEnCours = 0, gAttendu = 0
    for (const e of elevesArr) {
      const niv = (e as any).classe?.niveau || ''
      const p = passArr.find((pa: any) => pa.eleve_id === e.id && (pa as any).periode?.code === periodeActive?.code)
      if (!p || p.non_evalue || !p.score) continue
      const norme = normeDefault[niv] || defaultNorms[niv]
      if (!norme) continue
      const s = p.score as number
      if (s < norme.min * 0.7) gTresFragile++
      else if (s < norme.min) gFragile++
      else if (s < norme.attendu) gEnCours++
      else gAttendu++
    }
    const groupesRepartition = [
      { label: 'Très fragile', count: gTresFragile, color: '#DC2626' },
      { label: 'Fragile', count: gFragile, color: '#D97706' },
      { label: "En cours d'acq.", count: gEnCours, color: '#2563EB' },
      { label: 'Attendu', count: gAttendu, color: '#16A34A' },
    ]

    // Évolution entre périodes
    const periCodesActifs = periDedup.filter((p: any) => p.type !== 'evaluation_nationale').map((p: any) => p.code)
    const evolutionPeriodes = periCodesActifs.map(code => {
      const scoresP = passArr
        .filter((pa: any) => (pa as any).periode?.code === code && !pa.non_evalue && pa.score && pa.score > 0)
        .map((pa: any) => pa.score as number)
      return { code, moyenne: scoresP.length > 0 ? Math.round(scoresP.reduce((a, b) => a + b, 0) / scoresP.length) : null }
    })

    // Établissements sans activité (période active)
    const etabsAvecActivite = new Set<string>()
    for (const pa of passArr) {
      if ((pa as any).periode?.code === periodeActive?.code) {
        const el = elevesArr.find(e => e.id === pa.eleve_id)
        if (el) etabsAvecActivite.add((el as any).classe?.etablissement_id)
      }
    }
    const etabsSansActivite = allEtabs.filter(e => !etabsAvecActivite.has(e.id)).map(e => ({ nom: e.nom, ville: e.ville }))

    // Enseignants sans saisie (période active)
    const enseignants = allProfils.filter((p: any) => p.role === 'enseignant')
    const ensAvecSaisie = new Set<string>()
    // On ne peut pas facilement savoir quel enseignant a saisi sans enseignant_id dans passations
    // Simplification : on regarde les enseignants dont aucun élève de leurs classes n'a de passation
    const { data: ecData } = await supabase.from('enseignant_classes').select('enseignant_id, classe_id')
    const ecMap: Record<string, string[]> = {}
    for (const ec of (ecData || [])) {
      if (!ecMap[(ec as any).enseignant_id]) ecMap[(ec as any).enseignant_id] = []
      ecMap[(ec as any).enseignant_id].push((ec as any).classe_id)
    }
    const enseignantsSansSaisie: { nom: string; prenom: string; etablissement: string }[] = []
    for (const ens of enseignants) {
      const classeIds = ecMap[ens.id] || []
      if (classeIds.length === 0) continue
      const eleveIds = elevesArr.filter(e => classeIds.includes(e.classe_id)).map(e => e.id)
      const aPassation = passArr.some((pa: any) => eleveIds.includes(pa.eleve_id) && (pa as any).periode?.code === periodeActive?.code)
      if (!aPassation) {
        const etab = allEtabs.find(e => e.id === ens.etablissement_id)
        enseignantsSansSaisie.push({ nom: ens.nom, prenom: ens.prenom, etablissement: etab?.nom || '—' })
      }
    }

    // Top / Bottom établissements
    const etabScores: Record<string, { nom: string; scores: number[]; nbEleves: number; nbFragiles: number }> = {}
    for (const e of elevesArr) {
      const etabId = (e as any).classe?.etablissement_id
      if (!etabId) continue
      if (!etabScores[etabId]) {
        const etab = allEtabs.find(et => et.id === etabId)
        etabScores[etabId] = { nom: etab?.nom || '?', scores: [], nbEleves: 0, nbFragiles: 0 }
      }
      etabScores[etabId].nbEleves++
      const p = passArr.find((pa: any) => pa.eleve_id === e.id && (pa as any).periode?.code === periodeActive?.code)
      if (p && !p.non_evalue && p.score && p.score > 0) {
        etabScores[etabId].scores.push(p.score as number)
        const niv = (e as any).classe?.niveau || ''
        const norme = normeDefault[niv] || defaultNorms[niv]
        if (norme && (p.score as number) < norme.min) etabScores[etabId].nbFragiles++
      }
    }
    const etabRanking = Object.values(etabScores)
      .filter(e => e.scores.length > 0)
      .map(e => ({
        nom: e.nom,
        moyenne: Math.round(e.scores.reduce((a, b) => a + b, 0) / e.scores.length),
        pctFragiles: Math.round(e.nbFragiles / e.scores.length * 100),
      }))
      .sort((a, b) => b.moyenne - a.moyenne)
    const topEtabs = etabRanking.slice(0, 5)
    const bottomEtabs = etabRanking.slice(-5).reverse()

    // QCM stats
    const qcmTests = qcmTestsRes.data || []
    const qcmConfigures = qcmTests.length
    const qcmNiveauxPossibles = NIVEAUX_ORDRE.length
    // Élèves avec QCM complété (au moins q1 renseigné)
    const qcmComplete = passArr.filter((pa: any) =>
      (pa as any).periode?.code === periodeActive?.code && pa.q1 !== null
    ).length
    const nbElevesEvaluesTotal = elevesArr.length

    // Totaux évalués
    const nbElevesEvalues = passArr.filter((pa: any) =>
      (pa as any).periode?.code === periodeActive?.code && !pa.non_evalue && pa.score && pa.score > 0
    ).length

    setAdminOverview({
      nbEtablissements: allEtabs.length,
      nbUtilisateurs: Object.values(rolesCounts).reduce((s, n) => s + n, 0),
      periodesActives: periDedup.filter((p: any) => p.actif).length,
      invitationsActives: (invRes.data || []).filter((i: any) => i.actif).length,
      usersByRole: rolesCounts,
      periodesDetail: periDedup,
      nbElevesTotal: elevesArr.length,
      nbElevesEvalues,
      scoreMoyenGlobal: moyenne,
      scoreParNiveau,
      groupesRepartition,
      evolutionPeriodes,
      etabsSansActivite,
      enseignantsSansSaisie,
      topEtabs,
      bottomEtabs,
      qcmConfigures,
      qcmNiveauxTotal: qcmNiveauxPossibles,
      qcmElevesComplete: qcmComplete,
      qcmElevesTotal: nbElevesEvaluesTotal,
    })
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

            {/* ── KPI globaux (enseignant et réseau uniquement) ── */}
            {!isDirection && (
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
            )}

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

            {/* ── Vue direction : KPIs + tableau par niveau + tableau classes ── */}
            {isDirection && statsClasses.length > 0 && (
              <>
                {/* KPIs direction */}
                {(() => {
                  const totalEleves   = statsClasses.reduce((s, c) => s + c.nbEleves, 0)
                  const totalEvalues  = statsClasses.reduce((s, c) => s + c.nbEvalues, 0)
                  const totalFragiles = statsClasses.reduce((s, c) => s + (c.nbFragiles || 0), 0)
                  const txCouverture  = totalEleves > 0 ? Math.round(totalEvalues / totalEleves * 100) : 0
                  const txFragiles    = totalEvalues > 0 ? Math.round(totalFragiles / totalEvalues * 100) : 0
                  return (
                    <div className={styles.statsGrid} style={{ marginBottom: 28 }}>
                      <div className={`${styles.statCard} ${styles.featured}`}>
                        <div className={styles.statLabel}>Score moyen</div>
                        <div className={styles.statNum}>{stats?.scoreMoyen ?? '—'}</div>
                        <div className={styles.statUnit}>mots / minute</div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>Couverture</div>
                        <div className={`${styles.statNum} ${txCouverture < 50 ? styles.statGold : ''}`}>{txCouverture}%</div>
                        <div className={styles.statUnit}>{totalEvalues} / {totalEleves} élèves évalués</div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>Élèves fragiles</div>
                        <div className={`${styles.statNum} ${txFragiles > 30 ? styles.statGold : ''}`} style={{ color: txFragiles > 30 ? '#DC2626' : undefined }}>{txFragiles}%</div>
                        <div className={styles.statUnit}>{totalFragiles} élèves (groupes 1+2)</div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>Sans saisie</div>
                        <div className={`${styles.statNum} ${ensSansSaisie.length > 0 ? styles.statGold : ''}`}>{ensSansSaisie.length}</div>
                        <div className={styles.statUnit}>enseignant{ensSansSaisie.length > 1 ? 's' : ''}</div>
                      </div>
                    </div>
                  )
                })()}

                {/* Tableau par niveau */}
                {niveauxStats.length > 0 && (
                  <>
                    <div className={styles.sectionHeader} style={{ marginBottom: 12 }}>
                      <h2 className={styles.sectionTitle}>Par niveau · {periodeCode}</h2>
                    </div>
                    <div className={styles.activiteTable} style={{ marginBottom: 28 }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Niveau</th>
                            <th style={{ textAlign: 'center' }}>Élèves</th>
                            <th style={{ textAlign: 'center' }}>Évalués</th>
                            <th style={{ textAlign: 'center' }}>Moyenne</th>
                            <th style={{ textAlign: 'center' }}>Fragiles</th>
                            <th style={{ textAlign: 'center' }}>En attente</th>
                          </tr>
                        </thead>
                        <tbody>
                          {niveauxStats.map(n => {
                            const pctEval = n.nbEleves > 0 ? Math.round(n.nbEvalues / n.nbEleves * 100) : 0
                            const pctFrag = n.nbEvalues > 0 ? Math.round(n.nbFragiles / n.nbEvalues * 100) : 0
                            return (
                              <tr key={n.niveau}>
                                <td className={styles.tdNom} style={{ fontWeight: 800 }}>{n.niveau}</td>
                                <td style={{ textAlign: 'center' }}>{n.nbEleves}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <span style={{ fontWeight: 600, color: pctEval >= 80 ? '#16A34A' : pctEval >= 50 ? '#D97706' : '#DC2626' }}>
                                    {n.nbEvalues} <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-secondary)' }}>({pctEval}%)</span>
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {n.moyenne != null ? <span className={styles.scoreVal}>{n.moyenne} m/min</span> : <span className={styles.scoreNe}>—</span>}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {n.nbFragiles > 0 ? (
                                    <span style={{ fontWeight: 700, fontSize: 13, color: pctFrag > 40 ? '#DC2626' : '#D97706' }}>
                                      {n.nbFragiles} <span style={{ fontWeight: 400, fontSize: 11 }}>({pctFrag}%)</span>
                                    </span>
                                  ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                                </td>
                                <td style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>{n.nbNonRens}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* Tableau des classes */}
                <div className={styles.sectionHeader} style={{ marginBottom: 16 }}>
                  <h2 className={styles.sectionTitle}>Classes · {periodeCode}</h2>
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
                        <th style={{ textAlign: 'center' }}>Fragiles</th>
                        <th style={{ textAlign: 'center' }}>Moyenne</th>
                        <th style={{ textAlign: 'center' }}>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statsClasses.map(c => {
                        const pctEval = c.nbEleves > 0 ? Math.round(c.nbEvalues / c.nbEleves * 100) : 0
                        const pctFrag = c.nbEvalues > 0 ? Math.round((c.nbFragiles || 0) / c.nbEvalues * 100) : 0
                        return (
                          <tr key={c.classeId} style={{ cursor: 'pointer' }}
                            onClick={() => router.push(`/dashboard/eleves/${c.classeId}`)}>
                            <td className={styles.tdNom}>{c.classeNom}</td>
                            <td>{c.niveau}</td>
                            <td style={{ color: '#4A4540' }}>{(c as any).enseignant || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Non assigné</span>}</td>
                            <td style={{ textAlign: 'center' }}>{c.nbEleves}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ fontWeight: 600, color: pctEval >= 80 ? '#16A34A' : pctEval >= 50 ? '#D97706' : '#DC2626' }}>
                                {c.nbEvalues} <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-secondary)' }}>({pctEval}%)</span>
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {(c.nbFragiles || 0) > 0 ? (
                                <span style={{ fontWeight: 700, color: pctFrag > 40 ? '#DC2626' : '#D97706', fontSize: 13 }}>
                                  {c.nbFragiles} <span style={{ fontWeight: 400, fontSize: 11 }}>({pctFrag}%)</span>
                                </span>
                              ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {c.moyenne != null ? <span className={styles.scoreVal}>{c.moyenne} m/min</span> : <span className={styles.scoreNe}>—</span>}
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

            {/* ── Vue d'ensemble admin ── */}
            {!isEnseignant && !isDirection && !isReseau && adminOverview && (() => {
              const ov = adminOverview
              const cardS = { background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', padding: 24, fontFamily: 'var(--font-sans)' } as const
              const titleS = { fontSize: 15, fontWeight: 800, color: 'var(--primary-dark)', margin: '0 0 16px 0' } as const
              const pctEval = ov.nbElevesTotal > 0 ? Math.round(ov.nbElevesEvalues / ov.nbElevesTotal * 100) : 0
              const totalGroupes = ov.groupesRepartition.reduce((s, g) => s + g.count, 0)
              return (
              <>
                {/* Row 1 : Stats principales */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
                  {[
                    { label: 'Établissements', value: ov.nbEtablissements, icon: '🏫', bg: '#dbeafe', color: '#1d4ed8' },
                    { label: 'Utilisateurs', value: ov.nbUtilisateurs, icon: '👥', bg: '#dcfce7', color: '#16a34a' },
                    { label: 'Élèves inscrits', value: ov.nbElevesTotal, icon: '🎒', bg: '#fef9c3', color: '#854d0e' },
                    { label: 'Taux d\'évaluation', value: `${pctEval}%`, icon: '📊', bg: pctEval >= 80 ? '#dcfce7' : pctEval >= 50 ? '#fef9c3' : '#fef2f2', color: pctEval >= 80 ? '#16a34a' : pctEval >= 50 ? '#854d0e' : '#dc2626' },
                  ].map(c => (
                    <div key={c.label} style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, fontFamily: 'var(--font-sans)' }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{c.icon}</div>
                      <div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary-dark)', lineHeight: 1 }}>{c.value}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{c.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Row 2 : Groupes de besoin + Évolution */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  {/* Répartition groupes de besoin */}
                  <div style={cardS}>
                    <h3 style={titleS}>Groupes de besoin</h3>
                    {totalGroupes === 0 ? (
                      <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Aucune donnée pour la période active.</p>
                    ) : (
                      <>
                        {/* Barre empilée */}
                        <div style={{ display: 'flex', height: 28, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                          {ov.groupesRepartition.filter(g => g.count > 0).map(g => (
                            <div key={g.label} style={{ width: `${Math.round(g.count / totalGroupes * 100)}%`, background: g.color, minWidth: 2 }} title={`${g.label}: ${g.count}`} />
                          ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                          {ov.groupesRepartition.map(g => (
                            <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 12, height: 12, borderRadius: 3, background: g.color, flexShrink: 0 }} />
                              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{g.label}</span>
                              <span style={{ fontSize: 13, fontWeight: 800, color: g.color, marginLeft: 'auto' }}>{g.count}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>({totalGroupes > 0 ? Math.round(g.count / totalGroupes * 100) : 0}%)</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Évolution entre périodes */}
                  <div style={cardS}>
                    <h3 style={titleS}>Évolution par période</h3>
                    {ov.evolutionPeriodes.length === 0 ? (
                      <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Aucune période.</p>
                    ) : (
                      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', height: 120 }}>
                        {ov.evolutionPeriodes.map(p => {
                          const maxMoy = Math.max(...ov.evolutionPeriodes.filter(x => x.moyenne !== null).map(x => x.moyenne!), 1)
                          const h = p.moyenne !== null ? Math.max(20, Math.round(p.moyenne / maxMoy * 100)) : 0
                          return (
                            <div key={p.code} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                              {p.moyenne !== null && <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary-dark)' }}>{p.moyenne}</span>}
                              <div style={{ width: '100%', maxWidth: 60, height: h, background: p.moyenne !== null ? 'var(--primary-dark)' : 'var(--bg-gray)', borderRadius: 8, transition: 'height 0.3s' }} />
                              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{p.code}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 3 : Score par niveau */}
                <div style={{ ...cardS, marginBottom: 16 }}>
                  <h3 style={titleS}>Score moyen par niveau</h3>
                  {ov.scoreParNiveau.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Aucune donnée.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1.5px solid var(--border-light)' }}>
                          <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1, textTransform: 'uppercase' }}>Niveau</th>
                          <th style={{ padding: '8px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1, textTransform: 'uppercase' }}>Élèves</th>
                          <th style={{ padding: '8px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1, textTransform: 'uppercase' }}>Évalués</th>
                          <th style={{ padding: '8px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1, textTransform: 'uppercase' }}>Couverture</th>
                          <th style={{ padding: '8px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1, textTransform: 'uppercase' }}>Moy. (m/min)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ov.scoreParNiveau.map(n => {
                          const pct = n.nbEleves > 0 ? Math.round(n.nbEvalues / n.nbEleves * 100) : 0
                          return (
                            <tr key={n.niveau} style={{ borderBottom: '1px solid var(--border-light)' }}>
                              <td style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--primary-dark)' }}>{n.niveau}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>{n.nbEleves}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>{n.nbEvalues}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                <span style={{ fontWeight: 700, color: pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626' }}>{pct}%</span>
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 800, fontSize: 15, color: 'var(--primary-dark)' }}>
                                {n.moyenne !== null ? n.moyenne : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Row 4 : Top/Bottom + Utilisateurs par rôle */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  {/* Top établissements */}
                  <div style={cardS}>
                    <h3 style={{ ...titleS, color: '#16a34a' }}>Top 5 établissements</h3>
                    {ov.topEtabs.length === 0 ? (
                      <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Aucune donnée.</p>
                    ) : ov.topEtabs.map((e, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < ov.topEtabs.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                        <span style={{ fontWeight: 800, fontSize: 16, color: '#16a34a', width: 24, textAlign: 'center' }}>{i + 1}</span>
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>{e.nom}</span>
                        <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--primary-dark)' }}>{e.moyenne} m/min</span>
                      </div>
                    ))}
                  </div>

                  {/* Bottom établissements */}
                  <div style={cardS}>
                    <h3 style={{ ...titleS, color: '#dc2626' }}>5 établissements les plus fragiles</h3>
                    {ov.bottomEtabs.length === 0 ? (
                      <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Aucune donnée.</p>
                    ) : ov.bottomEtabs.map((e, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < ov.bottomEtabs.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                        <span style={{ fontWeight: 800, fontSize: 14, color: '#dc2626', width: 50 }}>{e.pctFragiles}%</span>
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>{e.nom}</span>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-tertiary)' }}>{e.moyenne} m/min</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Row 5 : Alertes opérationnelles + QCM */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  {/* Établissements sans activité */}
                  <div style={cardS}>
                    <h3 style={titleS}>
                      Établissements sans activité
                      {ov.etabsSansActivite.length > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginLeft: 8 }}>({ov.etabsSansActivite.length})</span>}
                    </h3>
                    {ov.etabsSansActivite.length === 0 ? (
                      <p style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>Tous les établissements ont de l'activité.</p>
                    ) : (
                      <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {ov.etabsSansActivite.map((e, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: '#fef2f2' }}>
                            <span style={{ color: '#dc2626', fontSize: 14 }}>!</span>
                            <span style={{ fontSize: 13, color: '#7f1d1d' }}>{e.nom}</span>
                            {e.ville && <span style={{ fontSize: 11, color: '#dc2626' }}>({e.ville})</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* QCM */}
                  <div style={cardS}>
                    <h3 style={titleS}>Compréhension (QCM)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                      <div style={{ background: 'var(--bg-gray)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary-dark)' }}>{ov.qcmConfigures}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Tests configurés</div>
                      </div>
                      <div style={{ background: 'var(--bg-gray)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary-dark)' }}>
                          {ov.qcmElevesTotal > 0 ? Math.round(ov.qcmElevesComplete / ov.qcmElevesTotal * 100) : 0}%
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Complétion QCM</div>
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
                      {ov.qcmElevesComplete} élèves ont passé le QCM sur {ov.qcmElevesTotal} inscrits
                    </p>
                  </div>
                </div>

                {/* Row 6 : Enseignants sans saisie + Utilisateurs par rôle */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  {/* Enseignants sans saisie */}
                  <div style={cardS}>
                    <h3 style={titleS}>
                      Enseignants sans saisie
                      {ov.enseignantsSansSaisie.length > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: '#d97706', marginLeft: 8 }}>({ov.enseignantsSansSaisie.length})</span>}
                    </h3>
                    {ov.enseignantsSansSaisie.length === 0 ? (
                      <p style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>Tous les enseignants ont saisi.</p>
                    ) : (
                      <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {ov.enseignantsSansSaisie.slice(0, 20).map((e, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 8, background: '#fff7ed' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>{e.prenom} {e.nom}</span>
                            <span style={{ fontSize: 11, color: '#d97706' }}>{e.etablissement}</span>
                          </div>
                        ))}
                        {ov.enseignantsSansSaisie.length > 20 && (
                          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>+ {ov.enseignantsSansSaisie.length - 20} autres</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Utilisateurs par rôle */}
                  <div style={cardS}>
                    <h3 style={titleS}>Utilisateurs par rôle</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {Object.entries(ov.usersByRole).sort((a, b) => b[1] - a[1]).map(([role, count]) => (
                        <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 120, fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>{ROLE_LABELS[role] || role}</div>
                          <div style={{ flex: 1, height: 8, background: 'var(--bg-gray)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.round((count / ov.nbUtilisateurs) * 100)}%`, background: 'var(--primary-dark)', borderRadius: 4 }} />
                          </div>
                          <div style={{ width: 24, fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)', textAlign: 'right' as const }}>{count}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Row 7 : État des périodes */}
                <div style={{ ...cardS, marginBottom: 16 }}>
                  <h3 style={titleS}>État des périodes</h3>
                  {ov.periodesDetail.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Aucune période configurée.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {ov.periodesDetail.map(p => (
                        <div key={p.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: 'var(--bg-gray)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary-dark)' }}>{p.code}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.label}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: p.actif ? '#dbeafe' : 'white', color: p.actif ? '#1d4ed8' : 'var(--text-tertiary)', border: `1px solid ${p.actif ? '#bfdbfe' : 'var(--border-light)'}` }}>{p.actif ? 'Active' : 'Inactive'}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: p.saisie_ouverte ? '#dcfce7' : 'white', color: p.saisie_ouverte ? '#16a34a' : 'var(--text-tertiary)', border: `1px solid ${p.saisie_ouverte ? '#bbf7d0' : 'var(--border-light)'}` }}>{p.saisie_ouverte ? 'Saisie ouverte' : 'Saisie fermée'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
              )
            })()}

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
