'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'
import styles from './eleves.module.css'

type Classe = {
  id: string
  nom: string
  niveau: string
  groupe_lecture: string | null
  etablissement: { nom: string }
  nbEleves: number
}

type ClasseRaw = {
  id: string
  nom: string
  niveau: string
  etablissement: { nom: string }
  eleves: { count: number }[]
}

type ClasseDisponible = {
  id: string
  nom: string
  niveau: string
  groupes: string[]
}

type EleveRecherche = {
  id: string
  nom: string
  prenom: string
  classeNom: string
  classeId: string
}

export default function MesClasses() {
  const [classes, setClasses]           = useState<Classe[]>([])
  const [classesDisponibles, setClassesDisponibles] = useState<ClasseDisponible[]>([])
  const [mode, setMode]                 = useState<'liste' | 'selection'>('liste')
  const [selections, setSelections]     = useState<{classeId: string, groupe: string | null}[]>([])
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [recherche, setRecherche]       = useState('')
  const [resultats, setResultats]       = useState<EleveRecherche[]>([])
  const [rechercheLoading, setRechercheLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { profil } = useProfil()
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (profil) chargerDonnees()
  }, [profil])

  async function chargerDonnees() {
    if (!profil) return
    const isEnseignant = profil.role === 'enseignant'

    if (isEnseignant) {
      // Charger les classes assignées à cet enseignant
      const { data: assignees } = await supabase
        .from('enseignant_classes')
        .select('classe_id, groupe_lecture, classe:classes(id, nom, niveau, etablissement:etablissements(nom))')
        .eq('enseignant_id', profil.id)

      if (!assignees || assignees.length === 0) {
        // Pas encore de classes → mode sélection
        await chargerClassesDisponibles()
        setMode('selection')
        setLoading(false)
        return
      }

      // Compter les élèves par classe (count embarqué — pas de N+1)
      const { data: assigneesAvecCount } = await supabase
        .from('enseignant_classes')
        .select('classe_id, groupe_lecture, classe:classes(id, nom, niveau, etablissement:etablissements(nom), eleves(count))')
        .eq('enseignant_id', profil.id)

      const classesAvecNb: Classe[] = (assigneesAvecCount || []).map((a: any) => ({
        id:             a.classe_id,
        nom:            a.classe?.nom || '',
        niveau:         a.classe?.niveau || '',
        groupe_lecture: a.groupe_lecture,
        etablissement:  a.classe?.etablissement || { nom: '' },
        nbEleves:       a.classe?.eleves?.[0]?.count || 0,
      }))
      setClasses(classesAvecNb)
      setSelections(assignees.map((a: any) => ({
        classeId: a.classe_id, groupe: a.groupe_lecture
      })))

    } else {
      // Directeur / Principal → toutes les classes de l'établissement
      // Count des élèves embarqué dans la requête (pas de N+1)
      let queryAvecCount = supabase
        .from('classes')
        .select('id, nom, niveau, etablissement:etablissements(nom), eleves(count)')
        .order('niveau')

      if (profil.etablissement_id) {
        queryAvecCount = queryAvecCount.eq('etablissement_id', profil.etablissement_id)
      }

      const { data: dataAvecCount } = await queryAvecCount
      const classesAvecNb: Classe[] = ((dataAvecCount as unknown as ClasseRaw[]) || []).map(c => ({
        id:             c.id,
        nom:            c.nom,
        niveau:         c.niveau,
        groupe_lecture: null,
        etablissement:  c.etablissement,
        nbEleves:       c.eleves?.[0]?.count || 0,
      }))
      setClasses(classesAvecNb)
    }

    setLoading(false)
  }

  async function chargerClassesDisponibles() {
    if (!profil?.etablissement_id) return
    const { data } = await supabase
      .from('classes')
      .select('id, nom, niveau')
      .eq('etablissement_id', profil.etablissement_id)
      .order('niveau')

    // Groupes de lecture disponibles
    const { data: groupesData } = await supabase
      .from('eleves')
      .select('classe_id')
      .not('classe_id', 'is', null)

    const classesAvecGroupes: ClasseDisponible[] = (data || []).map((c: any) => ({
      ...c, groupes: []
    }))

    setClassesDisponibles(classesAvecGroupes)
  }

  // ── Recherche d'élève (direction) ─────────────────────────────────────
  function rechercherEleve(query: string) {
    setRecherche(query)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) { setResultats([]); return }
    debounceRef.current = setTimeout(async () => {
      setRechercheLoading(true)
      const { data } = await supabase
        .from('eleves')
        .select('id, nom, prenom, classe:classes(id, nom)')
        .or(`nom.ilike.%${query}%,prenom.ilike.%${query}%`)
        .eq('actif', true)
        .limit(15)
      setResultats((data || []).map((e: any) => ({
        id: e.id, nom: e.nom, prenom: e.prenom,
        classeNom: e.classe?.nom || '—', classeId: e.classe?.id || '',
      })))
      setRechercheLoading(false)
    }, 300)
  }

  function toggleSelection(classeId: string, groupe: string | null) {
    const exists = selections.some(s => s.classeId === classeId && s.groupe === groupe)
    if (exists) {
      setSelections(prev => prev.filter(s => !(s.classeId === classeId && s.groupe === groupe)))
    } else {
      setSelections(prev => [...prev, { classeId, groupe }])
    }
  }

  function isSelected(classeId: string, groupe: string | null) {
    return selections.some(s => s.classeId === classeId && s.groupe === groupe)
  }

  async function sauvegarderSelections() {
    if (!profil?.id || selections.length === 0) return
    setSaving(true)

    await supabase.from('enseignant_classes').delete().eq('enseignant_id', profil.id)
    await supabase.from('enseignant_classes').insert(
      selections.map(s => ({
        enseignant_id:  profil.id,
        classe_id:      s.classeId,
        groupe_lecture: s.groupe,
      }))
    )

    setSaving(false)
    setMode('liste')
    chargerDonnees()
  }

  // Grouper par niveau pour l'affichage
  const classesByNiveau: Record<string, Classe[]> = {}
  classes.forEach(c => {
    const key = c.niveau || 'Autre'
    if (!classesByNiveau[key]) classesByNiveau[key] = []
    classesByNiveau[key].push(c)
  })

  const disponiblesByNiveau: Record<string, ClasseDisponible[]> = {}
  classesDisponibles.forEach(c => {
    const key = c.niveau || 'Autre'
    if (!disponiblesByNiveau[key]) disponiblesByNiveau[key] = []
    disponiblesByNiveau[key].push(c)
  })

  return (
    <div className={styles.page}>
      <Sidebar />
      <ImpersonationBar />

      <main className={styles.main}>

        {/* ── Mode liste ── */}
        {mode === 'liste' && (
          <>
            <div className={styles.topbar}>
              <div>
                <h1 className={styles.pageTitle}>
                  {['directeur','principal','ia_dasen','recteur'].includes(profil?.role || '') ? 'Détail élève' : 'Mes classes'}
                </h1>
                <p className={styles.pageSub}>
                  {classes.length} classe{classes.length > 1 ? 's' : ''} assignée{classes.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className={styles.topbarActions}>
                {profil?.role === 'enseignant' && (
                  <button className={styles.btnModifier} onClick={async () => {
                    await chargerClassesDisponibles()
                    setMode('selection')
                  }}>
                    ✎ Modifier mes classes
                  </button>
                )}
                {['directeur','principal','admin'].includes(profil?.role || '') && (
                  <button className={styles.btnPrimary} onClick={() => router.push('/dashboard/import')}>
                    + Importer des élèves
                  </button>
                )}
              </div>
            </div>

            {/* ── Barre de recherche (direction) ── */}
            {['directeur','principal','ia_dasen','recteur'].includes(profil?.role || '') && (
              <div style={{ marginBottom: 24, position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Rechercher un élève par nom ou prénom…"
                  value={recherche}
                  onChange={e => rechercherEleve(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 16px 12px 44px',
                    border: '1.5px solid var(--border-main)', borderRadius: 12,
                    fontFamily: 'var(--font-sans)', fontSize: 14, background: 'white',
                    color: 'var(--text-primary)', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, pointerEvents: 'none' }}>🔍</span>
                {recherche.length >= 2 && (
                  <div style={{
                    position: 'absolute', top: '110%', left: 0, right: 0,
                    background: 'white', border: '1.5px solid var(--border-main)',
                    borderRadius: 12, boxShadow: 'var(--shadow-lg)', zIndex: 10,
                    overflow: 'hidden',
                  }}>
                    {rechercheLoading ? (
                      <div style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text-tertiary)' }}>Recherche…</div>
                    ) : resultats.length === 0 ? (
                      <div style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text-tertiary)' }}>Aucun élève trouvé</div>
                    ) : resultats.map(e => (
                      <div key={e.id}
                        onClick={() => { router.push(`/dashboard/eleve/${e.id}`); setRecherche(''); setResultats([]) }}
                        style={{
                          padding: '12px 18px', cursor: 'pointer', fontSize: 13,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          borderBottom: '1px solid var(--border-light)',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={el => (el.currentTarget.style.background = 'var(--bg-gray)')}
                        onMouseLeave={el => (el.currentTarget.style.background = 'white')}>
                        <span style={{ fontWeight: 600, color: 'var(--primary-dark)' }}>{e.prenom} {e.nom}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-gray)', padding: '2px 8px', borderRadius: 6 }}>{e.classeNom}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {loading ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Chargement...</div>
            ) : classes.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>📚</div>
                <p className={styles.emptyStateText}>Aucune classe assignée</p>
                <button className={styles.btnPrimary} style={{ marginTop: 24 }} onClick={async () => {
                  await chargerClassesDisponibles()
                  setMode('selection')
                }}>
                  Choisir mes classes →
                </button>
              </div>
            ) : (
              Object.entries(classesByNiveau).map(([niveau, cls]) => (
                <div key={niveau} className={styles.niveauSection}>
                  <div className={styles.niveauTitle}>{niveau}</div>
                  <div className={styles.classesGrid}>
                    {cls.map(c => (
                      <div key={c.id + (c.groupe_lecture || '')} className={styles.classeCard}
                        onClick={() => router.push(`/dashboard/eleves/${c.id}`)}>
                        <div className={styles.classeCardTop}>
                          <div>
                            <div className={styles.classeNom}>{c.nom}</div>
                            <div className={styles.classeNiveau}>{c.niveau}</div>
                          </div>
                          <div className={styles.classeNb}>{c.nbEleves} élèves</div>
                        </div>
                        {c.groupe_lecture && (
                          <div className={styles.classeGroupe}>Groupe : {c.groupe_lecture}</div>
                        )}
                        <div className={styles.classeEtab}>{c.etablissement?.nom}</div>
                        <div className={styles.classeBtns} onClick={e => e.stopPropagation()}>
                          <button className={styles.btnSaisie}
                            onClick={() => router.push(`/dashboard/saisie?classe=${c.id}`)}>
                            ✏️ Saisie
                          </button>
                          <button className={styles.btnPassation}
                            onClick={() => router.push(`/dashboard/passation?classe=${c.id}`)}>
                            ⏱️ Passation
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ── Mode sélection ── */}
        {mode === 'selection' && (
          <>
            <div className={styles.topbar}>
              <div>
                <h1 className={styles.pageTitle}>Choisir mes classes</h1>
                <p className={styles.pageSub}>Sélectionnez vos classes et groupes de lecture</p>
              </div>
            </div>

            <div className={styles.selectionBar}>
              <span className={styles.selectionCount}>
                <strong>{selections.length}</strong> sélection{selections.length > 1 ? 's' : ''}
              </span>
              <div className={styles.selectionActions}>
                {classes.length > 0 && (
                  <button className={styles.btnOutline} onClick={() => setMode('liste')}>
                    Annuler
                  </button>
                )}
                <button className={styles.btnPrimary}
                  disabled={saving || selections.length === 0}
                  onClick={sauvegarderSelections}>
                  {saving ? 'Enregistrement...' : 'Confirmer mes classes →'}
                </button>
              </div>
            </div>

            {Object.entries(disponiblesByNiveau).map(([niveau, cls]) => (
              <div key={niveau} className={styles.niveauSection}>
                <div className={styles.niveauTitle}>{niveau}</div>
                <div className={styles.chips}>
                  {cls.map(c => (
                    <button key={c.id}
                      className={`${styles.chip} ${isSelected(c.id, null) ? styles.chipSelected : ''}`}
                      onClick={() => toggleSelection(c.id, null)}>
                      {c.nom}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  )
}