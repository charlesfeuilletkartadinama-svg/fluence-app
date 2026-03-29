'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'
import type { Periode, Classe, TestSession, QcmQuestion } from '@/app/lib/types'
import { playEndBeep } from '@/app/lib/useBeep'
import { saveOffline, hasOfflineData, syncOfflinePassations } from '@/app/lib/offlineStorage'
import { periodeVerrouillee } from '@/app/lib/fluenceUtils'

type Eleve = {
  id: string
  nom: string
  prenom: string
  scoreActuel: number | null
  ne: boolean
  absent: boolean
  nbErreurs: number
  dernierMot: number | null
  q1: boolean | null
  q2: boolean | null
  q3: boolean | null
  q4: boolean | null
  q5: boolean | null
  q6: boolean | null
  fait: boolean
}


function PassationContent() {
  const [etape, setEtape]           = useState<'etablissement'|'periode'|'classe'|'liste'|'eleve'|'done'>('periode')
  const [periodes, setPeriodes]     = useState<Periode[]>([])
  const [periode, setPeriode]       = useState<Periode | null>(null)
  const [classe, setClasse]         = useState<Classe | null>(null)
  const [classesEtab, setClassesEtab] = useState<Classe[]>([])
  const [adminEtabs, setAdminEtabs]   = useState<{ id: string; nom: string; type: string }[]>([])
  const [eleves, setEleves]         = useState<Eleve[]>([])
  const [eleveIdx, setEleveIdx] = useState(0)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [erreurSauvegarde, setErreurSauvegarde] = useState('')

  // Chrono
  const [chronoActif, setChronoActif]   = useState(false)
  const [secondes, setSecondes]         = useState(60)
  const [tempsEcoule, setTempsEcoule]   = useState(0)
  const [chronoTermine, setChronoTermine] = useState(false)
  const [nbErreurs, setNbErreurs]       = useState(0)
  const [dernierMot, setDernierMot]     = useState('')
  const [qs, setQs]                     = useState<(boolean|null)[]>(Array(6).fill(null))
  const [ongletPass, setOngletPass]     = useState<'fluence' | 'qcm'>('fluence')
  // QCM session
  const [qcmSessions, setQcmSessions]   = useState<TestSession[]>([])
  const [creatingQcm, setCreatingQcm]   = useState(false)
  const [copiedQcm, setCopiedQcm]       = useState('')
  const [qcmResultats, setQcmResultats] = useState<Record<string, { q1: string|null, q2: string|null, q3: string|null, q4: string|null, q5: string|null, q6: string|null }>>({})
  // QCM individuel
  const [qcmMode, setQcmMode]         = useState<'choix' | 'individuelle' | 'collective'>('choix')
  const [qcmEleveId, setQcmEleveId]   = useState<string | null>(null)
  const [qcmQuestions, setQcmQuestions] = useState<QcmQuestion[]>([])
  const [qcmReponses, setQcmReponses] = useState<Record<number, string>>({})
  const [qcmSubmitting, setQcmSubmitting] = useState(false)
  const [qcmDone, setQcmDone]         = useState(false)
  const [qcmScore, setQcmScore]       = useState<string[] | null>(null)
  const [qcmErreur, setQcmErreur]     = useState('')
  const [qcmTestLoaded, setQcmTestLoaded] = useState(false)
  const [qcmNoTest, setQcmNoTest]     = useState(false)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const { profil, loading: profilLoading } = useProfil()
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (profilLoading) return
    if (!profil) { setLoading(false); return }
    const ALLOWED_ROLES = ['enseignant', 'directeur', 'principal', 'admin', 'coordo_rep']
    if (!ALLOWED_ROLES.includes(profil.role)) { router.push('/dashboard'); return }
    if (profil.role === 'enseignant') chargerDonneesEnseignant()
    else if (['directeur', 'principal'].includes(profil.role)) chargerDonneesDirection()
    else if (['admin', 'coordo_rep'].includes(profil.role)) chargerDonneesAdmin()
    else setLoading(false)
  }, [profil, profilLoading])

  // Nettoyage chrono
  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  // Protection perte de données
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (eleves.some(el => el.fait)) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [eleves])

  async function chargerDonneesAdmin() {
    const classeId = new URLSearchParams(window.location.search).get('classe')
    if (classeId) {
      const { data: classeData } = await supabase.from('classes').select('id, nom, niveau, etablissement_id').eq('id', classeId).single()
      if (!classeData?.etablissement_id) { setLoading(false); return }
      await chargerEtabAdminPass(classeData.etablissement_id, classeId)
    } else {
      const { data: etabs } = await supabase.from('etablissements').select('id, nom, type').order('nom')
      setAdminEtabs(etabs || [])
      setEtape('etablissement')
      setLoading(false)
    }
  }

  async function chargerEtabAdminPass(etabId: string, classeId?: string) {
    setLoading(true)
    const [{ data: periodesData }, { data: classesData }] = await Promise.all([
      supabase.from('periodes').select('id, code, label, date_fin, type, annee_scolaire')
        .eq('etablissement_id', etabId).order('annee_scolaire', { ascending: false }).order('code'),
      supabase.from('classes').select('id, nom, niveau, etablissement_id')
        .eq('etablissement_id', etabId).order('niveau'),
    ])
    // Dédupliquer par code+année
    const seen = new Set<string>()
    const dedup = (periodesData || []).filter((p: any) => {
      const key = `${p.annee_scolaire}_${p.code}`
      if (seen.has(key)) return false
      seen.add(key); return true
    })
    setPeriodes(dedup)
    setClassesEtab(classesData || [])
    if (classeId) {
      const c = (classesData || []).find((c: any) => c.id === classeId)
      if (c) setClasse(c)
    }
    setEtape('periode')
    setLoading(false)
  }

  async function chargerDonneesDirection() {
    if (!profil?.etablissement_id) { setLoading(false); return }
    const classeId = new URLSearchParams(window.location.search).get('classe')
    const [{ data: periodesData }, { data: classesData }] = await Promise.all([
      supabase.from('periodes').select('id, code, label, date_fin, type')
        .eq('etablissement_id', profil.etablissement_id).eq('actif', true).order('code'),
      supabase.from('classes').select('id, nom, niveau, etablissement_id')
        .eq('etablissement_id', profil.etablissement_id).order('niveau'),
    ])
    setPeriodes(periodesData || [])
    setClassesEtab(classesData || [])
    if (classeId) {
      const c = (classesData || []).find((c: Classe) => c.id === classeId)
      if (c) setClasse(c)
    }
    setLoading(false)
  }

  async function chargerDonneesEnseignant() {
    if (!profil) { setLoading(false); return }
    const classeId = new URLSearchParams(window.location.search).get('classe')
    const { data } = await supabase
      .from('enseignant_classes')
      .select('classe:classes(id, nom, niveau, etablissement_id)')
      .eq('enseignant_id', profil.id)
    const classes = (data || []).map((r: any) => r.classe).filter(Boolean) as Classe[]
    if (classes.length === 0) { setLoading(false); return }

    const etabId = classes[0].etablissement_id
    const { data: periodesData } = await supabase
      .from('periodes').select('id, code, label, date_fin, type')
      .eq('etablissement_id', etabId).eq('actif', true).order('code')
    setPeriodes(periodesData || [])

    if (classes.length === 1) {
      setClasse(classes[0])
    } else {
      setClassesEtab(classes)
      if (classeId) {
        const c = classes.find(c => c.id === classeId)
        if (c) setClasse(c)
      }
    }
    setLoading(false)
  }

  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  function genererCode(): string {
    let code = 'FLU-'
    for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    return code
  }

  async function chargerQcmSessions(classeId: string, periodeId: string) {
    const { data } = await supabase
      .from('test_sessions')
      .select('id, code, classe_id, periode_id, enseignant_id, active, expires_at, created_at')
      .eq('classe_id', classeId).eq('periode_id', periodeId)
      .order('created_at', { ascending: false })
    setQcmSessions((data || []) as TestSession[])
  }

  async function chargerQcmRes(classeId: string, periodeId: string) {
    const { data: elevesData } = await supabase.from('eleves').select('id').eq('classe_id', classeId).eq('actif', true)
    if (!elevesData || elevesData.length === 0) return
    const { data: passData } = await supabase.from('passations')
      .select('eleve_id, q1, q2, q3, q4, q5, q6')
      .in('eleve_id', elevesData.map(e => e.id))
      .eq('periode_id', periodeId).eq('hors_periode', false)
    const map: Record<string, any> = {}
    for (const p of (passData || [])) map[p.eleve_id] = { q1: p.q1, q2: p.q2, q3: p.q3, q4: p.q4, q5: p.q5, q6: p.q6 }
    setQcmResultats(map)
  }

  async function creerQcmSession() {
    if (!classe || !periode || !profil) return
    setCreatingQcm(true)
    let code = genererCode()
    let attempts = 0
    while (attempts < 5) {
      const { error } = await supabase.from('test_sessions').insert({ code, classe_id: classe.id, periode_id: periode.id, enseignant_id: profil.id })
      if (!error) break
      if (error.code === '23505') { code = genererCode(); attempts++ }
      else { setCreatingQcm(false); return }
    }
    setCreatingQcm(false)
    chargerQcmSessions(classe.id, periode.id)
  }

  async function desactiverQcmSession(id: string) {
    await supabase.from('test_sessions').update({ active: false }).eq('id', id)
    setQcmSessions(prev => prev.map(s => s.id === id ? { ...s, active: false } : s))
  }

  function copierQcmCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopiedQcm(code)
    setTimeout(() => setCopiedQcm(''), 2000)
  }

  async function chargerQcmQuestions() {
    if (!classe || !periode) return
    setQcmTestLoaded(false); setQcmNoTest(false)
    const { data: classeData } = await supabase.from('classes').select('niveau').eq('id', classe.id).single()
    if (!classeData) { setQcmNoTest(true); setQcmTestLoaded(true); return }
    const { data: test } = await supabase.from('qcm_tests').select('id').eq('periode_id', periode.id).eq('niveau', classeData.niveau).single()
    if (!test) { setQcmNoTest(true); setQcmTestLoaded(true); return }
    const { data: questions } = await supabase.from('qcm_questions').select('*').eq('qcm_test_id', test.id).order('numero')
    setQcmQuestions((questions || []) as QcmQuestion[])
    setQcmTestLoaded(true)
    if (!questions || questions.length === 0) setQcmNoTest(true)
  }

  function ouvrirQcmIndividuel(eleveId: string) {
    setQcmEleveId(eleveId); setQcmReponses({}); setQcmDone(false); setQcmScore(null); setQcmErreur('')
    setQcmMode('individuelle')
    if (!qcmTestLoaded) chargerQcmQuestions()
  }

  async function soumettreQcmIndividuel() {
    if (!qcmEleveId || !periode || !profil) return
    if (qcmQuestions.length === 0) return
    if (!qcmQuestions.every(q => qcmReponses[q.numero])) { setQcmErreur('Répondez à toutes les questions.'); return }
    setQcmSubmitting(true); setQcmErreur('')
    const results = qcmQuestions.map(q => qcmReponses[q.numero] === q.reponse_correcte ? 'Correct' : 'Incorrect')
    const { error } = await supabase.from('passations').upsert({
      eleve_id: qcmEleveId, periode_id: periode.id, hors_periode: false,
      q1: results[0] || null, q2: results[1] || null, q3: results[2] || null,
      q4: results[3] || null, q5: results[4] || null, q6: results[5] || null,
      mode: 'qcm_enseignant',
    }, { onConflict: 'eleve_id,periode_id,hors_periode' })
    setQcmSubmitting(false)
    if (error) { setQcmErreur(error.message); return }
    setQcmScore(results); setQcmDone(true)
    if (classe && periode) chargerQcmRes(classe.id, periode.id)
  }

  function qcmEleveSuivant() {
    setQcmDone(false); setQcmScore(null); setQcmReponses({}); setQcmEleveId(null)
  }

  async function selectionnerPeriode(p: Periode) {
    if (profil?.role === 'enseignant' && periodeVerrouillee(p?.date_fin)) return
    setPeriode(p)
    if (classe) {
      // Classe déjà connue : charger les élèves et aller à la liste
      setLoading(true)
      const { data } = await supabase
        .from('eleves').select('id, nom, prenom')
        .eq('classe_id', classe.id).eq('actif', true).order('nom')
      setEleves((data || []).map(e => ({
        ...e, scoreActuel: null, ne: false, absent: false, nbErreurs: 0,
        dernierMot: null, fait: false,
        q1: null, q2: null, q3: null, q4: null, q5: null, q6: null,
      })))
      setLoading(false)
      setOngletPass('fluence')
      setEtape('liste')
      chargerQcmSessions(classe.id, p.id)
      chargerQcmRes(classe.id, p.id)
    } else {
      setEtape('classe')
    }
  }

  async function selectionnerClasse(c: Classe) {
    setClasse(c)
    setLoading(true)
    const { data } = await supabase
      .from('eleves').select('id, nom, prenom')
      .eq('classe_id', c.id).eq('actif', true).order('nom')
    setEleves((data || []).map(e => ({
      ...e, scoreActuel: null, ne: false, absent: false, nbErreurs: 0,
      dernierMot: null, fait: false,
      q1: null, q2: null, q3: null, q4: null, q5: null, q6: null,
    })))
    setLoading(false)
    setOngletPass('fluence')
    setEtape('liste')
    if (periode) {
      chargerQcmSessions(c.id, periode.id)
      chargerQcmRes(c.id, periode.id)
    }
  }

  function demarrerChrono() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setChronoActif(true)
    setSecondes(60)
    setTempsEcoule(0)
    setNbErreurs(0)
    setChronoTermine(false)
    setDernierMot('')
    setQs(Array(6).fill(null))

    intervalRef.current = setInterval(() => {
      setSecondes(s => {
        if (s <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          setChronoActif(false)
          setChronoTermine(true)
          setTempsEcoule(60)
          playEndBeep()
          return 0
        }
        setTempsEcoule(60 - s + 1)
        return s - 1
      })
    }, 1000)
  }

  function arreterChrono() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setChronoActif(false)
    setTempsEcoule(60 - secondes)
    setChronoTermine(true)
  }

  function resetChrono() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setChronoActif(false)
    setSecondes(60)
    setTempsEcoule(0)
    setChronoTermine(false)
    setNbErreurs(0)
    setDernierMot('')
    setQs(Array(6).fill(null))
  }

  function calculerScore(): number | null {
    const mot = parseInt(dernierMot)
    if (!mot || mot <= 0) return null
    const mots = mot - nbErreurs
    const temps = tempsEcoule > 0 ? tempsEcoule : 60
    return Math.max(0, Math.round(mots / temps * 60))
  }

  function toggleQ(i: number) {
    setQs(prev => {
      const n = [...prev]
      n[i] = n[i] === null ? true : n[i] === true ? false : null
      return n
    })
  }

  function validerEleve(ne: boolean = false, absent: boolean = false) {
    const score = ne ? null : calculerScore()
    setEleves(prev => prev.map((e, i) =>
      i === eleveIdx ? {
        ...e, fait: true, ne, absent,
        scoreActuel: score,
        nbErreurs,
        dernierMot: parseInt(dernierMot) || null,
        q1: qs[0], q2: qs[1], q3: qs[2],
        q4: qs[3], q5: qs[4], q6: qs[5],
      } : e
    ))
    resetChrono()

    const prochain = eleves.findIndex((e, i) => i > eleveIdx && !e.fait)
    if (prochain >= 0) {
      setEleveIdx(prochain)
    } else {
      setEtape('liste')
    }
  }

  async function enregistrerTout() {
    if (!profil || !periode) return
    if (profil.role === 'enseignant' && periodeVerrouillee(periode?.date_fin)) return
    setSaving(true)
    setErreurSauvegarde('')
    let errMsg = ''
    let savedOfflineCount = 0

    for (const eleve of eleves) {
      if (!eleve.fait) continue
      const passData = {
        eleve_id:      eleve.id,
        periode_id:    periode.id,
        hors_periode:  false,
        score:         eleve.ne ? null : eleve.scoreActuel,
        non_evalue:    eleve.ne,
        absent:        eleve.absent,
        mode:          'passation',
        enseignant_id: profil.id,
        q1: eleve.q1 === true ? 'Correct' : eleve.q1 === false ? 'Incorrect' : null,
        q2: eleve.q2 === true ? 'Correct' : eleve.q2 === false ? 'Incorrect' : null,
        q3: eleve.q3 === true ? 'Correct' : eleve.q3 === false ? 'Incorrect' : null,
        q4: eleve.q4 === true ? 'Correct' : eleve.q4 === false ? 'Incorrect' : null,
        q5: eleve.q5 === true ? 'Correct' : eleve.q5 === false ? 'Incorrect' : null,
        q6: eleve.q6 === true ? 'Correct' : eleve.q6 === false ? 'Incorrect' : null,
      }
      const { error } = await supabase.from('passations').upsert(passData, { onConflict: 'eleve_id,periode_id,hors_periode' })
      if (error) {
        // Sauvegarder hors-ligne si erreur réseau
        saveOffline({ ...passData, saved_at: new Date().toISOString() } as any)
        savedOfflineCount++
        if (!errMsg) errMsg = `${error.message}${error.details ? ' — ' + error.details : ''}`
      }
    }
    setSaving(false)
    if (savedOfflineCount > 0 && !navigator.onLine) {
      setErreurSauvegarde(`${savedOfflineCount} passation(s) sauvegardée(s) hors-ligne. Elles seront synchronisées quand la connexion sera rétablie.`)
    } else if (errMsg) {
      setErreurSauvegarde(errMsg)
    }
    setEtape('done')
  }

  // Synchroniser les données hors-ligne au chargement
  useEffect(() => {
    if (!profil || !navigator.onLine) return
    if (hasOfflineData()) {
      syncOfflinePassations(supabase).then(({ synced, errors }) => {
        if (synced > 0) {
          setErreurSauvegarde(`${synced} passation(s) hors-ligne synchronisée(s) avec succès.`)
        }
      })
    }
    const onOnline = () => {
      if (hasOfflineData()) {
        syncOfflinePassations(supabase).then(({ synced }) => {
          if (synced > 0) setErreurSauvegarde(`${synced} passation(s) synchronisée(s).`)
        })
      }
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [profil])

  const eleve = eleves[eleveIdx]
  const nbFaits = eleves.filter(e => e.fait).length
  const scoreCalc = calculerScore()

  if (loading) return <div style={{ marginLeft: 'var(--sidebar-width)', padding: 32, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>Chargement...</div>

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-light)' }}>
      <div style={{ marginLeft: 'var(--sidebar-width)' }}>

        {/* ── Choix période ── */}
        {/* ── Choix établissement (admin) ── */}
        {etape === 'etablissement' && (
          <div style={{ padding: 32, maxWidth: 640 }}>
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>Mode passation</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 15, fontFamily: 'var(--font-sans)' }}>Choisissez un établissement</p>
            </div>
            <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1.5px solid var(--border-light)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {adminEtabs.map(e => (
                  <button key={e.id} onClick={() => chargerEtabAdminPass(e.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      border: '1.5px solid var(--border-light)', borderRadius: 12, padding: '16px 20px',
                      background: 'var(--bg-gray)', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                      fontFamily: 'var(--font-sans)',
                    }}
                    onMouseEnter={ev => { ev.currentTarget.style.borderColor = 'var(--primary-dark)'; ev.currentTarget.style.background = 'white' }}
                    onMouseLeave={ev => { ev.currentTarget.style.borderColor = 'var(--border-light)'; ev.currentTarget.style.background = 'var(--bg-gray)' }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--primary-dark)' }}>{e.nom}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>{e.type}</div>
                    </div>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 18 }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Choix période ── */}
        {etape === 'periode' && (
          <div style={{ padding: 32, maxWidth: 640 }}>
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>Mode passation</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 15, fontFamily: 'var(--font-sans)' }}>Choisissez une période</p>
            </div>
            {!localStorage.getItem('fluence-info-passation') && (
              <div style={{
                background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 14,
                padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 14,
                fontFamily: 'var(--font-sans)',
              }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>⏱️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#166534', marginBottom: 6 }}>À quoi sert le Mode Passation ?</div>
                  <p style={{ fontSize: 13, color: '#15803D', lineHeight: 1.6, margin: 0 }}>
                    Le Mode Passation est destiné à <strong>faire passer le test de fluence en direct</strong> avec un élève.<br />
                    Un chronomètre de 60 secondes se lance, vous comptez les erreurs de lecture en temps réel,
                    puis vous indiquez le dernier mot lu. Le score est <strong>calculé automatiquement</strong> en mots/minute.<br />
                    Vous pouvez ensuite enchaîner avec les questions de compréhension (QCM).
                  </p>
                </div>
                <button onClick={() => { localStorage.setItem('fluence-info-passation', '1'); window.location.reload() }}
                  style={{ background: 'none', border: 'none', color: '#86EFAC', cursor: 'pointer', fontSize: 18, flexShrink: 0, padding: 0 }}>✕</button>
              </div>
            )}
            {periodes.length === 0 ? (
              <div style={{ background: 'white', borderRadius: 16, padding: '48px 32px', border: '1.5px solid var(--border-light)', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🏫</div>
                <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', marginBottom: 8 }}>Aucune période disponible</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                  Ce profil n'est pas rattaché à un établissement.<br />
                  Utilisez l'impersonation pour passer en tant qu'enseignant ou directeur.
                </p>
              </div>
            ) : (
            <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1.5px solid var(--border-light)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>Choisir une période</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {periodes.map(p => {
                  const locked = profil?.role === 'enseignant' && periodeVerrouillee(p?.date_fin)
                  return (
                    <button key={p.id}
                      onClick={() => selectionnerPeriode(p)}
                      disabled={locked}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        border: '1.5px solid var(--border-light)', borderRadius: 12, padding: '16px 20px',
                        background: 'var(--bg-gray)', cursor: locked ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s', textAlign: 'left', fontFamily: 'var(--font-sans)',
                        opacity: locked ? 0.55 : 1,
                      }}
                      onMouseEnter={e => { if (!locked) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-dark)'; (e.currentTarget as HTMLElement).style.background = 'white' } }}
                      onMouseLeave={e => { if (!locked) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-gray)' } }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--primary-dark)' }}>
                          {p.code}
                          {(p as any).annee_scolaire && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 8 }}>{(p as any).annee_scolaire}</span>}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>{p.label}</div>
                        {locked && <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600, marginTop: 4 }}>Période clôturée — passation réservée au directeur</div>}
                      </div>
                      <span style={{ color: locked ? '#DC2626' : 'var(--text-tertiary)', fontSize: 18 }}>{locked ? '🔒' : '→'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            )}
          </div>
        )}

        {/* ── Choix classe ── */}
        {etape === 'classe' && (
          <div style={{ padding: 32, maxWidth: 640 }}>
            <div style={{ marginBottom: 32 }}>
              <button onClick={() => setEtape('periode')}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontFamily: 'var(--font-sans)', marginBottom: 12, padding: 0, display: 'block' }}>
                ← Retour
              </button>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>Mode passation</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 15, fontFamily: 'var(--font-sans)' }}>Période · {periode?.code} — Choisissez une classe</p>
            </div>
            <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1.5px solid var(--border-light)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {classesEtab.map(c => (
                  <button key={c.id} onClick={() => selectionnerClasse(c)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      border: '1.5px solid var(--border-light)', borderRadius: 12, padding: '16px 20px',
                      background: 'var(--bg-gray)', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                      fontFamily: 'var(--font-sans)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-dark)'; (e.currentTarget as HTMLElement).style.background = 'white' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-gray)' }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--primary-dark)' }}>{c.nom}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>{c.niveau}</div>
                    </div>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 18 }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Liste élèves — avec onglets Fluence / QCM ── */}
        {etape === 'liste' && (
          <div style={{ padding: 32, maxWidth: 700 }}>
            <div style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>{classe?.nom} · {periode?.code}</h2>
            </div>

            {/* Onglets */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid var(--border-light)' }}>
              <button onClick={() => setOngletPass('fluence')} style={{
                padding: '10px 24px', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)',
                background: 'none', border: 'none', cursor: 'pointer', marginBottom: -2,
                borderBottom: `2px solid ${ongletPass === 'fluence' ? 'var(--primary-dark)' : 'transparent'}`,
                color: ongletPass === 'fluence' ? 'var(--primary-dark)' : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}>Fluence</button>
              <button onClick={() => setOngletPass('qcm')} style={{
                padding: '10px 24px', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)',
                background: 'none', border: 'none', cursor: 'pointer', marginBottom: -2,
                borderBottom: `2px solid ${ongletPass === 'qcm' ? 'var(--primary-dark)' : 'transparent'}`,
                color: ongletPass === 'qcm' ? 'var(--primary-dark)' : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}>QCM Compréhension</button>
            </div>

            {/* ── Onglet Fluence ── */}
            {ongletPass === 'fluence' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, fontFamily: 'var(--font-sans)', margin: 0 }}>
                    {nbFaits} / {eleves.length} élèves passés
                  </p>
                  {nbFaits > 0 && (
                    <button onClick={enregistrerTout} disabled={saving}
                      style={{ background: '#16a34a', color: 'white', border: 'none', padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                      {saving ? 'Enregistrement...' : '✓ Enregistrer tout'}
                    </button>
                  )}
                </div>

                {/* Barre de progression */}
                <div style={{ background: 'var(--border-light)', borderRadius: 99, height: 6, marginBottom: 24 }}>
                  <div style={{ background: 'var(--primary-dark)', height: 6, borderRadius: 99, transition: 'width 0.3s', width: `${eleves.length > 0 ? nbFaits/eleves.length*100 : 0}%` }}/>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {eleves.map((e, i) => (
                    <div key={e.id} style={{
                      background: e.fait ? '#f0fdf4' : 'white',
                      border: `1.5px solid ${e.fait ? '#bbf7d0' : 'var(--border-light)'}`,
                      borderRadius: 14, padding: '16px 20px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)' }}>{e.nom}</span>
                        <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 14, fontFamily: 'var(--font-sans)' }}>{e.prenom}</span>
                        {e.fait && (
                          <span style={{ marginLeft: 12, fontSize: 12, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 6, fontFamily: 'var(--font-sans)' }}>
                            {e.ne ? 'N.É.' : `${e.scoreActuel} m/min`}
                          </span>
                        )}
                      </div>
                      {!e.fait ? (
                        <button
                          onClick={() => { setEleveIdx(i); setEtape('eleve') }}
                          style={{ background: 'var(--primary-dark)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                          Commencer →
                        </button>
                      ) : (
                        <span style={{ color: '#16a34a', fontSize: 18 }}>✓</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Onglet QCM ── */}
            {ongletPass === 'qcm' && (
              <div>
                {/* Choix du mode */}
                {qcmMode === 'choix' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                      <button onClick={() => { setQcmMode('individuelle'); if (!qcmTestLoaded) chargerQcmQuestions() }} style={{
                        background: 'white', border: '1.5px solid var(--border-light)', borderRadius: 16, padding: '28px 24px',
                        cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-dark)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)' }}
                      >
                        <div style={{ fontSize: 28, marginBottom: 12 }}>👤</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary-dark)', marginBottom: 6 }}>Passation individuelle</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          L'enseignant sélectionne un élève et saisit ses réponses au QCM en tête-à-tête.
                        </div>
                      </button>
                      <button onClick={() => setQcmMode('collective')} style={{
                        background: 'white', border: '1.5px solid var(--border-light)', borderRadius: 16, padding: '28px 24px',
                        cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-dark)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)' }}
                      >
                        <div style={{ fontSize: 28, marginBottom: 12 }}>📱</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary-dark)', marginBottom: 6 }}>Session collective</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          Générez un code pour que les élèves passent le QCM en autonomie sur tablette.
                        </div>
                      </button>
                    </div>
                    <QcmResultatsTablePass eleves={eleves} qcmResultats={qcmResultats} />
                  </>
                )}

                {/* ── Mode individuel : sélection ── */}
                {qcmMode === 'individuelle' && !qcmEleveId && !qcmDone && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>Passation individuelle — Sélectionner un élève</h3>
                      <button onClick={() => { setQcmMode('choix'); setQcmEleveId(null) }} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border-light)', padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>← Retour</button>
                    </div>
                    {qcmNoTest && (
                      <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#c2410c', fontFamily: 'var(--font-sans)' }}>
                        Aucun test QCM configuré pour ce niveau et cette période. Créez-en un dans Administration → QCM.
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {eleves.map(e => {
                        const r = qcmResultats[e.id]
                        const hasResult = r && [r.q1, r.q2, r.q3, r.q4, r.q5, r.q6].some(q => q !== null)
                        return (
                          <button key={e.id} onClick={() => !qcmNoTest && ouvrirQcmIndividuel(e.id)} disabled={qcmNoTest} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            background: hasResult ? '#f0fdf4' : 'white', border: `1.5px solid ${hasResult ? '#bbf7d0' : 'var(--border-light)'}`,
                            borderRadius: 14, padding: '16px 20px', cursor: qcmNoTest ? 'not-allowed' : 'pointer',
                            fontFamily: 'var(--font-sans)', transition: 'all 0.15s', textAlign: 'left', opacity: qcmNoTest ? 0.5 : 1,
                          }}>
                            <div>
                              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary-dark)' }}>{e.nom}</span>
                              <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 14 }}>{e.prenom}</span>
                              {hasResult && <span style={{ marginLeft: 12, fontSize: 12, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 6 }}>{[r!.q1, r!.q2, r!.q3, r!.q4, r!.q5, r!.q6].filter(q => q === 'Correct').length}/6</span>}
                            </div>
                            {hasResult ? <span style={{ color: '#16a34a', fontSize: 18 }}>✓</span> : <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>→</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── Mode individuel : questions ── */}
                {qcmMode === 'individuelle' && qcmEleveId && !qcmDone && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>
                        QCM — {eleves.find(e => e.id === qcmEleveId)?.prenom} {eleves.find(e => e.id === qcmEleveId)?.nom}
                      </h3>
                      <button onClick={() => setQcmEleveId(null)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border-light)', padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>← Retour</button>
                    </div>
                    {qcmErreur && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#dc2626', fontFamily: 'var(--font-sans)' }}>{qcmErreur}</div>}
                    {qcmQuestions.map(q => (
                      <div key={q.id} style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', padding: 20, marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                          <span style={{ background: qcmReponses[q.numero] ? '#16a34a' : 'var(--primary-dark)', color: 'white', borderRadius: 10, minWidth: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, flexShrink: 0, fontFamily: 'var(--font-sans)' }}>{q.numero}</span>
                          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--primary-dark)', margin: 0, lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>{q.question_text}</p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingLeft: 48 }}>
                          {(['A', 'B', 'C', 'D'] as const).map(letter => {
                            const selected = qcmReponses[q.numero] === letter
                            return (
                              <button key={letter} onClick={() => setQcmReponses(prev => ({ ...prev, [q.numero]: letter }))} style={{
                                padding: '12px 14px', borderRadius: 10, textAlign: 'left',
                                border: `2px solid ${selected ? '#3b82f6' : 'var(--border-light)'}`,
                                background: selected ? '#eff6ff' : 'white', cursor: 'pointer', fontSize: 14,
                                fontWeight: selected ? 700 : 500, color: selected ? 'var(--primary-dark)' : 'var(--text-secondary)',
                                fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
                              }}>
                                <span style={{ fontWeight: 800, marginRight: 8, color: selected ? '#3b82f6' : 'var(--text-tertiary)' }}>{letter}.</span>
                                {(q as any)[`option_${letter.toLowerCase()}`]}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    <button onClick={soumettreQcmIndividuel} disabled={qcmSubmitting || Object.keys(qcmReponses).length < qcmQuestions.length} style={{
                      width: '100%', background: 'var(--primary-dark)', color: 'white', border: 'none', padding: '14px', borderRadius: 12,
                      fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer', marginTop: 8,
                      opacity: (qcmSubmitting || Object.keys(qcmReponses).length < qcmQuestions.length) ? 0.5 : 1,
                    }}>{qcmSubmitting ? 'Enregistrement…' : 'Valider les réponses'}</button>
                  </div>
                )}

                {/* ── Mode individuel : résultat ── */}
                {qcmMode === 'individuelle' && qcmDone && qcmScore && (
                  <div style={{ background: 'white', borderRadius: 20, padding: '40px 32px', border: '1.5px solid var(--border-light)', textAlign: 'center' }}>
                    <div style={{ fontSize: 48, fontWeight: 800, color: qcmScore.filter(r => r === 'Correct').length >= 4 ? '#16a34a' : '#d97706', marginBottom: 12, fontFamily: 'var(--font-sans)' }}>
                      {qcmScore.filter(r => r === 'Correct').length} / {qcmScore.length}
                    </div>
                    <p style={{ fontSize: 15, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: 8 }}>
                      {eleves.find(e => e.id === qcmEleveId)?.prenom} {eleves.find(e => e.id === qcmEleveId)?.nom}
                    </p>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
                      {qcmScore.map((r, i) => (
                        <span key={i} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', background: r === 'Correct' ? '#f0fdf4' : '#fef2f2', color: r === 'Correct' ? '#16a34a' : '#dc2626', border: `1px solid ${r === 'Correct' ? '#bbf7d0' : '#fecaca'}` }}>Q{i + 1} {r === 'Correct' ? '✓' : '✗'}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                      <button onClick={qcmEleveSuivant} style={{ background: 'var(--primary-dark)', color: 'white', border: 'none', padding: '13px 28px', borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>Élève suivant</button>
                      <button onClick={() => { setQcmMode('choix'); setQcmEleveId(null); setQcmDone(false) }} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border-light)', padding: '13px 28px', borderRadius: 12, fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>Retour</button>
                    </div>
                  </div>
                )}

                {/* ── Mode collectif ── */}
                {qcmMode === 'collective' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>Session collective</h3>
                      <button onClick={() => setQcmMode('choix')} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border-light)', padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>← Retour</button>
                    </div>
                    <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', padding: 24, marginBottom: 24 }}>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
                        Créez un code pour que les élèves passent le QCM sur tablette via <strong>/test</strong>. La session expire après 2 heures.
                      </p>
                      <button onClick={creerQcmSession} disabled={creatingQcm} style={{
                        background: 'var(--primary-dark)', color: 'white', border: 'none', padding: '11px 22px',
                        borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer', opacity: creatingQcm ? 0.6 : 1,
                      }}>{creatingQcm ? 'Création…' : '+ Nouvelle session'}</button>
                    </div>
                    {qcmSessions.length > 0 && (
                      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', overflow: 'hidden', marginBottom: 24 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-gray)' }}>
                              <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1 }}>CODE</th>
                              <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1 }}>STATUT</th>
                              <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1 }}>ACTIONS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {qcmSessions.map(s => {
                              const expired = new Date(s.expires_at) < new Date()
                              const isActive = s.active && !expired
                              return (
                                <tr key={s.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                                  <td style={{ padding: '14px 20px', fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'monospace', fontSize: 16, letterSpacing: 2 }}>{s.code}</td>
                                  <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, fontFamily: 'var(--font-sans)', background: isActive ? '#f0fdf4' : '#f3f4f6', color: isActive ? '#16a34a' : '#6b7280' }}>
                                      {isActive ? 'Active' : !s.active ? 'Désactivée' : 'Expirée'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                      <button onClick={() => copierQcmCode(s.code)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border-light)', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                                        {copiedQcm === s.code ? 'Copié !' : 'Copier'}
                                      </button>
                                      {isActive && (
                                        <button onClick={() => desactiverQcmSession(s.id)} style={{ background: 'transparent', color: '#dc2626', border: '1.5px solid #fca5a5', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>Désactiver</button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <QcmResultatsTablePass eleves={eleves} qcmResultats={qcmResultats} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Écran passation élève ── */}
        {etape === 'eleve' && eleve && (
          <div style={{ minHeight: '100vh', background: 'white', display: 'flex', flexDirection: 'column' }}>

            {/* Top bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1.5px solid var(--border-light)' }}>
              <button onClick={() => setEtape('liste')}
                style={{ background: 'var(--bg-gray)', border: 'none', color: 'var(--text-secondary)', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontFamily: 'var(--font-sans)', cursor: 'pointer', fontWeight: 600 }}>
                ← Retour à la liste
              </button>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                Élève {eleveIdx + 1} / {eleves.length}
              </span>
            </div>

            {/* Nom élève */}
            <div style={{ textAlign: 'center', padding: '28px 24px 12px' }}>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'var(--font-sans)', marginBottom: 8 }}>Lecture en cours</div>
              <h2 style={{ fontSize: 38, fontWeight: 900, color: 'var(--primary-dark)', margin: 0, fontFamily: 'var(--font-sans)', letterSpacing: -1 }}>{eleve.nom}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 20, marginTop: 4, fontFamily: 'var(--font-sans)' }}>{eleve.prenom}</p>
            </div>

            {/* Chrono */}
            <div style={{ textAlign: 'center', padding: '8px 24px 12px' }}>
              <div style={{
                fontSize: 96, fontWeight: 900, fontVariantNumeric: 'tabular-nums', lineHeight: 1, transition: 'color 0.3s', fontFamily: 'var(--font-sans)',
                color: secondes <= 10 ? '#ef4444' : secondes <= 20 ? '#f97316' : 'var(--primary-dark)',
              }}>
                {Math.floor(secondes/60)}:{String(secondes%60).padStart(2,'0')}
              </div>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 8, fontFamily: 'var(--font-sans)' }}>
                {chronoActif ? 'Chronomètre en cours' : chronoTermine ? 'Temps écoulé' : 'Prêt à démarrer'}
              </p>
            </div>

            {/* Boutons chrono */}
            <div style={{ display: 'flex', gap: 12, padding: '0 28px 16px', justifyContent: 'center' }}>
              {!chronoActif && !chronoTermine && (
                <button onClick={demarrerChrono}
                  style={{ flex: 1, maxWidth: 320, background: 'var(--primary-dark)', color: 'white', border: 'none', padding: '16px', borderRadius: 16, fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                  ▶ Démarrer les 60 secondes
                </button>
              )}
              {chronoActif && (
                <button onClick={arreterChrono}
                  style={{ flex: 1, maxWidth: 320, background: '#f97316', color: 'white', border: 'none', padding: '16px', borderRadius: 16, fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                  ⏹ Arrêter
                </button>
              )}
              {(chronoActif || chronoTermine) && (
                <button onClick={resetChrono}
                  style={{ background: 'var(--bg-gray)', color: 'var(--text-secondary)', border: '1.5px solid var(--border-light)', padding: '16px 20px', borderRadius: 16, fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>
                  ↺
                </button>
              )}
            </div>

            {/* Bouton erreur */}
            {chronoActif && (
              <div style={{ padding: '0 28px 16px' }}>
                <button onClick={() => setNbErreurs(n => n+1)}
                  style={{ width: '100%', background: '#fef2f2', border: '1.5px solid #fca5a5', color: '#dc2626', padding: '20px', borderRadius: 16, fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                  ✗ Erreur de lecture {nbErreurs > 0 && <span style={{ fontSize: 15, opacity: 0.8 }}>({nbErreurs})</span>}
                </button>
              </div>
            )}

            {/* Saisie après chrono */}
            {chronoTermine && (
              <div style={{ padding: '0 28px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: 'var(--bg-gray)', borderRadius: 16, padding: 20 }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 10, fontFamily: 'var(--font-sans)' }}>
                    N° du dernier mot lu
                  </label>
                  <input
                    type="number"
                    value={dernierMot}
                    onChange={e => setDernierMot(e.target.value)}
                    placeholder="ex: 87"
                    autoFocus
                    style={{ width: '100%', background: 'white', border: '1.5px solid var(--border-main)', color: 'var(--primary-dark)', fontSize: 32, fontWeight: 700, textAlign: 'center', borderRadius: 12, padding: '12px', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }}
                  />
                  {nbErreurs > 0 && (
                    <p style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 8, textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
                      {nbErreurs} erreur{nbErreurs > 1 ? 's' : ''} comptabilisée{nbErreurs > 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {scoreCalc !== null && (
                  <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 16, padding: 20, textAlign: 'center' }}>
                    <p style={{ color: '#16a34a', fontSize: 13, fontWeight: 600, marginBottom: 4, fontFamily: 'var(--font-sans)' }}>Score calculé</p>
                    <p style={{ color: 'var(--primary-dark)', fontSize: 52, fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-sans)' }}>{scoreCalc}</p>
                    <p style={{ color: '#16a34a', fontSize: 14, marginTop: 4, fontFamily: 'var(--font-sans)' }}>mots / minute</p>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 6, fontFamily: 'var(--font-sans)' }}>
                      {parseInt(dernierMot)} mots − {nbErreurs} erreurs = {parseInt(dernierMot)-nbErreurs} corrects · {tempsEcoule}s
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Questions compréhension */}
            {chronoTermine && scoreCalc !== null && periode?.type !== 'evaluation_nationale' && (
              <div style={{ padding: '0 28px 16px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, marginBottom: 10, fontFamily: 'var(--font-sans)' }}>Questions de compréhension</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
                  {qs.map((q, i) => (
                    <button key={i} onClick={() => toggleQ(i)}
                      style={{
                        padding: '12px 4px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        border: q === true ? '1.5px solid #22c55e' : q === false ? '1.5px solid #ef4444' : '1.5px solid var(--border-main)',
                        background: q === true ? '#f0fdf4' : q === false ? '#fef2f2' : 'var(--bg-gray)',
                        color: q === true ? '#16a34a' : q === false ? '#dc2626' : 'var(--text-tertiary)',
                      }}>
                      Q{i+1}
                      <div style={{ fontSize: 16, marginTop: 2 }}>{q === true ? '✓' : q === false ? '✗' : '·'}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Boutons action */}
            <div style={{ padding: '16px 28px 28px', marginTop: 'auto', display: 'flex', gap: 10 }}>
              <button onClick={() => validerEleve(true, true)}
                style={{ flex: 1, border: '1.5px solid #fca5a5', background: '#fef2f2', color: '#dc2626', padding: '14px 10px', borderRadius: 14, fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                Absent
              </button>
              <button onClick={() => validerEleve(true, false)}
                style={{ flex: 1, border: '1.5px solid #fed7aa', background: '#fff7ed', color: '#c2410c', padding: '14px 10px', borderRadius: 14, fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                Non évalué
              </button>
              {scoreCalc !== null && (
                <button onClick={() => validerEleve(false, false)}
                  style={{ flex: 2, background: 'var(--primary-dark)', color: 'white', border: 'none', padding: '14px 20px', borderRadius: 14, fontWeight: 800, fontSize: 15, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                  Valider · Suivant →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Terminé ── */}
        {etape === 'done' && (
          <div style={{ padding: 32, maxWidth: 560 }}>
            <div style={{ background: 'white', borderRadius: 20, padding: '48px 40px', textAlign: 'center', border: '1.5px solid var(--border-light)' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>{erreurSauvegarde ? '⚠️' : '🎉'}</div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', marginBottom: 8 }}>
                {erreurSauvegarde ? 'Enregistrement partiel' : 'Passation terminée !'}
              </h3>
              {erreurSauvegarde && (
                <div style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#dc2626', fontFamily: 'var(--font-sans)', marginBottom: 16, textAlign: 'left' }}>
                  {erreurSauvegarde}
                </div>
              )}
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, fontFamily: 'var(--font-sans)', marginBottom: 4 }}>
                {nbFaits} élèves enregistrés
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'var(--font-sans)', marginBottom: 32 }}>
                Score moyen : {(() => {
                  const scores = eleves.filter(e => e.fait && !e.ne && e.scoreActuel).map(e => e.scoreActuel!)
                  return scores.length > 0 ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) + ' m/min' : '—'
                })()}
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => router.push('/dashboard/eleves')} style={{
                  flex: 1, border: '1.5px solid var(--border-main)', background: 'transparent',
                  color: 'var(--text-secondary)', padding: '13px 0', borderRadius: 12,
                  fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>
                  Mes classes
                </button>
                <button onClick={() => router.push('/dashboard/statistiques')} style={{
                  flex: 1, border: 'none', background: 'var(--primary-dark)',
                  color: 'white', padding: '13px 0', borderRadius: 12,
                  fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>
                  Voir les stats →
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function QcmResultatsTablePass({ eleves, qcmResultats }: { eleves: { id: string; nom: string; prenom: string }[]; qcmResultats: Record<string, any> }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', background: 'var(--bg-gray)', borderBottom: '1.5px solid var(--border-light)' }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'var(--font-sans)', margin: 0 }}>Résultats QCM</h4>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
        <thead><tr style={{ background: 'var(--bg-gray)' }}>
          <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1 }}>ÉLÈVE</th>
          {['Q1','Q2','Q3','Q4','Q5','Q6'].map(q => (<th key={q} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1 }}>{q}</th>))}
          <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1 }}>SCORE</th>
        </tr></thead>
        <tbody>
          {eleves.map(e => {
            const r = qcmResultats[e.id]
            const qs = r ? [r.q1, r.q2, r.q3, r.q4, r.q5, r.q6] : Array(6).fill(null)
            const nbCorrect = qs.filter((q: any) => q === 'Correct').length
            const hasAny = qs.some((q: any) => q !== null)
            return (<tr key={e.id} style={{ borderTop: '1px solid var(--border-light)' }}>
              <td style={{ padding: '12px 20px', fontWeight: 700, color: 'var(--primary-dark)' }}>{e.nom} {e.prenom}</td>
              {qs.map((q: any, i: number) => (<td key={i} style={{ padding: '12px 8px', textAlign: 'center' }}>
                {q === 'Correct' ? <span style={{ color: '#16a34a', fontWeight: 800 }}>✓</span> : q === 'Incorrect' ? <span style={{ color: '#dc2626', fontWeight: 800 }}>✗</span> : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
              </td>))}
              <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: hasAny ? (nbCorrect >= 4 ? '#16a34a' : nbCorrect >= 2 ? '#d97706' : '#dc2626') : 'var(--text-tertiary)' }}>{hasAny ? `${nbCorrect}/6` : '—'}</td>
            </tr>)
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function Passation() {
  return (
    <>
      <Sidebar />
      <ImpersonationBar />
      <PassationContent />
    </>
  )
}
