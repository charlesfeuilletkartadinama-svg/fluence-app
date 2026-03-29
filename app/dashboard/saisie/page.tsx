'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'
import { useProfil } from '@/app/lib/useProfil'
import type { Periode, Classe, TestSession, QcmQuestion } from '@/app/lib/types'
import { periodeVerrouillee } from '@/app/lib/fluenceUtils'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function genererCode(): string {
  let code = 'FLU-'
  for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return code
}

type Eleve = {
  id: string
  nom: string
  prenom: string
  score: string
  ne: boolean
  absent: boolean
  q1: boolean | null
  q2: boolean | null
  q3: boolean | null
  q4: boolean | null
  q5: boolean | null
  q6: boolean | null
}


function Saisie() {
  const [etape, setEtape]             = useState<'periode' | 'classe' | 'saisie' | 'recap' | 'done'>('periode')
  const [onglet, setOnglet]           = useState<'fluence' | 'qcm'>('fluence')
  const [periodes, setPeriodes]       = useState<Periode[]>([])
  const [periode, setPeriode]         = useState<Periode | null>(null)
  const [classe, setClasse]           = useState<Classe | null>(null)
  const [classesEtab, setClassesEtab] = useState<Classe[]>([])
  const [eleves, setEleves]           = useState<Eleve[]>([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [erreurSauvegarde, setErreurSauvegarde] = useState('')
  // QCM session
  const [sessions, setSessions]       = useState<TestSession[]>([])
  const [creatingSession, setCreatingSession] = useState(false)
  const [copiedCode, setCopiedCode]   = useState('')
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

  const router   = useRouter()
  const supabase = createClient()
  const { profil, loading: profilLoading } = useProfil()

  const isDirection = profil && ['directeur', 'principal'].includes(profil.role)

  useEffect(() => {
    if (profilLoading) return
    if (!profil) { setLoading(false); return }
    if (isDirection) chargerDonneesDirection()
    else if (profil.role === 'enseignant') chargerDonneesEnseignant()
    else setLoading(false)
  }, [profil, profilLoading])

  async function chargerDonneesDirection() {
    if (!profil?.etablissement_id) { setLoading(false); return }
    const classeId = new URLSearchParams(window.location.search).get('classe')
    const [{ data: periodesData }, { data: classesData }] = await Promise.all([
      supabase.from('periodes').select('id, code, label, date_fin, type')
        .eq('etablissement_id', profil.etablissement_id).eq('actif', true).order('code'),
      supabase.from('classes').select('id, nom, niveau')
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
    const classes = (data || []).map((r: any) => r.classe).filter(Boolean) as (Classe & { etablissement_id: string })[]
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

  async function selectionnerPeriode(p: Periode) {
    if (profil?.role === 'enseignant' && periodeVerrouillee(p?.date_fin)) return
    setPeriode(p)
    if (classe) {
      setLoading(true)
      const { data } = await supabase
        .from('eleves').select('id, nom, prenom').eq('classe_id', classe.id).eq('actif', true).order('nom')
      setEleves((data || []).map(e => ({ ...e, score: '', ne: false, absent: false, q1: null, q2: null, q3: null, q4: null, q5: null, q6: null })))
      setLoading(false)
      setOnglet('fluence')
      setEtape('saisie')
      chargerSessions(classe.id, p.id)
      chargerQcmResultats(classe.id, p.id)
    } else {
      setEtape('classe')
    }
  }

  async function selectionnerClasse(c: Classe) {
    setClasse(c)
    setLoading(true)
    const { data } = await supabase
      .from('eleves').select('id, nom, prenom').eq('classe_id', c.id).eq('actif', true).order('nom')
    setEleves((data || []).map(e => ({ ...e, score: '', ne: false, absent: false, q1: null, q2: null, q3: null, q4: null, q5: null, q6: null })))
    setLoading(false)
    setOnglet('fluence')
    setEtape('saisie')
    if (periode) {
      chargerSessions(c.id, periode.id)
      chargerQcmResultats(c.id, periode.id)
    }
  }

  async function chargerSessions(classeId: string, periodeId: string) {
    const { data } = await supabase
      .from('test_sessions')
      .select('id, code, classe_id, periode_id, enseignant_id, active, expires_at, created_at')
      .eq('classe_id', classeId)
      .eq('periode_id', periodeId)
      .order('created_at', { ascending: false })
    setSessions((data || []) as TestSession[])
  }

  async function chargerQcmResultats(classeId: string, periodeId: string) {
    const { data: elevesData } = await supabase
      .from('eleves').select('id').eq('classe_id', classeId).eq('actif', true)
    if (!elevesData || elevesData.length === 0) return
    const ids = elevesData.map(e => e.id)
    const { data: passData } = await supabase
      .from('passations')
      .select('eleve_id, q1, q2, q3, q4, q5, q6')
      .in('eleve_id', ids)
      .eq('periode_id', periodeId)
      .eq('hors_periode', false)
    const map: Record<string, any> = {}
    for (const p of (passData || [])) {
      map[p.eleve_id] = { q1: p.q1, q2: p.q2, q3: p.q3, q4: p.q4, q5: p.q5, q6: p.q6 }
    }
    setQcmResultats(map)
  }

  async function chargerQcmQuestions() {
    if (!classe || !periode) return
    setQcmTestLoaded(false)
    setQcmNoTest(false)
    const { data: classeData } = await supabase.from('classes').select('niveau').eq('id', classe.id).single()
    if (!classeData) { setQcmNoTest(true); setQcmTestLoaded(true); return }
    const { data: test } = await supabase.from('qcm_tests')
      .select('id').eq('periode_id', periode.id).eq('niveau', classeData.niveau).single()
    if (!test) { setQcmNoTest(true); setQcmTestLoaded(true); return }
    const { data: questions } = await supabase.from('qcm_questions')
      .select('*').eq('qcm_test_id', test.id).order('numero')
    setQcmQuestions((questions || []) as QcmQuestion[])
    setQcmTestLoaded(true)
    if (!questions || questions.length === 0) setQcmNoTest(true)
  }

  function ouvrirQcmIndividuel(eleveId: string) {
    setQcmEleveId(eleveId)
    setQcmReponses({})
    setQcmDone(false)
    setQcmScore(null)
    setQcmErreur('')
    setQcmMode('individuelle')
    if (!qcmTestLoaded) chargerQcmQuestions()
  }

  async function soumettreQcmIndividuel() {
    if (!qcmEleveId || !periode || !profil) return
    if (qcmQuestions.length === 0) return
    const toutRepondu = qcmQuestions.every(q => qcmReponses[q.numero])
    if (!toutRepondu) { setQcmErreur('Répondez à toutes les questions.'); return }

    setQcmSubmitting(true)
    setQcmErreur('')

    // Corriger localement
    const results: string[] = qcmQuestions.map(q =>
      qcmReponses[q.numero] === q.reponse_correcte ? 'Correct' : 'Incorrect'
    )

    // Upsert directement
    const { error } = await supabase.from('passations').upsert({
      eleve_id: qcmEleveId,
      periode_id: periode.id,
      hors_periode: false,
      q1: results[0] || null, q2: results[1] || null, q3: results[2] || null,
      q4: results[3] || null, q5: results[4] || null, q6: results[5] || null,
      mode: 'qcm_enseignant',
    }, { onConflict: 'eleve_id,periode_id,hors_periode' })

    setQcmSubmitting(false)
    if (error) { setQcmErreur(error.message); return }

    setQcmScore(results)
    setQcmDone(true)
    // Rafraîchir les résultats
    if (classe && periode) chargerQcmResultats(classe.id, periode.id)
  }

  function qcmEleveSuivant() {
    setQcmDone(false)
    setQcmScore(null)
    setQcmReponses({})
    setQcmEleveId(null)
    // Rester en mode individuelle pour sélectionner le prochain
  }

  async function creerSession() {
    if (!classe || !periode || !profil) return
    setCreatingSession(true)
    let code = genererCode()
    let attempts = 0
    while (attempts < 5) {
      const { error } = await supabase.from('test_sessions').insert({
        code,
        classe_id: classe.id,
        periode_id: periode.id,
        enseignant_id: profil.id,
      })
      if (!error) break
      if (error.code === '23505') { code = genererCode(); attempts++ }
      else { setCreatingSession(false); return }
    }
    setCreatingSession(false)
    chargerSessions(classe.id, periode.id)
  }

  async function desactiverSession(id: string) {
    await supabase.from('test_sessions').update({ active: false }).eq('id', id)
    setSessions(prev => prev.map(s => s.id === id ? { ...s, active: false } : s))
  }

  function copierCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(''), 2000)
  }

  function updateEleve(idx: number, champ: string, valeur: any) {
    setEleves(prev => prev.map((e, i) =>
      i === idx ? { ...e, [champ]: valeur } : e
    ))
  }

  function toggleQ(idx: number, q: string) {
    const cur = (eleves[idx] as any)[q]
    updateEleve(idx, q, cur === null ? true : cur === true ? false : null)
  }

  const nbSaisis = eleves.filter(e => e.ne || e.absent || (e.score !== '' && !isNaN(Number(e.score)))).length
  const scoreMoyen = (() => {
    const scores = eleves.filter(e => !e.ne && e.score !== '' && !isNaN(Number(e.score))).map(e => Number(e.score))
    return scores.length > 0 ? Math.round(scores.reduce((a,b) => a+b, 0) / scores.length) : null
  })()

  async function valider() {
    if (!profil) return
    if (profil.role === 'enseignant' && periodeVerrouillee(periode?.date_fin)) return
    setSaving(true)
    setErreurSauvegarde('')
    let ok = 0, err = 0

    for (const eleve of eleves) {
      if (!eleve.ne && !eleve.absent && eleve.score === '') continue
      if (!periode) continue

      const { error } = await supabase.from('passations').upsert({
        eleve_id:      eleve.id,
        periode_id:    periode.id,
        hors_periode:  false,
        score:         (eleve.ne || eleve.absent) ? null : Number(eleve.score),
        non_evalue:    eleve.ne || eleve.absent,
        absent:        eleve.absent,
        mode:          'saisie',
        enseignant_id: profil.id,
        q1: eleve.q1 === true ? 'Correct' : eleve.q1 === false ? 'Incorrect' : null,
        q2: eleve.q2 === true ? 'Correct' : eleve.q2 === false ? 'Incorrect' : null,
        q3: eleve.q3 === true ? 'Correct' : eleve.q3 === false ? 'Incorrect' : null,
        q4: eleve.q4 === true ? 'Correct' : eleve.q4 === false ? 'Incorrect' : null,
        q5: eleve.q5 === true ? 'Correct' : eleve.q5 === false ? 'Incorrect' : null,
        q6: eleve.q6 === true ? 'Correct' : eleve.q6 === false ? 'Incorrect' : null,
      }, { onConflict: 'eleve_id,periode_id,hors_periode' })

      if (error) {
        err++
        console.error('[saisie] upsert error:', error.message, error.details, error.hint, error.code)
        if (err === 1) setErreurSauvegarde(`Erreur : ${error.message}${error.details ? ' — ' + error.details : ''}`)
      } else ok++
    }

    setSaving(false)
    if (err > 0 && ok > 0) {
      setErreurSauvegarde(`${err} enregistrement${err > 1 ? 's ont' : ' a'} échoué sur ${ok + err}.`)
    }
    setEtape('done')
  }

  if (loading) return <div style={{ marginLeft: 'var(--sidebar-width)', padding: 32, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>Chargement...</div>

  // Tab style helper
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 24px', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)',
    background: 'none', border: 'none', cursor: 'pointer', marginBottom: -2,
    borderBottom: `2px solid ${active ? 'var(--primary-dark)' : 'transparent'}`,
    color: active ? 'var(--primary-dark)' : 'var(--text-secondary)',
    transition: 'all 0.15s',
  })

  return (
    <div style={{ marginLeft: 'var(--sidebar-width)', padding: 32, maxWidth: 900, minHeight: '100vh', background: 'var(--bg-light)' }}>

        {/* ÉTAPE 0 : Choix de la période */}
        {etape === 'periode' && (
          <>
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>Mode Saisie</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 15, fontFamily: 'var(--font-sans)' }}>Choisissez une période</p>
            </div>
            {periodes.length === 0 ? (
              <div style={{ background: 'white', borderRadius: 16, padding: '48px 32px', border: '1.5px solid var(--border-light)', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🏫</div>
                <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', marginBottom: 8 }}>Aucune période disponible</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                  Ce profil n'est pas rattaché à un établissement.<br />
                  Utilisez l'impersonation pour saisir en tant qu'enseignant ou directeur.
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
                        <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--primary-dark)' }}>{p.code}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>{p.label}</div>
                        {locked && <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600, marginTop: 4 }}>Période clôturée — saisie réservée au directeur</div>}
                      </div>
                      <span style={{ color: locked ? '#DC2626' : 'var(--text-tertiary)', fontSize: 18 }}>{locked ? '🔒' : '→'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            )}
          </>
        )}

        {/* ÉTAPE 1 : Choix de la classe */}
        {etape === 'classe' && (
          <>
            <div style={{ marginBottom: 32 }}>
              <button onClick={() => setEtape('periode')}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontFamily: 'var(--font-sans)', marginBottom: 12, padding: 0, display: 'block' }}>
                ← Retour
              </button>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>Mode Saisie</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 15, fontFamily: 'var(--font-sans)' }}>Période · {periode?.code} — Choisissez la classe</p>
            </div>
            <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1.5px solid var(--border-light)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>Choisir une classe</p>
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
          </>
        )}

        {/* ÉTAPE 2 : Saisie — avec onglets Fluence / QCM */}
        {etape === 'saisie' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>
                  {classe?.nom} · {periode?.code}
                </h2>
              </div>
            </div>

            {/* Onglets Fluence / QCM */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid var(--border-light)' }}>
              <button onClick={() => setOnglet('fluence')} style={tabStyle(onglet === 'fluence')}>Fluence</button>
              <button onClick={() => setOnglet('qcm')} style={tabStyle(onglet === 'qcm')}>QCM Compréhension</button>
            </div>

            {/* ── Onglet Fluence ── */}
            {onglet === 'fluence' && (
              <>
                <p style={{ color: 'var(--text-secondary)', marginTop: 0, marginBottom: 16, fontSize: 14, fontFamily: 'var(--font-sans)' }}>
                  {nbSaisis} / {eleves.length} élèves saisis
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {eleves.map((eleve, idx) => (
                    <div key={eleve.id} style={{
                      background: eleve.absent ? '#fef2f2' : eleve.ne ? '#fff7ed' : eleve.score !== '' ? '#f0fdf4' : 'white',
                      border: `1.5px solid ${eleve.absent ? '#fca5a5' : eleve.ne ? '#fed7aa' : eleve.score !== '' ? '#bbf7d0' : 'var(--border-light)'}`,
                      borderRadius: 16, padding: '18px 24px', transition: 'all 0.15s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 48 }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)' }}>{eleve.nom}</span>
                          <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 15 }}>{eleve.prenom}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input type="number" value={eleve.score}
                            onChange={e => updateEleve(idx, 'score', e.target.value)}
                            disabled={eleve.ne || eleve.absent}
                            placeholder="—" min={0} max={500}
                            style={{
                              width: 88, textAlign: 'center', border: '1.5px solid var(--border-main)',
                              borderRadius: 12, padding: '10px 12px', fontSize: 18, fontWeight: 700,
                              color: 'var(--primary-dark)', outline: 'none', fontFamily: 'var(--font-sans)',
                              background: (eleve.ne || eleve.absent) ? 'var(--bg-gray)' : 'white',
                              opacity: (eleve.ne || eleve.absent) ? 0.4 : 1,
                            }}
                          />
                          <span style={{ color: 'var(--text-tertiary)', fontSize: 12, fontFamily: 'var(--font-sans)' }}>mots/min</span>
                        </div>
                        <button onClick={() => setEleves(prev => prev.map((e, i) => i === idx ? { ...e, ne: !e.ne, absent: false, score: '' } : e))} style={{
                          padding: '10px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                          border: eleve.ne ? '2px solid #fb923c' : '2px solid var(--border-main)',
                          background: eleve.ne ? '#fff7ed' : 'transparent',
                          color: eleve.ne ? '#c2410c' : 'var(--text-tertiary)',
                          cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
                        }}>N.É.</button>
                        <button onClick={() => setEleves(prev => prev.map((e, i) => i === idx ? { ...e, absent: !e.absent, ne: false, score: '' } : e))} style={{
                          padding: '10px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                          border: eleve.absent ? '2px solid #f87171' : '2px solid var(--border-main)',
                          background: eleve.absent ? '#fef2f2' : 'transparent',
                          color: eleve.absent ? '#dc2626' : 'var(--text-tertiary)',
                          cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
                        }}>Absent</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setEtape('recap')} disabled={nbSaisis === 0} style={{
                    background: nbSaisis === 0 ? 'var(--text-tertiary)' : 'var(--primary-dark)',
                    color: 'white', border: 'none', padding: '13px 32px', borderRadius: 12,
                    fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700,
                    cursor: nbSaisis === 0 ? 'not-allowed' : 'pointer',
                  }}>
                    Voir le récapitulatif →
                  </button>
                </div>
              </>
            )}

            {/* ── Onglet QCM ── */}
            {onglet === 'qcm' && (
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

                    {/* Résultats QCM */}
                    <QcmResultatsTable eleves={eleves} qcmResultats={qcmResultats} />
                  </>
                )}

                {/* ── Mode individuel ── */}
                {qcmMode === 'individuelle' && !qcmEleveId && !qcmDone && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>
                        Passation individuelle — Sélectionner un élève
                      </h3>
                      <button onClick={() => { setQcmMode('choix'); setQcmEleveId(null) }} style={{
                        background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border-light)',
                        padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer',
                      }}>← Retour</button>
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
                            background: hasResult ? '#f0fdf4' : 'white',
                            border: `1.5px solid ${hasResult ? '#bbf7d0' : 'var(--border-light)'}`,
                            borderRadius: 14, padding: '16px 20px', cursor: qcmNoTest ? 'not-allowed' : 'pointer',
                            fontFamily: 'var(--font-sans)', transition: 'all 0.15s', textAlign: 'left',
                            opacity: qcmNoTest ? 0.5 : 1,
                          }}>
                            <div>
                              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary-dark)' }}>{e.nom}</span>
                              <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 14 }}>{e.prenom}</span>
                              {hasResult && (
                                <span style={{ marginLeft: 12, fontSize: 12, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 6 }}>
                                  {[r!.q1, r!.q2, r!.q3, r!.q4, r!.q5, r!.q6].filter(q => q === 'Correct').length}/6
                                </span>
                              )}
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
                      <button onClick={() => setQcmEleveId(null)} style={{
                        background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border-light)',
                        padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer',
                      }}>← Retour</button>
                    </div>

                    {qcmErreur && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#dc2626', fontFamily: 'var(--font-sans)' }}>{qcmErreur}</div>}

                    {qcmQuestions.map((q, idx) => (
                      <div key={q.id} style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', padding: 20, marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                          <span style={{ background: qcmReponses[q.numero] ? '#16a34a' : 'var(--primary-dark)', color: 'white', borderRadius: 10, minWidth: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, flexShrink: 0, fontFamily: 'var(--font-sans)' }}>
                            {q.numero}
                          </span>
                          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--primary-dark)', margin: 0, lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>{q.question_text}</p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingLeft: 48 }}>
                          {(['A', 'B', 'C', 'D'] as const).map(letter => {
                            const selected = qcmReponses[q.numero] === letter
                            return (
                              <button key={letter} onClick={() => setQcmReponses(prev => ({ ...prev, [q.numero]: letter }))} style={{
                                padding: '12px 14px', borderRadius: 10, textAlign: 'left',
                                border: `2px solid ${selected ? '#3b82f6' : 'var(--border-light)'}`,
                                background: selected ? '#eff6ff' : 'white',
                                cursor: 'pointer', fontSize: 14, fontWeight: selected ? 700 : 500,
                                color: selected ? 'var(--primary-dark)' : 'var(--text-secondary)',
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
                    }}>
                      {qcmSubmitting ? 'Enregistrement…' : 'Valider les réponses'}
                    </button>
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
                        <span key={i} style={{
                          padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)',
                          background: r === 'Correct' ? '#f0fdf4' : '#fef2f2',
                          color: r === 'Correct' ? '#16a34a' : '#dc2626',
                          border: `1px solid ${r === 'Correct' ? '#bbf7d0' : '#fecaca'}`,
                        }}>Q{i + 1} {r === 'Correct' ? '✓' : '✗'}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                      <button onClick={qcmEleveSuivant} style={{
                        background: 'var(--primary-dark)', color: 'white', border: 'none', padding: '13px 28px', borderRadius: 12,
                        fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer',
                      }}>Élève suivant</button>
                      <button onClick={() => { setQcmMode('choix'); setQcmEleveId(null); setQcmDone(false) }} style={{
                        background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border-light)',
                        padding: '13px 28px', borderRadius: 12, fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
                      }}>Retour</button>
                    </div>
                  </div>
                )}

                {/* ── Mode collectif ── */}
                {qcmMode === 'collective' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>
                        Session collective
                      </h3>
                      <button onClick={() => setQcmMode('choix')} style={{
                        background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border-light)',
                        padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer',
                      }}>← Retour</button>
                    </div>

                    <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', padding: 24, marginBottom: 24 }}>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
                        Créez un code pour que les élèves passent le QCM sur tablette via <strong>/test</strong>. La session expire après 2 heures.
                      </p>
                      <button onClick={creerSession} disabled={creatingSession} style={{
                        background: 'var(--primary-dark)', color: 'white', border: 'none', padding: '11px 22px',
                        borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer',
                        opacity: creatingSession ? 0.6 : 1,
                      }}>
                        {creatingSession ? 'Création…' : '+ Nouvelle session'}
                      </button>
                    </div>

                    {sessions.length > 0 && (
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
                            {sessions.map(s => {
                              const expired = new Date(s.expires_at) < new Date()
                              const isActive = s.active && !expired
                              return (
                                <tr key={s.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                                  <td style={{ padding: '14px 20px', fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'monospace', fontSize: 16, letterSpacing: 2 }}>{s.code}</td>
                                  <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                    <span style={{
                                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, fontFamily: 'var(--font-sans)',
                                      background: isActive ? '#f0fdf4' : '#f3f4f6', color: isActive ? '#16a34a' : '#6b7280',
                                    }}>{isActive ? 'Active' : !s.active ? 'Désactivée' : 'Expirée'}</span>
                                  </td>
                                  <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                      <button onClick={() => copierCode(s.code)} style={{
                                        background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border-light)',
                                        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer',
                                      }}>{copiedCode === s.code ? 'Copié !' : 'Copier'}</button>
                                      {isActive && (
                                        <button onClick={() => desactiverSession(s.id)} style={{
                                          background: 'transparent', color: '#dc2626', border: '1.5px solid #fca5a5',
                                          padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer',
                                        }}>Désactiver</button>
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

                    <QcmResultatsTable eleves={eleves} qcmResultats={qcmResultats} />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ÉTAPE 3 : Récap */}
        {etape === 'recap' && (
          <>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>Récapitulatif</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 14, fontFamily: 'var(--font-sans)' }}>{classe?.nom} · {periode?.code}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { val: nbSaisis, label: 'Élèves saisis', color: 'var(--primary-dark)' },
                { val: scoreMoyen !== null ? scoreMoyen : '—', label: 'Score moyen', color: 'var(--primary-dark)' },
                { val: eleves.filter(e => e.ne).length, label: 'Non évalués', color: '#D97706' },
                { val: eleves.filter(e => e.absent).length, label: 'Absents', color: '#DC2626' },
              ].map(({ val, label, color }) => (
                <div key={label} style={{ background: 'white', borderRadius: 16, padding: '20px 16px', border: '1.5px solid var(--border-light)', textAlign: 'center' }}>
                  <p style={{ fontSize: 28, fontWeight: 800, color, fontFamily: 'var(--font-sans)', margin: '0 0 4px 0' }}>{val}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', margin: 0 }}>{label}</p>
                </div>
              ))}
            </div>

            <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', overflow: 'hidden', marginBottom: 24 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-gray)' }}>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1 }}>ÉLÈVE</th>
                    <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1 }}>SCORE</th>
                    <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1 }}>STATUT</th>
                  </tr>
                </thead>
                <tbody>
                  {eleves.filter(e => e.ne || e.absent || e.score !== '').map((e, i) => (
                    <tr key={e.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '12px 20px', fontWeight: 700, color: 'var(--primary-dark)' }}>{e.nom} {e.prenom}</td>
                      <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 700, color: 'var(--primary-dark)' }}>
                        {(e.ne || e.absent) ? '—' : `${e.score} m/min`}
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                        {e.absent
                          ? <span style={{ background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6 }}>Absent</span>
                          : e.ne
                            ? <span style={{ background: '#fff7ed', color: '#c2410c', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6 }}>N.É.</span>
                            : <span style={{ background: 'rgba(22,163,74,0.08)', color: '#16a34a', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6 }}>✓</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setEtape('saisie')} style={{
                flex: 1, border: '1.5px solid var(--border-main)', background: 'transparent',
                color: 'var(--text-secondary)', padding: '13px 0', borderRadius: 12,
                fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>← Modifier</button>
              <button onClick={valider} disabled={saving} style={{
                flex: 1, background: saving ? 'var(--text-tertiary)' : 'var(--primary-dark)',
                color: 'white', border: 'none', padding: '13px 0', borderRadius: 12,
                fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}>
                {saving ? 'Enregistrement...' : 'Confirmer et envoyer'}
              </button>
            </div>
          </>
        )}

        {/* ÉTAPE 4 : Terminé */}
        {etape === 'done' && (
          <div style={{ background: 'white', borderRadius: 20, padding: '48px 40px', textAlign: 'center', border: '1.5px solid var(--border-light)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{erreurSauvegarde ? '⚠️' : '✅'}</div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', marginBottom: 8 }}>
              {erreurSauvegarde ? 'Enregistrement partiel' : 'Scores enregistrés !'}
            </h3>
            {erreurSauvegarde && (
              <div style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#dc2626', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
                {erreurSauvegarde}
              </div>
            )}
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, fontFamily: 'var(--font-sans)', marginBottom: 32 }}>
              {nbSaisis} élèves · Score moyen : {scoreMoyen !== null ? `${scoreMoyen} mots/min` : '—'}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => router.push('/dashboard/eleves')} style={{
                border: '1.5px solid var(--border-main)', background: 'transparent',
                color: 'var(--text-secondary)', padding: '13px 24px', borderRadius: 12,
                fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>Voir mes classes</button>
              <button onClick={() => {
                setPeriode(null)
                setClasse(classesEtab.length > 1 ? null : classe)
                setEleves(prev => prev.map(e => ({ ...e, score: '', ne: false, absent: false, q1: null, q2: null, q3: null, q4: null, q5: null, q6: null })))
                setEtape('periode')
              }} style={{
                background: 'var(--primary-dark)', color: 'white', border: 'none',
                padding: '13px 24px', borderRadius: 12,
                fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>Nouvelle saisie</button>
            </div>
          </div>
        )}
    </div>
  )
}

function QcmResultatsTable({ eleves, qcmResultats }: { eleves: { id: string; nom: string; prenom: string }[]; qcmResultats: Record<string, any> }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', background: 'var(--bg-gray)', borderBottom: '1.5px solid var(--border-light)' }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'var(--font-sans)', margin: 0 }}>
          Résultats QCM
        </h4>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
        <thead>
          <tr style={{ background: 'var(--bg-gray)' }}>
            <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1 }}>ÉLÈVE</th>
            {['Q1','Q2','Q3','Q4','Q5','Q6'].map(q => (
              <th key={q} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1 }}>{q}</th>
            ))}
            <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1 }}>SCORE</th>
          </tr>
        </thead>
        <tbody>
          {eleves.map(e => {
            const r = qcmResultats[e.id]
            const qs = r ? [r.q1, r.q2, r.q3, r.q4, r.q5, r.q6] : Array(6).fill(null)
            const nbCorrect = qs.filter((q: any) => q === 'Correct').length
            const hasAny = qs.some((q: any) => q !== null)
            return (
              <tr key={e.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                <td style={{ padding: '12px 20px', fontWeight: 700, color: 'var(--primary-dark)' }}>{e.nom} {e.prenom}</td>
                {qs.map((q: any, i: number) => (
                  <td key={i} style={{ padding: '12px 8px', textAlign: 'center' }}>
                    {q === 'Correct' ? <span style={{ color: '#16a34a', fontWeight: 800 }}>✓</span>
                      : q === 'Incorrect' ? <span style={{ color: '#dc2626', fontWeight: 800 }}>✗</span>
                      : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                  </td>
                ))}
                <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: hasAny ? (nbCorrect >= 4 ? '#16a34a' : nbCorrect >= 2 ? '#d97706' : '#dc2626') : 'var(--text-tertiary)' }}>
                  {hasAny ? `${nbCorrect}/6` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function SaisieWrapper() {
  return (
    <>
      <Sidebar />
      <ImpersonationBar />
      <Saisie />
    </>
  )
}
