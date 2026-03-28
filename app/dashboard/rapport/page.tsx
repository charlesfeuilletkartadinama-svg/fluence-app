'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'
import styles from './rapport.module.css'
import { RapportPDF, RapportEtabPDF, RapportCompletPDF } from './RapportPDF'

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFDownloadLink),
  { ssr: false, loading: () => <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Préparation…</span> }
)

// ── Types ──────────────────────────────────────────────────────────────────

type ModeRapport = 'classe' | 'etablissement' | 'complet'
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
    } else {
      const q = supabase.from('classes').select('id, nom, niveau, etablissement:etablissements(id, nom)').order('nom')
      const { data } = profil.etablissement_id ? await q.eq('etablissement_id', profil.etablissement_id) : await q
      classesData = (data as unknown as ClasseOption[]) || []
    }
    setClasses(classesData)
    if (classesData[0]) setClasseId(classesData[0].id)

    const etabId = profil.etablissement_id || (classesData[0] as any)?.etablissement?.id || null
    let perQuery = supabase.from('periodes').select('id, code, label').eq('actif', true).order('code')
    if (etabId) perQuery = perQuery.eq('etablissement_id', etabId)
    const { data: rawPer } = await perQuery
    const seen = new Set<string>()
    const perDedup: PeriodeOption[] = []
    for (const p of (rawPer || [])) {
      if (!seen.has(p.code)) { seen.add(p.code); perDedup.push(p) }
    }
    setPeriodes(perDedup)
    if (perDedup[0]) { setPeriodeId(perDedup[0].id); setPeriodeEtabId(perDedup[0].id) }
    setLoading(false)
  }

  // ── Génération rapport par classe ─────────────────────────────────────

  async function genererClasse() {
    if (!classeId || !periodeId) return
    setGenerating(true); setDonneesClasse(null)

    const { data: classeData } = await supabase.from('classes')
      .select('nom, niveau, etablissement:etablissements(nom)').eq('id', classeId).single()
    const { data: periodeData } = await supabase.from('periodes')
      .select('code, label').eq('id', periodeId).single()
    const { data: elevesIds } = await supabase.from('eleves').select('id').eq('classe_id', classeId)
    const { data: passData } = await supabase.from('passations')
      .select('eleve_id, score, non_evalue, groupe_lecture, q1, q2, q3, q4, q5, q6, eleve:eleves(nom, prenom)')
      .eq('periode_id', periodeId).in('eleve_id', (elevesIds || []).map(e => e.id))
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
    if (!profil?.etablissement_id || !periodeEtabId) return
    setGenerating(true); setDonneesEtab(null)

    const { data: etabData } = await supabase.from('etablissements')
      .select('nom').eq('id', profil.etablissement_id).single()
    const { data: periodeData } = await supabase.from('periodes')
      .select('code').eq('id', periodeEtabId).single()
    const { data: classesData } = await supabase.from('classes')
      .select('id, nom, niveau').eq('etablissement_id', profil.etablissement_id).order('niveau')
    const { data: normesData } = await supabase.from('config_normes')
      .select('niveau, seuil_min, seuil_attendu')

    const classeIds = (classesData || []).map((c: any) => c.id)
    const { data: elevesData } = await supabase.from('eleves')
      .select('id, classe_id').in('classe_id', classeIds).eq('actif', true)

    // Trouver tous les IDs de période correspondant au code (multi-étab)
    const { data: perIds } = await supabase.from('periodes').select('id').eq('code', periodeData?.code || '')
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
    if (!profil?.etablissement_id || periodes.length === 0) return
    setGenerating(true); setDonneesComplet(null)

    const { data: etabData } = await supabase.from('etablissements')
      .select('nom').eq('id', profil.etablissement_id).single()
    const { data: classesData } = await supabase.from('classes')
      .select('id, nom, niveau').eq('etablissement_id', profil.etablissement_id).order('niveau')
    const { data: normesData } = await supabase.from('config_normes')
      .select('niveau, seuil_min, seuil_attendu')

    const classeIds = (classesData || []).map((c: any) => c.id)
    const { data: elevesData } = await supabase.from('eleves')
      .select('id, classe_id').in('classe_id', classeIds).eq('actif', true)
    const eleveIds = (elevesData || []).map((e: any) => e.id)

    // Toutes les passations pour toutes les périodes
    const { data: allPass } = eleveIds.length > 0
      ? await supabase.from('passations')
          .select('eleve_id, score, non_evalue, periode:periodes(id, code)')
          .in('eleve_id', eleveIds)
      : { data: [] }

    const passAll = (allPass || []) as any[]

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

  function generer() {
    if (mode === 'classe')        genererClasse()
    else if (mode === 'etablissement') genererEtab()
    else                          genererComplet()
  }

  function onModeChange(m: ModeRapport) {
    setMode(m)
    setDonneesClasse(null); setDonneesEtab(null); setDonneesComplet(null)
  }

  const isDirection = profil && ['directeur', 'principal'].includes(profil.role)
  const donneesPrete = mode === 'classe' ? donneesClasse : mode === 'etablissement' ? donneesEtab : donneesComplet

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
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* ── Sélecteur de type ── */}
            {isDirection && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {[
                  { id: 'complet'      as ModeRapport, icon: '📊', titre: 'Rapport complet',   desc: 'Toutes les classes sur toutes les périodes avec progression T1→T2→T3' },
                  { id: 'etablissement'as ModeRapport, icon: '🏫', titre: 'Par établissement', desc: 'Vue globale de toutes les classes pour une période donnée' },
                  { id: 'classe'       as ModeRapport, icon: '📋', titre: 'Par classe',        desc: 'Rapport détaillé d\'une classe pour une période avec liste des élèves' },
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

              <div style={{ display: 'grid', gridTemplateColumns: mode === 'classe' ? 'repeat(3,1fr)' : '1fr', gap: 16 }}>

                {/* Mode classe */}
                {mode === 'classe' && (<>
                  <div>
                    <label className={styles.label}>Classe</label>
                    <select value={classeId} onChange={e => { setClasseId(e.target.value); setDonneesClasse(null) }} className={styles.select}>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.nom} · {c.niveau}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={styles.label}>Période</label>
                    <select value={periodeId} onChange={e => { setPeriodeId(e.target.value); setDonneesClasse(null) }} className={styles.select}>
                      {periodes.map(p => <option key={p.id} value={p.id}>{p.code} — {p.label}</option>)}
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
                      {periodes.map(p => <option key={p.id} value={p.id}>{p.code} — {p.label}</option>)}
                    </select>
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
                        : donneesComplet
                          ? <RapportCompletPDF donnees={donneesComplet} />
                          : <></>
                  }
                  fileName={
                    mode === 'classe' && donneesClasse
                      ? `rapport-fluence-${donneesClasse.classe}-${donneesClasse.periode}.pdf`
                      : mode === 'etablissement' && donneesEtab
                        ? `rapport-etab-${donneesEtab.periode}.pdf`
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
