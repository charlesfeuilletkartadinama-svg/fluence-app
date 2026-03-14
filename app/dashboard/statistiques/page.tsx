'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useRouter } from 'next/navigation'

type StatClasse = {
  classe: string
  niveau: string
  total: number
  evalues: number
  ne: number
  moyenne: number | null
  min: number | null
  max: number | null
}

type StatPeriode = {
  periode: string
  moyenne: number | null
  evalues: number
  ne: number
}

export default function Statistiques() {
  const [periode, setPeriode]         = useState('T1')
  const [periodes, setPeriodes]       = useState<string[]>([])
  const [statsClasses, setStatsClasses] = useState<StatClasse[]>([])
  const [statsPeriodes, setStatsPeriodes] = useState<StatPeriode[]>([])
  const [loading, setLoading]         = useState(true)
  const [moyenneGlobale, setMoyenneGlobale] = useState<number | null>(null)
  const [totalEleves, setTotalEleves] = useState(0)
  const [totalEvalues, setTotalEvalues] = useState(0)
  const [totalNE, setTotalNE]         = useState(0)
  const router  = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      chargerPeriodes()
    })
  }, [])

  useEffect(() => {
    if (periodes.length > 0) chargerStats()
  }, [periode, periodes])

  async function chargerPeriodes() {
    const { data } = await supabase
      .from('periodes')
      .select('code')
      .eq('actif', true)
      .order('code')
    const codes = [...new Set((data || []).map(p => p.code))]
    setPeriodes(codes)
    if (codes.length > 0) setPeriode(codes[0])
    setLoading(false)
  }

  async function chargerStats() {
    setLoading(true)

    // Stats par classe pour la période sélectionnée
    const { data: passData } = await supabase
      .from('passations')
      .select(`
        score, non_evalue,
        eleve:eleves(
          id,
          classe:classes(nom, niveau)
        ),
        periode:periodes(code)
      `)
      .eq('periodes.code', periode)

    // Filtrer par période
    const passFiltrees = (passData || []).filter((p: any) =>
      p.periode?.code === periode
    )

    // Grouper par classe
    const parClasse: Record<string, any[]> = {}
    passFiltrees.forEach((p: any) => {
      const classe = p.eleve?.classe?.nom || 'Inconnue'
      if (!parClasse[classe]) parClasse[classe] = []
      parClasse[classe].push(p)
    })

    const statsC: StatClasse[] = Object.entries(parClasse).map(([nom, passations]) => {
      const evalues  = passations.filter(p => !p.non_evalue && p.score !== null && p.score > 0)
      const ne       = passations.filter(p => p.non_evalue)
      const scores   = evalues.map(p => p.score as number)
      const moyenne  = scores.length > 0 ? Math.round(scores.reduce((a,b) => a+b, 0) / scores.length) : null
      const niveau   = passations[0]?.eleve?.classe?.niveau || ''
      return {
        classe: nom,
        niveau,
        total:  passations.length,
        evalues: evalues.length,
        ne:     ne.length,
        moyenne,
        min:    scores.length > 0 ? Math.min(...scores) : null,
        max:    scores.length > 0 ? Math.max(...scores) : null,
      }
    }).sort((a,b) => a.classe.localeCompare(b.classe))

    setStatsClasses(statsC)

    // Stats globales
    const tousScores = passFiltrees
      .filter((p: any) => !p.non_evalue && p.score !== null && p.score > 0)
      .map((p: any) => p.score as number)

    setMoyenneGlobale(tousScores.length > 0
      ? Math.round(tousScores.reduce((a,b) => a+b, 0) / tousScores.length)
      : null)
    setTotalEleves(passFiltrees.length)
    setTotalEvalues(tousScores.length)
    setTotalNE(passFiltrees.filter((p: any) => p.non_evalue).length)

    // Évolution par période
    const { data: evolData } = await supabase
      .from('passations')
      .select('score, non_evalue, periode:periodes(code)')

    const parPeriode: Record<string, number[]> = {}
    const neParPeriode: Record<string, number> = {}
    ;(evolData || []).forEach((p: any) => {
      const code = p.periode?.code
      if (!code) return
      if (!parPeriode[code]) { parPeriode[code] = []; neParPeriode[code] = 0 }
      if (p.non_evalue) {
        neParPeriode[code]++
      } else if (p.score && p.score > 0) {
        parPeriode[code].push(p.score)
      }
    })

    const statsP: StatPeriode[] = Object.entries(parPeriode)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([code, scores]) => ({
        periode: code,
        moyenne: scores.length > 0 ? Math.round(scores.reduce((a,b) => a+b,0)/scores.length) : null,
        evalues: scores.length,
        ne:      neParPeriode[code] || 0,
      }))

    setStatsPeriodes(statsP)
    setLoading(false)
  }

  const txNE = totalEleves > 0 ? Math.round(totalNE / totalEleves * 100) : 0

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
          <a href="/dashboard/eleves" className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 text-sm font-medium transition">
            👥 Mes élèves
          </a>
          <a href="/dashboard/saisie" className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 text-sm font-medium transition">
            ✏️ Saisie des scores
          </a>
          <a href="/dashboard/statistiques" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-800 text-white text-sm font-medium">
            📈 Statistiques
          </a>
        </nav>
      </div>

      <div className="ml-64 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-blue-900">Statistiques</h2>
            <p className="text-slate-500 mt-1">Analyse des scores de fluence</p>
          </div>

          {/* Filtre période */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 font-medium">Période :</span>
            <div className="flex gap-2">
              {periodes.map(p => (
                <button key={p}
                  onClick={() => setPeriode(p)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition
                    ${periode === p
                      ? 'bg-blue-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm">Chargement...</div>
        ) : (
          <>
            {/* Cartes globales */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-blue-900 rounded-2xl p-5 text-white">
                <p className="text-blue-300 text-xs font-semibold uppercase tracking-wide mb-2">Score moyen</p>
                <p className="text-4xl font-bold">
                  {moyenneGlobale !== null ? moyenneGlobale : '—'}
                </p>
                <p className="text-blue-300 text-xs mt-1">mots / minute</p>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-slate-100">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">Élèves évalués</p>
                <p className="text-4xl font-bold text-blue-900">{totalEvalues}</p>
                <p className="text-slate-400 text-xs mt-1">sur {totalEleves} total</p>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-slate-100">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">Non évalués</p>
                <p className="text-4xl font-bold text-orange-500">{totalNE}</p>
                <p className="text-slate-400 text-xs mt-1">{txNE}% des élèves</p>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-slate-100">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">Classes</p>
                <p className="text-4xl font-bold text-blue-900">{statsClasses.length}</p>
                <p className="text-slate-400 text-xs mt-1">classes évaluées</p>
              </div>
            </div>

            {/* Évolution par période */}
            {statsPeriodes.length > 1 && (
              <div className="bg-white rounded-2xl p-6 border border-slate-100 mb-6">
                <h3 className="font-bold text-blue-900 mb-4">Évolution par période</h3>
                <div className="flex items-end gap-4">
                  {statsPeriodes.map((sp, i) => {
                    const maxMoy = Math.max(...statsPeriodes.map(s => s.moyenne || 0))
                    const pct = maxMoy > 0 && sp.moyenne ? Math.round(sp.moyenne / maxMoy * 100) : 0
                    const prev = i > 0 ? statsPeriodes[i-1].moyenne : null
                    const diff = prev !== null && sp.moyenne !== null ? sp.moyenne - prev : null
                    return (
                      <div key={sp.periode} className="flex-1 text-center">
                        <div className="mb-2">
                          {diff !== null && (
                            <span className={`text-xs font-bold ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {diff >= 0 ? '↑' : '↓'} {Math.abs(diff)}
                            </span>
                          )}
                        </div>
                        <div className="bg-slate-100 rounded-xl overflow-hidden h-32 flex items-end">
                          <div
                            className="w-full bg-blue-900 rounded-xl transition-all duration-500"
                            style={{ height: `${pct}%` }}
                          />
                        </div>
                        <p className="font-bold text-blue-900 mt-2">{sp.periode}</p>
                        <p className="text-lg font-bold text-blue-900">{sp.moyenne ?? '—'}</p>
                        <p className="text-xs text-slate-400">{sp.evalues} élèves</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Stats par classe */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-bold text-blue-900">Détail par classe · {periode}</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Classe</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Niveau</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Évalués</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">N.É.</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Moyenne</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Min</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Max</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Distribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {statsClasses.map(s => {
                    const maxMoy = Math.max(...statsClasses.map(sc => sc.moyenne || 0))
                    const pct = maxMoy > 0 && s.moyenne ? Math.round(s.moyenne / maxMoy * 100) : 0
                    return (
                      <tr key={s.classe} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 font-bold text-blue-900">{s.classe}</td>
                        <td className="px-6 py-4 text-slate-500">{s.niveau}</td>
                        <td className="px-6 py-4 text-center text-slate-600">{s.evalues}</td>
                        <td className="px-6 py-4 text-center">
                          {s.ne > 0 ? (
                            <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded-full">{s.ne}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-blue-900">
                          {s.moyenne !== null ? `${s.moyenne}` : '—'}
                        </td>
                        <td className="px-6 py-4 text-center text-slate-500">{s.min ?? '—'}</td>
                        <td className="px-6 py-4 text-center text-slate-500">{s.max ?? '—'}</td>
                        <td className="px-6 py-4">
                          <div className="w-full bg-slate-100 rounded-full h-2">
                            <div className="bg-blue-900 h-2 rounded-full transition-all"
                              style={{ width: `${pct}%` }}/>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}