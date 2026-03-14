'use client'

import { useState } from 'react'
import { createClient } from './lib/supabase'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('Email:', email)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    console.log('Data:', JSON.stringify(data))
    console.log('Error:', JSON.stringify(error))

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

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
        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Adresse email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="votre@email.fr" required
              className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-600 transition"/>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
              className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-600 transition"/>
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-blue-900 text-white rounded-lg py-3 font-semibold text-sm hover:bg-blue-800 transition disabled:opacity-50">
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
        <p className="text-center text-xs text-slate-400 mt-6">Application développée par M. FEUILLET</p>
      </div>
    </main>
  )
}