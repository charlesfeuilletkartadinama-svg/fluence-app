'use client'

import { useState } from 'react'
import { createClient } from '@/app/lib/supabase'

type Etape = 'code' | 'eleve' | 'lecture' | 'questions' | 'resultat'
type Eleve = { id: string; nom: string; prenom: string }
type Question = {
  id: string; numero: number; question_text: string
  option_a: string; option_b: string; option_c: string; option_d: string
}

export default function TestEleve() {
  const supabase = createClient()
  const [etape, setEtape] = useState<Etape>('code')
  const [codeInput, setCodeInput] = useState('')
  const [erreur, setErreur] = useState('')
  const [sessionData, setSessionData] = useState<any>(null)
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [selectedEleve, setSelectedEleve] = useState<Eleve | null>(null)
  const [texteReference, setTexteReference] = useState('')
  const [titreTest, setTitreTest] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [reponses, setReponses] = useState<Record<number, string>>({})
  const [resultats, setResultats] = useState<string[] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [classeNiveau, setClasseNiveau] = useState('')

  // ── Étape 1 : Valider le code session ──
  async function validerCode() {
    setErreur('')
    const code = codeInput.trim().toUpperCase()
    if (!code) { setErreur('Veuillez entrer un code.'); return }

    const { data: session, error } = await supabase
      .from('test_sessions')
      .select('id, code, classe_id, periode_id, active, expires_at')
      .eq('code', code)
      .single()

    if (error || !session) { setErreur('Code invalide. Vérifie auprès de ton enseignant.'); return }
    if (!session.active) { setErreur('Cette session a été désactivée.'); return }
    if (new Date(session.expires_at) < new Date()) { setErreur('Cette session a expiré.'); return }

    setSessionData(session)

    // Charger les élèves de la classe
    const { data: elevesData } = await supabase
      .from('eleves')
      .select('id, nom, prenom')
      .eq('classe_id', session.classe_id)
      .eq('actif', true)
      .order('nom')

    if (!elevesData || elevesData.length === 0) {
      setErreur('Aucun élève trouvé dans cette classe.')
      return
    }
    setEleves(elevesData)

    // Charger le niveau de la classe
    const { data: classeData } = await supabase
      .from('classes')
      .select('niveau')
      .eq('id', session.classe_id)
      .single()
    setClasseNiveau(classeData?.niveau || '')

    setEtape('eleve')
  }

  // ── Étape 2 : Sélectionner l'élève puis charger le test ──
  async function confirmerEleve(eleve: Eleve) {
    setSelectedEleve(eleve)
    setErreur('')

    // Charger le test QCM pour cette période + niveau
    const { data: test } = await supabase
      .from('qcm_tests')
      .select('id, titre, texte_reference')
      .eq('periode_id', sessionData.periode_id)
      .eq('niveau', classeNiveau)
      .single()

    if (!test) {
      setErreur('Aucun test QCM n\'a été configuré pour ta classe. Préviens ton enseignant.')
      return
    }

    setTitreTest(test.titre || '')
    setTexteReference(test.texte_reference || '')

    // Charger les questions
    const { data: questionsData } = await supabase
      .from('qcm_questions')
      .select('id, numero, question_text, option_a, option_b, option_c, option_d')
      .eq('qcm_test_id', test.id)
      .order('numero')

    if (!questionsData || questionsData.length === 0) {
      setErreur('Les questions n\'ont pas encore été ajoutées. Préviens ton enseignant.')
      return
    }

    setQuestions(questionsData)
    setReponses({})

    // Si texte de référence, aller à l'étape lecture
    if (test.texte_reference) {
      setEtape('lecture')
    } else {
      setEtape('questions')
    }
  }

  // ── Étape 5 : Soumettre les réponses ──
  async function soumettre() {
    setErreur('')
    const toutRepondu = questions.every(q => reponses[q.numero])
    if (!toutRepondu) { setErreur('Réponds à toutes les questions avant d\'envoyer.'); return }

    setSubmitting(true)
    const answersArray = questions.map(q => reponses[q.numero])

    const { data, error } = await supabase.rpc('submit_qcm_answers', {
      p_session_code: sessionData.code,
      p_eleve_id: selectedEleve!.id,
      p_answers: answersArray,
    })

    setSubmitting(false)

    if (error) {
      setErreur(`Erreur : ${error.message}`)
      return
    }

    if (data?.error) {
      setErreur(data.error)
      return
    }

    setResultats(data.results)
    setEtape('resultat')
  }

  // ── Recommencer (pour l'élève suivant) ──
  function recommencer() {
    setSelectedEleve(null)
    setReponses({})
    setResultats(null)
    setEtape('eleve')
  }

  function retourAccueil() {
    setCodeInput('')
    setSessionData(null)
    setEleves([])
    setSelectedEleve(null)
    setQuestions([])
    setReponses({})
    setResultats(null)
    setErreur('')
    setEtape('code')
  }

  // ── Styles ──
  const page: React.CSSProperties = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f0f4ff 0%, #e8eeff 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '32px 16px',
    fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
  }
  const card: React.CSSProperties = {
    background: 'white',
    borderRadius: 20,
    border: '1.5px solid #e2e8f0',
    padding: 32,
    width: '100%',
    maxWidth: 600,
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
  }
  const title: React.CSSProperties = {
    fontSize: 28, fontWeight: 800, color: '#1e293b', margin: '0 0 8px 0', textAlign: 'center',
  }
  const subtitle: React.CSSProperties = {
    fontSize: 15, color: '#64748b', textAlign: 'center', margin: '0 0 28px 0',
  }
  const btnPrimary: React.CSSProperties = {
    background: '#1e3a5f', color: 'white', border: 'none', padding: '14px 28px',
    borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer', width: '100%',
  }
  const btnSecondary: React.CSSProperties = {
    background: 'transparent', color: '#64748b', border: '1.5px solid #e2e8f0',
    padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  }
  const input: React.CSSProperties = {
    width: '100%', border: '2px solid #e2e8f0', borderRadius: 14, padding: '16px 20px',
    fontSize: 24, fontFamily: 'monospace', textAlign: 'center', letterSpacing: 4,
    outline: 'none', textTransform: 'uppercase',
  }
  const errStyle: React.CSSProperties = {
    background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 16px',
    fontSize: 14, color: '#dc2626', marginBottom: 16, textAlign: 'center',
  }

  return (
    <div style={page}>
      {/* Logo */}
      <div style={{ marginBottom: 24 }}>
        <svg width="160" viewBox="0 0 220 44" xmlns="http://www.w3.org/2000/svg">
          <text x="0" y="34" style={{ fontSize: 36, fontWeight: 800, fill: '#1e3a5f', fontFamily: 'var(--font-sans, sans-serif)' }}>Fluence</text>
          <text x="155" y="34" style={{ fontSize: 18, fontWeight: 800, fill: '#3b82f6', fontFamily: 'var(--font-sans, sans-serif)' }}>+</text>
        </svg>
      </div>

      {/* ── ÉTAPE 1 : CODE ── */}
      {etape === 'code' && (
        <div style={card}>
          <h1 style={title}>Test de compréhension</h1>
          <p style={subtitle}>Entre le code donné par ton enseignant</p>
          {erreur && <div style={errStyle}>{erreur}</div>}
          <input
            value={codeInput}
            onChange={e => setCodeInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && validerCode()}
            placeholder="FLU-XXXXXX"
            style={input}
            autoFocus
          />
          <button onClick={validerCode} style={{ ...btnPrimary, marginTop: 20 }}>
            Commencer
          </button>
        </div>
      )}

      {/* ── ÉTAPE 2 : SÉLECTION ÉLÈVE ── */}
      {etape === 'eleve' && (
        <div style={card}>
          <h1 style={title}>Qui es-tu ?</h1>
          <p style={subtitle}>Sélectionne ton nom dans la liste</p>
          {erreur && <div style={errStyle}>{erreur}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {eleves.map(e => (
              <button
                key={e.id}
                onClick={() => confirmerEleve(e)}
                style={{
                  padding: '16px 12px',
                  borderRadius: 12,
                  border: '2px solid #e2e8f0',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#1e293b',
                  fontFamily: 'var(--font-sans, sans-serif)',
                  transition: 'all 0.15s',
                  textAlign: 'center',
                }}
                onMouseEnter={ev => { ev.currentTarget.style.borderColor = '#3b82f6'; ev.currentTarget.style.background = '#eff6ff' }}
                onMouseLeave={ev => { ev.currentTarget.style.borderColor = '#e2e8f0'; ev.currentTarget.style.background = 'white' }}
              >
                {e.prenom} {e.nom}
              </button>
            ))}
          </div>
          <button onClick={retourAccueil} style={{ ...btnSecondary, marginTop: 20 }}>
            ← Changer de code
          </button>
        </div>
      )}

      {/* ── ÉTAPE 3 : LECTURE ── */}
      {etape === 'lecture' && (
        <div style={card}>
          <h1 style={title}>{titreTest || 'Texte de lecture'}</h1>
          <p style={subtitle}>Lis bien ce texte, puis clique sur le bouton</p>
          <div style={{
            background: '#fafbfc', border: '1.5px solid #e2e8f0', borderRadius: 14,
            padding: 24, fontSize: 17, lineHeight: 1.8, color: '#334155',
            fontFamily: 'Georgia, "Times New Roman", serif', marginBottom: 24,
            maxHeight: 400, overflowY: 'auto' as const,
            whiteSpace: 'pre-wrap' as const,
          }}>
            {texteReference}
          </div>
          <button onClick={() => setEtape('questions')} style={btnPrimary}>
            J'ai lu le texte
          </button>
        </div>
      )}

      {/* ── ÉTAPE 4 : QUESTIONS ── */}
      {etape === 'questions' && (
        <div style={{ width: '100%', maxWidth: 600 }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h1 style={{ ...title, fontSize: 22 }}>
              {selectedEleve?.prenom}, réponds aux questions
            </h1>
            <p style={{ ...subtitle, marginBottom: 0 }}>
              {Object.keys(reponses).length} / {questions.length} répondu{Object.keys(reponses).length > 1 ? 'es' : ''}
            </p>
          </div>

          {erreur && <div style={errStyle}>{erreur}</div>}

          {questions.map(q => (
            <div key={q.id} style={{ ...card, marginBottom: 14, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                <span style={{
                  background: reponses[q.numero] ? '#16a34a' : '#1e3a5f',
                  color: 'white', borderRadius: 10, minWidth: 36, height: 36,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 800, flexShrink: 0,
                }}>
                  {q.numero}
                </span>
                <p style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', margin: 0, lineHeight: 1.5 }}>
                  {q.question_text}
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(['A', 'B', 'C', 'D'] as const).map(letter => {
                  const optionText = (q as any)[`option_${letter.toLowerCase()}`] as string
                  const selected = reponses[q.numero] === letter
                  return (
                    <button
                      key={letter}
                      onClick={() => setReponses(prev => ({ ...prev, [q.numero]: letter }))}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 10,
                        border: `2px solid ${selected ? '#3b82f6' : '#e2e8f0'}`,
                        background: selected ? '#eff6ff' : 'white',
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: selected ? 700 : 500,
                        color: selected ? '#1e3a5f' : '#475569',
                        fontFamily: 'var(--font-sans, sans-serif)',
                        textAlign: 'left' as const,
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontWeight: 800, marginRight: 8, color: selected ? '#3b82f6' : '#94a3b8' }}>{letter}.</span>
                      {optionText}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <button
            onClick={soumettre}
            disabled={submitting || Object.keys(reponses).length < questions.length}
            style={{
              ...btnPrimary,
              marginTop: 8,
              opacity: (submitting || Object.keys(reponses).length < questions.length) ? 0.5 : 1,
            }}
          >
            {submitting ? 'Envoi en cours…' : 'Envoyer mes réponses'}
          </button>

          {erreur && <div style={{ ...errStyle, marginTop: 12 }}>{erreur}</div>}
        </div>
      )}

      {/* ── ÉTAPE 5 : RÉSULTATS ── */}
      {etape === 'resultat' && resultats && (
        <div style={card}>
          <h1 style={title}>Bravo {selectedEleve?.prenom} !</h1>
          <div style={{
            fontSize: 48, fontWeight: 800, textAlign: 'center', margin: '16px 0 24px',
            color: resultats.filter(r => r === 'Correct').length >= 4 ? '#16a34a' : resultats.filter(r => r === 'Correct').length >= 2 ? '#d97706' : '#dc2626',
          }}>
            {resultats.filter(r => r === 'Correct').length} / {resultats.length}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {resultats.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                borderRadius: 10,
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

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={recommencer} style={{ ...btnPrimary, flex: 1 }}>
              Élève suivant
            </button>
            <button onClick={retourAccueil} style={{ ...btnSecondary, flex: 1 }}>
              Quitter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
