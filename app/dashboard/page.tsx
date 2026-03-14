'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'

type StatGlobale = {
  nbEleves: number
  nbClasses: number
  nbPassations: number
  scoreMoyen: number | null
  txNE: number
}

type Activite = {
  eleve_nom: string
  eleve_prenom: string
  classe: string
  score: number | null
  non_evalue: boolean
  periode: string
  created_at: string
}

export default function Dashboard() {
  const [stats, setStats]       = useState<StatGlobale | null>(null)
  const [activite, setActivite] = useState<Activite[]>([])
  const [loading, setLoading]   = useState(true)
  const { profil, loading: profilLoading } = useProfil()
  const supabase = createClient()

  useEffect(() => {
    if (!profilLoading && profil) chargerStats()
  }, [profil, profilLoading])

  async function chargerStats() {
    let classeQuery = supabase.from('classes').select('id, nom')
    if (profil && ['enseignant','directeur','principal'].includes(profil.role) && profil.etablissement_id) {
      classeQuery = classeQuery.eq('etablissement_id', profil.etablissement_id)
    }
    const { data: classes } = await classeQuery
    const classeIds = (classes || []).map((c: any) => c.id)

    if (classeIds.length === 0) {
      setStats({ nbEleves: 0, nbClasses: 0, nbPassations: 0, scoreMoyen: null, txNE: 0 })
      setLoading(false)
      return
    }

    const { count: nbEleves } = await supabase
      .from('eleves').select('*', { count: 'exact', head: true })
      .in('classe_id', classeIds).eq('actif', true)

    const { data: passations } = await supabase
      .from('passations')
      .select('score, non_evalue, created_at, eleve:eleves(nom, prenom, classe:classes(nom)), periode:periodes(code)')
      .order('created_at', { ascending: false })
      .limit(200)

    const pass    = (passations || []).filter((p: any) => p.eleve)
    const evalues = pass.filter((p: any) => !p.non_evalue && p.score && p.score > 0)
    const ne      = pass.filter((p: any) => p.non_evalue)
    const scores  = evalues.map((p: any) => p.score as number)
    const moyenne = scores.length > 0 ? Math.round(scores.reduce((a,b) => a+b,0)/scores.length) : null

    setStats({
      nbEleves:     nbEleves || 0,
      nbClasses:    classeIds.length,
      nbPassations: pass.length,
      scoreMoyen:   moyenne,
      txNE:         pass.length > 0 ? Math.round(ne.length/pass.length*100) : 0,
    })

    setActivite(pass.slice(0,8).map((p: any) => ({
      eleve_nom:    p.eleve?.nom || '',
      eleve_prenom: p.eleve?.prenom || '',
      classe:       p.eleve?.classe?.nom || '',
      score:        p.score,
      non_evalue:   p.non_evalue,
      periode:      p.periode?.code || '',
      created_at:   p.created_at,
    })))

    setLoading(false)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
        body { background: #F4F2ED; font-family: 'DM Sans', sans-serif; }

        .dash-page { display: flex; min-height: 100vh; }

        .dash-main {
          margin-left: 260px; flex: 1;
          padding: 48px;
          background: #F4F2ED;
        }

        .dash-greeting {
          font-family: 'DM Serif Display', serif;
          font-size: 36px; font-weight: 400;
          color: #001845; line-height: 1.2;
          margin-bottom: 6px;
        }
        .dash-greeting em { font-style: italic; color: #C9A84C; }
        .dash-date { font-size: 13px; color: #8A8680; margin-bottom: 40px; }

        .stats-grid {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 16px; margin-bottom: 28px;
        }

        .stat-card {
          background: #fff; border-radius: 16px; padding: 24px;
          border: 1px solid rgba(0,0,0,0.06);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,24,69,0.08); }
        .stat-card.featured { background: #001845; }
        .stat-label { font-size: 11px; font-weight: 600; color: #A8A49D; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 16px; }
        .stat-card.featured .stat-label { color: rgba(255,255,255,0.4); }
        .stat-num { font-family: 'DM Serif Display', serif; font-size: 42px; font-weight: 400; color: #001845; line-height: 1; }
        .stat-card.featured .stat-num { color: #fff; }
        .stat-unit { font-size: 13px; color: #A8A49D; margin-top: 6px; }
        .stat-card.featured .stat-unit { color: rgba(255,255,255,0.35); }
        .stat-gold { color: #C9A84C !important; }

        .actions-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 16px; margin-bottom: 32px;
        }
        .action-card {
          background: #fff; border-radius: 16px; padding: 20px 24px;
          border: 1px solid rgba(0,0,0,0.06); cursor: pointer;
          transition: all 0.15s; text-align: left;
          display: flex; align-items: center; gap: 16px; text-decoration: none;
        }
        .action-card:hover { border-color: #C9A84C; box-shadow: 0 4px 16px rgba(201,168,76,0.12); transform: translateY(-1px); }
        .action-icon { width: 44px; height: 44px; background: #F4F2ED; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
        .action-card:hover .action-icon { background: rgba(201,168,76,0.12); }
        .action-title { font-size: 14px; font-weight: 500; color: #001845; margin-bottom: 2px; }
        .action-sub { font-size: 12px; color: #A8A49D; }

        .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .section-title { font-family: 'DM Serif Display', serif; font-size: 22px; font-weight: 400; color: #001845; }
        .section-link { font-size: 13px; color: #C9A84C; text-decoration: none; font-weight: 500; }
        .section-link:hover { text-decoration: underline; }

        .activite-table { background: #fff; border-radius: 16px; border: 1px solid rgba(0,0,0,0.06); overflow: hidden; }
        .activite-table table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .activite-table thead tr { background: #F9F7F4; border-bottom: 1px solid rgba(0,0,0,0.06); }
        .activite-table th { padding: 12px 20px; font-size: 11px; font-weight: 600; color: #A8A49D; text-transform: uppercase; letter-spacing: 0.08em; text-align: left; }
        .activite-table td { padding: 14px 20px; border-bottom: 1px solid rgba(0,0,0,0.04); color: #4A4540; }
        .activite-table tr:last-child td { border-bottom: none; }
        .activite-table tbody tr:hover { background: #FAFAF8; }
        .td-nom { font-weight: 500; color: #001845; }
        .badge-periode { background: rgba(0,24,69,0.08); color: #001845; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; }
        .score-val { font-weight: 600; color: #001845; }
        .score-ne { font-size: 11px; font-weight: 600; color: #D97706; }
        .empty-state { padding: 48px; text-align: center; color: #A8A49D; font-size: 14px; }

        @media (max-width: 768px) {
          .dash-main { margin-left: 0; padding: 24px 20px; }
          .stats-grid { grid-template-columns: 1fr 1fr; }
          .actions-grid { grid-template-columns: 1fr; }
          .dash-greeting { font-size: 28px; }
        }
      `}</style>

      <div className="dash-page">
        <Sidebar />
        <ImpersonationBar />

        <main className="dash-main">
          <h1 className="dash-greeting">
            Bonjour, <em>{profil?.prenom || '—'}</em>
          </h1>
          <p className="dash-date">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>

          {loading ? (
            <div style={{ color: '#A8A49D', fontSize: 14 }}>Chargement...</div>
          ) : (
            <>
              <div className="stats-grid">
                <div className="stat-card featured">
                  <div className="stat-label">Score moyen</div>
                  <div className="stat-num">{stats?.scoreMoyen ?? '—'}</div>
                  <div className="stat-unit">mots / minute</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Élèves</div>
                  <div className="stat-num">{stats?.nbEleves ?? '—'}</div>
                  <div className="stat-unit">{stats?.nbClasses} classes</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Passations</div>
                  <div className="stat-num">{stats?.nbPassations ?? '—'}</div>
                  <div className="stat-unit">scores enregistrés</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Non évalués</div>
                  <div className={`stat-num ${(stats?.txNE || 0) > 10 ? 'stat-gold' : ''}`}>
                    {stats?.txNE ?? 0}%
                  </div>
                  <div className="stat-unit">des élèves</div>
                </div>
              </div>

              <div className="actions-grid">
                <a href="/dashboard/eleves" className="action-card">
                  <div className="action-icon">👥</div>
                  <div>
                    <div className="action-title">Mes classes</div>
                    <div className="action-sub">Gérer les élèves</div>
                  </div>
                </a>
                <a href="/dashboard/saisie" className="action-card">
                  <div className="action-icon">✏️</div>
                  <div>
                    <div className="action-title">Saisie manuelle</div>
                    <div className="action-sub">Entrer les scores</div>
                  </div>
                </a>
                <a href="/dashboard/statistiques" className="action-card">
                  <div className="action-icon">📈</div>
                  <div>
                    <div className="action-title">Statistiques</div>
                    <div className="action-sub">Analyser les résultats</div>
                  </div>
                </a>
              </div>

              <div>
                <div className="section-header">
                  <h2 className="section-title">Activité récente</h2>
                  <a href="/dashboard/statistiques" className="section-link">Voir tout →</a>
                </div>
                <div className="activite-table">
                  {activite.length === 0 ? (
                    <div className="empty-state">Aucune saisie pour le moment</div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Élève</th>
                          <th>Classe</th>
                          <th>Période</th>
                          <th>Score</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activite.map((a, i) => (
                          <tr key={i}>
                            <td className="td-nom">{a.eleve_nom} {a.eleve_prenom}</td>
                            <td>{a.classe}</td>
                            <td><span className="badge-periode">{a.periode}</span></td>
                            <td>
                              {a.non_evalue
                                ? <span className="score-ne">N.É.</span>
                                : <span className="score-val">{a.score} m/min</span>
                              }
                            </td>
                            <td>{new Date(a.created_at).toLocaleDateString('fr-FR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  )
}