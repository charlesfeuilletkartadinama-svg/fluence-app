'use client'

import { useState, useEffect } from 'react'
import { createClient } from './lib/supabase'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [mode, setMode]         = useState<'connexion' | 'inscription'>('connexion')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode]         = useState('')
  const [nom, setNom]           = useState('')
  const [prenom, setPrenom]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [erreur, setErreur]     = useState('')
  const [mounted, setMounted]   = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => { setMounted(true) }, [])

  async function handleConnexion(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErreur('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setErreur('Email ou mot de passe incorrect.'); setLoading(false); return }
    router.push('/dashboard')
  }

  async function handleInscription(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErreur('')
    const { data: invitation, error: invErr } = await supabase
      .from('invitations').select('id, etablissement_id, role, actif')
      .eq('code', code.toUpperCase().trim()).single()
    if (invErr || !invitation) {
      setErreur('Code établissement invalide.'); setLoading(false); return
    }
    if (!invitation.actif) {
      setErreur("Ce code n'est plus actif."); setLoading(false); return
    }
    const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password })
    if (authErr || !authData.user) {
      setErreur(authErr?.message || 'Erreur lors de la création du compte.'); setLoading(false); return
    }
    await supabase.from('profils').insert({
      id: authData.user.id, nom: nom.toUpperCase(), prenom,
      role: invitation.role, etablissement_id: invitation.etablissement_id,
    })
    router.push('/dashboard')
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'DM Sans', sans-serif;
          background: #F7F5F0;
          min-height: 100vh;
        }

        .page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 1fr;
        }

        /* ── Panneau gauche ── */
        .left-panel {
          background: #001845;
          padding: 60px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
        }

        .left-panel::before {
          content: '';
          position: absolute;
          top: -100px; right: -100px;
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%);
          border-radius: 50%;
          pointer-events: none;
        }

        .logo-svg text {
          font-family: 'DM Serif Display', Georgia, serif;
        }
        .lw {
          font-size: 52px; font-weight: 400; fill: #ffffff;
          animation: flu 0.6s cubic-bezier(0.22,1,0.36,1) 0.2s forwards;
          opacity: 0; transform: translateY(10px);
        }
        .lp {
          font-family: 'DM Sans', sans-serif;
          font-size: 34px; font-weight: 300; fill: #C9A84C;
          animation: flu 0.5s cubic-bezier(0.22,1,0.36,1) 0.45s forwards;
          opacity: 0; transform: translateY(6px);
        }

        @keyframes flu { to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }

        .hero {
          flex: 1;
          display: flex; flex-direction: column;
          justify-content: center;
          padding: 40px 0;
        }

        .hero-title {
          font-family: 'DM Serif Display', serif;
          font-size: 52px; line-height: 1.1;
          color: #fff; font-weight: 400;
          margin-bottom: 20px;
          opacity: 0; transform: translateY(30px);
          animation: fadeUp 0.7s ease forwards;
          animation-delay: 0.4s;
        }

        .hero-title em { font-style: italic; color: #C9A84C; }

        .hero-sub {
          font-size: 16px; line-height: 1.7;
          color: rgba(255,255,255,0.5);
          max-width: 380px;
          opacity: 0; transform: translateY(20px);
          animation: fadeUp 0.7s ease forwards;
          animation-delay: 0.55s;
        }

        .features {
          display: flex; flex-direction: column;
          gap: 16px; margin-top: 40px;
          opacity: 0;
          animation: fadeUp 0.7s ease forwards;
          animation-delay: 0.7s;
        }

        .feature { display: flex; align-items: center; gap: 14px; }

        .feature-icon {
          width: 36px; height: 36px;
          background: rgba(201,168,76,0.12);
          border: 1px solid rgba(201,168,76,0.25);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; flex-shrink: 0;
        }

        .feature-text { font-size: 14px; color: rgba(255,255,255,0.55); }
        .feature-text strong {
          color: rgba(255,255,255,0.85);
          font-weight: 500; display: block;
          font-size: 13px; margin-bottom: 1px;
        }

        .left-footer {
          font-size: 12px; color: rgba(255,255,255,0.2);
          opacity: 0;
          animation: fadeUp 0.5s ease forwards;
          animation-delay: 0.9s;
        }

        /* ── Panneau droit ── */
        .right-panel {
          background: #F7F5F0;
          padding: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .form-container {
          width: 100%; max-width: 400px;
          opacity: 0; transform: translateY(24px);
          animation: fadeUp 0.7s ease forwards;
          animation-delay: 0.3s;
        }

        .form-header { margin-bottom: 36px; }

        .form-title {
          font-family: 'DM Serif Display', serif;
          font-size: 32px; color: #001845;
          font-weight: 400; margin-bottom: 6px;
        }

        .form-sub { font-size: 14px; color: #8A8680; }

        .tabs {
          display: flex;
          background: #ECEAE4;
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 32px;
        }

        .tab {
          flex: 1; padding: 10px;
          border: none; border-radius: 9px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; font-weight: 500;
          cursor: pointer; transition: all 0.2s;
          background: transparent; color: #8A8680;
        }

        .tab.active {
          background: #fff;
          color: #001845;
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        }

        .field { margin-bottom: 18px; }
        .field-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 18px;
        }

        .field label {
          display: block;
          font-size: 11px; font-weight: 600;
          color: #8A8680;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 8px;
        }

        .field input {
          width: 100%;
          background: #fff;
          border: 1.5px solid #E4E1DA;
          border-radius: 12px;
          padding: 13px 16px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; color: #001845;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .field input:focus {
          border-color: #C9A84C;
          box-shadow: 0 0 0 3px rgba(201,168,76,0.12);
        }

        .field input.code-input {
          background: #FFFDF5;
          border-color: #E8D99A;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #7A6010;
        }

        .field input.code-input:focus {
          border-color: #C9A84C;
          box-shadow: 0 0 0 3px rgba(201,168,76,0.15);
        }

        .field-hint {
          font-size: 11px; color: #A8A49D;
          margin-top: 6px; line-height: 1.5;
        }

        .erreur {
          background: #FEF2F2;
          border: 1.5px solid #FCA5A5;
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 13px; color: #DC2626;
          margin-bottom: 20px;
          display: flex; align-items: center; gap: 8px;
        }

        .btn-submit {
          width: 100%;
          background: linear-gradient(135deg, #001845 0%, #002D72 100%);
          color: #fff; border: none;
          border-radius: 12px; padding: 15px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 600;
          cursor: pointer; transition: all 0.2s;
          margin-top: 8px;
        }

        .btn-submit:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(0,24,69,0.25);
        }

        .btn-submit:active { transform: translateY(0); }
        .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .gold-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, #C9A84C40, transparent);
          margin: 28px 0;
        }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          .page {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr;
          }
          .left-panel {
            padding: 36px 28px 32px;
            min-height: auto;
          }
          .logo-svg { width: 150px; }
          .hero { padding: 28px 0 0; }
          .hero-title { font-size: 34px; margin-bottom: 14px; }
          .hero-sub { font-size: 14px; max-width: 100%; }
          .features { display: none; }
          .left-footer { display: none; }
          .right-panel {
            padding: 36px 28px 48px;
            align-items: flex-start;
          }
          .form-container { max-width: 100%; }
          .form-title { font-size: 26px; }
          .field-grid { grid-template-columns: 1fr; gap: 0; }
          .field-grid .field { margin-bottom: 18px !important; }
        }
      `}</style>

      <div className="page" style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.3s' }}>

        {/* ── Panneau gauche ── */}
        <div className="left-panel">
          <svg className="logo-svg" width="200" viewBox="0 0 360 70" xmlns="http://www.w3.org/2000/svg">
            <text className="lw" x="0" y="54">Fluence</text>
            <text className="lp" x="268" y="46">+</text>
          </svg>

          <div className="hero">
            <h1 className="hero-title">
              La fluence,<br/>
              <em>mesurée</em><br/>
              avec précision.
            </h1>
            <p className="hero-sub">
              Outil de collecte et d'analyse des scores de fluence en lecture pour les établissements scolaires.
            </p>
            <div className="features">
              <div className="feature">
                <div className="feature-icon">⏱️</div>
                <div className="feature-text">
                  <strong>Mode passation</strong>
                  Chronomètre intégré, calcul automatique
                </div>
              </div>
              <div className="feature">
                <div className="feature-icon">📈</div>
                <div className="feature-text">
                  <strong>Statistiques en temps réel</strong>
                  Suivi T1→T4, groupes de besoin
                </div>
              </div>
              <div className="feature">
                <div className="feature-icon">📄</div>
                <div className="feature-text">
                  <strong>Rapports PDF</strong>
                  Groupes de besoin et recommandations
                </div>
              </div>
            </div>
          </div>

          <div className="left-footer">
            © 2026 · Développé par M. FEUILLET
          </div>
        </div>

        {/* ── Panneau droit ── */}
        <div className="right-panel">
          <div className="form-container">
            <div className="form-header">
              <h2 className="form-title">
                {mode === 'connexion' ? 'Bon retour.' : 'Bienvenue.'}
              </h2>
              <p className="form-sub">
                {mode === 'connexion'
                  ? 'Connectez-vous à votre espace.'
                  : 'Créez votre compte en quelques secondes.'}
              </p>
            </div>

            <div className="tabs">
              <button className={`tab ${mode === 'connexion' ? 'active' : ''}`}
                onClick={() => { setMode('connexion'); setErreur('') }}>
                Connexion
              </button>
              <button className={`tab ${mode === 'inscription' ? 'active' : ''}`}
                onClick={() => { setMode('inscription'); setErreur('') }}>
                Créer un compte
              </button>
            </div>

            {erreur && (
              <div className="erreur">
                <span>⚠️</span> {erreur}
              </div>
            )}

            {mode === 'connexion' ? (
              <form onSubmit={handleConnexion}>
                <div className="field">
                  <label>Adresse email</label>
                  <input type="email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="votre@email.fr" required/>
                </div>
                <div className="field">
                  <label>Mot de passe</label>
                  <input type="password" value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required/>
                </div>
                <button type="submit" className="btn-submit" disabled={loading}>
                  {loading ? 'Connexion...' : 'Se connecter →'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleInscription}>
                <div className="field-grid">
                  <div className="field" style={{ margin: 0 }}>
                    <label>Prénom</label>
                    <input type="text" value={prenom}
                      onChange={e => setPrenom(e.target.value)}
                      placeholder="Marie" required/>
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Nom</label>
                    <input type="text" value={nom}
                      onChange={e => setNom(e.target.value)}
                      placeholder="DUPONT" required/>
                  </div>
                </div>
                <div className="field">
                  <label>Adresse email</label>
                  <input type="email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="votre@email.fr" required/>
                </div>
                <div className="field">
                  <label>Mot de passe</label>
                  <input type="password" value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="8 caractères minimum" required minLength={8}/>
                </div>
                <div className="gold-divider"/>
                <div className="field">
                  <label>Code établissement</label>
                  <input type="text" value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="ex: WESTHAM2026" required
                    className="code-input"/>
                  <p className="field-hint">
                    Fourni par votre direction ou coordonnateur REP+
                  </p>
                </div>
                <button type="submit" className="btn-submit" disabled={loading}>
                  {loading ? 'Création...' : 'Créer mon compte →'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}