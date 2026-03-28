'use client'

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

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const isDirection = profil && ['directeur', 'principal'].includes(profil.role)
  const isReseau    = profil?.role === 'coordo_rep' || profil?.role === 'ien'
  const isGlobal    = profil?.role === 'ia_dasen' || profil?.role === 'recteur'

  const NAV = [
    { href: '/dashboard',              icon: '📊', label: 'Tableau de bord' },
    { href: '/dashboard/eleves',       icon: '👥', label: (isReseau || isGlobal) ? "Réseau d'élèves" : isDirection ? 'Détail élève' : 'Mes élèves' },
    { href: '/dashboard/saisie',       icon: '✏️', label: 'Saisie'           },
    { href: '/dashboard/statistiques', icon: '📈', label: 'Statistiques'     },
    { href: '/dashboard/groupes',      icon: '🎯', label: 'Groupes & Remédiation' },
    { href: '/dashboard/rapport',      icon: '📄', label: 'Rapports PDF'     },
    ...(isDirection || isReseau
      ? [{ href: '/dashboard/import', icon: '📥', label: 'Importation élèves' }]
      : []),
    ...(profil && ['admin','ia_dasen','recteur','coordo_rep','ien'].includes(profil.role)
      ? [{ href: '/dashboard/admin', icon: '⚙️', label: 'Administration' }]
      : []),
  ]

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarLogo}>
        <svg width="130" viewBox="0 0 220 44" xmlns="http://www.w3.org/2000/svg">
          <text className={styles.sbLw} x="0" y="34">Fluence</text>
          <text className={styles.sbLp} x="163" y="28">+</text>
        </svg>
      </div>

      <nav className={styles.sidebarNav}>
        <div className={styles.navSectionLabel}>Navigation</div>
        {NAV.map(item => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <a key={item.href} href={item.href}
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
  )
}