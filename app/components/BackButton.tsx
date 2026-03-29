'use client'

import { useRouter, usePathname } from 'next/navigation'

export default function BackButton() {
  const router = useRouter()
  const pathname = usePathname()

  // Ne pas afficher sur la page principale du dashboard
  if (pathname === '/dashboard') return null

  return (
    <button
      onClick={() => router.back()}
      style={{
        position: 'fixed',
        top: 16,
        left: 'calc(var(--sidebar-width) + 16)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'white',
        border: '1.5px solid var(--border-light)',
        borderRadius: 10,
        padding: '6px 14px',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-dark)'; e.currentTarget.style.color = 'var(--primary-dark)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
    >
      ← Retour
    </button>
  )
}
