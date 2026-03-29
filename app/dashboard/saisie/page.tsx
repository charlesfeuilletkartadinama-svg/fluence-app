'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'
import { useProfil } from '@/app/lib/useProfil'
import type { Periode, Classe } from '@/app/lib/types'
import { periodeVerrouillee } from '@/app/lib/fluenceUtils'

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


function Saisie() {
  const [etape, setEtape]             = useState<'periode' | 'classe' | 'saisie' | 'recap' | 'done'>('periode')
  const [periodes, setPeriodes]       = useState<Periode[]>([])
  const [periode, setPeriode]         = useState<Periode | null>(null)
  const [classe, setClasse]           = useState<Classe | null>(null)
  const [classesEtab, setClassesEtab] = useState<Classe[]>([])
  const [eleves, setEleves]           = useState<Eleve[]>([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [erreurSauvegarde, setErreurSauvegarde] = useState('')
  const router   = useRouter()
  const supabase = createClient()
  const { profil, loading: profilLoading } = useProfil()

  const isDirection = profil && ['directeur', 'principal'].includes(profil.role)

  useEffect(() => {
    if (profilLoading) return
    if (!profil) { setLoading(false); return }
    if (isDirection) chargerDonneesDirection()
    else if (profil.role === 'enseignant') chargerDonneesEnseignant()
    else setLoading(false)
  }, [profil, profilLoading])

  async function chargerDonneesDirection() {
    if (!profil?.etablissement_id) { setLoading(false); return }
    const classeId = new URLSearchParams(window.location.search).get('classe')
    const [{ data: periodesData }, { data: classesData }] = await Promise.all([
      supabase.from('periodes').select('id, code, label, date_fin, type')
        .eq('etablissement_id', profil.etablissement_id).eq('actif', true).order('code'),
      supabase.from('classes').select('id, nom, niveau')
        .eq('etablissement_id', profil.etablissement_id).order('niveau'),
    ])
    setPeriodes(periodesData || [])
    setClassesEtab(classesData || [])
    if (classeId) {
      const c = (classesData || []).find((c: Classe) => c.id === classeId)
      if (c) setClasse(c)
    }
    setLoading(false)
  }

  async function chargerDonneesEnseignant() {
    if (!profil) { setLoading(false); return }
    const classeId = new URLSearchParams(window.location.search).get('classe')
    const { data } = await supabase
      .from('enseignant_classes')
      .select('classe:classes(id, nom, niveau, etablissement_id)')
      .eq('enseignant_id', profil.id)
    const classes = (data || []).map((r: any) => r.classe).filter(Boolean) as (Classe & { etablissement_id: string })[]
    if (classes.length === 0) { setLoading(false); return }

    const etabId = classes[0].etablissement_id
    const { data: periodesData } = await supabase
      .from('periodes').select('id, code, label, date_fin, type')
      .eq('etablissement_id', etabId).eq('actif', true).order('code')
    setPeriodes(periodesData || [])

    if (classes.length === 1) {
      setClasse(classes[0])
    } else {
      setClassesEtab(classes)
      if (classeId) {
        const c = classes.find(c => c.id === classeId)
        if (c) setClasse(c)
      }
    }
    setLoading(false)
  }

  async function selectionnerPeriode(p: Periode) {
    if (profil?.role === 'enseignant' && periodeVerrouillee(p?.date_fin)) return
    setPeriode(p)
    if (classe) {
      // Classe déjà connue : charger les élèves et aller directement à la saisie
      setLoading(true)
      const { data } = await supabase
        .from('eleves').select('id, nom, prenom').eq('classe_id', classe.id).eq('actif', true).order('nom')
      setEleves((data || []).map(e => ({ ...e, score: '', ne: false, absent: false, q1: null, q2: null, q3: null, q4: null, q5: null, q6: null })))
      setLoading(false)
      setEtape('saisie')
    } else {
      setEtape('classe')
    }
  }

  async function selectionnerClasse(c: Classe) {
    setClasse(c)
    setLoading(true)
    const { data } = await supabase
      .from('eleves').select('id, nom, prenom').eq('classe_id', c.id).eq('actif', true).order('nom')
    setEleves((data || []).map(e => ({ ...e, score: '', ne: false, absent: false, q1: null, q2: null, q3: null, q4: null, q5: null, q6: null })))
    setLoading(false)
    setEtape('saisie')
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
    if (profil.role === 'enseignant' && periodeVerrouillee(periode?.date_fin)) return
    setSaving(true)
    setErreurSauvegarde('')
    let ok = 0, err = 0

    for (const eleve of eleves) {
      if (!eleve.ne && !eleve.absent && eleve.score === '') continue
      if (!periode) continue

      const { error } = await supabase.from('passations').upsert({
        eleve_id:      eleve.id,
        periode_id:    periode.id,
        hors_periode:  false,
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
      }, { onConflict: 'eleve_id,periode_id,hors_periode' })

      if (error) {
        err++
        console.error('[saisie] upsert error:', error.message, error.details, error.hint, error.code)
        if (err === 1) setErreurSauvegarde(`Erreur : ${error.message}${error.details ? ' — ' + error.details : ''}`)
      } else ok++
    }

    setSaving(false)
    if (err > 0 && ok > 0) {
      setErreurSauvegarde(`${err} enregistrement${err > 1 ? 's ont' : ' a'} échoué sur ${ok + err}.`)
    }
    setEtape('done')
  }

  if (loading) return <div style={{ marginLeft: 'var(--sidebar-width)', padding: 32, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>Chargement...</div>

  return (
    <div style={{ marginLeft: 'var(--sidebar-width)', padding: 32, maxWidth: 900, minHeight: '100vh', background: 'var(--bg-light)' }}>

        {/* ÉTAPE 0 : Choix de la période */}
        {etape === 'periode' && (
          <>
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>Mode Saisie</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 15, fontFamily: 'var(--font-sans)' }}>Choisissez une période</p>
            </div>
            {periodes.length === 0 ? (
              <div style={{ background: 'white', borderRadius: 16, padding: '48px 32px', border: '1.5px solid var(--border-light)', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🏫</div>
                <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', marginBottom: 8 }}>Aucune période disponible</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                  Ce profil n'est pas rattaché à un établissement.<br />
                  Utilisez l'impersonation pour saisir en tant qu'enseignant ou directeur.
                </p>
              </div>
            ) : (
            <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1.5px solid var(--border-light)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>Choisir une période</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {periodes.map(p => {
                  const locked = profil?.role === 'enseignant' && periodeVerrouillee(p?.date_fin)
                  return (
                    <button key={p.id}
                      onClick={() => selectionnerPeriode(p)}
                      disabled={locked}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        border: '1.5px solid var(--border-light)', borderRadius: 12, padding: '16px 20px',
                        background: 'var(--bg-gray)', cursor: locked ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s', textAlign: 'left', fontFamily: 'var(--font-sans)',
                        opacity: locked ? 0.55 : 1,
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
            )}
          </>
        )}

        {/* ÉTAPE 1 : Choix de la classe */}
        {etape === 'classe' && (
          <>
            <div style={{ marginBottom: 32 }}>
              <button onClick={() => setEtape('periode')}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontFamily: 'var(--font-sans)', marginBottom: 12, padding: 0, display: 'block' }}>
                ← Retour
              </button>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>Mode Saisie</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 15, fontFamily: 'var(--font-sans)' }}>Période · {periode?.code} — Choisissez la classe</p>
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

        {/* ÉTAPE 2 : Saisie */}
        {etape === 'saisie' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>
                  {classe?.nom} · {periode?.code}
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 14, fontFamily: 'var(--font-sans)' }}>
                  {nbSaisis} / {eleves.length} élèves saisis
                </p>
              </div>
              <button onClick={() => setEtape('recap')} disabled={nbSaisis === 0} style={{
                background: nbSaisis === 0 ? 'var(--text-tertiary)' : 'var(--primary-dark)',
                color: 'white', border: 'none', padding: '11px 22px', borderRadius: 12,
                fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700,
                cursor: nbSaisis === 0 ? 'not-allowed' : 'pointer',
              }}>
                Valider →
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {eleves.map((eleve, idx) => (
                <div key={eleve.id} style={{
                  background: eleve.absent ? '#fef2f2' : eleve.ne ? '#fff7ed' : eleve.score !== '' ? '#f0fdf4' : 'white',
                  border: `1.5px solid ${eleve.absent ? '#fca5a5' : eleve.ne ? '#fed7aa' : eleve.score !== '' ? '#bbf7d0' : 'var(--border-light)'}`,
                  borderRadius: 16, padding: '18px 24px', transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 48 }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)' }}>{eleve.nom}</span>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 15 }}>{eleve.prenom}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="number" value={eleve.score}
                        onChange={e => updateEleve(idx, 'score', e.target.value)}
                        disabled={eleve.ne || eleve.absent}
                        placeholder="—" min={0} max={500}
                        style={{
                          width: 88, textAlign: 'center', border: '1.5px solid var(--border-main)',
                          borderRadius: 12, padding: '10px 12px', fontSize: 18, fontWeight: 700,
                          color: 'var(--primary-dark)', outline: 'none', fontFamily: 'var(--font-sans)',
                          background: (eleve.ne || eleve.absent) ? 'var(--bg-gray)' : 'white',
                          opacity: (eleve.ne || eleve.absent) ? 0.4 : 1,
                        }}
                      />
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 12, fontFamily: 'var(--font-sans)' }}>mots/min</span>
                    </div>
                    <button onClick={() => setEleves(prev => prev.map((e, i) => i === idx ? { ...e, ne: !e.ne, absent: false, score: '' } : e))} style={{
                      padding: '10px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                      border: eleve.ne ? '2px solid #fb923c' : '2px solid var(--border-main)',
                      background: eleve.ne ? '#fff7ed' : 'transparent',
                      color: eleve.ne ? '#c2410c' : 'var(--text-tertiary)',
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
                    }}>N.É.</button>
                    <button onClick={() => setEleves(prev => prev.map((e, i) => i === idx ? { ...e, absent: !e.absent, ne: false, score: '' } : e))} style={{
                      padding: '10px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                      border: eleve.absent ? '2px solid #f87171' : '2px solid var(--border-main)',
                      background: eleve.absent ? '#fef2f2' : 'transparent',
                      color: eleve.absent ? '#dc2626' : 'var(--text-tertiary)',
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
                    }}>Absent</button>
                  </div>
                  {!eleve.ne && !eleve.absent && eleve.score !== '' && periode?.type !== 'evaluation_nationale' && (
                    <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, fontFamily: 'var(--font-sans)', marginRight: 4 }}>Compréhension :</span>
                      {(['q1','q2','q3','q4','q5','q6'] as const).map(q => {
                        const val = (eleve as any)[q]
                        return (
                          <button key={q} onClick={() => toggleQ(idx, q)} style={{
                            width: 40, height: 40, borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
                            border: val === true ? '2px solid #22c55e' : val === false ? '2px solid #ef4444' : '2px solid var(--border-main)',
                            background: val === true ? '#f0fdf4' : val === false ? '#fef2f2' : 'var(--bg-gray)',
                            color: val === true ? '#16a34a' : val === false ? '#dc2626' : 'var(--text-tertiary)',
                          }}>
                            {q.toUpperCase()}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setEtape('recap')} disabled={nbSaisis === 0} style={{
                background: nbSaisis === 0 ? 'var(--text-tertiary)' : 'var(--primary-dark)',
                color: 'white', border: 'none', padding: '13px 32px', borderRadius: 12,
                fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700,
                cursor: nbSaisis === 0 ? 'not-allowed' : 'pointer',
              }}>
                Voir le récapitulatif →
              </button>
            </div>
          </>
        )}

        {/* ÉTAPE 3 : Récap */}
        {etape === 'recap' && (
          <>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>Récapitulatif</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 14, fontFamily: 'var(--font-sans)' }}>{classe?.nom} · {periode?.code}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { val: nbSaisis, label: 'Élèves saisis', color: 'var(--primary-dark)' },
                { val: scoreMoyen !== null ? scoreMoyen : '—', label: 'Score moyen', color: 'var(--primary-dark)' },
                { val: eleves.filter(e => e.ne).length, label: 'Non évalués', color: '#D97706' },
                { val: eleves.filter(e => e.absent).length, label: 'Absents', color: '#DC2626' },
              ].map(({ val, label, color }) => (
                <div key={label} style={{ background: 'white', borderRadius: 16, padding: '20px 16px', border: '1.5px solid var(--border-light)', textAlign: 'center' }}>
                  <p style={{ fontSize: 28, fontWeight: 800, color, fontFamily: 'var(--font-sans)', margin: '0 0 4px 0' }}>{val}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', margin: 0 }}>{label}</p>
                </div>
              ))}
            </div>

            <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', overflow: 'hidden', marginBottom: 24 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-gray)' }}>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1 }}>ÉLÈVE</th>
                    <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1 }}>SCORE</th>
                    <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1 }}>STATUT</th>
                  </tr>
                </thead>
                <tbody>
                  {eleves.filter(e => e.ne || e.absent || e.score !== '').map((e, i) => (
                    <tr key={e.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '12px 20px', fontWeight: 700, color: 'var(--primary-dark)' }}>{e.nom} {e.prenom}</td>
                      <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 700, color: 'var(--primary-dark)' }}>
                        {(e.ne || e.absent) ? '—' : `${e.score} m/min`}
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                        {e.absent
                          ? <span style={{ background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6 }}>Absent</span>
                          : e.ne
                            ? <span style={{ background: '#fff7ed', color: '#c2410c', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6 }}>N.É.</span>
                            : <span style={{ background: 'rgba(22,163,74,0.08)', color: '#16a34a', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6 }}>✓</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setEtape('saisie')} style={{
                flex: 1, border: '1.5px solid var(--border-main)', background: 'transparent',
                color: 'var(--text-secondary)', padding: '13px 0', borderRadius: 12,
                fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>← Modifier</button>
              <button onClick={valider} disabled={saving} style={{
                flex: 1, background: saving ? 'var(--text-tertiary)' : 'var(--primary-dark)',
                color: 'white', border: 'none', padding: '13px 0', borderRadius: 12,
                fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}>
                {saving ? 'Enregistrement...' : '✅ Confirmer et envoyer'}
              </button>
            </div>
          </>
        )}

        {/* ÉTAPE 4 : Terminé */}
        {etape === 'done' && (
          <div style={{ background: 'white', borderRadius: 20, padding: '48px 40px', textAlign: 'center', border: '1.5px solid var(--border-light)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{erreurSauvegarde ? '⚠️' : '✅'}</div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', marginBottom: 8 }}>
              {erreurSauvegarde ? 'Enregistrement partiel' : 'Scores enregistrés !'}
            </h3>
            {erreurSauvegarde && (
              <div style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#dc2626', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
                {erreurSauvegarde}
              </div>
            )}
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, fontFamily: 'var(--font-sans)', marginBottom: 32 }}>
              {nbSaisis} élèves · Score moyen : {scoreMoyen !== null ? `${scoreMoyen} mots/min` : '—'}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => router.push('/dashboard/eleves')} style={{
                border: '1.5px solid var(--border-main)', background: 'transparent',
                color: 'var(--text-secondary)', padding: '13px 24px', borderRadius: 12,
                fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>Voir mes classes</button>
              <button onClick={() => {
                setPeriode(null)
                setClasse(classesEtab.length > 1 ? null : classe)
                setEleves(prev => prev.map(e => ({ ...e, score: '', ne: false, absent: false, q1: null, q2: null, q3: null, q4: null, q5: null, q6: null })))
                setEtape('periode')
              }} style={{
                background: 'var(--primary-dark)', color: 'white', border: 'none',
                padding: '13px 24px', borderRadius: 12,
                fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>Nouvelle saisie</button>
            </div>
          </div>
        )}
    </div>
  )
}

export default function SaisieWrapper() {
  return (
    <>
      <Sidebar />
      <ImpersonationBar />
      <Saisie />
    </>
  )
}
