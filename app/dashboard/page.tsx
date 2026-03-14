import { createClient } from '@/app/lib/supabase'
import { redirect } from 'next/navigation'

export default async function Dashboard() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
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
          <a href="/dashboard/saisie" className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 text-sm font-medium transition">
            ✏️ Saisie des scores
          </a>
          <a href="/dashboard/eleves" className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 text-sm font-medium transition">
            👥 Mes élèves
          </a>
          <a href="/dashboard/statistiques" className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 text-sm font-medium transition">
            📈 Statistiques
          </a>
        </nav>

        <div className="absolute bottom-6 left-6 right-6">
          <div className="bg-blue-800 rounded-lg p-3 mb-3">
            <p className="text-xs text-blue-300">Connecté en tant que</p>
            <p className="text-sm font-medium text-white truncate">{user.email}</p>
          </div>
          <a href="/logout" className="flex items-center gap-2 text-blue-300 hover:text-white text-sm transition">
            🚪 Se déconnecter
          </a>
        </div>
      </div>

      {/* Main content */}
      <div className="ml-64 p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-blue-900">Tableau de bord</h2>
          <p className="text-slate-500 mt-1">Bienvenue sur l'application Test de Fluence</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Élèves</p>
            <p className="text-3xl font-bold text-blue-900">—</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Classes</p>
            <p className="text-3xl font-bold text-blue-900">—</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Score moyen</p>
            <p className="text-3xl font-bold text-blue-900">—</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Période</p>
            <p className="text-3xl font-bold text-blue-900">—</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-blue-900 mb-4">Activité récente</h3>
          <p className="text-slate-400 text-sm">Aucune saisie pour le moment.</p>
        </div>
      </div>
    </div>
  )
}