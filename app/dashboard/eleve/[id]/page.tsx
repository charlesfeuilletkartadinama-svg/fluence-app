'use client'

import { use, useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'
import styles from './eleve.module.css'
import type { Norme } from '@/app/lib/types'
import { GROUPES_CONFIG as GROUPES } from '@/app/lib/types'
import { classerEleve as _classerEleve } from '@/app/lib/fluenceUtils'

// ── Types ──────────────────────────────────────────────────────────────────

type Eleve = {
  id: string
  nom: string
  prenom: string
  date_naissance: string | null
  sexe: string | null
  classe: { id: string; nom: string; niveau: string }
}

type Passation = {
  id: string
  score: number | null
  non_evalue: boolean
  q1: string | null; q2: string | null; q3: string | null
  q4: string | null; q5: string | null; q6: string | null
  mode: string
  created_at: string
  periode: { id: string; code: string; label: string; annee_scolaire?: string }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function classerEleve(score: number, norme: Norme | undefined): 1 | 2 | 3 | 4 {
  if (!norme) return 4
  return _classerEleve(score, norme)
}

function compPct(qs: (string | null)[]): number {
  const filled = qs.filter(q => q !== null)
  if (filled.length === 0) return -1
  return Math.round(filled.filter(q => q === 'Correct').length / filled.length * 100)
}

function compColor(pct: number) {
  if (pct >= 70) return { color: '#16A34A', background: 'rgba(22,163,74,0.08)' }
  if (pct >= 40) return { color: '#B45309', background: 'rgba(217,119,6,0.08)' }
  return { color: '#DC2626', background: 'rgba(220,38,38,0.08)' }
}

// ── SVG Courbe de progression ─────────────────────────────────────────────

function LineChart({ scores, codes }: { scores: (number | null)[]; codes: string[] }) {
  const W = 500, H = 120, PAD = 28
  const valid = scores.filter(s => s !== null) as number[]
  if (valid.length < 2) return null
  const minV = Math.min(...valid), maxV = Math.max(...valid)
  const range = maxV - minV || 1
  const pts = scores.map((s, i) => ({
    x: PAD + (i / (scores.length - 1)) * (W - 2 * PAD),
    y: s !== null ? H - PAD - ((s - minV) / range) * (H - 2 * PAD) : null,
    v: s, code: codes[i],
  }))
  const validPts = pts.filter(p => p.y !== null) as { x: number; y: number; v: number; code: string }[]
  const path = validPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 120 }}>
      {/* grid line */}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--border-light)" strokeWidth={1} />
      <path d={path} fill="none" stroke="var(--accent-gold)" strokeWidth={2.5} strokeLinejoin="round" />
      {validPts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={5} fill="var(--accent-gold)" />
          <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize={12} fill="var(--primary-dark)" fontWeight={700}>
            {p.v}
          </text>
        </g>
      ))}
      {pts.map((p, i) => (
        <text key={i} x={p.x} y={H - 4} textAnchor="middle" fontSize={10} fill="var(--text-secondary)">
          {p.code}
        </text>
      ))}
    </svg>
  )
}

// ── Page principale ────────────────────────────────────────────────────────

export default function FicheElevePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eleveId } = use(params)
  const [eleve, setEleve] = useState<Eleve | null>(null)
  const [passations, setPassations] = useState<Passation[]>([])
  const [normes, setNormes] = useState<Norme[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { charger() }, [eleveId])

  async function charger() {
    // Élève + classe
    const { data: eleveData } = await supabase
      .from('eleves')
      .select('id, nom, prenom, date_naissance, sexe, classe:classes(id, nom, niveau)')
      .eq('id', eleveId)
      .single()
    setEleve(eleveData as any)

    // Passations avec période
    const { data: passData } = await supabase
      .from('passations')
      .select('id, score, non_evalue, q1, q2, q3, q4, q5, q6, mode, created_at, periode:periodes(id, code, label, annee_scolaire)')
      .eq('eleve_id', eleveId)
      .order('created_at', { ascending: true })
    setPassations((passData || []) as any[])

    // Normes
    const { data: normesData } = await supabase
      .from('config_normes').select('niveau, periode_id, seuil_min, seuil_attendu')
    setNormes(normesData || [])

    setLoading(false)
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <Sidebar />
        <main className={styles.main}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Chargement…</p>
        </main>
      </div>
    )
  }

  if (!eleve) {
    return (
      <div className={styles.page}>
        <Sidebar />
        <main className={styles.main}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Élève introuvable.</p>
        </main>
      </div>
    )
  }

  // Dédupliquons par code+année de période (garder la plus récente)
  const passByKey: Record<string, Passation> = {}
  passations.forEach(p => {
    const code = (p.periode as any)?.code
    const annee = (p.periode as any)?.annee_scolaire || ''
    const key = `${annee}_${code}`
    if (code) passByKey[key] = p
  })
  const passUniques = Object.values(passByKey).sort((a, b) => {
    const anneeA = (a.periode as any)?.annee_scolaire || ''
    const anneeB = (b.periode as any)?.annee_scolaire || ''
    if (anneeA !== anneeB) return anneeA.localeCompare(anneeB)
    return ((a.periode as any)?.code || '').localeCompare((b.periode as any)?.code || '')
  })

  const scores = passUniques.map(p => (!p.non_evalue && p.score != null) ? p.score : null)
  const codes  = passUniques.map(p => {
    const code = (p.periode as any)?.code || ''
    const annee = (p.periode as any)?.annee_scolaire || ''
    // Format court : "T1 24-25"
    const anneeShort = annee ? annee.replace('20', '').replace('-20', '-') : ''
    return anneeShort ? `${code} ${anneeShort}` : code
  })
  // Identifier les années distinctes
  const anneesDistinctes = [...new Set(passUniques.map(p => (p.periode as any)?.annee_scolaire || ''))].filter(Boolean)
  const niveau = (eleve.classe as any)?.niveau || ''

  return (
    <div className={styles.page}>
      <Sidebar />
      <ImpersonationBar />

      <main className={styles.main}>
        {/* Retour */}
        <button className={styles.backBtn} onClick={() => router.back()}>
          ← Retour
        </button>

        {/* En-tête élève */}
        <div className={styles.header}>
          <div className={styles.avatar}>
            {eleve.prenom[0]}{eleve.nom[0]}
          </div>
          <div>
            <h1 className={styles.name}>{eleve.prenom} <span style={{ textTransform: 'uppercase' }}>{eleve.nom}</span></h1>
            <div className={styles.meta}>
              <span className={styles.metaBadge}>{(eleve.classe as any)?.nom}</span>
              <span className={styles.metaBadge}>{niveau}</span>
              {eleve.sexe && <span className={styles.metaBadge}>{eleve.sexe}</span>}
              {eleve.date_naissance && (
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Né(e) le {new Date(eleve.date_naissance).toLocaleDateString('fr-FR')}
                </span>
              )}
            </div>
          </div>
        </div>

        {passUniques.length === 0 ? (
          <div className={styles.empty}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <p>Aucune passation enregistrée pour cet élève.</p>
            <button className={styles.btnPrimary}
              onClick={() => router.push(`/dashboard/saisie?classe=${(eleve.classe as any)?.id}`)}>
              Saisir les scores →
            </button>
          </div>
        ) : (
          <>
            {/* Courbe de progression */}
            {scores.filter(s => s !== null).length >= 2 && (
              <div className={styles.card} style={{ marginBottom: 20 }}>
                <h2 className={styles.cardTitle}>
                  Progression
                  {anneesDistinctes.length > 1 && (
                    <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 8 }}>
                      ({anneesDistinctes.join(' → ')})
                    </span>
                  )}
                </h2>
                <LineChart scores={scores} codes={codes} />
              </div>
            )}

            {/* KPIs synthèse */}
            <div className={styles.kpiGrid}>
              {(() => {
                const scoresNum = scores.filter(s => s !== null) as number[]
                const dernierScore = scoresNum[scoresNum.length - 1] ?? null
                const premierScore = scoresNum[0] ?? null
                const progression = scoresNum.length >= 2 ? scoresNum[scoresNum.length - 1] - scoresNum[0] : null
                const dernierPass = passUniques.filter(p => !p.non_evalue).pop()
                const compDernier = dernierPass ? compPct([dernierPass.q1, dernierPass.q2, dernierPass.q3, dernierPass.q4, dernierPass.q5, dernierPass.q6]) : -1
                const norme = dernierPass ? normes.find(n => n.niveau === niveau && n.periode_id === (dernierPass.periode as any)?.id) : undefined
                const groupe = dernierScore != null ? classerEleve(dernierScore, norme) : null
                const g = groupe ? GROUPES[groupe - 1] : null
                return (
                  <>
                    <div className={styles.kpiCard} style={{ background: 'var(--primary-dark)', border: 'none' }}>
                      <div className={styles.kpiLabel} style={{ color: 'rgba(255,255,255,0.5)' }}>Dernier score</div>
                      <div className={styles.kpiVal} style={{ color: 'white' }}>{dernierScore ?? '—'}</div>
                      <div className={styles.kpiUnit} style={{ color: 'rgba(255,255,255,0.4)' }}>mots / minute</div>
                    </div>
                    <div className={styles.kpiCard}>
                      <div className={styles.kpiLabel}>Progression</div>
                      <div className={styles.kpiVal} style={{ color: progression == null ? 'var(--text-tertiary)' : progression >= 0 ? '#16A34A' : '#DC2626' }}>
                        {progression == null ? '—' : `${progression >= 0 ? '+' : ''}${progression}`}
                      </div>
                      <div className={styles.kpiUnit}>depuis {codes[0]}</div>
                    </div>
                    <div className={styles.kpiCard}>
                      <div className={styles.kpiLabel}>Compréhension</div>
                      {compDernier >= 0 ? (
                        <div className={styles.kpiVal} style={{ color: compColor(compDernier).color }}>{compDernier}%</div>
                      ) : (
                        <div className={styles.kpiVal} style={{ color: 'var(--text-tertiary)' }}>—</div>
                      )}
                      <div className={styles.kpiUnit}>dernière période</div>
                    </div>
                    <div className={styles.kpiCard}>
                      <div className={styles.kpiLabel}>Groupe de besoin</div>
                      {g ? (
                        <div style={{ background: g.bg, color: g.color, fontSize: 13, fontWeight: 700, padding: '6px 12px', borderRadius: 8, marginTop: 8, display: 'inline-block' }}>
                          {g.label}
                        </div>
                      ) : (
                        <div className={styles.kpiVal} style={{ color: 'var(--text-tertiary)' }}>—</div>
                      )}
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Détail par période */}
            <h2 className={styles.sectionTitle}>Détail par période</h2>
            <div className={styles.periodesGrid}>
              {passUniques.map((p, i) => {
                const code = (p.periode as any)?.code || ''
                const label = (p.periode as any)?.label || ''
                const qs = [p.q1, p.q2, p.q3, p.q4, p.q5, p.q6]
                const comp = compPct(qs)
                const norme = normes.find(n => n.niveau === niveau && n.periode_id === (p.periode as any)?.id)
                const groupe = !p.non_evalue && p.score != null ? classerEleve(p.score, norme) : null
                const g = groupe ? GROUPES[groupe - 1] : null

                return (
                  <div key={i} className={styles.periodeCard}>
                    <div className={styles.periodeCardTop}>
                      <span className={styles.periodeBadge}>{code}</span>
                      {label && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>}
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {new Date(p.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>

                    {p.non_evalue ? (
                      <div style={{ marginTop: 10, color: '#C2410C', fontWeight: 700, fontSize: 14 }}>Non évalué</div>
                    ) : p.score != null ? (
                      <>
                        <div className={styles.scoreRow}>
                          <span className={styles.scoreBig}>{p.score}</span>
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)', alignSelf: 'flex-end', paddingBottom: 2 }}>mots/min</span>
                          {g && (
                            <span style={{ marginLeft: 'auto', background: g.bg, color: g.color, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6 }}>
                              {g.label}
                            </span>
                          )}
                        </div>

                        {/* Compréhension */}
                        {comp >= 0 && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Compréhension</span>
                              <span style={{ ...compColor(comp), fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>{comp}%</span>
                            </div>
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                              {qs.map((q, qi) =>
                                q !== null ? (
                                  <span key={qi} style={{
                                    background: q === 'Correct' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.08)',
                                    color: q === 'Correct' ? '#16A34A' : '#DC2626',
                                    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                                  }}>Q{qi + 1} {q === 'Correct' ? '✓' : '✗'}</span>
                                ) : (
                                  <span key={qi} style={{ background: 'var(--bg-gray)', color: 'var(--text-tertiary)', fontSize: 11, padding: '3px 8px', borderRadius: 6 }}>Q{qi + 1} —</span>
                                )
                              )}
                            </div>
                          </div>
                        )}

                        {/* Mode */}
                        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {p.mode === 'passation' ? '🎯 Mode passation' : '✏️ Saisie manuelle'}
                        </div>
                      </>
                    ) : (
                      <div style={{ marginTop: 10, color: 'var(--text-tertiary)', fontSize: 13 }}>—</div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
