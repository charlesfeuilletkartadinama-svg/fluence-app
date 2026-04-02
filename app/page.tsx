'use client'

import { useState, useEffect } from 'react'
import { createClient } from './lib/supabase'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'

export default function Home() {
  const [mode, setMode]         = useState<'connexion' | 'inscription' | 'reset'>('connexion')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode]         = useState('')
  const [nom, setNom]           = useState('')
  const [prenom, setPrenom]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [erreur, setErreur]     = useState('')
  const [resetSent, setResetSent] = useState(false)
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

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErreur('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/dashboard/profil`,
    })
    setLoading(false)
    if (error) { setErreur('Erreur lors de l\'envoi. Vérifiez votre adresse.'); return }
    setResetSent(true)
  }

  async function handleInscription(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErreur('')
    const { data: invitation, error: invErr } = await supabase
      .from('invitations').select('id, etablissement_id, role, actif')
      .eq('code', code.toUpperCase().trim()).single()
    if (invErr || !invitation || !invitation.actif) {
      setErreur('Code invalide ou expiré. Contactez votre établissement.'); setLoading(false); return
    }
    const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password })
    if (authErr || !authData.user) {
      setErreur('Erreur lors de la création du compte. Vérifiez vos informations ou réessayez.'); setLoading(false); return
    }
    const { error: profErr } = await supabase.from('profils').insert({
      id: authData.user.id, nom: nom.toUpperCase(), prenom,
      role: invitation.role, etablissement_id: invitation.etablissement_id,
    })
    if (profErr) {
      setErreur('Compte créé mais erreur profil. Contactez votre administrateur.'); setLoading(false); return
    }
    router.push('/dashboard')
  }

  if (!mounted) return null

  return (
    <div className={styles.page}>

      {/* ── Panneau gauche ── */}
      <div className={styles.leftPanel}>
        {/* Logo */}
        <svg className={styles.logo} viewBox="0 0 220 44" xmlns="http://www.w3.org/2000/svg">
          <text className={styles.logoText} x="0" y="34">Fluence</text>
          <text className={styles.logoPlusSign} x="163" y="28">+</text>
        </svg>

        {/* Hero */}
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>
            La fluence,<br/>
            <em>mesurée</em><br/>
            avec précision.
          </h1>
          <p className={styles.heroSub}>
            Outil de collecte et d'analyse des scores de fluence en lecture pour les établissements scolaires.
          </p>

          <div className={styles.features}>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>⏱️</div>
              <div className={styles.featureText}>
                <strong>Mode passation</strong>
                Chronomètre intégré, calcul automatique
              </div>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>📈</div>
              <div className={styles.featureText}>
                <strong>Statistiques en temps réel</strong>
                Suivi T1→T4, groupes de besoin
              </div>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>📄</div>
              <div className={styles.featureText}>
                <strong>Rapports PDF</strong>
                Groupes de besoin et recommandations
              </div>
            </div>
          </div>
        </div>

        <div className={styles.leftFooter}>
          © 2026 · Développé par M. FEUILLET
        </div>
      </div>

      {/* ── Panneau droit ── */}
      <div className={styles.rightPanel}>
        <div className={styles.formContainer}>
          <h2 className={styles.formTitle}>
            {mode === 'connexion' ? 'Bon retour.' : 'Bienvenue.'}
          </h2>
          <p className={styles.formSub}>
            {mode === 'connexion'
              ? 'Connectez-vous à votre espace.'
              : 'Créez votre compte en quelques secondes.'}
          </p>

          {/* Onglets */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${mode === 'connexion' ? styles.active : ''}`}
              onClick={() => { setMode('connexion'); setErreur(''); setResetSent(false) }}>
              Connexion
            </button>
            <button
              className={`${styles.tab} ${mode === 'inscription' ? styles.active : ''}`}
              onClick={() => { setMode('inscription'); setErreur('') }}>
              Créer un compte
            </button>
          </div>

          {/* Erreur */}
          {erreur && (
            <div className={styles.error}>
              <span>⚠️</span> {erreur}
            </div>
          )}

          {/* Formulaire connexion */}
          {mode === 'connexion' ? (
            <form onSubmit={handleConnexion}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Adresse email</label>
                <input
                  type="email"
                  className={styles.input}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="votre@email.fr"
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Mot de passe</label>
                <input
                  type="password"
                  className={styles.input}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => { setMode('reset'); setErreur(''); setResetSent(false) }}
                  style={{ background: 'none', border: 'none', padding: 0, marginTop: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
                  Mot de passe oublié ?
                </button>
              </div>
              <button type="submit" className={styles.btnSubmit} disabled={loading}>
                {loading ? 'Connexion...' : 'Se connecter →'}
              </button>
            </form>
          ) : mode === 'reset' ? (
            /* Formulaire réinitialisation mot de passe */
            <div>
              {resetSent ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--primary-dark)', marginBottom: 8 }}>
                    Email envoyé !
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
                    Consultez votre boîte mail et cliquez sur le lien pour réinitialiser votre mot de passe.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setMode('connexion'); setResetSent(false) }}
                    className={styles.btnSubmit}>
                    Retour à la connexion
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReset}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                    Entrez votre adresse email pour recevoir un lien de réinitialisation.
                  </p>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Adresse email</label>
                    <input
                      type="email"
                      className={styles.input}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="votre@email.fr"
                      required
                    />
                  </div>
                  <button type="submit" className={styles.btnSubmit} disabled={loading}>
                    {loading ? 'Envoi...' : 'Envoyer le lien →'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('connexion'); setErreur('') }}
                    style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
                    ← Retour à la connexion
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* Formulaire inscription */
            <form onSubmit={handleInscription}>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Prénom</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={prenom}
                    onChange={e => setPrenom(e.target.value)}
                    placeholder="Marie"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Nom</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={nom}
                    onChange={e => setNom(e.target.value)}
                    placeholder="DUPONT"
                    required
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Adresse email</label>
                <input
                  type="email"
                  className={styles.input}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="votre@email.fr"
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Mot de passe</label>
                <input
                  type="password"
                  className={styles.input}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="8 caractères minimum"
                  required
                  minLength={8}
                />
              </div>
              <div className={styles.goldDivider} />
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Code établissement</label>
                <input
                  type="text"
                  className={`${styles.input} ${styles.codeInput}`}
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="ex: WESTHAM2026"
                  required
                />
                <p className={styles.fieldHint}>
                  Fourni par votre direction ou coordonnateur REP+
                </p>
              </div>
              <button type="submit" className={styles.btnSubmit} disabled={loading}>
                {loading ? 'Création...' : 'Créer mon compte →'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
