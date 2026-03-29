'use client'

import { use, useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'
import styles from '../eleves.module.css'

type ClasseDetail = {
  id: string
  nom: string
  niveau: string
  etablissement: { nom: string }
}

type Eleve = {
  id: string
  nom: string
  prenom: string
}

type ScoreRecent = {
  eleve_id: string
  score: number | null
  non_evalue: boolean
  periode: { code: string }
}

export default function ElevesClasse({ params }: { params: Promise<{ id: string }> }) {
  const { id: classeId } = use(params)

  const [classe, setClasse]   = useState<ClasseDetail | null>(null)
  const [eleves, setEleves]   = useState<Eleve[]>([])
  const [scores, setScores]   = useState<ScoreRecent[]>([])
  const [loading, setLoading] = useState(true)
  // Ajout manuel d'élève
  const [showAddForm, setShowAddForm] = useState(false)
  const [newNom, setNewNom]     = useState('')
  const [newPrenom, setNewPrenom] = useState('')
  const [adding, setAdding]     = useState(false)
  const { profil, loading: profilLoading } = useProfil()
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!profilLoading && profil) chargerDonnees().catch(() => setLoading(false))
  }, [profil, profilLoading, classeId])

  async function chargerDonnees() {
    // Classe
    const { data: classeData } = await supabase
      .from('classes')
      .select('id, nom, niveau, etablissement:etablissements(nom)')
      .eq('id', classeId)
      .single()
    if (classeData) setClasse(classeData as unknown as ClasseDetail)

    // Élèves
    const { data: elevesData } = await supabase
      .from('eleves')
      .select('id, nom, prenom')
      .eq('classe_id', classeId)
      .eq('actif', true)
      .order('nom')
    const liste = elevesData || []
    setEleves(liste)

    // Scores récents (une seule requête pour tous les élèves)
    if (liste.length > 0) {
      const ids = liste.map(e => e.id)
      const { data: scoresData } = await supabase
        .from('passations')
        .select('eleve_id, score, non_evalue, periode:periodes(code)')
        .in('eleve_id', ids)
        .order('created_at', { ascending: false })
      setScores((scoresData as unknown as ScoreRecent[]) || [])
    }

    setLoading(false)
  }

  async function ajouterEleve() {
    if (!newNom.trim() || !newPrenom.trim()) return
    setAdding(true)
    await supabase.from('eleves').insert({
      nom: newNom.trim().toUpperCase(),
      prenom: newPrenom.trim(),
      classe_id: classeId,
      actif: true,
    })
    setNewNom(''); setNewPrenom(''); setAdding(false); setShowAddForm(false)
    await chargerDonnees()
  }

  async function desactiverEleve(id: string, nom: string) {
    if (!window.confirm(`Retirer ${nom} de cette classe ?`)) return
    await supabase.from('eleves').update({ actif: false }).eq('id', id)
    setEleves(prev => prev.filter(e => e.id !== id))
  }

  // Score le plus récent par élève
  function dernierScore(eleveId: string): ScoreRecent | undefined {
    return scores.find(s => s.eleve_id === eleveId)
  }

  if (profilLoading || loading) {
    return (
      <div className={styles.page}>
        <Sidebar />
        <main className={styles.main}>
          <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Chargement...</div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <Sidebar />
      <ImpersonationBar />

      <main className={styles.main}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <button
              onClick={() => router.back()}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'var(--font-sans)',
                marginBottom: 8, display: 'block', padding: 0,
              }}>
              ← Retour aux classes
            </button>
            <h1 className={styles.title}>{classe?.nom || 'Classe'}</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
              {classe?.niveau}
              {classe?.etablissement?.nom ? ` · ${classe.etablissement.nom}` : ''}
              {` · ${eleves.length} élève${eleves.length > 1 ? 's' : ''}`}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              className={`${styles.button} ${styles.buttonSecondary}`}
              onClick={() => setShowAddForm(!showAddForm)}>
              {showAddForm ? '✕ Annuler' : '+ Ajouter un élève'}
            </button>
            <button
              className={`${styles.button} ${styles.buttonSecondary}`}
              onClick={() => router.push(`/dashboard/statistiques?classe=${classeId}`)}>
              📈 Statistiques
            </button>
            <button
              className={`${styles.button} ${styles.buttonPrimary}`}
              onClick={() => router.push(`/dashboard/saisie?classe=${classeId}`)}>
              ✏️ Saisir des scores
            </button>
          </div>
        </div>

        {/* Formulaire ajout élève */}
        {showAddForm && (
          <div style={{
            background: 'white', borderRadius: 14, border: '1.5px solid var(--border-light)',
            padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <input
              value={newNom}
              onChange={e => setNewNom(e.target.value)}
              placeholder="Nom"
              style={{ border: '1.5px solid var(--border-main)', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', flex: 1, textTransform: 'uppercase' }}
              autoFocus
            />
            <input
              value={newPrenom}
              onChange={e => setNewPrenom(e.target.value)}
              placeholder="Prénom"
              onKeyDown={e => e.key === 'Enter' && ajouterEleve()}
              style={{ border: '1.5px solid var(--border-main)', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', flex: 1 }}
            />
            <button
              onClick={ajouterEleve}
              disabled={adding || !newNom.trim() || !newPrenom.trim()}
              style={{
                background: 'var(--primary-dark)', color: 'white', border: 'none', borderRadius: 10,
                padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'var(--font-sans)', opacity: (adding || !newNom.trim() || !newPrenom.trim()) ? 0.5 : 1,
                whiteSpace: 'nowrap' as const,
              }}>
              {adding ? '…' : 'Ajouter'}
            </button>
          </div>
        )}

        {eleves.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>👤</div>
            <p className={styles.emptyStateText}>
              Aucun élève dans cette classe.{' '}
              <button
                onClick={() => router.push('/dashboard/import')}
                style={{
                  color: 'var(--accent-gold)', background: 'none', border: 'none',
                  cursor: 'pointer', textDecoration: 'underline',
                  fontFamily: 'inherit', fontSize: 'inherit',
                }}>
                Importer des élèves →
              </button>
            </p>
          </div>
        ) : (
          <>
            <div className={styles.statsBar}>
              <div className={styles.statItem}>
                <div className={styles.statNumber}>{eleves.length}</div>
                <div className={styles.statLabel}>Élèves</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statNumber}>
                  {scores.filter(s => !s.non_evalue && s.score !== null).length}
                </div>
                <div className={styles.statLabel}>Scores enregistrés</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statNumber}>
                  {(() => {
                    const vals = scores.filter(s => !s.non_evalue && s.score !== null).map(s => s.score as number)
                    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : '—'
                  })()}
                </div>
                <div className={styles.statLabel}>Score moyen</div>
              </div>
            </div>

            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead className={styles.tableHead}>
                  <tr>
                    <th className={styles.tableHeaderCell}>Nom</th>
                    <th className={styles.tableHeaderCell}>Prénom</th>
                    <th className={styles.tableHeaderCell}>Dernier score</th>
                    <th className={styles.tableHeaderCell}>Période</th>
                    <th className={styles.tableHeaderCell}></th>
                  </tr>
                </thead>
                <tbody>
                  {eleves.map(e => {
                    const s = dernierScore(e.id)
                    return (
                      <tr key={e.id} className={styles.tableRow}>
                        <td className={`${styles.tableCell} ${styles.namePrimary}`}>{e.nom}</td>
                        <td className={`${styles.tableCell} ${styles.tableCellSmall}`}>{e.prenom}</td>
                        <td className={styles.tableCell}>
                          {s ? (
                            s.non_evalue ? (
                              <span className={styles.badge} style={{ background: 'rgba(234,88,12,0.1)', color: '#c2410c' }}>N.É.</span>
                            ) : (
                              <span className={`${styles.badge} ${styles.badgeActive}`}>{s.score} m/min</span>
                            )
                          ) : (
                            <span className={`${styles.badge} ${styles.badgeInactive}`}>—</span>
                          )}
                        </td>
                        <td className={`${styles.tableCell} ${styles.tableCellSmall}`}>
                          {s?.periode?.code || '—'}
                        </td>
                        <td className={styles.tableCell} style={{ textAlign: 'center' }}>
                          <button onClick={() => desactiverEleve(e.id, `${e.prenom} ${e.nom}`)} style={{
                            background: 'transparent', color: '#dc2626', border: '1px solid #fca5a5',
                            borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'var(--font-sans)',
                          }}>Retirer</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
