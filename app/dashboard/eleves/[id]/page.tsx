'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
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
  const { profil, loading: profilLoading } = useProfil()
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!profilLoading && profil) chargerClasses()
  }, [profil, profilLoading])

  async function chargerClasses() {
    let query = supabase
      .from('classes')
      .select(`
        id, nom, niveau,
        etablissement:etablissements(nom),
        eleves(count)
      `)
      .order('niveau')

    // Filtrer selon le rôle
    if (profil && ['enseignant','directeur','principal'].includes(profil.role)) {
      if (profil.etablissement_id) {
        query = query.eq('etablissement_id', profil.etablissement_id)
      }
    }
    // IEN, IA-DASEN, recteur, admin → pas de filtre = tout voir

    const { data } = await query

    // Dédoublonner par id
    const seen = new Set<string>()
    const uniques = (data || []).filter(c => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })

    setClasses(uniques)
    setLoading(false)
  }

  if (profilLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 ml-64 p-8">
        <div className="text-slate-400 text-sm">Chargement...</div>
      </div>
    )
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

        {/* Profil en bas */}
        {profil && (
          <div className="absolute bottom-6 left-6 right-6">
            <a href="/dashboard/profil" className="block bg-blue-800 rounded-xl p-3 hover:bg-blue-700 transition">
              <p className="text-xs text-blue-300 mb-1">{profil.role}</p>
              <p className="text-sm font-bold text-white">{profil.prenom} {profil.nom}</p>
            </a>
          </div>
        )}
      </div>

      {/* Main */}
      <div className="ml-64 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-blue-900">Mes élèves</h2>
            <p className="text-slate-500 mt-1">
              {profil?.role === 'enseignant' ? 'Mes classes' : 'Toutes les classes'}
              {' · '}{classes.length} classe{classes.length > 1 ? 's' : ''}
            </p>
          </div>
          {['admin','ia_dasen','recteur','directeur','principal'].includes(profil?.role || '') && (
            <button onClick={() => router.push('/dashboard/import')}
              className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800 transition">
              + Importer des élèves
            </button>
          )}
        </div>

        {classes.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="font-bold text-blue-900 mb-2">Aucune classe</h3>
            <p className="text-slate-400 text-sm">
              {profil?.etablissement_id
                ? 'Aucune classe dans votre établissement'
                : 'Configurez votre profil avec un établissement'}
            </p>
            <button onClick={() => router.push('/dashboard/profil')}
              className="mt-4 bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800 transition">
              Configurer mon profil
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            {classes.map(c => (
              <div key={c.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:border-blue-200 transition">
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
                  <button
                    onClick={() => router.push(`/dashboard/saisie?classe=${c.id}`)}
                    className="flex-1 border border-blue-200 text-blue-700 text-xs font-semibold py-2 rounded-lg hover:bg-blue-50 transition">
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