'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

type Eleve = {
  id: string
  nom: string
  prenom: string
  scoreActuel: number | null
  ne: boolean
  nbErreurs: number
  dernierMot: number | null
  q1: boolean | null
  q2: boolean | null
  q3: boolean | null
  q4: boolean | null
  q5: boolean | null
  q6: boolean | null
  fait: boolean
}

type Periode = { id: string; code: string; label: string }
type Classe  = { id: string; nom: string; niveau: string; etablissement_id: string }

function PassationContent() {
  const [etape, setEtape]       = useState<'periode'|'liste'|'eleve'|'done'>('periode')
  const [periodes, setPeriodes] = useState<Periode[]>([])
  const [periode, setPeriode]   = useState<Periode | null>(null)
  const [classe, setClasse]     = useState<Classe | null>(null)
  const [eleves, setEleves]     = useState<Eleve[]>([])
  const [eleveIdx, setEleveIdx] = useState(0)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)

  // Chrono
  const [chronoActif, setChronoActif]   = useState(false)
  const [secondes, setSecondes]         = useState(60)
  const [tempsEcoule, setTempsEcoule]   = useState(0)
  const [chronoTermine, setChronoTermine] = useState(false)
  const [nbErreurs, setNbErreurs]       = useState(0)
  const [dernierMot, setDernierMot]     = useState('')
  const [qs, setQs]                     = useState<(boolean|null)[]>(Array(6).fill(null))
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const { profil } = useProfil()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const classeId     = searchParams.get('classe')
  const supabase     = createClient()

  useEffect(() => {
    if (classeId) chargerDonnees()
  }, [classeId])

  // Nettoyage chrono
  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  async function chargerDonnees() {
    const { data: classeData } = await supabase
      .from('classes').select('id, nom, niveau, etablissement_id')
      .eq('id', classeId!).single()
    setClasse(classeData)

    const { data: periodesData } = await supabase
      .from('periodes').select('id, code, label')
      .eq('etablissement_id', classeData.etablissement_id)
      .eq('actif', true).order('code')
    setPeriodes(periodesData || [])

    const { data: elevesData } = await supabase
      .from('eleves').select('id, nom, prenom')
      .eq('classe_id', classeId!).eq('actif', true).order('nom')

    setEleves((elevesData || []).map(e => ({
      ...e, scoreActuel: null, ne: false, nbErreurs: 0,
      dernierMot: null, fait: false,
      q1:null, q2:null, q3:null, q4:null, q5:null, q6:null
    })))
    setLoading(false)
  }

  function demarrerChrono() {
    setChronoActif(true)
    setSecondes(60)
    setTempsEcoule(0)
    setNbErreurs(0)
    setChronoTermine(false)
    setDernierMot('')
    setQs(Array(6).fill(null))

    intervalRef.current = setInterval(() => {
      setSecondes(s => {
        if (s <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          setChronoActif(false)
          setChronoTermine(true)
          setTempsEcoule(60)
          return 0
        }
        setTempsEcoule(60 - s + 1)
        return s - 1
      })
    }, 1000)
  }

  function arreterChrono() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setChronoActif(false)
    setTempsEcoule(60 - secondes)
    setChronoTermine(true)
  }

  function resetChrono() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setChronoActif(false)
    setSecondes(60)
    setTempsEcoule(0)
    setChronoTermine(false)
    setNbErreurs(0)
    setDernierMot('')
    setQs(Array(6).fill(null))
  }

  function calculerScore(): number | null {
    const mot = parseInt(dernierMot)
    if (!mot || mot <= 0) return null
    const mots = mot - nbErreurs
    const temps = tempsEcoule > 0 ? tempsEcoule : 60
    return Math.max(0, Math.round(mots / temps * 60))
  }

  function toggleQ(i: number) {
    setQs(prev => {
      const n = [...prev]
      n[i] = n[i] === null ? true : n[i] === true ? false : null
      return n
    })
  }

  function validerEleve(ne: boolean = false) {
    const score = ne ? null : calculerScore()
    setEleves(prev => prev.map((e, i) =>
      i === eleveIdx ? {
        ...e, fait: true, ne,
        scoreActuel: score,
        nbErreurs,
        dernierMot: parseInt(dernierMot) || null,
        q1: qs[0], q2: qs[1], q3: qs[2],
        q4: qs[3], q5: qs[4], q6: qs[5],
      } : e
    ))
    resetChrono()

    // Passer au suivant automatiquement
    const prochain = eleves.findIndex((e, i) => i > eleveIdx && !e.fait)
    if (prochain >= 0) {
      setEleveIdx(prochain)
    } else {
      setEtape('liste')
    }
  }

  async function enregistrerTout() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !periode) return

    for (const eleve of eleves) {
      if (!eleve.fait) continue
      await supabase.from('passations').upsert({
        eleve_id:      eleve.id,
        periode_id:    periode.id,
        score:         eleve.ne ? null : eleve.scoreActuel,
        non_evalue:    eleve.ne,
        mode:          'passation',
        enseignant_id: user.id,
        q1: eleve.q1 === true ? 'Correct' : eleve.q1 === false ? 'Incorrect' : null,
        q2: eleve.q2 === true ? 'Correct' : eleve.q2 === false ? 'Incorrect' : null,
        q3: eleve.q3 === true ? 'Correct' : eleve.q3 === false ? 'Incorrect' : null,
        q4: eleve.q4 === true ? 'Correct' : eleve.q4 === false ? 'Incorrect' : null,
        q5: eleve.q5 === true ? 'Correct' : eleve.q5 === false ? 'Incorrect' : null,
        q6: eleve.q6 === true ? 'Correct' : eleve.q6 === false ? 'Incorrect' : null,
      }, { onConflict: 'eleve_id,periode_id,hors_periode' })
    }
    setSaving(false)
    setEtape('done')
  }

  const eleve = eleves[eleveIdx]
  const nbFaits = eleves.filter(e => e.fait).length
  const scoreCalc = calculerScore()

  const chronoCouleur = secondes <= 10 ? '#ef4444'
    : secondes <= 20 ? '#f97316' : '#ffffff'

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-400">Chargement...</div>

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
          <a href="/dashboard/eleves" className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 text-sm font-medium transition">
            👥 Mes élèves
          </a>
          <a href="/dashboard/passation" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-800 text-white text-sm font-medium">
            ⏱️ Mode passation
          </a>
        </nav>
        {classe && (
          <div className="mt-6 bg-blue-800 rounded-xl p-4">
            <p className="text-xs text-blue-300 mb-1">Classe</p>
            <p className="font-bold text-white">{classe.nom}</p>
            {periode && <p className="text-blue-300 text-xs mt-1">Période {periode.code}</p>}
            {etape !== 'periode' && (
              <p className="text-blue-300 text-xs mt-2">{nbFaits}/{eleves.length} élèves</p>
            )}
          </div>
        )}
      </div>

      <div className="ml-64">

        {/* ── Choix période ── */}
        {etape === 'periode' && (
          <div className="p-8 max-w-2xl">
            <h2 className="text-2xl font-bold text-blue-900 mb-2">Mode passation</h2>
            <p className="text-slate-500 mb-8">Classe : {classe?.nom}</p>
            <div className="bg-white rounded-2xl p-6 border border-slate-100">
              <h3 className="font-bold text-blue-900 mb-4">Quelle période ?</h3>
              <div className="grid grid-cols-2 gap-3">
                {periodes.map(p => (
                  <button key={p.id}
                    onClick={() => { setPeriode(p); setEtape('liste') }}
                    className="border-2 border-slate-200 hover:border-blue-600 rounded-xl p-4 text-left transition">
                    <div className="font-bold text-blue-900 text-lg">{p.code}</div>
                    <div className="text-slate-500 text-sm">{p.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Liste élèves ── */}
        {etape === 'liste' && (
          <div className="p-8 max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-blue-900">{classe?.nom} · {periode?.code}</h2>
                <p className="text-slate-500 mt-1">{nbFaits} / {eleves.length} élèves passés</p>
              </div>
              {nbFaits > 0 && (
                <button onClick={enregistrerTout} disabled={saving}
                  className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50">
                  {saving ? 'Enregistrement...' : '✅ Enregistrer tout'}
                </button>
              )}
            </div>

            {/* Barre de progression */}
            <div className="w-full bg-slate-100 rounded-full h-2 mb-6">
              <div className="bg-blue-900 h-2 rounded-full transition-all"
                style={{ width: `${eleves.length > 0 ? nbFaits/eleves.length*100 : 0}%` }}/>
            </div>

            <div className="space-y-2">
              {eleves.map((e, i) => (
                <div key={e.id}
                  className={`bg-white rounded-xl p-4 border flex items-center justify-between transition
                    ${e.fait ? 'border-green-200 bg-green-50' : 
                      i === eleveIdx ? 'border-blue-400 shadow-md' : 'border-slate-100'}`}>
                  <div>
                    <span className="font-bold text-blue-900">{e.nom}</span>
                    <span className="text-slate-500 ml-2">{e.prenom}</span>
                    {e.fait && (
                      <span className="ml-3 text-xs font-bold text-green-700">
                        {e.ne ? 'N.É.' : `${e.scoreActuel} m/min`}
                      </span>
                    )}
                  </div>
                  {!e.fait ? (
                    <button
                      onClick={() => { setEleveIdx(i); setEtape('eleve') }}
                      className="bg-blue-900 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-800 transition">
                      Commencer →
                    </button>
                  ) : (
                    <span className="text-green-600 text-lg">✅</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Écran passation élève ── */}
        {etape === 'eleve' && eleve && (
          <div className="min-h-screen bg-blue-900 flex flex-col">
            {/* Top bar */}
            <div className="flex items-center justify-between px-6 py-4 bg-black/20">
              <span className="text-blue-300 text-sm font-semibold">
                Élève {eleveIdx + 1} / {eleves.length}
              </span>
              <button onClick={() => setEtape('liste')}
                className="bg-white/20 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-white/30 transition">
                ✕ Fermer
              </button>
            </div>

            {/* Nom élève */}
            <div className="text-center pt-8 pb-4 px-6">
              <h2 className="text-4xl font-black text-white tracking-wide">{eleve.nom}</h2>
              <p className="text-blue-300 text-xl mt-1">{eleve.prenom}</p>
            </div>

            {/* Chrono */}
            <div className="text-center py-4">
              <div className="text-8xl font-black transition-colors duration-300"
                style={{ color: chronoCouleur, fontVariantNumeric: 'tabular-nums' }}>
                {Math.floor(secondes/60)}:{String(secondes%60).padStart(2,'0')}
              </div>
              <p className="text-blue-400 text-sm mt-2">
                {chronoActif ? 'En cours...' : chronoTermine ? 'Temps écoulé !' : 'Prêt'}
              </p>
            </div>

            {/* Boutons chrono */}
            <div className="flex gap-3 px-6 justify-center mb-4">
              {!chronoActif && !chronoTermine && (
                <button onClick={demarrerChrono}
                  className="flex-1 max-w-xs bg-green-500 text-white py-4 rounded-2xl text-lg font-bold hover:bg-green-400 transition">
                  ▶ Démarrer
                </button>
              )}
              {chronoActif && (
                <button onClick={arreterChrono}
                  className="flex-1 max-w-xs bg-orange-500 text-white py-4 rounded-2xl text-lg font-bold hover:bg-orange-400 transition">
                  ⏹ Arrêter
                </button>
              )}
              {(chronoActif || chronoTermine) && (
                <button onClick={resetChrono}
                  className="bg-white/20 text-white px-6 py-4 rounded-2xl text-lg font-bold hover:bg-white/30 transition">
                  ↺
                </button>
              )}
            </div>

            {/* Bouton erreur */}
            {chronoActif && (
              <div className="px-6 mb-4">
                <button onClick={() => setNbErreurs(n => n+1)}
                  className="w-full bg-red-500 text-white py-5 rounded-2xl text-xl font-black hover:bg-red-400 active:scale-95 transition shadow-lg shadow-red-900/40">
                  ✗ Erreur de lecture
                  {nbErreurs > 0 && <span className="ml-3 text-base">({nbErreurs})</span>}
                </button>
              </div>
            )}

            {/* Saisie après chrono */}
            {chronoTermine && (
              <div className="px-6 mb-4 space-y-3">
                <div className="bg-white/10 rounded-2xl p-4">
                  <label className="text-blue-300 text-sm font-semibold block mb-2">
                    N° du dernier mot lu :
                  </label>
                  <input
                    type="number"
                    value={dernierMot}
                    onChange={e => setDernierMot(e.target.value)}
                    placeholder="ex: 87"
                    className="w-full bg-white/20 text-white text-3xl font-bold text-center rounded-xl py-3 outline-none placeholder:text-blue-400 border border-white/20 focus:border-white/60"
                    autoFocus
                  />
                  {nbErreurs > 0 && (
                    <p className="text-blue-300 text-xs mt-2 text-center">
                      {nbErreurs} erreur{nbErreurs > 1 ? 's' : ''} comptabilisée{nbErreurs > 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {scoreCalc !== null && (
                  <div className="bg-green-500/20 border border-green-400/30 rounded-2xl p-4 text-center">
                    <p className="text-green-300 text-sm font-semibold mb-1">Score calculé</p>
                    <p className="text-white text-5xl font-black">{scoreCalc}</p>
                    <p className="text-green-300 text-sm mt-1">mots / minute</p>
                    <p className="text-blue-400 text-xs mt-1">
                      {parseInt(dernierMot)} mots − {nbErreurs} erreurs = {parseInt(dernierMot)-nbErreurs} corrects / {tempsEcoule}s
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Questions compréhension */}
            {chronoTermine && scoreCalc !== null && (
              <div className="px-6 mb-4">
                <p className="text-blue-300 text-sm font-semibold mb-3">Questions de compréhension :</p>
                <div className="grid grid-cols-6 gap-2">
                  {qs.map((q, i) => (
                    <button key={i} onClick={() => toggleQ(i)}
                      className={`py-3 rounded-xl font-bold text-sm transition
                        ${q === true  ? 'bg-green-500 text-white' :
                          q === false ? 'bg-red-500 text-white' :
                          'bg-white/20 text-white hover:bg-white/30'}`}>
                      Q{i+1}<br/>
                      <span className="text-lg">{q === true ? '✅' : q === false ? '❌' : '○'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Boutons valider */}
            <div className="px-6 pb-6 mt-auto flex gap-3">
              <button onClick={() => validerEleve(true)}
                className="flex-1 border-2 border-orange-400 text-orange-300 py-4 rounded-2xl font-bold hover:bg-orange-400/20 transition">
                Non évalué
              </button>
              {scoreCalc !== null && (
                <button onClick={() => validerEleve(false)}
                  className="flex-2 bg-white text-blue-900 py-4 px-8 rounded-2xl font-black text-lg hover:bg-blue-50 transition">
                  Valider → Suivant
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Terminé ── */}
        {etape === 'done' && (
          <div className="p-8 max-w-xl">
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
              <div className="text-5xl mb-4">🎉</div>
              <h3 className="text-2xl font-bold text-blue-900 mb-2">Passation terminée !</h3>
              <p className="text-slate-400 mb-2">{nbFaits} élèves enregistrés</p>
              <p className="text-slate-400 text-sm mb-8">
                Score moyen : {(() => {
                  const scores = eleves.filter(e => e.fait && !e.ne && e.scoreActuel).map(e => e.scoreActuel!)
                  return scores.length > 0 ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) + ' m/min' : '—'
                })()}
              </p>
              <div className="flex gap-3">
                <button onClick={() => router.push('/dashboard/eleves')}
                  className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl font-semibold text-sm hover:bg-slate-50 transition">
                  Mes classes
                </button>
                <button onClick={() => router.push('/dashboard/statistiques')}
                  className="flex-1 bg-blue-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-800 transition">
                  Voir les stats →
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default function Passation() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-slate-400">Chargement...</div>}>
      <PassationContent />
    </Suspense>
  )
}