'use client'

import { useState, useRef, useEffect } from 'react'
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
  const [allowedClasseIds, setAllowedClasseIds] = useState<string[] | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Charger les classes autorisées pour l'enseignant (filtre recherche)
  useEffect(() => {
    if (!profil) return
    if (profil.role === 'enseignant') {
      supabase.from('enseignant_classes').select('classe_id').eq('enseignant_id', profil.id)
        .then(({ data }) => setAllowedClasseIds((data || []).map((r: any) => r.classe_id)))
    } else if (['directeur', 'principal'].includes(profil.role) && profil.etablissement_id) {
      supabase.from('classes').select('id').eq('etablissement_id', profil.etablissement_id)
        .then(({ data }) => setAllowedClasseIds((data || []).map((r: any) => r.id)))
    } else {
      setAllowedClasseIds(null) // admin/réseau : pas de filtre
    }
  }, [profil])

  function onSearch(q: string) {
    setSearchQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) { setSearchResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      let query = supabase
        .from('eleves')
        .select('id, nom, prenom, classe:classes(nom)')
        .or(`nom.ilike.%${q.trim()}%,prenom.ilike.%${q.trim()}%`)
        .eq('actif', true)
        .limit(8)
      // Filtrer par classes autorisées pour enseignant/direction
      if (allowedClasseIds && allowedClasseIds.length > 0) {
        query = query.in('classe_id', allowedClasseIds)
      } else if (allowedClasseIds && allowedClasseIds.length === 0) {
        setSearchResults([]); setSearchLoading(false); return
      }
      const { data } = await query
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

  type NavItem = { href: string; icon: string; label: string; children?: { href: string; label: string; hash?: string }[] }

  const NAV: NavItem[] = [
    { href: '/dashboard', icon: '📊', label: 'Tableau de bord' },
    ...(isDirection
      ? [{
          href: '/dashboard/onboarding', icon: '⚙️', label: 'Configuration',
          children: [
            { href: '/dashboard/onboarding', label: 'Structure', hash: 'structure' },
            { href: '/dashboard/onboarding', label: 'Passations', hash: 'passations' },
          ],
        }]
      : []),
    ...(isEnseignant ? [
      { href: '/dashboard/mes-classes', icon: '🏫', label: 'Mes classes' },
    ] : !isDirection ? [
      { href: '/dashboard/eleves', icon: '👥', label: profil?.role === 'admin' ? 'Explorateur élèves' : (isReseau || isGlobal) ? "Réseau d'élèves" : 'Mes élèves' },
    ] : []),
    ...(canSaisie ? [{
      href: '/dashboard/saisie', icon: '✏️', label: 'Évaluations',
      children: [
        { href: '/dashboard/saisie',    label: 'Saisir des résultats' },
        { href: '/dashboard/passation', label: 'Faire passer un test' },
      ],
    }] : []),
    ...(!isEnseignant ? [
      { href: '/dashboard/statistiques', icon: '📈', label: 'Statistiques' },
      { href: '/dashboard/groupes',      icon: '🎯', label: 'Groupes & Remédiation' },
    ] : []),
    { href: '/dashboard/rapport',      icon: '📄', label: 'Rapports PDF' },
    ...(profil && ['admin','ia_dasen','recteur','coordo_rep','ien'].includes(profil.role)
      ? [{
          href: '/dashboard/admin', icon: '⚙️', label: 'Administration',
          children: [
            { href: '/dashboard/admin', label: 'Établissements', hash: '0' },
            { href: '/dashboard/admin', label: 'Géographie', hash: '1' },
            { href: '/dashboard/admin', label: 'Périodes', hash: '2' },
            { href: '/dashboard/admin', label: 'Normes', hash: '3' },
            { href: '/dashboard/admin', label: 'Utilisateurs', hash: '4' },
            { href: '/dashboard/admin', label: 'Invitations', hash: '5' },
            { href: '/dashboard/admin', label: 'Affectations', hash: '6' },
            { href: '/dashboard/admin', label: 'QCM', hash: '7' },
            { href: '/dashboard/admin', label: 'Structure', hash: '8' },
          ],
        }]
      : []),
  ]

  const [mobileOpen, setMobileOpen] = useState(false)
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)

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
          const hasChildren = item.children && item.children.length > 0
          const isSubmenuOpen = openSubmenu === item.label

          if (hasChildren) {
            return (
              <div key={item.label}>
                <button
                  onClick={() => setOpenSubmenu(isSubmenuOpen ? null : item.label)}
                  className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <div className={styles.navIcon}>{item.icon}</div>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 4 }}>{isSubmenuOpen ? '▼' : '▶'}</span>
                </button>
                {isSubmenuOpen && (
                  <div style={{ paddingLeft: 20 }}>
                    {item.children!.map(child => {
                      const childActive = pathname === child.href && (!child.hash || true)
                      return (
                        <a key={child.label} href={child.hash ? `${child.href}?tab=${child.hash}` : child.href}
                          onClick={() => setMobileOpen(false)}
                          style={{
                            display: 'block', padding: '7px 12px 7px 24px', fontSize: 12,
                            color: 'rgba(255,255,255,0.6)', textDecoration: 'none',
                            borderLeft: '2px solid rgba(255,255,255,0.1)',
                            fontFamily: 'var(--font-sans)', transition: 'all 0.1s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderLeftColor = 'var(--accent-gold)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.borderLeftColor = 'rgba(255,255,255,0.1)' }}
                        >
                          {child.label}
                        </a>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

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
        <button className={styles.logoutBtn} onClick={() => {
          const html = document.documentElement
          const current = html.getAttribute('data-theme')
          html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark')
          localStorage.setItem('fluence-theme', current === 'dark' ? 'light' : 'dark')
        }} style={{ marginBottom: 4 }}>
          <span>🌙</span> Thème sombre
        </button>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          <span>↩</span> Se déconnecter
        </button>
      </div>
    </aside>
    </>
  )
}