'use client'

import { useState, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import styles from './Sidebar.module.css'

const ROLE_LABELS: Record<string, string> = {
  enseignant: 'Enseignant',
  directeur:  'Directeur',
  principal:  'Principal',
  coordo_rep: 'Coordo REP+',
  ien:        'IEN',
  ia_dasen:   'IA-DASEN',
  recteur:    'Recteur',
  admin:      'Administrateur',
}

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const { profil } = useProfil()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; nom: string; prenom: string; classe: string }[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function onSearch(q: string) {
    setSearchQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) { setSearchResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      const { data } = await supabase
        .from('eleves')
        .select('id, nom, prenom, classe:classes(nom)')
        .or(`nom.ilike.%${q.trim()}%,prenom.ilike.%${q.trim()}%`)
        .eq('actif', true)
        .limit(8)
      setSearchResults((data || []).map((e: any) => ({
        id: e.id, nom: e.nom, prenom: e.prenom, classe: e.classe?.nom || '',
      })))
      setSearchLoading(false)
    }, 300)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const isDirection  = profil && ['directeur', 'principal'].includes(profil.role)
  const isReseau     = profil?.role === 'coordo_rep' || profil?.role === 'ien'
  const isGlobal     = profil?.role === 'ia_dasen' || profil?.role === 'recteur'
  const isEnseignant = profil?.role === 'enseignant'
  // Saisie/Passation : uniquement pour les rôles rattachés à un établissement
  const canSaisie    = profil && ['enseignant', 'directeur', 'principal', 'admin', 'coordo_rep'].includes(profil.role)

  const NAV = [
    { href: '/dashboard',              icon: '📊', label: 'Tableau de bord' },
    ...(isDirection
      ? [{ href: '/dashboard/onboarding', icon: '⚙️', label: 'Configuration' }]
      : []),
    ...(isEnseignant ? [
      { href: '/dashboard/eleves',     icon: '🏫', label: 'Mes classes'      },
      { href: '/dashboard/mes-eleves', icon: '👥', label: 'Mes élèves'       },
    ] : !isDirection ? [
      { href: '/dashboard/eleves',     icon: '👥', label: (isReseau || isGlobal) ? "Réseau d'élèves" : 'Mes élèves' },
    ] : []),
    ...(canSaisie ? [
      { href: '/dashboard/saisie',    icon: '✏️', label: 'Mode Saisie'   },
      { href: '/dashboard/passation', icon: '⏱️', label: 'Mode passation' },
    ] : []),
    { href: '/dashboard/statistiques', icon: '📈', label: 'Statistiques'     },
    { href: '/dashboard/groupes',      icon: '🎯', label: 'Groupes & Remédiation' },
    { href: '/dashboard/rapport',      icon: '📄', label: 'Rapports PDF'     },
    ...(profil && ['admin','ia_dasen','recteur','coordo_rep','ien'].includes(profil.role)
      ? [{ href: '/dashboard/admin', icon: '⚙️', label: 'Administration' }]
      : []),
  ]

  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <button className={styles.burgerBtn} onClick={() => setMobileOpen(!mobileOpen)}>
        {mobileOpen ? '✕' : '☰'}
      </button>
      {mobileOpen && <div className={`${styles.overlay} ${styles.visible}`} onClick={() => setMobileOpen(false)} />}
    <aside className={`${styles.sidebar} ${mobileOpen ? styles.open : ''}`}>
      <div className={styles.sidebarLogo}>
        <svg width="130" viewBox="0 0 220 44" xmlns="http://www.w3.org/2000/svg">
          <text className={styles.sbLw} x="0" y="34">Fluence</text>
          <text className={styles.sbLp} x="163" y="28">+</text>
        </svg>
      </div>

      {/* Recherche rapide */}
      <div style={{ padding: '0 16px 12px', position: 'relative' }}>
        <input
          type="text"
          placeholder="Rechercher un élève…"
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 8,
            border: '1.5px solid var(--border-light)', fontSize: 12,
            fontFamily: 'var(--font-sans)', outline: 'none',
            background: 'var(--bg-gray)', color: 'var(--text-secondary)',
            boxSizing: 'border-box',
          }}
        />
        {searchResults.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 16, right: 16, zIndex: 100,
            background: 'white', borderRadius: 10, border: '1.5px solid var(--border-light)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 240, overflowY: 'auto',
          }}>
            {searchResults.map(r => (
              <a key={r.id} href={`/dashboard/eleve/${r.id}`}
                onClick={() => { setSearchQuery(''); setSearchResults([]) }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderBottom: '1px solid var(--border-light)',
                  textDecoration: 'none', cursor: 'pointer', transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-gray)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)' }}>{r.nom} {r.prenom}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.classe}</div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>→</span>
              </a>
            ))}
          </div>
        )}
        {searchLoading && searchQuery.length >= 2 && (
          <div style={{ position: 'absolute', top: '100%', left: 16, right: 16, padding: '10px 14px', background: 'white', borderRadius: 10, border: '1.5px solid var(--border-light)', fontSize: 12, color: 'var(--text-tertiary)' }}>
            Recherche…
          </div>
        )}
      </div>

      <nav className={styles.sidebarNav}>
        <div className={styles.navSectionLabel}>Navigation</div>
        {NAV.map(item => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <a key={item.href} href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}>
              <div className={styles.navIcon}>{item.icon}</div>
              <span>{item.label}</span>
            </a>
          )
        })}
      </nav>

      <div className={styles.sidebarFooter}>
        {profil && (
          <a href="/dashboard/profil" className={styles.profilCard}>
            <div className={styles.profilAvatar}>
              {profil.prenom?.[0]}{profil.nom?.[0]}
            </div>
            <div className={styles.profilInfo}>
              <div className={styles.profilNom}>{profil.prenom} {profil.nom}</div>
              <div className={styles.profilRole}>{ROLE_LABELS[profil.role] || profil.role}</div>
            </div>
          </a>
        )}
        <button className={styles.logoutBtn} onClick={handleLogout}>
          <span>↩</span> Se déconnecter
        </button>
      </div>
    </aside>
    </>
  )
}