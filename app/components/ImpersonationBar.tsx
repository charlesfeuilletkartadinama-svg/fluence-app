'use client'

import { useEffect, useState } from 'react'
import { useImpersonation } from '@/app/lib/useImpersonation'
import { useProfil } from '@/app/lib/useProfil'
import { createClient } from '@/app/lib/supabase'

type SimulProfil = { id: string; role: string; label: string; etablissement_id: string | null }

export default function ImpersonationBar() {
  const [mounted, setMounted] = useState(false)
  const [simulProfils, setSimulProfils] = useState<SimulProfil[]>([])
  const { profil, profilReel } = useProfil()
  const { roleImpersonne, setRoleImpersonne, clearImpersonation, hydrate } = useImpersonation()
  const supabase = createClient()

  useEffect(() => {
    hydrate()
    setMounted(true)
    // Charger les profils simulables — max 1 par rôle pour un sélecteur compact
    supabase.from('profils').select('id, nom, prenom, role, etablissement_id')
      .neq('role', 'admin')
      .order('role').order('nom')
      .then(({ data }) => {
        // 1 profil par rôle : prioriser les profils sans [TEST] (= profils de démo nommés)
        const byRole = new Map<string, any>()
        for (const p of (data || [])) {
          const isTest = (p.nom || '').includes('[TEST]')
          const current = byRole.get(p.role)
          if (!current) { byRole.set(p.role, p) }
          else {
            const currentIsTest = (current.nom || '').includes('[TEST]')
            // Préférer non-[TEST] avec établissement
            if (currentIsTest && !isTest && p.etablissement_id) byRole.set(p.role, p)
          }
        }
        data = Array.from(byRole.values())
        if (data) {
          setSimulProfils(data.map((p: any) => ({
            id: p.id,
            role: p.role,
            label: `${p.prenom} ${p.nom}`,
            etablissement_id: p.etablissement_id,
          })))
        }
      })
  }, [])

  // Visible uniquement pour les admins et après hydration
  if (!mounted || !profilReel || !['admin', 'ia_dasen', 'recteur'].includes(profilReel.role)) return null

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
            <span className="imp-label">— Simuler :</span>
            <select className="imp-select"
              value=""
              onChange={e => {
                const found = simulProfils.find(p => p.id === e.target.value)
                if (found) setRoleImpersonne({
                  role:              found.role,
                  label:             found.label,
                  id:                found.id,
                  etablissement_id:  found.etablissement_id,
                })
              }}>
              <option value="">Choisir un profil...</option>
              {simulProfils.map(p => {
                const roleIcon: Record<string, string> = { enseignant: '👨‍🏫', directeur: '🏫', principal: '🏛️', coordo_rep: '🎯', ien: '📋', ia_dasen: '🏢', recteur: '⭐' }
                const roleLabel: Record<string, string> = { enseignant: 'Enseignant', directeur: 'Directeur', principal: 'Principal', coordo_rep: 'Coordo REP', ien: 'IEN', ia_dasen: 'IA-DASEN', recteur: 'Recteur' }
                return (
                  <option key={p.id} value={p.id}>
                    {roleIcon[p.role] || ''} {roleLabel[p.role] || p.role} — {p.label.replace(/\[TEST\]\s*/g, '')}
                  </option>
                )
              })}
            </select>
            <span className="imp-info">Admin</span>
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