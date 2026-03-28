'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'

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
    if (classeId) chargerDonnees().catch(() => setLoading(false))
    else setLoading(false)
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
      .eq('etablissement_id', (classeData as any).etablissement_id)
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
    if (intervalRef.current) clearInterval(intervalRef.current)
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
    if (!profil || !periode) { setSaving(false); return }

    for (const eleve of eleves) {
      if (!eleve.fait) continue
      await supabase.from('passations').upsert({
        eleve_id:      eleve.id,
        periode_id:    periode.id,
        score:         eleve.ne ? null : eleve.scoreActuel,
        non_evalue:    eleve.ne,
        mode:          'passation',
        enseignant_id: profil.id,
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

  if (loading) return (
    <>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar-width)', padding: 32 }} className="text-slate-400">Chargement...</div>
    </>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <ImpersonationBar />

      <div style={{ marginLeft: 'var(--sidebar-width)' }}>

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
          <div style={{ minHeight: '100vh', background: 'var(--primary-dark)', display: 'flex', flexDirection: 'column' }}>

            {/* Top bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <button onClick={() => setEtape('liste')}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontFamily: 'var(--font-sans)', cursor: 'pointer', fontWeight: 600 }}>
                ← Retour à la liste
              </button>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                Élève {eleveIdx + 1} / {eleves.length}
              </span>
            </div>

            {/* Nom élève */}
            <div style={{ textAlign: 'center', padding: '32px 24px 16px' }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'var(--font-sans)', marginBottom: 8 }}>Lecture en cours</div>
              <h2 style={{ fontSize: 40, fontWeight: 900, color: 'white', margin: 0, fontFamily: 'var(--font-sans)', letterSpacing: -1 }}>{eleve.nom}</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 20, marginTop: 4, fontFamily: 'var(--font-sans)' }}>{eleve.prenom}</p>
            </div>

            {/* Chrono */}
            <div style={{ textAlign: 'center', padding: '8px 24px 16px' }}>
              <div style={{ fontSize: 96, fontWeight: 900, color: chronoCouleur, fontVariantNumeric: 'tabular-nums', lineHeight: 1, transition: 'color 0.3s', fontFamily: 'var(--font-sans)' }}>
                {Math.floor(secondes/60)}:{String(secondes%60).padStart(2,'0')}
              </div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 8, fontFamily: 'var(--font-sans)' }}>
                {chronoActif ? 'Chronomètre en cours' : chronoTermine ? 'Temps écoulé' : 'Prêt à démarrer'}
              </p>
            </div>

            {/* Boutons chrono */}
            <div style={{ display: 'flex', gap: 12, padding: '0 28px 16px', justifyContent: 'center' }}>
              {!chronoActif && !chronoTermine && (
                <button onClick={demarrerChrono}
                  style={{ flex: 1, maxWidth: 320, background: '#22c55e', color: 'white', border: 'none', padding: '16px', borderRadius: 16, fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer', letterSpacing: 0.5 }}>
                  ▶ Démarrer les 60 secondes
                </button>
              )}
              {chronoActif && (
                <button onClick={arreterChrono}
                  style={{ flex: 1, maxWidth: 320, background: '#f97316', color: 'white', border: 'none', padding: '16px', borderRadius: 16, fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                  ⏹ Arrêter
                </button>
              )}
              {(chronoActif || chronoTermine) && (
                <button onClick={resetChrono}
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: 'none', padding: '16px 20px', borderRadius: 16, fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>
                  ↺
                </button>
              )}
            </div>

            {/* Bouton erreur — grand bouton tactile */}
            {chronoActif && (
              <div style={{ padding: '0 28px 16px' }}>
                <button onClick={() => setNbErreurs(n => n+1)}
                  style={{ width: '100%', background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.4)', color: '#fca5a5', padding: '20px', borderRadius: 16, fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-sans)', cursor: 'pointer', letterSpacing: 0.3 }}>
                  ✗ Erreur de lecture {nbErreurs > 0 && <span style={{ fontSize: 15, opacity: 0.8 }}>({nbErreurs})</span>}
                </button>
              </div>
            )}

            {/* Saisie après chrono */}
            {chronoTermine && (
              <div style={{ padding: '0 28px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
                  <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 10, fontFamily: 'var(--font-sans)' }}>
                    N° du dernier mot lu
                  </label>
                  <input
                    type="number"
                    value={dernierMot}
                    onChange={e => setDernierMot(e.target.value)}
                    placeholder="ex: 87"
                    autoFocus
                    style={{ width: '100%', background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.2)', color: 'white', fontSize: 32, fontWeight: 700, textAlign: 'center', borderRadius: 12, padding: '12px', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }}
                  />
                  {nbErreurs > 0 && (
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 8, textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
                      {nbErreurs} erreur{nbErreurs > 1 ? 's' : ''} comptabilisée{nbErreurs > 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {scoreCalc !== null && (
                  <div style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.25)', borderRadius: 16, padding: 20, textAlign: 'center' }}>
                    <p style={{ color: '#86efac', fontSize: 13, fontWeight: 600, marginBottom: 4, fontFamily: 'var(--font-sans)' }}>Score calculé</p>
                    <p style={{ color: 'white', fontSize: 52, fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-sans)' }}>{scoreCalc}</p>
                    <p style={{ color: '#86efac', fontSize: 14, marginTop: 4, fontFamily: 'var(--font-sans)' }}>mots / minute</p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 6, fontFamily: 'var(--font-sans)' }}>
                      {parseInt(dernierMot)} mots − {nbErreurs} erreurs = {parseInt(dernierMot)-nbErreurs} corrects · {tempsEcoule}s
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Questions compréhension */}
            {chronoTermine && scoreCalc !== null && (
              <div style={{ padding: '0 28px 16px' }}>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, marginBottom: 10, fontFamily: 'var(--font-sans)' }}>Questions de compréhension</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
                  {qs.map((q, i) => (
                    <button key={i} onClick={() => toggleQ(i)}
                      style={{
                        padding: '12px 4px', borderRadius: 12, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        background: q === true ? '#22c55e' : q === false ? '#ef4444' : 'rgba(255,255,255,0.1)',
                        color: q === null ? 'rgba(255,255,255,0.6)' : 'white',
                      }}>
                      Q{i+1}
                      <div style={{ fontSize: 16, marginTop: 2 }}>{q === true ? '✓' : q === false ? '✗' : '·'}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Boutons valider */}
            <div style={{ padding: '16px 28px 28px', marginTop: 'auto', display: 'flex', gap: 12 }}>
              <button onClick={() => validerEleve(true)}
                style={{ flex: 1, border: '2px solid rgba(251,146,60,0.5)', background: 'rgba(251,146,60,0.08)', color: '#fdba74', padding: '16px', borderRadius: 16, fontWeight: 700, fontSize: 15, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                Non évalué
              </button>
              {scoreCalc !== null && (
                <button onClick={() => validerEleve(false)}
                  style={{ flex: 2, background: 'white', color: 'var(--primary-dark)', border: 'none', padding: '16px 24px', borderRadius: 16, fontWeight: 800, fontSize: 17, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                  Valider · Élève suivant →
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