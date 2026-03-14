'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'

type StatGlobale = {
  nbEleves: number
  nbClasses: number
  nbPassations: number
  scoreMoyen: number | null
  txNE: number
  derniereActivite: string | null
}

type ActiviteRecente = {
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
  const [activite, setActivite] = useState<ActiviteRecente[]>([])
  const [loading, setLoading]   = useState(true)
  const { profil, loading: profilLoading } = useProfil()
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!profilLoading && profil) chargerStats()
  }, [profil, profilLoading])

  async function chargerStats() {
    // Charger les classes de l'établissement
    let classeQuery = supabase.from('classes').select('id, nom')
    if (profil && ['enseignant','directeur','principal'].includes(profil.role) && profil.etablissement_id) {
      classeQuery = classeQuery.eq('etablissement_id', profil.etablissement_id)
    }
    const { data: classes } = await classeQuery
    const classeIds = (classes || []).map(c => c.id)

    if (classeIds.length === 0) {
      setStats({ nbEleves: 0, nbClasses: 0, nbPassations: 0, scoreMoyen: null, txNE: 0, derniereActivite: null })
      setLoading(false)
      return
    }

    // Élèves
    const { count: nbEleves } = await supabase
      .from('eleves').select('*', { count: 'exact', head: true })
      .in('classe_id', classeIds).eq('actif', true)

    // Passations
    const { data: passations } = await supabase
      .from('passations')
      .select(`
        score, non_evalue, created_at,
        eleve:eleves(nom, prenom, classe:classes(nom)),
        periode:periodes(code)
      `)
      .in('eleves.classe_id', classeIds)
      .order('created_at', { ascending: false })
      .limit(200)

    const pass = (passations || []).filter((p: any) => p.eleve)
    const evalues = pass.filter((p: any) => !p.non_evalue && p.score && p.score > 0)
    const ne      = pass.filter((p: any) => p.non_evalue)
    const scores  = evalues.map((p: any) => p.score as number)
    const moyenne = scores.length > 0
      ? Math.round(scores.reduce((a,b) => a+b, 0) / scores.length)
      : null

    setStats({
      nbEleves:        nbEleves || 0,
      nbClasses:       classeIds.length,
      nbPassations:    pass.length,
      scoreMoyen:      moyenne,
      txNE:            pass.length > 0 ? Math.round(ne.length / pass.length * 100) : 0,
      derniereActivite: pass[0]?.created_at || null,
    })

    // Activité récente (10 dernières)
    const recent: ActiviteRecente[] = pass.slice(0, 10).map((p: any) => ({
      eleve_nom:    p.eleve?.nom || '',
      eleve_prenom: p.eleve?.prenom || '',
      classe:       p.eleve?.classe?.nom || '',
      score:        p.score,
      non_evalue:   p.non_evalue,
      periode:      p.periode?.code || '',
      created_at:   p.created_at,
    }))
    setActivite(recent)
    setLoading(false)
  }

  const ROLE_LABELS: Record<string, string> = {
    enseignant: 'Enseignant',
    directeur:  'Directeur',
    principal:  'Principal / Principal Adjoint',
    coordo_rep: 'Coordonnateur REP+',
    ien:        'IEN',
    ia_dasen:   'IA-DASEN',
    recteur:    'Recteur',
    admin:      'Administrateur',
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-blue-900 text-white p-6">
        <div className="mb-8">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mb-3">
            <span className="text-blue-900 font-bold text-lg">F</span>
          </div>
          <h1 className="font-bold text-lg">Test de Fluence</h1>
          <p className="text-blue-300 text-xs mt-1">Académie de Guyane</p>
        </div>
        <nav className="space-y-1">
          <a href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-800 text-white text-sm font-medium">
            📊 Tableau de bord
          </a>
          <a href="/dashboard/eleves" className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 text-sm font-medium transition">
            👥 Mes élèves
          </a>
          <a href="/dashboard/saisie" className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 text-sm font-medium transition">
            ✏️ Saisie
          </a>
          <a href="/dashboard/statistiques" className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 text-sm font-medium transition">
            📈 Statistiques
          </a>
          {profil && ['admin','ia_dasen','recteur','principal'].includes(profil.role) && (
            <a href="/dashboard/admin" className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 text-sm font-medium transition">
              ⚙️ Administration
            </a>
          )}
        </nav>
        {profil && (
          <div className="absolute bottom-6 left-6 right-6">
            <a href="/dashboard/profil" className="block bg-blue-800 rounded-xl p-3 hover:bg-blue-700 transition">
              <p className="text-xs text-blue-300 mb-1">{ROLE_LABELS[profil.role] || profil.role}</p>
              <p className="text-sm font-bold text-white">{profil.prenom} {profil.nom}</p>
            </a>
          </div>
        )}
      </div>

      {/* Main */}
      <div className="ml-64 p-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-blue-900">
            Bonjour {profil?.prenom} 👋
          </h2>
          <p className="text-slate-500 mt-1">
            {ROLE_LABELS[profil?.role || ''] || ''} · Collège Westham
          </p>
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm">Chargement...</div>
        ) : (
          <>
            {/* Cartes stats */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-blue-900 rounded-2xl p-6 text-white">
                <p className="text-blue-300 text-xs font-semibold uppercase tracking-wide mb-3">Score moyen</p>
                <p className="text-5xl font-black">
                  {stats?.scoreMoyen ?? '—'}
                </p>
                <p className="text-blue-300 text-sm mt-1">mots / minute</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-slate-100">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">Élèves</p>
                <p className="text-5xl font-black text-blue-900">{stats?.nbEleves ?? '—'}</p>
                <p className="text-slate-400 text-sm mt-1">{stats?.nbClasses} classes</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-slate-100">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">Passations</p>
                <p className="text-5xl font-black text-blue-900">{stats?.nbPassations ?? '—'}</p>
                <p className="text-slate-400 text-sm mt-1">scores enregistrés</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-slate-100">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">Non évalués</p>
                <p className="text-5xl font-black text-orange-500">{stats?.txNE ?? 0}%</p>
                <p className="text-slate-400 text-sm mt-1">des élèves</p>
              </div>
            </div>

            {/* Actions rapides */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <button onClick={() => router.push('/dashboard/eleves')}
                className="bg-white rounded-2xl p-5 border border-slate-100 hover:border-blue-200 text-left transition group">
                <div className="text-2xl mb-3">👥</div>
                <h3 className="font-bold text-blue-900 group-hover:text-blue-700">Mes classes</h3>
                <p className="text-slate-400 text-sm mt-1">Gérer les élèves</p>
              </button>
              <button onClick={() => router.push('/dashboard/saisie')}
                className="bg-white rounded-2xl p-5 border border-slate-100 hover:border-blue-200 text-left transition group">
                <div className="text-2xl mb-3">✏️</div>
                <h3 className="font-bold text-blue-900 group-hover:text-blue-700">Saisie manuelle</h3>
                <p className="text-slate-400 text-sm mt-1">Entrer les scores</p>
              </button>
              <button onClick={() => router.push('/dashboard/statistiques')}
                className="bg-white rounded-2xl p-5 border border-slate-100 hover:border-blue-200 text-left transition group">
                <div className="text-2xl mb-3">📈</div>
                <h3 className="font-bold text-blue-900 group-hover:text-blue-700">Statistiques</h3>
                <p className="text-slate-400 text-sm mt-1">Analyser les résultats</p>
              </button>
            </div>

            {/* Activité récente */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-blue-900">Activité récente</h3>
                <span className="text-xs text-slate-400">10 dernières saisies</span>
              </div>
              {activite.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  Aucune saisie pour le moment
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Élève</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Classe</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Période</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Score</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {activite.map((a, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-3 font-semibold text-blue-900">
                          {a.eleve_nom} {a.eleve_prenom}
                        </td>
                        <td className="px-6 py-3 text-slate-500">{a.classe}</td>
                        <td className="px-6 py-3 text-center">
                          <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
                            {a.periode}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center font-bold text-blue-900">
                          {a.non_evalue ? (
                            <span className="text-orange-500 text-xs font-bold">N.É.</span>
                          ) : (
                            `${a.score} m/min`
                          )}
                        </td>
                        <td className="px-6 py-3 text-right text-slate-400 text-xs">
                          {new Date(a.created_at).toLocaleDateString('fr-FR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}