'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useRouter } from 'next/navigation'

type Classe = {
  id: string
  nom: string
  niveau: string
  etablissement: { nom: string }
  eleves: { count: number }[]
}

export default function Eleves() {
  const [classes, setClasses] = useState<Classe[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      chargerClasses()
    })
  }, [])

  async function chargerClasses() {
    const { data } = await supabase
      .from('classes')
      .select(`
        id, nom, niveau,
        etablissement:etablissements(nom),
        eleves(count)
      `)
      .order('niveau')

    setClasses(data || [])
    setLoading(false)
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
          <a href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 text-sm font-medium transition">
            📊 Tableau de bord
          </a>
          <a href="/dashboard/saisie" className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 text-sm font-medium transition">
            ✏️ Saisie des scores
          </a>
          <a href="/dashboard/eleves" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-800 text-white text-sm font-medium">
            👥 Mes élèves
          </a>
          <a href="/dashboard/statistiques" className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 text-sm font-medium transition">
            📈 Statistiques
          </a>
        </nav>
      </div>

      {/* Main */}
      <div className="ml-64 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-blue-900">Mes élèves</h2>
            <p className="text-slate-500 mt-1">Gestion des classes et des élèves</p>
          </div>
          <button className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800 transition">
            + Importer des élèves
          </button>
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm">Chargement...</div>
        ) : classes.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="font-bold text-blue-900 mb-2">Aucune classe</h3>
            <p className="text-slate-400 text-sm">Importez vos élèves pour commencer</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            {classes.map(c => (
              <div key={c.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:border-blue-200 transition cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-blue-900 text-lg">{c.nom}</h3>
                    <p className="text-slate-400 text-sm">{c.niveau}</p>
                  </div>
                  <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full">
                    {c.eleves?.[0]?.count || 0} élèves
                  </span>
                </div>
                <p className="text-slate-500 text-xs">{c.etablissement?.nom}</p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => router.push(`/dashboard/eleves/${c.id}`)}
                    className="flex-1 bg-blue-900 text-white text-xs font-semibold py-2 rounded-lg hover:bg-blue-800 transition">
                     Voir les élèves
                </button>
                  <button className="flex-1 border border-blue-200 text-blue-700 text-xs font-semibold py-2 rounded-lg hover:bg-blue-50 transition">
                    Saisir scores
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}