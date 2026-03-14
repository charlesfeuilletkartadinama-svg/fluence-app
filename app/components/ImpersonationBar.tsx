'use client'

import { useImpersonation } from '@/app/lib/useImpersonation'
import { useProfil } from '@/app/lib/useProfil'

const PROFILS_SIMULABLES = [
  { role: 'enseignant',  label: '👨‍🏫 Enseignant',         etablissement_id: 'current' },
  { role: 'directeur',   label: '🏫 Directeur',            etablissement_id: 'current' },
  { role: 'principal',   label: '🏛️ Principal',            etablissement_id: 'current' },
  { role: 'coordo_rep',  label: '🎯 Coordo REP+',          etablissement_id: null      },
  { role: 'ien',         label: '📋 IEN',                  etablissement_id: null      },
  { role: 'ia_dasen',    label: '🏢 IA-DASEN',             etablissement_id: null      },
  { role: 'recteur',     label: '⭐ Recteur',              etablissement_id: null      },
]

export default function ImpersonationBar() {
  const { profil } = useProfil()
  const { roleImpersonne, setRoleImpersonne, clearImpersonation } = useImpersonation()

  // Visible uniquement pour les admins
  if (!profil || !['admin', 'ia_dasen', 'recteur'].includes(profil.role)) return null

  return (
    <>
      <style>{`
        .imp-bar {
          position: fixed;
          top: 0; left: 260px; right: 0;
          height: 40px;
          background: ${roleImpersonne ? '#7C3AED' : '#1E293B'};
          display: flex; align-items: center;
          padding: 0 20px; gap: 12px;
          z-index: 999;
          transition: background 0.2s;
        }

        .imp-label {
          font-size: 11px; font-weight: 600;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase; letter-spacing: 0.1em;
          white-space: nowrap;
        }

        .imp-select {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 12px; font-weight: 500;
          color: #fff;
          cursor: pointer; outline: none;
          font-family: 'DM Sans', sans-serif;
        }

        .imp-select option { background: #1E293B; color: #fff; }

        .imp-active-badge {
          display: flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.15);
          border-radius: 6px; padding: 3px 10px;
          font-size: 12px; font-weight: 600; color: #fff;
        }

        .imp-dot {
          width: 6px; height: 6px;
          background: #A78BFA; border-radius: 50%;
          animation: pulse-dot 1.5s ease infinite;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .imp-quit {
          margin-left: auto;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 6px; padding: 4px 12px;
          font-size: 11px; font-weight: 600;
          color: rgba(255,255,255,0.8);
          cursor: pointer; transition: all 0.15s;
          font-family: 'DM Sans', sans-serif;
        }

        .imp-quit:hover {
          background: rgba(255,255,255,0.2);
          color: #fff;
        }

        .imp-info {
          margin-left: auto;
          font-size: 11px; color: rgba(255,255,255,0.35);
        }

        /* Décale le contenu principal quand la barre est visible */
        .has-imp-bar .dash-main,
        .has-imp-bar .main-content {
          padding-top: calc(40px + 40px) !important;
        }

        @media (max-width: 768px) {
          .imp-bar { left: 0; }
        }
      `}</style>

      <div className="imp-bar">
        <span className="imp-label">🔍 Mode admin</span>

        {!roleImpersonne ? (
          <>
            <span className="imp-label">— Simuler le profil :</span>
            <select className="imp-select"
              value=""
              onChange={e => {
                const found = PROFILS_SIMULABLES.find(p => p.role === e.target.value)
                if (found) setRoleImpersonne({
                  role:              found.role,
                  label:             found.label,
                  etablissement_id:  found.etablissement_id === 'current' ? profil.etablissement_id : null,
                  circonscription_id: profil.circonscription_id,
                })
              }}>
              <option value="">Choisir un profil...</option>
              {PROFILS_SIMULABLES.map(p => (
                <option key={p.role} value={p.role}>{p.label}</option>
              ))}
            </select>
            <span className="imp-info">Vous voyez l'interface en tant qu'admin</span>
          </>
        ) : (
          <>
            <div className="imp-active-badge">
              <div className="imp-dot"/>
              Simulation : {roleImpersonne.label}
            </div>
            <button className="imp-quit" onClick={clearImpersonation}>
              ✕ Quitter la simulation
            </button>
          </>
        )}
      </div>
    </>
  )
}