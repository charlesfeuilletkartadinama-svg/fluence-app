'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Fluence+] Erreur globale :', error)
  }, [error])

  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: 'DM Sans, sans-serif', background: '#F4F2ED' }}>
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: '40px 48px', maxWidth: 480,
            textAlign: 'center', border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <h1 style={{
              fontFamily: 'DM Serif Display, serif', fontSize: 24,
              color: '#001845', marginBottom: 12, marginTop: 0,
            }}>
              Une erreur est survenue
            </h1>
            <p style={{ fontSize: 14, color: '#8A8680', lineHeight: 1.6, marginBottom: 28 }}>
              Une erreur inattendue s'est produite. Veuillez réessayer ou contacter votre administrateur si le problème persiste.
            </p>
            {error.digest && (
              <p style={{ fontSize: 11, color: '#A8A49D', marginBottom: 20, fontFamily: 'monospace' }}>
                Référence : {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                background: '#001845', color: 'white', border: 'none',
                borderRadius: 8, padding: '10px 24px', fontSize: 14,
                fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              }}
            >
              Réessayer
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
