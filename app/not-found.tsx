import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: '#F4F2ED',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <div style={{
          fontFamily: 'DM Serif Display, serif',
          fontSize: 96, color: '#001845', lineHeight: 1,
          marginBottom: 8, opacity: 0.12,
        }}>
          404
        </div>
        <h1 style={{
          fontFamily: 'DM Serif Display, serif', fontSize: 28,
          color: '#001845', marginBottom: 12, marginTop: -16,
        }}>
          Page introuvable
        </h1>
        <p style={{ fontSize: 14, color: '#8A8680', lineHeight: 1.6, marginBottom: 32 }}>
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        <Link href="/dashboard" style={{
          display: 'inline-block',
          background: '#001845', color: 'white',
          borderRadius: 8, padding: '10px 24px',
          fontSize: 14, fontWeight: 600, textDecoration: 'none',
          fontFamily: 'DM Sans, sans-serif',
        }}>
          Retour au tableau de bord
        </Link>
        <div style={{ marginTop: 12 }}>
          <Link href="/" style={{
            fontSize: 13, color: '#8A8680', textDecoration: 'underline',
          }}>
            Page de connexion
          </Link>
        </div>
      </div>
    </div>
  )
}
