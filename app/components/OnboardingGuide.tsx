'use client'

import { useState, useEffect } from 'react'
import { useProfil } from '@/app/lib/useProfil'

const STORAGE_KEY = 'fluence-onboarding-done'

const STEPS_BY_ROLE: Record<string, { title: string; desc: string; icon: string }[]> = {
  enseignant: [
    { icon: '👋', title: 'Bienvenue sur Fluence+', desc: 'Cette application vous permet de gérer les tests de fluence en lecture de vos élèves.' },
    { icon: '✏️', title: 'Mode Saisie', desc: 'Saisissez les scores de lecture de vos élèves après les passations.' },
    { icon: '⏱️', title: 'Mode Passation', desc: 'Chronométrez les lectures en live avec le timer 60 secondes intégré.' },
    { icon: '📋', title: 'QCM Compréhension', desc: 'Faites passer les tests de compréhension en individuel ou en collectif sur tablette.' },
    { icon: '📊', title: 'Statistiques', desc: 'Suivez la progression de vos élèves avec des graphiques et tableaux détaillés.' },
  ],
  directeur: [
    { icon: '👋', title: 'Bienvenue sur Fluence+', desc: 'Configurez votre établissement et suivez les résultats de fluence.' },
    { icon: '⚙️', title: 'Configuration', desc: 'Créez vos classes, assignez les enseignants et configurez les périodes de passation.' },
    { icon: '📊', title: 'Tableau de bord', desc: 'Vue d\'ensemble de votre établissement : scores, couverture, groupes de besoin.' },
    { icon: '📄', title: 'Rapports PDF', desc: 'Générez des rapports par classe, par établissement ou complets pour vos bilans.' },
  ],
  admin: [
    { icon: '👋', title: 'Bienvenue Administrateur', desc: 'Vous avez accès à toutes les fonctionnalités de la plateforme.' },
    { icon: '⚙️', title: 'Administration', desc: 'Gérez les établissements, utilisateurs, périodes, normes et tests QCM.' },
    { icon: '📊', title: 'Tableau de bord', desc: 'Vue 360° : tous les indicateurs de l\'académie en un coup d\'oeil.' },
    { icon: '🔍', title: 'Recherche', desc: 'Utilisez la barre de recherche dans la sidebar pour trouver rapidement un élève.' },
  ],
}

// Même guide pour principal que directeur, pour coordo/ien que leur version
STEPS_BY_ROLE.principal = STEPS_BY_ROLE.directeur
STEPS_BY_ROLE.coordo_rep = [
  { icon: '👋', title: 'Bienvenue Coordonnateur', desc: 'Suivez les résultats de fluence de votre réseau d\'établissements.' },
  { icon: '📊', title: 'Vue réseau', desc: 'Comparez les établissements de votre réseau : scores, fragiles, couverture.' },
  { icon: '📈', title: 'Progression', desc: 'Suivez l\'évolution des élèves fragiles entre les périodes.' },
  { icon: '📄', title: 'Rapports', desc: 'Générez des rapports réseau pour vos bilans.' },
]
STEPS_BY_ROLE.ien = STEPS_BY_ROLE.coordo_rep
STEPS_BY_ROLE.ia_dasen = [
  { icon: '👋', title: 'Bienvenue', desc: 'Vue académique des résultats de fluence en lecture.' },
  { icon: '📊', title: 'Pilotage', desc: 'Score par circonscription, comparaison REP vs Hors REP, groupes de besoin.' },
  { icon: '📄', title: 'Rapports', desc: 'Générez des rapports académiques pour vos bilans institutionnels.' },
]
STEPS_BY_ROLE.recteur = STEPS_BY_ROLE.ia_dasen

export default function OnboardingGuide() {
  const { profil } = useProfil()
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!profil) return
    const done = localStorage.getItem(`${STORAGE_KEY}-${profil.id}`)
    if (!done) setVisible(true)
  }, [profil])

  if (!visible || !profil) return null

  const steps = STEPS_BY_ROLE[profil.role] || STEPS_BY_ROLE.enseignant
  const current = steps[step]

  function finish() {
    localStorage.setItem(`${STORAGE_KEY}-${profil!.id}`, 'true')
    setVisible(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 24, padding: '40px 36px', maxWidth: 440, width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>{current.icon}</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary-dark, #001845)', marginBottom: 8 }}>{current.title}</h2>
        <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.6, marginBottom: 28 }}>{current.desc}</p>

        {/* Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 4, background: i === step ? '#001845' : '#E2E8F0', transition: 'all 0.2s' }} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{ padding: '10px 24px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: 'white', color: '#64748b', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Précédent
            </button>
          )}
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#001845', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Suivant
            </button>
          ) : (
            <button onClick={finish} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#16A34A', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              C'est parti !
            </button>
          )}
          <button onClick={finish} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'transparent', color: '#94A3B8', fontSize: 13, cursor: 'pointer' }}>
            Passer
          </button>
        </div>
      </div>
    </div>
  )
}
