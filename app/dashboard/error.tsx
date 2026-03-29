'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Fluence+] Erreur dashboard :', error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-cream, #F4F2ED)', padding: 24,
      fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{
        background: 'white', borderRadius: 16, padding: '40px 48px', maxWidth: 440,
        textAlign: 'center', border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>
        <h2 style={{
          fontFamily: 'DM Serif Display, serif', fontSize: 22,
          color: '#001845', marginBottom: 10, marginTop: 0,
        }}>
          Erreur de chargement
        </h2>
        <p style={{ fontSize: 13, color: '#8A8680', lineHeight: 1.6, marginBottom: 24 }}>
          Impossible de charger cette page. Vérifiez votre connexion et réessayez.
        </p>
        {error.digest && (
          <p style={{ fontSize: 11, color: '#A8A49D', marginBottom: 20, fontFamily: 'monospace' }}>
            Réf. : {error.digest}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              background: '#001845', color: 'white', border: 'none',
              borderRadius: 8, padding: '9px 20px', fontSize: 13,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Réessayer
          </button>
          <a
            href="/dashboard"
            style={{
              background: 'white', color: '#4A4540',
              border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 8,
              padding: '9px 20px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
            }}
          >
            Accueil
          </a>
        </div>
      </div>
    </div>
  )
}
