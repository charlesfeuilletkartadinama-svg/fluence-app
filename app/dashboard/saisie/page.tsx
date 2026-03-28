'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'
import { useProfil } from '@/app/lib/useProfil'

type Eleve = {
  id: string
  nom: string
  prenom: string
  score: string
  ne: boolean
  absent: boolean
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
  date_fin: string | null
}

function periodeVerrouillee(p: Periode | null): boolean {
  if (!p?.date_fin) return false
  return p.date_fin < new Date().toISOString().split('T')[0]
}

type Classe = {
  id: string
  nom: string
  niveau: string
}

function Saisie() {
  const [etape, setEtape]             = useState<'classe' | 'periode' | 'saisie' | 'recap' | 'done'>('periode')
  const [periodes, setPeriodes]       = useState<Periode[]>([])
  const [periode, setPeriode]         = useState<Periode | null>(null)
  const [classe, setClasse]           = useState<Classe | null>(null)
  const [classesEtab, setClassesEtab] = useState<Classe[]>([])
  const [eleves, setEleves]           = useState<Eleve[]>([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [erreurSauvegarde, setErreurSauvegarde] = useState('')
  const router       = useRouter()
  const searchParams = useSearchParams()
  const classeId     = searchParams.get('classe')
  const supabase     = createClient()
  const { profil }   = useProfil()

  const isDirection = profil && ['directeur', 'principal'].includes(profil.role)

  useEffect(() => {
    chargerDonnees().catch(() => setLoading(false))
  }, [classeId])

  // Déclencher charger quand profil est disponible et pas de classeId en URL
  useEffect(() => {
    if (!profil || classeId) return
    if (isDirection && classesEtab.length === 0) {
      chargerClassesEtablissement()
    } else if (profil.role === 'enseignant') {
      chargerClassesEnseignant()
    }
  }, [profil])

  // Vérification d'appartenance : l'utilisateur doit avoir accès à cette classe
  useEffect(() => {
    if (!profil || !classeId) return

    if (profil.role === 'enseignant') {
      supabase.from('enseignant_classes')
        .select('id').eq('enseignant_id', profil.id).eq('classe_id', classeId)
        .maybeSingle()
        .then(({ data }) => { if (!data) router.push('/dashboard/eleves') })
    } else if (['directeur', 'principal'].includes(profil.role) && profil.etablissement_id) {
      supabase.from('classes')
        .select('id').eq('id', classeId).eq('etablissement_id', profil.etablissement_id)
        .maybeSingle()
        .then(({ data }) => { if (!data) router.push('/dashboard/eleves') })
    }
  }, [profil, classeId])

  async function chargerClassesEtablissement() {
    if (!profil?.etablissement_id) return
    const { data } = await supabase
      .from('classes').select('id, nom, niveau')
      .eq('etablissement_id', profil.etablissement_id).order('niveau')
    setClassesEtab(data || [])
    setEtape('classe')
    setLoading(false)
  }

  async function chargerClassesEnseignant() {
    if (!profil) return
    const { data } = await supabase
      .from('enseignant_classes')
      .select('classe:classes(id, nom, niveau, etablissement_id)')
      .eq('enseignant_id', profil.id)
    const classes = (data || []).map((r: any) => r.classe).filter(Boolean) as (Classe & { etablissement_id: string })[]

    if (classes.length === 0) {
      setLoading(false)
      return
    }
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
    // Charger les périodes et élèves de cette classe
    const { data: classeData } = await supabase
      .from('classes').select('id, nom, niveau, etablissement_id').eq('id', c.id).single()
    if (classeData) {
      const { data: periodesData } = await supabase
        .from('periodes').select('id, code, label, date_fin')
        .eq('etablissement_id', classeData.etablissement_id).eq('actif', true).order('code')
      setPeriodes(periodesData || [])
      const { data: elevesData } = await supabase
        .from('eleves').select('id, nom, prenom').eq('classe_id', c.id).eq('actif', true).order('nom')
      setEleves((elevesData || []).map(e => ({ ...e, score: '', ne: false, absent: false, q1: null, q2: null, q3: null, q4: null, q5: null, q6: null })))
    }
    setLoading(false)
    setEtape('periode')
  }

  async function chargerDonnees() {
    if (!classeId) {
      // Sans classeId dans l'URL, on attend que profil soit prêt (useEffect gérera)
      setLoading(false)
      return
    }

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
        absent: false,
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

  const nbSaisis = eleves.filter(e => e.ne || e.absent || (e.score !== '' && !isNaN(Number(e.score)))).length
  const scoreMoyen = (() => {
    const scores = eleves.filter(e => !e.ne && e.score !== '' && !isNaN(Number(e.score))).map(e => Number(e.score))
    return scores.length > 0 ? Math.round(scores.reduce((a,b) => a+b, 0) / scores.length) : null
  })()

  async function valider() {
    if (!profil) return
    if (profil.role === 'enseignant' && periodeVerrouillee(periode)) return
    setSaving(true)
    setErreurSauvegarde('')
    let ok = 0, err = 0

    for (const eleve of eleves) {
      if (!eleve.ne && !eleve.absent && eleve.score === '') continue
      if (!periode) continue

      const { error } = await supabase.from('passations').upsert({
        eleve_id:      eleve.id,
        periode_id:    periode.id,
        score:         (eleve.ne || eleve.absent) ? null : Number(eleve.score),
        non_evalue:    eleve.ne || eleve.absent,
        absent:        eleve.absent,
        mode:          'saisie',
        enseignant_id: profil.id,
        q1: eleve.q1 === true ? 'Correct' : eleve.q1 === false ? 'Incorrect' : null,
        q2: eleve.q2 === true ? 'Correct' : eleve.q2 === false ? 'Incorrect' : null,
        q3: eleve.q3 === true ? 'Correct' : eleve.q3 === false ? 'Incorrect' : null,
        q4: eleve.q4 === true ? 'Correct' : eleve.q4 === false ? 'Incorrect' : null,
        q5: eleve.q5 === true ? 'Correct' : eleve.q5 === false ? 'Incorrect' : null,
        q6: eleve.q6 === true ? 'Correct' : eleve.q6 === false ? 'Incorrect' : null,
      }, { onConflict: 'eleve_id,periode_id' })

      if (error) err++
      else ok++
    }

    setSaving(false)
    if (err > 0) {
      setErreurSauvegarde(`${err} enregistrement${err > 1 ? 's ont' : ' a'} échoué. Vérifiez votre connexion et réessayez.`)
    }
    setEtape('done')
  }

  if (loading) return <div style={{ marginLeft: 'var(--sidebar-width)', padding: 32 }} className="text-slate-400">Chargement...</div>

  return (
    <>
      <Sidebar />
      <ImpersonationBar />

      <div style={{ marginLeft: 'var(--sidebar-width)', padding: 32, maxWidth: 900, minHeight: '100vh', background: 'var(--bg-light)' }}>

        {/* ÉTAPE 0 : Choix de la classe */}
        {etape === 'classe' && (
          <>
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>Mode Saisie</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 15, fontFamily: 'var(--font-sans)' }}>Choisissez la classe</p>
            </div>
            <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1.5px solid var(--border-light)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>Choisir une classe</p>
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
          </>
        )}

        {/* ÉTAPE 1 : Choix de la période */}
        {etape === 'periode' && (
          <>
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>Saisie des scores</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 15, fontFamily: 'var(--font-sans)' }}>
                {classe ? `Classe · ${classe.nom}` : 'Choisissez d\'abord une classe'}
              </p>
            </div>

            <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1.5px solid var(--border-light)', marginBottom: 24 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>Choisir une période</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {periodes.map(p => {
                  const locked = profil?.role === 'enseignant' && periodeVerrouillee(p)
                  return (
                    <button key={p.id}
                      onClick={() => { if (!locked) { setPeriode(p); setEtape('saisie') } }}
                      disabled={locked}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        border: `1.5px solid ${locked ? 'var(--border-light)' : 'var(--border-light)'}`,
                        borderRadius: 12, padding: '16px 20px',
                        background: locked ? 'var(--bg-gray)' : 'var(--bg-gray)',
                        cursor: locked ? 'not-allowed' : 'pointer', transition: 'all 0.15s', textAlign: 'left',
                        fontFamily: 'var(--font-sans)', opacity: locked ? 0.55 : 1,
                      }}
                      onMouseEnter={e => { if (!locked) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-dark)'; (e.currentTarget as HTMLElement).style.background = 'white' } }}
                      onMouseLeave={e => { if (!locked) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-gray)' } }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--primary-dark)' }}>{p.code}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>{p.label}</div>
                        {locked && <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600, marginTop: 4 }}>Période clôturée — saisie réservée au directeur</div>}
                      </div>
                      <span style={{ color: locked ? '#DC2626' : 'var(--text-tertiary)', fontSize: 18 }}>{locked ? '🔒' : '→'}</span>
                    </button>
                  )
                })}
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
                  style={{
                    background: eleve.absent ? '#fef2f2' : eleve.ne ? '#fff7ed' : eleve.score !== '' ? '#f0fdf4' : 'white',
                    border: `1.5px solid ${eleve.absent ? '#fca5a5' : eleve.ne ? '#fed7aa' : eleve.score !== '' ? '#bbf7d0' : 'var(--border-light)'}`,
                    borderRadius: 16, padding: '18px 24px', transition: 'all 0.15s',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 48 }}>
                    {/* Nom */}
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)' }}>{eleve.nom}</span>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 15 }}>{eleve.prenom}</span>
                    </div>

                    {/* Score */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="number"
                        value={eleve.score}
                        onChange={e => updateEleve(idx, 'score', e.target.value)}
                        disabled={eleve.ne || eleve.absent}
                        placeholder="—"
                        min={0} max={500}
                        style={{
                          width: 88, textAlign: 'center', border: '1.5px solid var(--border-main)',
                          borderRadius: 12, padding: '10px 12px', fontSize: 18, fontWeight: 700,
                          color: 'var(--primary-dark)', outline: 'none', fontFamily: 'var(--font-sans)',
                          background: (eleve.ne || eleve.absent) ? 'var(--bg-gray)' : 'white', opacity: (eleve.ne || eleve.absent) ? 0.4 : 1,
                        }}
                      />
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>mots/min</span>
                    </div>

                    {/* N.É. */}
                    <button
                      onClick={() => setEleves(prev => prev.map((e, i) => i === idx ? { ...e, ne: !e.ne, absent: false, score: '' } : e))}
                      style={{
                        padding: '10px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                        border: eleve.ne ? '2px solid #fb923c' : '2px solid var(--border-main)',
                        background: eleve.ne ? '#fff7ed' : 'transparent',
                        color: eleve.ne ? '#c2410c' : 'var(--text-tertiary)',
                        cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
                      }}>
                      N.É.
                    </button>

                    {/* Absent */}
                    <button
                      onClick={() => setEleves(prev => prev.map((e, i) => i === idx ? { ...e, absent: !e.absent, ne: false, score: '' } : e))}
                      style={{
                        padding: '10px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                        border: eleve.absent ? '2px solid #f87171' : '2px solid var(--border-main)',
                        background: eleve.absent ? '#fef2f2' : 'transparent',
                        color: eleve.absent ? '#dc2626' : 'var(--text-tertiary)',
                        cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
                      }}>
                      Absent
                    </button>
                  </div>

                  {/* Questions compréhension */}
                  {!eleve.ne && !eleve.absent && eleve.score !== '' && (
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

            <div className="grid grid-cols-4 gap-4 mb-6">
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
              <div className="bg-white rounded-2xl p-5 border border-slate-100 text-center">
                <p className="text-3xl font-bold text-red-500">
                  {eleves.filter(e => e.absent).length}
                </p>
                <p className="text-sm text-slate-400 mt-1">Absents</p>
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
                  {eleves.filter(e => e.ne || e.absent || e.score !== '').map(e => (
                    <tr key={e.id}>
                      <td className="px-5 py-3 font-semibold text-blue-900">
                        {e.nom} {e.prenom}
                      </td>
                      <td className="px-5 py-3 text-center font-bold text-blue-900">
                        {(e.ne || e.absent) ? '—' : `${e.score} m/min`}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {e.absent ? (
                          <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">Absent</span>
                        ) : e.ne ? (
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
            <div className="text-5xl mb-4">{erreurSauvegarde ? '⚠️' : '✅'}</div>
            <h3 className="text-2xl font-bold text-blue-900 mb-2">
              {erreurSauvegarde ? 'Enregistrement partiel' : 'Scores enregistrés !'}
            </h3>
            {erreurSauvegarde && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
                {erreurSauvegarde}
              </div>
            )}
            <p className="text-slate-400 mb-8">
              {nbSaisis} élèves · Score moyen : {scoreMoyen !== null ? `${scoreMoyen} mots/min` : '—'}
            </p>
            <div className="flex gap-4 justify-center">
              <button onClick={() => router.push('/dashboard/eleves')}
                className="border border-slate-200 text-slate-600 px-6 py-3 rounded-xl font-semibold text-sm hover:bg-slate-50 transition">
                Voir mes classes
              </button>
              <button onClick={() => { setEtape('periode'); setEleves(prev => prev.map(e => ({ ...e, score: '', ne: false, absent: false, q1: null, q2: null, q3: null, q4: null, q5: null, q6: null }))) }}
                className="bg-blue-900 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-blue-800 transition">
                Nouvelle saisie
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default function SaisieWrapper() {
  return (
    <Suspense fallback={<div className="ml-64 p-8 text-slate-400">Chargement...</div>}>
      <Saisie />
    </Suspense>
  )
}