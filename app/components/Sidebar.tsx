'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'

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

  const NAV = [
    { href: '/dashboard',              icon: '📊', label: 'Tableau de bord' },
    { href: '/dashboard/eleves',       icon: '👥', label: 'Mes élèves'       },
    { href: '/dashboard/saisie',       icon: '✏️', label: 'Saisie'           },
    { href: '/dashboard/statistiques', icon: '📈', label: 'Statistiques'     },
    { href: '/dashboard/rapport',      icon: '📄', label: 'Rapports PDF'     },
    ...(profil && ['admin','ia_dasen','recteur','principal'].includes(profil.role)
      ? [{ href: '/dashboard/admin', icon: '⚙️', label: 'Administration' }]
      : []),
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500&display=swap');

        .sidebar {
          position: fixed; left: 0; top: 0;
          height: 100vh; width: 260px;
          background: #001845;
          display: flex; flex-direction: column;
          z-index: 100; overflow: hidden;
        }

        .sidebar-logo {
          padding: 28px 28px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
        }

        .sb-lw {
          font-family: 'DM Serif Display', Georgia, serif;
          font-size: 28px; font-weight: 400; fill: #ffffff;
        }
        .sb-lp {
          font-family: 'DM Sans', sans-serif;
          font-size: 18px; font-weight: 300; fill: #C9A84C;
        }

        .sidebar-nav {
          flex: 1; padding: 16px 12px;
          display: flex; flex-direction: column; gap: 2px;
          overflow-y: auto;
        }

        .nav-section-label {
          font-size: 10px; font-weight: 600;
          color: rgba(255,255,255,0.25);
          text-transform: uppercase; letter-spacing: 0.12em;
          padding: 12px 16px 6px;
        }

        .nav-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 16px; border-radius: 10px;
          text-decoration: none; cursor: pointer;
          transition: all 0.15s; position: relative;
          border: none; background: transparent;
          width: 100%; text-align: left;
          font-family: 'DM Sans', sans-serif;
        }

        .nav-item:hover { background: rgba(255,255,255,0.06); }

        .nav-item.active { background: rgba(201,168,76,0.12); }

        .nav-item.active::before {
          content: '';
          position: absolute; left: 0; top: 50%;
          transform: translateY(-50%);
          width: 3px; height: 20px;
          background: #C9A84C;
          border-radius: 0 2px 2px 0;
        }

        .nav-icon {
          width: 32px; height: 32px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; flex-shrink: 0;
          background: rgba(255,255,255,0.05);
          transition: background 0.15s;
        }

        .nav-item.active .nav-icon { background: rgba(201,168,76,0.2); }

        .nav-label {
          font-size: 14px; font-weight: 400;
          color: rgba(255,255,255,0.55);
          transition: color 0.15s;
        }

        .nav-item:hover .nav-label { color: rgba(255,255,255,0.9); }
        .nav-item.active .nav-label { font-weight: 500; color: #E8CC7A; }

        .sidebar-footer {
          padding: 16px 12px;
          border-top: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
        }

        .profil-card {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 16px; border-radius: 10px;
          cursor: pointer; transition: background 0.15s;
          text-decoration: none; margin-bottom: 4px;
        }

        .profil-card:hover { background: rgba(255,255,255,0.06); }

        .profil-avatar {
          width: 34px; height: 34px;
          background: linear-gradient(135deg, #C9A84C, #E8CC7A);
          border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; font-weight: 600;
          color: #001845; flex-shrink: 0;
        }

        .profil-info { flex: 1; min-width: 0; }

        .profil-nom {
          font-size: 13px; font-weight: 500;
          color: rgba(255,255,255,0.85);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .profil-role { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 1px; }

        .btn-logout {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 16px; border-radius: 10px;
          border: none; background: transparent;
          width: 100%; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; color: rgba(255,255,255,0.3);
          transition: all 0.15s; text-align: left;
        }

        .btn-logout:hover { background: rgba(255,59,48,0.1); color: rgba(255,100,90,0.8); }

        @media (max-width: 768px) {
          .sidebar { display: none; }
        }
      `}</style>

      <aside className="sidebar">
        <div className="sidebar-logo">
          <svg width="130" viewBox="0 0 220 44" xmlns="http://www.w3.org/2000/svg">
            <text className="sb-lw" x="0" y="34">Fluence</text>
            <text className="sb-lp" x="163" y="28">+</text>
          </svg>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          {NAV.map(item => {
            const isActive = pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <a key={item.href} href={item.href}
                className={`nav-item ${isActive ? 'active' : ''}`}>
                <div className="nav-icon">{item.icon}</div>
                <span className="nav-label">{item.label}</span>
              </a>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          {profil && (
            <a href="/dashboard/profil" className="profil-card">
              <div className="profil-avatar">
                {profil.prenom?.[0]}{profil.nom?.[0]}
              </div>
              <div className="profil-info">
                <div className="profil-nom">{profil.prenom} {profil.nom}</div>
                <div className="profil-role">{ROLE_LABELS[profil.role] || profil.role}</div>
              </div>
            </a>
          )}
          <button className="btn-logout" onClick={handleLogout}>
            <span>↩</span> Se déconnecter
          </button>
        </div>
      </aside>
    </>
  )
}