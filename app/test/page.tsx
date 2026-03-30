'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/app/lib/supabase'
import { playEndBeep } from '@/app/lib/useBeep'

type Etape = 'code' | 'lecture' | 'questions' | 'resultat'
type Question = { id: string; numero: number; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string }

export default function TestEleve() {
  const supabase = createClient()
  const [etape, setEtape] = useState<Etape>('code')
  const [codeInput, setCodeInput] = useState('')
  const [erreur, setErreur] = useState('')
  // Données élève
  const [eleveNom, setEleveNom] = useState('')
  const [elevePrenom, setElevePrenom] = useState('')
  const [sessionCode, setSessionCode] = useState('')
  const [texteReference, setTexteReference] = useState('')
  const [titreTest, setTitreTest] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [reponses, setReponses] = useState<Record<number, string>>({})
  const [resultats, setResultats] = useState<string[] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Timer
  const [timer, setTimer] = useState(300)
  const [timerActive, setTimerActive] = useState(false)
  const [timerExpired, setTimerExpired] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  function startTimer() {
    setTimer(300); setTimerActive(true); setTimerExpired(false)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          setTimerActive(false); setTimerExpired(true); playEndBeep()
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  // ── Étape 1 : Valider le code individuel ──
  async function validerCode() {
    setErreur('')
    const code = codeInput.trim().toUpperCase()
    if (!code) { setErreur('Entre ton code personnel.'); return }

    // Rate limiting
    const ipHash = 'client_' + (navigator.userAgent + screen.width).split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0).toString(36)
    const { data: allowed } = await supabase.rpc('check_test_rate_limit', { p_ip_hash: ipHash })
    if (allowed === false) { setErreur('Trop de tentatives. Réessaie dans quelques minutes.'); return }

    // Chercher le code individuel
    const { data: se } = await supabase
      .from('session_eleves')
      .select('id, session_id, eleve_id, termine, eleve:eleves(id, nom, prenom, classe:classes(niveau))')
      .eq('code_individuel', code)
      .single()

    if (!se) { setErreur('Code invalide. Vérifie auprès de ton enseignant.'); return }
    if ((se as any).termine) { setErreur('Tu as déjà passé ce test.'); return }

    // Vérifier que la session est active
    const { data: session } = await supabase.from('test_sessions').select('id, code, periode_id, active, expires_at').eq('id', (se as any).session_id).single()
    if (!session || !session.active) { setErreur('Cette session a été désactivée.'); return }
    if (new Date(session.expires_at) < new Date()) { setErreur('Cette session a expiré.'); return }

    setSessionCode(code)
    setEleveNom((se as any).eleve?.nom || '')
    setElevePrenom((se as any).eleve?.prenom || '')

    // Marquer comme connecté
    await supabase.from('session_eleves').update({ connecte: true, debut_test: new Date().toISOString() }).eq('id', (se as any).id)

    // Charger le test QCM
    const niveau = (se as any).eleve?.classe?.niveau || ''
    const { data: test } = await supabase.from('qcm_tests').select('id, titre, texte_reference').eq('periode_id', session.periode_id).eq('niveau', niveau).single()
    if (!test) { setErreur('Aucun test configuré pour ton niveau. Préviens ton enseignant.'); return }

    setTitreTest(test.titre || '')
    setTexteReference(test.texte_reference || '')

    const { data: qs } = await supabase.from('qcm_questions').select('id, numero, question_text, option_a, option_b, option_c, option_d').eq('qcm_test_id', test.id).order('numero')
    if (!qs || qs.length === 0) { setErreur('Les questions ne sont pas encore prêtes.'); return }
    setQuestions(qs)
    setReponses({})

    if (test.texte_reference) { setEtape('lecture') } else { setEtape('questions'); startTimer() }
  }

  // ── Soumettre ──
  async function soumettre() {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimerActive(false)
    setErreur('')
    const toutRepondu = questions.every(q => reponses[q.numero])
    if (!toutRepondu) { setErreur('Réponds à toutes les questions avant de valider.'); return }

    setSubmitting(true)
    const answersArray = questions.map(q => reponses[q.numero])
    const { data, error } = await supabase.rpc('submit_qcm_individual', { p_code: sessionCode, p_answers: answersArray })
    setSubmitting(false)

    if (error) { setErreur(error.message); return }
    if (data?.error) { setErreur(data.error); return }
    setResultats(data.results)
    setEtape('resultat')
  }

  function retourAccueil() {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimerActive(false); setTimerExpired(false)
    setCodeInput(''); setErreur(''); setEtape('code')
    setQuestions([]); setReponses({}); setResultats(null)
  }

  // ── Styles ──
  const page: React.CSSProperties = { minHeight: '100vh', background: 'linear-gradient(135deg, #f0f4ff 0%, #e8eeff 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', fontFamily: 'var(--font-sans, -apple-system, sans-serif)' }
  const card: React.CSSProperties = { background: 'white', borderRadius: 20, border: '1.5px solid #e2e8f0', padding: 32, width: '100%', maxWidth: 600, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }
  const title: React.CSSProperties = { fontSize: 28, fontWeight: 800, color: '#1e293b', margin: '0 0 8px 0', textAlign: 'center' }
  const subtitle: React.CSSProperties = { fontSize: 15, color: '#64748b', textAlign: 'center', margin: '0 0 28px 0' }
  const btnPrimary: React.CSSProperties = { background: '#1e3a5f', color: 'white', border: 'none', padding: '14px 28px', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer', width: '100%' }
  const errStyle: React.CSSProperties = { background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 16px', fontSize: 14, color: '#dc2626', marginBottom: 16, textAlign: 'center' }

  return (
    <div style={page}>
      {/* Logo */}
      <div style={{ marginBottom: 24 }}>
        <svg width="160" viewBox="0 0 220 44" xmlns="http://www.w3.org/2000/svg">
          <text x="0" y="34" style={{ fontSize: 36, fontWeight: 800, fill: '#1e3a5f', fontFamily: 'var(--font-sans, sans-serif)' }}>Fluence</text>
          <text x="155" y="34" style={{ fontSize: 18, fontWeight: 800, fill: '#3b82f6', fontFamily: 'var(--font-sans, sans-serif)' }}>+</text>
        </svg>
      </div>

      {/* ── ÉTAPE 1 : CODE PERSONNEL ── */}
      {etape === 'code' && (
        <div style={card}>
          <h1 style={title}>Test de compréhension</h1>
          <p style={subtitle}>Entre ton code personnel donné par ton enseignant</p>
          {erreur && <div style={errStyle}>{erreur}</div>}
          <input
            value={codeInput}
            onChange={e => setCodeInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && validerCode()}
            placeholder="Mon code personnel"
            style={{ width: '100%', border: '2px solid #e2e8f0', borderRadius: 14, padding: '16px 20px', fontSize: 20, fontFamily: 'monospace', textAlign: 'center', letterSpacing: 3, outline: 'none', textTransform: 'uppercase', boxSizing: 'border-box' }}
            autoFocus
          />
          <button onClick={validerCode} style={{ ...btnPrimary, marginTop: 20 }}>C'est parti !</button>
        </div>
      )}

      {/* ── ÉTAPE 2 : LECTURE ── */}
      {etape === 'lecture' && (
        <div style={card}>
          <h1 style={title}>{titreTest || 'Texte de lecture'}</h1>
          <p style={subtitle}>Bonjour {elevePrenom} ! Lis bien ce texte.</p>
          <div style={{
            background: '#fafbfc', border: '1.5px solid #e2e8f0', borderRadius: 14,
            padding: 24, fontSize: 17, lineHeight: 1.8, color: '#334155',
            fontFamily: 'Georgia, serif', marginBottom: 24, maxHeight: 400, overflowY: 'auto',
            whiteSpace: 'pre-wrap',
          }}>{texteReference}</div>
          <button onClick={() => { setEtape('questions'); startTimer() }} style={btnPrimary}>J'ai lu le texte</button>
        </div>
      )}

      {/* ── ÉTAPE 3 : QUESTIONS ── */}
      {etape === 'questions' && (
        <div style={{ width: '100%', maxWidth: 600 }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 4px 0' }}>Bonjour <strong>{elevePrenom} {eleveNom}</strong></p>
            {/* Minuteur */}
            <div style={{
              fontSize: 32, fontWeight: 900, fontVariantNumeric: 'tabular-nums', margin: '8px 0 12px',
              color: timerExpired ? '#dc2626' : timer <= 30 ? '#f97316' : timer <= 60 ? '#d97706' : '#1e3a5f',
            }}>
              {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
            </div>
            {timerExpired && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '8px 16px', marginBottom: 12, fontSize: 14, color: '#dc2626', fontWeight: 700 }}>
                Temps écoulé ! Envoie vite tes réponses.
              </div>
            )}
            <p style={{ ...subtitle, marginBottom: 0 }}>
              {Object.keys(reponses).length} / {questions.length} répondu{Object.keys(reponses).length > 1 ? 'es' : ''}
            </p>
          </div>

          {erreur && <div style={errStyle}>{erreur}</div>}

          {questions.map(q => (
            <div key={q.id} style={{ ...card, marginBottom: 14, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                <span style={{
                  background: reponses[q.numero] ? '#16a34a' : '#1e3a5f', color: 'white', borderRadius: 10,
                  minWidth: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 800, flexShrink: 0,
                }}>{q.numero}</span>
                <p style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', margin: 0, lineHeight: 1.5 }}>{q.question_text}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(['A', 'B', 'C', 'D'] as const).map(letter => {
                  const selected = reponses[q.numero] === letter
                  return (
                    <button key={letter} onClick={() => setReponses(prev => ({ ...prev, [q.numero]: letter }))} style={{
                      padding: '14px 16px', borderRadius: 10, border: `2px solid ${selected ? '#3b82f6' : '#e2e8f0'}`,
                      background: selected ? '#eff6ff' : 'white', cursor: 'pointer', fontSize: 14,
                      fontWeight: selected ? 700 : 500, color: selected ? '#1e3a5f' : '#475569',
                      textAlign: 'left', transition: 'all 0.15s',
                    }}>
                      <span style={{ fontWeight: 800, marginRight: 8, color: selected ? '#3b82f6' : '#94a3b8' }}>{letter}.</span>
                      {(q as any)[`option_${letter.toLowerCase()}`]}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* GROS BOUTON VALIDER */}
          <button
            onClick={soumettre}
            disabled={submitting || Object.keys(reponses).length < questions.length}
            style={{
              width: '100%', padding: '20px', borderRadius: 16, border: 'none',
              background: (submitting || Object.keys(reponses).length < questions.length) ? '#94a3b8' : '#16a34a',
              color: 'white', fontSize: 20, fontWeight: 800, cursor: (submitting || Object.keys(reponses).length < questions.length) ? 'default' : 'pointer',
              marginTop: 12, boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
              transition: 'all 0.2s',
            }}
          >
            {submitting ? '⏳ Envoi en cours…' : '✅ VALIDER MES RÉPONSES'}
          </button>
        </div>
      )}

      {/* ── ÉTAPE 4 : RÉSULTATS ── */}
      {etape === 'resultat' && resultats && (
        <div style={card}>
          <h1 style={title}>Bravo {elevePrenom} !</h1>
          <div style={{
            fontSize: 56, fontWeight: 800, textAlign: 'center', margin: '16px 0 24px',
            color: resultats.filter(r => r === 'Correct').length >= 4 ? '#16a34a' : resultats.filter(r => r === 'Correct').length >= 2 ? '#d97706' : '#dc2626',
          }}>
            {resultats.filter(r => r === 'Correct').length} / {resultats.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {resultats.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 10,
                background: r === 'Correct' ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${r === 'Correct' ? '#bbf7d0' : '#fecaca'}`,
              }}>
                <span style={{ fontSize: 20 }}>{r === 'Correct' ? '✓' : '✗'}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: r === 'Correct' ? '#16a34a' : '#dc2626' }}>
                  Question {i + 1} — {r === 'Correct' ? 'Bonne réponse' : 'Mauvaise réponse'}
                </span>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: 15, color: '#64748b', marginBottom: 20 }}>
            Tu peux maintenant rendre ta tablette à ton enseignant.
          </p>
          <button onClick={retourAccueil} style={{ ...btnPrimary, background: '#64748b' }}>Terminer</button>
        </div>
      )}
    </div>
  )
}
