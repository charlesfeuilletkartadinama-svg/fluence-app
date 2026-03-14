'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

type Eleve = {
  id: string
  nom: string
  prenom: string
  score: string
  ne: boolean
  q1: boolean | null
  q2: boolean | null
  q3: boolean | null
  q4: boolean | null
  q5: boolean | null
  q6: boolean | null
}

type Periode = {
  id: string
  code: string
  label: string
}

type Classe = {
  id: string
  nom: string
  niveau: string
}

function SaisieContent() {
  const [etape, setEtape]       = useState<'periode' | 'saisie' | 'recap' | 'done'>('periode')
  const [periodes, setPeriodes] = useState<Periode[]>([])
  const [periode, setPeriode]   = useState<Periode | null>(null)
  const [classe, setClasse]     = useState<Classe | null>(null)
  const [eleves, setEleves]     = useState<Eleve[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [userId, setUserId]     = useState<string>('')
  const router      = useRouter()
  const searchParams = useSearchParams()
  const classeId    = searchParams.get('classe')
  const supabase    = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUserId(user.id)
      chargerDonnees()
    })
  }, [])

  async function chargerDonnees() {
    // Charger la classe
    if (classeId) {
      const { data: classeData } = await supabase
        .from('classes')
        .select('id, nom, niveau, etablissement_id')
        .eq('id', classeId)
        .single()
      setClasse(classeData)

      // Charger les périodes de cet établissement
      if (classeData) {
        const { data: periodesData } = await supabase
          .from('periodes')
          .select('id, code, label')
          .eq('etablissement_id', classeData.etablissement_id)
          .eq('actif', true)
          .order('code')
        setPeriodes(periodesData || [])
      }
    }

    // Charger les élèves
    if (classeId) {
      const { data: elevesData } = await supabase
        .from('eleves')
        .select('id, nom, prenom')
        .eq('classe_id', classeId)
        .eq('actif', true)
        .order('nom')

      setEleves((elevesData || []).map(e => ({
        ...e,
        score: '',
        ne: false,
        q1: null, q2: null, q3: null,
        q4: null, q5: null, q6: null,
      })))
    }

    setLoading(false)
  }

  function updateEleve(idx: number, champ: string, valeur: any) {
    setEleves(prev => prev.map((e, i) =>
      i === idx ? { ...e, [champ]: valeur } : e
    ))
  }

  function toggleQ(idx: number, q: string) {
    const cur = (eleves[idx] as any)[q]
    updateEleve(idx, q, cur === null ? true : cur === true ? false : null)
  }

  const nbSaisis = eleves.filter(e => e.ne || (e.score !== '' && !isNaN(Number(e.score)))).length
  const scoreMoyen = (() => {
    const scores = eleves.filter(e => !e.ne && e.score !== '' && !isNaN(Number(e.score))).map(e => Number(e.score))
    return scores.length > 0 ? Math.round(scores.reduce((a,b) => a+b, 0) / scores.length) : null
  })()

  async function valider() {
    setSaving(true)
    let ok = 0, err = 0

    for (const eleve of eleves) {
      if (!eleve.ne && eleve.score === '') continue
      if (!periode) continue

      const { error } = await supabase.from('passations').upsert({
        eleve_id:      eleve.id,
        periode_id:    periode.id,
        score:         eleve.ne ? null : Number(eleve.score),
        non_evalue:    eleve.ne,
        mode:          'saisie',
        enseignant_id: userId,
        q1: eleve.q1 === true ? 'Correct' : eleve.q1 === false ? 'Incorrect' : null,
        q2: eleve.q2 === true ? 'Correct' : eleve.q2 === false ? 'Incorrect' : null,
        q3: eleve.q3 === true ? 'Correct' : eleve.q3 === false ? 'Incorrect' : null,
        q4: eleve.q4 === true ? 'Correct' : eleve.q4 === false ? 'Incorrect' : null,
        q5: eleve.q5 === true ? 'Correct' : eleve.q5 === false ? 'Incorrect' : null,
        q6: eleve.q6 === true ? 'Correct' : eleve.q6 === false ? 'Incorrect' : null,
      }, { onConflict: 'eleve_id,periode_id,hors_periode' })

      if (error) err++
      else ok++
    }

    setSaving(false)
    setEtape('done')
  }

  if (loading) return <div className="ml-64 p-8 text-slate-400">Chargement...</div>

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
          <a href="/dashboard/saisie" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-800 text-white text-sm font-medium">
            ✏️ Saisie des scores
          </a>
        </nav>

        {classe && (
          <div className="mt-6 bg-blue-800 rounded-xl p-4">
            <p className="text-xs text-blue-300 mb-1">Classe en cours</p>
            <p className="font-bold text-white">{classe.nom}</p>
            <p className="text-blue-300 text-xs">{classe.niveau}</p>
            {periode && (
              <span className="mt-2 inline-block bg-blue-700 text-white text-xs px-2 py-1 rounded-full">
                {periode.code}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="ml-64 p-8 max-w-4xl">

        {/* ÉTAPE 1 : Choix de la période */}
        {etape === 'periode' && (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-blue-900">Saisie des scores</h2>
              <p className="text-slate-500 mt-1">
                {classe ? `Classe : ${classe.nom}` : 'Choisissez d\'abord une classe'}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-100 mb-6">
              <h3 className="font-bold text-blue-900 mb-4">Quelle période ?</h3>
              <div className="grid grid-cols-2 gap-3">
                {periodes.map(p => (
                  <button key={p.id}
                    onClick={() => { setPeriode(p); setEtape('saisie') }}
                    className="border-2 border-slate-200 hover:border-blue-600 rounded-xl p-4 text-left transition">
                    <div className="font-bold text-blue-900 text-lg">{p.code}</div>
                    <div className="text-slate-500 text-sm">{p.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ÉTAPE 2 : Saisie */}
        {etape === 'saisie' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-blue-900">
                  {classe?.nom} · {periode?.code}
                </h2>
                <p className="text-slate-500 mt-1">
                  {nbSaisis} / {eleves.length} élèves saisis
                </p>
              </div>
              <button onClick={() => setEtape('recap')}
                disabled={nbSaisis === 0}
                className="bg-blue-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-800 transition disabled:opacity-40">
                Valider →
              </button>
            </div>

            <div className="space-y-3">
              {eleves.map((eleve, idx) => (
                <div key={eleve.id}
                  className={`bg-white rounded-2xl border p-5 transition
                    ${eleve.ne ? 'border-orange-200 bg-orange-50' :
                      eleve.score !== '' ? 'border-green-200' : 'border-slate-100'}`}>
                  <div className="flex items-center gap-4">
                    {/* Nom */}
                    <div className="flex-1">
                      <span className="font-bold text-blue-900">{eleve.nom}</span>
                      <span className="text-slate-500 ml-2">{eleve.prenom}</span>
                    </div>

                    {/* Score */}
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={eleve.score}
                        onChange={e => updateEleve(idx, 'score', e.target.value)}
                        disabled={eleve.ne}
                        placeholder="—"
                        min={0} max={500}
                        className="w-24 text-center border border-slate-200 rounded-xl px-3 py-2 text-lg font-bold text-blue-900 outline-none focus:border-blue-600 transition disabled:opacity-30 disabled:bg-slate-50"
                      />
                      <span className="text-slate-400 text-xs">mots/min</span>
                    </div>

                    {/* N.É. */}
                    <button
                      onClick={() => updateEleve(idx, 'ne', !eleve.ne)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition
                        ${eleve.ne ? 'border-orange-400 bg-orange-100 text-orange-700' : 'border-slate-200 text-slate-400 hover:border-orange-300'}`}>
                      N.É.
                    </button>
                  </div>

                  {/* Questions compréhension */}
                  {!eleve.ne && eleve.score !== '' && (
                    <div className="mt-4 flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-400 font-medium mr-1">Compréhension :</span>
                      {(['q1','q2','q3','q4','q5','q6'] as const).map(q => (
                        <button key={q}
                          onClick={() => toggleQ(idx, q)}
                          className={`w-10 h-10 rounded-xl text-xs font-bold border-2 transition
                            ${(eleve as any)[q] === true  ? 'border-green-400 bg-green-100 text-green-700' :
                              (eleve as any)[q] === false ? 'border-red-400 bg-red-100 text-red-700' :
                              'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                          {q.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={() => setEtape('recap')}
                disabled={nbSaisis === 0}
                className="bg-blue-900 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-800 transition disabled:opacity-40">
                Voir le récapitulatif →
              </button>
            </div>
          </>
        )}

        {/* ÉTAPE 3 : Récap */}
        {etape === 'recap' && (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-blue-900">Récapitulatif</h2>
              <p className="text-slate-500 mt-1">{classe?.nom} · {periode?.code}</p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-2xl p-5 border border-slate-100 text-center">
                <p className="text-3xl font-bold text-blue-900">{nbSaisis}</p>
                <p className="text-sm text-slate-400 mt-1">Élèves saisis</p>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-slate-100 text-center">
                <p className="text-3xl font-bold text-blue-900">
                  {scoreMoyen !== null ? `${scoreMoyen}` : '—'}
                </p>
                <p className="text-sm text-slate-400 mt-1">Score moyen</p>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-slate-100 text-center">
                <p className="text-3xl font-bold text-orange-500">
                  {eleves.filter(e => e.ne).length}
                </p>
                <p className="text-sm text-slate-400 mt-1">Non évalués</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">ÉLÈVE</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500">SCORE</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500">STATUT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {eleves.filter(e => e.ne || e.score !== '').map(e => (
                    <tr key={e.id}>
                      <td className="px-5 py-3 font-semibold text-blue-900">
                        {e.nom} {e.prenom}
                      </td>
                      <td className="px-5 py-3 text-center font-bold text-blue-900">
                        {e.ne ? '—' : `${e.score} m/min`}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {e.ne ? (
                          <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded-full">N.É.</span>
                        ) : (
                          <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">✓</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setEtape('saisie')}
                className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl font-semibold text-sm hover:bg-slate-50 transition">
                ← Modifier
              </button>
              <button onClick={valider} disabled={saving}
                className="flex-1 bg-blue-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-800 transition disabled:opacity-50">
                {saving ? 'Enregistrement...' : '✅ Confirmer et envoyer'}
              </button>
            </div>
          </>
        )}

        {/* ÉTAPE 4 : Terminé */}
        {etape === 'done' && (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-2xl font-bold text-blue-900 mb-2">Scores enregistrés !</h3>
            <p className="text-slate-400 mb-8">
              {nbSaisis} élèves · Score moyen : {scoreMoyen !== null ? `${scoreMoyen} mots/min` : '—'}
            </p>
            <div className="flex gap-4 justify-center">
              <button onClick={() => router.push('/dashboard/eleves')}
                className="border border-slate-200 text-slate-600 px-6 py-3 rounded-xl font-semibold text-sm hover:bg-slate-50 transition">
                Voir mes classes
              </button>
              <button onClick={() => { setEtape('periode'); setEleves(prev => prev.map(e => ({ ...e, score: '', ne: false, q1: null, q2: null, q3: null, q4: null, q5: null, q6: null }))) }}
                className="bg-blue-900 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-blue-800 transition">
                Nouvelle saisie
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Saisie() {
  return (
    <Suspense fallback={<div className="ml-64 p-8 text-slate-400">Chargement...</div>}>
      <SaisieContent />
    </Suspense>
  )
}