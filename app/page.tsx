import { login } from './actions/auth'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-900 rounded-xl mx-auto mb-4 flex items-center justify-center">
            <span className="text-white text-2xl font-bold">F</span>
          </div>
          <h1 className="text-2xl font-bold text-blue-900">Test de Fluence</h1>
          <p className="text-slate-500 text-sm mt-1">Académie de Guyane</p>
        </div>

        <form action={login} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Adresse email
            </label>
            <input
              name="email"
              type="email"
              placeholder="votre@email.fr"
              className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-600 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Mot de passe
            </label>
            <input
              name="password"
              type="password"
              placeholder="••••••••"
              className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-600 transition"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-900 text-white rounded-lg py-3 font-semibold text-sm hover:bg-blue-800 transition"
          >
            Se connecter
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Application développée par M. FEUILLET
        </p>
      </div>
    </main>
  )
}