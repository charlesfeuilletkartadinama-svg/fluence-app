'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

type Eleve = {
  id: string
  nom: string
  prenom: string
  ine: string | null
  actif: boolean
}

type Classe = {
  id: string
  nom: string
  niveau: string
  etablissement: { nom: string }
}

export default function DetailClasse() {
  const [classe, setClasse]   = useState<Classe | null>(null)
  const [eleves, setEleves]   = useState<Eleve[]>([])
  const [loading, setLoading] = useState(true)
  const [recherche, setRecherche] = useState('')
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      chargerDonnees()
    })
  }, [])

  async function chargerDonnees() {
    const id = params.id as string

    // Charger la classe
    const { data: classeData } = await supabase
      .from('classes')
      .select('id, nom, niveau, etablissement:etablissements(nom)')
      .eq('id', id)
      .single()

    // Charger les élèves
    const { data: elevesData } = await supabase
      .from('eleves')
      .select('id, nom, prenom, ine, actif')
      .eq('classe_id', id)
      .eq('actif', true)
      .order('nom')

    setClasse(classeData)
    setEleves(elevesData || [])
    setLoading(false)
  }

  const elevesFiltres = eleves.filter(e =>
    e.nom.toLowerCase().includes(recherche.toLowerCase()) ||
    e.prenom.toLowerCase().includes(recherche.toLowerCase())
  )

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
          <a href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 text-sm font-medium transition">
            📊 Tableau de bord
          </a>
          <a href="/dashboard/eleves" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-800 text-white text-sm font-medium">
            👥 Mes élèves
          </a>
          <a href="/dashboard/import" className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 text-sm font-medium transition">
            📥 Importer
          </a>
          <a href="/dashboard/statistiques" className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 text-sm font-medium transition">
            📈 Statistiques
          </a>
        </nav>
      </div>

      {/* Main */}
      <div className="ml-64 p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => router.push('/dashboard/eleves')}
            className="text-slate-400 hover:text-blue-900 transition text-sm">
            ← Mes élèves
          </button>
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm">Chargement...</div>
        ) : !classe ? (
          <div className="text-red-500">Classe introuvable</div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-blue-900">{classe.nom}</h2>
                <p className="text-slate-500 mt-1">
                  {classe.niveau} · {classe.etablissement?.nom} · {eleves.length} élève{eleves.length > 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => router.push(`/dashboard/saisie?classe=${classe.id}`)}
                className="bg-blue-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-800 transition flex items-center gap-2">
                ✏️ Saisir les scores
              </button>
            </div>

            {/* Barre de recherche */}
            <div className="mb-6">
              <input
                type="text"
                placeholder="Rechercher un élève..."
                value={recherche}
                onChange={e => setRecherche(e.target.value)}
                className="w-full max-w-sm border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-600 transition bg-white"
              />
            </div>

            {/* Liste élèves */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <span className="font-semibold text-blue-900 text-sm">
                  {elevesFiltres.length} élève{elevesFiltres.length > 1 ? 's' : ''}
                </span>
              </div>
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Nom</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Prénom</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">INE</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Dernier score</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Évolution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {elevesFiltres.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-semibold text-blue-900">{e.nom}</td>
                      <td className="px-6 py-4 text-slate-600">{e.prenom}</td>
                      <td className="px-6 py-4 text-slate-400 text-sm font-mono">{e.ine || '—'}</td>
                      <td className="px-6 py-4">
                        <span className="text-slate-400 text-sm">—</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-400 text-sm">—</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}