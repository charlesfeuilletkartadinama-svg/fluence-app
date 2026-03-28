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
  absent: boolean
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
  const [etape, setEtape]           = useState<'classe'|'periode'|'liste'|'eleve'|'done'>('periode')
  const [periodes, setPeriodes]     = useState<Periode[]>([])
  const [periode, setPeriode]       = useState<Periode | null>(null)
  const [classe, setClasse]         = useState<Classe | null>(null)
  const [classesEtab, setClassesEtab] = useState<Classe[]>([])
  const [eleves, setEleves]         = useState<Eleve[]>([])
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

  useEffect(() => {
    if (!profil || classeId) return
    if (profil.role === 'enseignant') chargerClassesEnseignant()
  }, [profil])

  // Nettoyage chrono
  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  async function chargerClassesEnseignant() {
    if (!profil) return
    const { data } = await supabase
      .from('enseignant_classes')
      .select('classe:classes(id, nom, niveau, etablissement_id)')
      .eq('enseignant_id', profil.id)
    const classes = (data || []).map((r: any) => r.classe).filter(Boolean) as Classe[]
    if (classes.length === 0) { setLoading(false); return }
    if (classes.length === 1) {
      await selectionnerClasse(classes[0])
    } else {
      setClassesEtab(classes)
      setEtape('classe')
      setLoading(false)
    }
  }

  async function selectionnerClasse(c: Classe) {
    setClasse(c)
    setLoading(true)
    const { data: periodesData } = await supabase
      .from('periodes').select('id, code, label')
      .eq('etablissement_id', c.etablissement_id).eq('actif', true).order('code')
    setPeriodes(periodesData || [])
    const { data: elevesData } = await supabase
      .from('eleves').select('id, nom, prenom')
      .eq('classe_id', c.id).eq('actif', true).order('nom')
    setEleves((elevesData || []).map(e => ({
      ...e, scoreActuel: null, ne: false, absent: false, nbErreurs: 0,
      dernierMot: null, fait: false,
      q1: null, q2: null, q3: null, q4: null, q5: null, q6: null,
    })))
    setLoading(false)
    setEtape('periode')
  }

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
      ...e, scoreActuel: null, ne: false, absent: false, nbErreurs: 0,
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

  function validerEleve(ne: boolean = false, absent: boolean = false) {
    const score = ne ? null : calculerScore()
    setEleves(prev => prev.map((e, i) =>
      i === eleveIdx ? {
        ...e, fait: true, ne, absent,
        scoreActuel: score,
        nbErreurs,
        dernierMot: parseInt(dernierMot) || null,
        q1: qs[0], q2: qs[1], q3: qs[2],
        q4: qs[3], q5: qs[4], q6: qs[5],
      } : e
    ))
    resetChrono()

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
        absent:        eleve.absent,
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

        {/* ── Choix classe ── */}
        {etape === 'classe' && (
          <div style={{ padding: 32, maxWidth: 640 }}>
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>Mode passation</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 15, fontFamily: 'var(--font-sans)' }}>Choisissez une classe</p>
            </div>
            <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1.5px solid var(--border-light)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {classesEtab.map(c => (
                  <button key={c.id} onClick={() => selectionnerClasse(c)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      border: '1.5px solid var(--border-light)', borderRadius: 12, padding: '16px 20px',
                      background: 'var(--bg-gray)', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                      fontFamily: 'var(--font-sans)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-dark)'; (e.currentTarget as HTMLElement).style.background = 'white' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-gray)' }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--primary-dark)' }}>{c.nom}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>{c.niveau}</div>
                    </div>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 18 }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Choix période ── */}
        {etape === 'periode' && (
          <div style={{ padding: 32, maxWidth: 640 }}>
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>Mode passation</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 15, fontFamily: 'var(--font-sans)' }}>Classe · {classe?.nom}</p>
            </div>
            <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1.5px solid var(--border-light)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>Choisir une période</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {periodes.map(p => (
                  <button key={p.id}
                    onClick={() => { setPeriode(p); setEtape('liste') }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      border: '1.5px solid var(--border-light)', borderRadius: 12, padding: '16px 20px',
                      background: 'var(--bg-gray)', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                      fontFamily: 'var(--font-sans)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-dark)'; (e.currentTarget as HTMLElement).style.background = 'white' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-gray)' }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--primary-dark)' }}>{p.code}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>{p.label}</div>
                    </div>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 18 }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Liste élèves ── */}
        {etape === 'liste' && (
          <div style={{ padding: 32, maxWidth: 640 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>{classe?.nom}</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 14, fontFamily: 'var(--font-sans)' }}>
                  {periode?.code} · {nbFaits} / {eleves.length} élèves passés
                </p>
              </div>
              {nbFaits > 0 && (
                <button onClick={enregistrerTout} disabled={saving}
                  style={{ background: '#16a34a', color: 'white', border: 'none', padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Enregistrement...' : '✓ Enregistrer tout'}
                </button>
              )}
            </div>

            {/* Barre de progression */}
            <div style={{ background: 'var(--border-light)', borderRadius: 99, height: 6, marginBottom: 24 }}>
              <div style={{ background: 'var(--primary-dark)', height: 6, borderRadius: 99, transition: 'width 0.3s', width: `${eleves.length > 0 ? nbFaits/eleves.length*100 : 0}%` }}/>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {eleves.map((e, i) => (
                <div key={e.id} style={{
                  background: e.fait ? '#f0fdf4' : 'white',
                  border: `1.5px solid ${e.fait ? '#bbf7d0' : 'var(--border-light)'}`,
                  borderRadius: 14, padding: '16px 20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)' }}>{e.nom}</span>
                    <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 14, fontFamily: 'var(--font-sans)' }}>{e.prenom}</span>
                    {e.fait && (
                      <span style={{ marginLeft: 12, fontSize: 12, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 6, fontFamily: 'var(--font-sans)' }}>
                        {e.ne ? 'N.É.' : `${e.scoreActuel} m/min`}
                      </span>
                    )}
                  </div>
                  {!e.fait ? (
                    <button
                      onClick={() => { setEleveIdx(i); setEtape('eleve') }}
                      style={{ background: 'var(--primary-dark)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                      Commencer →
                    </button>
                  ) : (
                    <span style={{ color: '#16a34a', fontSize: 18 }}>✓</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Écran passation élève ── */}
        {etape === 'eleve' && eleve && (
          <div style={{ minHeight: '100vh', background: 'white', display: 'flex', flexDirection: 'column' }}>

            {/* Top bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1.5px solid var(--border-light)' }}>
              <button onClick={() => setEtape('liste')}
                style={{ background: 'var(--bg-gray)', border: 'none', color: 'var(--text-secondary)', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontFamily: 'var(--font-sans)', cursor: 'pointer', fontWeight: 600 }}>
                ← Retour à la liste
              </button>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                Élève {eleveIdx + 1} / {eleves.length}
              </span>
            </div>

            {/* Nom élève */}
            <div style={{ textAlign: 'center', padding: '28px 24px 12px' }}>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'var(--font-sans)', marginBottom: 8 }}>Lecture en cours</div>
              <h2 style={{ fontSize: 38, fontWeight: 900, color: 'var(--primary-dark)', margin: 0, fontFamily: 'var(--font-sans)', letterSpacing: -1 }}>{eleve.nom}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 20, marginTop: 4, fontFamily: 'var(--font-sans)' }}>{eleve.prenom}</p>
            </div>

            {/* Chrono */}
            <div style={{ textAlign: 'center', padding: '8px 24px 12px' }}>
              <div style={{
                fontSize: 96, fontWeight: 900, fontVariantNumeric: 'tabular-nums', lineHeight: 1, transition: 'color 0.3s', fontFamily: 'var(--font-sans)',
                color: secondes <= 10 ? '#ef4444' : secondes <= 20 ? '#f97316' : 'var(--primary-dark)',
              }}>
                {Math.floor(secondes/60)}:{String(secondes%60).padStart(2,'0')}
              </div>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 8, fontFamily: 'var(--font-sans)' }}>
                {chronoActif ? 'Chronomètre en cours' : chronoTermine ? 'Temps écoulé' : 'Prêt à démarrer'}
              </p>
            </div>

            {/* Boutons chrono */}
            <div style={{ display: 'flex', gap: 12, padding: '0 28px 16px', justifyContent: 'center' }}>
              {!chronoActif && !chronoTermine && (
                <button onClick={demarrerChrono}
                  style={{ flex: 1, maxWidth: 320, background: 'var(--primary-dark)', color: 'white', border: 'none', padding: '16px', borderRadius: 16, fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
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
                  style={{ background: 'var(--bg-gray)', color: 'var(--text-secondary)', border: '1.5px solid var(--border-light)', padding: '16px 20px', borderRadius: 16, fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>
                  ↺
                </button>
              )}
            </div>

            {/* Bouton erreur */}
            {chronoActif && (
              <div style={{ padding: '0 28px 16px' }}>
                <button onClick={() => setNbErreurs(n => n+1)}
                  style={{ width: '100%', background: '#fef2f2', border: '1.5px solid #fca5a5', color: '#dc2626', padding: '20px', borderRadius: 16, fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                  ✗ Erreur de lecture {nbErreurs > 0 && <span style={{ fontSize: 15, opacity: 0.8 }}>({nbErreurs})</span>}
                </button>
              </div>
            )}

            {/* Saisie après chrono */}
            {chronoTermine && (
              <div style={{ padding: '0 28px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: 'var(--bg-gray)', borderRadius: 16, padding: 20 }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 10, fontFamily: 'var(--font-sans)' }}>
                    N° du dernier mot lu
                  </label>
                  <input
                    type="number"
                    value={dernierMot}
                    onChange={e => setDernierMot(e.target.value)}
                    placeholder="ex: 87"
                    autoFocus
                    style={{ width: '100%', background: 'white', border: '1.5px solid var(--border-main)', color: 'var(--primary-dark)', fontSize: 32, fontWeight: 700, textAlign: 'center', borderRadius: 12, padding: '12px', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }}
                  />
                  {nbErreurs > 0 && (
                    <p style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 8, textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
                      {nbErreurs} erreur{nbErreurs > 1 ? 's' : ''} comptabilisée{nbErreurs > 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {scoreCalc !== null && (
                  <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 16, padding: 20, textAlign: 'center' }}>
                    <p style={{ color: '#16a34a', fontSize: 13, fontWeight: 600, marginBottom: 4, fontFamily: 'var(--font-sans)' }}>Score calculé</p>
                    <p style={{ color: 'var(--primary-dark)', fontSize: 52, fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-sans)' }}>{scoreCalc}</p>
                    <p style={{ color: '#16a34a', fontSize: 14, marginTop: 4, fontFamily: 'var(--font-sans)' }}>mots / minute</p>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 6, fontFamily: 'var(--font-sans)' }}>
                      {parseInt(dernierMot)} mots − {nbErreurs} erreurs = {parseInt(dernierMot)-nbErreurs} corrects · {tempsEcoule}s
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Questions compréhension */}
            {chronoTermine && scoreCalc !== null && (
              <div style={{ padding: '0 28px 16px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, marginBottom: 10, fontFamily: 'var(--font-sans)' }}>Questions de compréhension</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
                  {qs.map((q, i) => (
                    <button key={i} onClick={() => toggleQ(i)}
                      style={{
                        padding: '12px 4px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        border: q === true ? '1.5px solid #22c55e' : q === false ? '1.5px solid #ef4444' : '1.5px solid var(--border-main)',
                        background: q === true ? '#f0fdf4' : q === false ? '#fef2f2' : 'var(--bg-gray)',
                        color: q === true ? '#16a34a' : q === false ? '#dc2626' : 'var(--text-tertiary)',
                      }}>
                      Q{i+1}
                      <div style={{ fontSize: 16, marginTop: 2 }}>{q === true ? '✓' : q === false ? '✗' : '·'}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Boutons action */}
            <div style={{ padding: '16px 28px 28px', marginTop: 'auto', display: 'flex', gap: 10 }}>
              <button onClick={() => validerEleve(true, true)}
                style={{ flex: 1, border: '1.5px solid #fca5a5', background: '#fef2f2', color: '#dc2626', padding: '14px 10px', borderRadius: 14, fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                Absent
              </button>
              <button onClick={() => validerEleve(true, false)}
                style={{ flex: 1, border: '1.5px solid #fed7aa', background: '#fff7ed', color: '#c2410c', padding: '14px 10px', borderRadius: 14, fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                Non évalué
              </button>
              {scoreCalc !== null && (
                <button onClick={() => validerEleve(false, false)}
                  style={{ flex: 2, background: 'var(--primary-dark)', color: 'white', border: 'none', padding: '14px 20px', borderRadius: 14, fontWeight: 800, fontSize: 15, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                  Valider · Suivant →
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