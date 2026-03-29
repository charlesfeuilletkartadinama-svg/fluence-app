'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'
import styles from './import.module.css'
import type { Classe } from '@/app/lib/types'

// ── Types ──────────────────────────────────────────────────────────────────

type EleveCSV = {
  nom: string
  prenom: string
  date_naissance: string
  sexe: string
  classe: string  // nom de la classe dans le CSV
  numero_ine: string
  // Statut après parsing
  _valid: boolean
  _erreur?: string
}

// ── Parser CSV ────────────────────────────────────────────────────────────

function normaliserEntete(h: string): string {
  return h.trim().toLowerCase()
    .replace(/[éèê]/g, 'e').replace(/[àâ]/g, 'a').replace(/[îï]/g, 'i').replace(/[ôö]/g, 'o').replace(/[ùûü]/g, 'u')
    .replace(/\s+/g, '_')
    .replace('prenom', 'prenom')
    .replace('date_de_naissance', 'date_naissance')
    .replace('numero_ine', 'numero_ine')
    .replace('no_ine', 'numero_ine')
    .replace('ine', 'numero_ine')
}

function parseCSV(texte: string): EleveCSV[] {
  const lignes = texte.trim().split(/\r?\n/)
  if (lignes.length < 2) return []

  // Détecter le séparateur
  const sep = lignes[0].includes(';') ? ';' : ','
  const entetes = lignes[0].split(sep).map(normaliserEntete)

  return lignes.slice(1)
    .filter(l => l.trim())
    .map(ligne => {
      const cols = ligne.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''))
      const get = (key: string) => cols[entetes.indexOf(key)] || ''

      const nom = get('nom').toUpperCase().replace(/[<>{}|\\^`]/g, '').trim()
      const prenom = get('prenom').replace(/[<>{}|\\^`]/g, '').trim()
      const classe = get('classe').replace(/[<>{}|\\^`]/g, '').trim()

      return {
        nom,
        prenom,
        date_naissance: get('date_naissance'),
        sexe:           get('sexe'),
        classe,
        numero_ine:     get('numero_ine'),
        _valid:         !!(nom && prenom && classe),
        _erreur:        !nom ? 'Nom manquant' : !prenom ? 'Prénom manquant' : !classe ? 'Classe manquante' : undefined,
      }
    })
}

// ── Composant principal ────────────────────────────────────────────────────

export default function ImportCSV() {
  const [etape,       setEtape]       = useState<'upload' | 'apercu' | 'import' | 'done'>('upload')
  const [classes,     setClasses]     = useState<Classe[]>([])
  const [eleves,      setEleves]      = useState<EleveCSV[]>([])
  const [erreur,      setErreur]      = useState('')
  const [progression, setProgression] = useState(0)
  const [resultats,   setResultats]   = useState({ importes: 0, mises_a_jour: 0, erreurs: 0, classes_creees: 0 })

  const { profil } = useProfil()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!profil) return
    const ALLOWED_ROLES = ['directeur', 'principal', 'admin', 'coordo_rep', 'ien']
    if (!ALLOWED_ROLES.includes(profil.role)) { router.push('/dashboard'); return }
    if (profil.etablissement_id) chargerClasses()
  }, [profil])

  async function chargerClasses() {
    const { data } = await supabase
      .from('classes').select('id, nom, niveau')
      .eq('etablissement_id', profil!.etablissement_id!).order('niveau')
    setClasses(data || [])
  }

  function sanitize(str: string): string {
    return str.replace(/[<>{}|\\^`]/g, '').trim()
  }

  function handleFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    // Validation taille (5 Mo max)
    if (fichier.size > 5 * 1024 * 1024) {
      setErreur('Le fichier est trop volumineux (5 Mo maximum).')
      return
    }
    // Validation type
    if (!fichier.name.match(/\.(csv|txt)$/i)) {
      setErreur('Format non supporté. Utilisez un fichier .csv ou .txt.')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const texte = ev.target?.result as string
        const raw = parseCSV(texte)
        if (raw.length === 0) {
          setErreur('Aucun élève trouvé. Vérifiez le format du fichier.')
          return
        }
        // Déduplication par (nom, prenom, classe) sur les lignes valides
        const seen = new Set<string>()
        const data = raw.map(e => {
          if (!e._valid) return e
          const key = `${e.nom}|${e.prenom}|${e.classe}`.toLowerCase()
          if (seen.has(key)) return { ...e, _valid: false, _erreur: 'Doublon' }
          seen.add(key)
          return e
        })
        setEleves(data)
        setErreur('')
        setEtape('apercu')
      } catch {
        setErreur('Erreur lors de la lecture du fichier.')
      }
    }
    reader.readAsText(fichier, 'UTF-8')
  }

  async function lancerImport() {
    if (!profil?.etablissement_id) return
    setEtape('import')
    setProgression(0)

    let nbImportes = 0, nbMaj = 0, nbErreurs = 0, nbClassesCrees = 0

    // Construire la map des classes existantes (nom → id)
    const classeMap: Record<string, string> = {}
    classes.forEach(c => { classeMap[c.nom.toLowerCase()] = c.id })

    // Pré-charger tous les élèves existants des classes connues (évite N+1 dans la boucle)
    const knownClasseIds = Object.values(classeMap)
    const existingByIne: Record<string, string> = {}
    const existingByNomPrenom: Record<string, string> = {}
    if (knownClasseIds.length > 0) {
      const { data: existingEleves } = await supabase
        .from('eleves').select('id, nom, prenom, classe_id, numero_ine')
        .in('classe_id', knownClasseIds)
      ;(existingEleves || []).forEach((e: any) => {
        if (e.numero_ine) existingByIne[e.numero_ine] = e.id
        existingByNomPrenom[`${e.nom}|${e.prenom}|${e.classe_id}`] = e.id
      })
    }

    const total = eleves.filter(e => e._valid).length
    let done = 0

    for (const eleve of eleves.filter(e => e._valid)) {
      try {
        // Trouver ou créer la classe
        const nomClasse = eleve.classe.trim()
        const keyClasse = nomClasse.toLowerCase()
        let classeId = classeMap[keyClasse]

        if (!classeId) {
          const { data: newClasse } = await supabase
            .from('classes')
            .insert({ nom: nomClasse, niveau: nomClasse, etablissement_id: profil.etablissement_id, annee_scolaire: '2025-2026' })
            .select('id').single()
          if (newClasse) {
            classeId = newClasse.id
            classeMap[keyClasse] = classeId
            nbClassesCrees++
          }
        }

        if (!classeId) { nbErreurs++; continue }

        // Chercher si l'élève existe déjà — lookup en mémoire (pré-chargé avant la boucle)
        let existingId: string | null = null
        if (eleve.numero_ine && existingByIne[eleve.numero_ine]) {
          existingId = existingByIne[eleve.numero_ine]
        } else {
          existingId = existingByNomPrenom[`${eleve.nom}|${eleve.prenom}|${classeId}`] || null
        }

        const payload: any = {
          nom:            eleve.nom,
          prenom:         eleve.prenom,
          classe_id:      classeId,
          actif:          true,
        }
        if (eleve.date_naissance) payload.date_naissance = eleve.date_naissance || null
        if (eleve.sexe) payload.sexe = eleve.sexe || null
        if (eleve.numero_ine) payload.numero_ine = eleve.numero_ine || null

        let error: any = null
        if (existingId) {
          const res = await supabase.from('eleves').update(payload).eq('id', existingId)
          error = res.error
          if (!error) nbMaj++
        } else {
          const res = await supabase.from('eleves').insert(payload)
          error = res.error
          if (!error) nbImportes++
        }

        if (error) nbErreurs++

      } catch {
        nbErreurs++
      }

      done++
      setProgression(Math.round(done / total * 100))
    }

    setResultats({ importes: nbImportes, mises_a_jour: nbMaj, erreurs: nbErreurs, classes_creees: nbClassesCrees })
    setEtape('done')
  }

  function telechargerModele() {
    const lignes = [
      'nom;prenom;date_naissance;sexe;classe;numero_ine',
      'DUPONT;Marie;2016-09-15;F;CPA;1234567890A',
      'MARTIN;Paul;2016-11-03;M;CPA;0987654321B',
      'BERNARD;Léa;2015-04-22;F;CE1B;1122334455C',
    ]
    const blob = new Blob([lignes.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'modele_import_eleves.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const elevesValides   = eleves.filter(e => e._valid)
  const elevesInvalides = eleves.filter(e => !e._valid)
  const classesCSV      = [...new Set(eleves.map(e => e.classe).filter(Boolean))]

  const ETAPES = ['Fichier', 'Aperçu', 'Import', 'Terminé']
  const etapeIdx = ['upload', 'apercu', 'import', 'done'].indexOf(etape)

  return (
    <div className={styles.page}>
      <Sidebar />
      <ImpersonationBar />

      <main className={styles.main}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Importation élèves</h1>
            <p className={styles.subtitle}>Importer des élèves depuis un fichier CSV</p>
          </div>
        </div>

        {/* Stepper */}
        <div className={styles.stepper}>
          {ETAPES.map((label, i) => (
            <div key={i} className={styles.stepItem}>
              <div className={`${styles.stepCircle} ${etapeIdx === i ? styles.stepActive : etapeIdx > i ? styles.stepDone : ''}`}>
                {etapeIdx > i ? '✓' : i + 1}
              </div>
              <span className={`${styles.stepLabel} ${etapeIdx === i ? styles.stepLabelActive : ''}`}>{label}</span>
              {i < 3 && <div className={styles.stepLine} />}
            </div>
          ))}
        </div>

        {/* ── Étape 1 : Upload ── */}
        {etape === 'upload' && (
          <div className={styles.uploadZone}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
            <h2 className={styles.uploadTitle}>Sélectionnez votre fichier CSV</h2>
            <p className={styles.uploadDesc}>
              Colonnes attendues (séparateur ; ou ,) :<br />
              <strong>Nom · Prénom · Date de naissance · Sexe · Classe · Numéro INE</strong>
            </p>
            <button onClick={telechargerModele} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 4,
              background: 'rgba(0,24,69,0.08)', border: '1.5px solid var(--border-light)',
              borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--primary-dark)',
            }}>
              ⬇ Télécharger le modèle CSV
            </button>
            {erreur && (
              <div className={styles.erreurBanner}>{erreur}</div>
            )}
            <label className={styles.btnUpload}>
              Choisir un fichier
              <input type="file" accept=".csv" onChange={handleFichier} style={{ display: 'none' }} />
            </label>
            <p className={styles.uploadHint}>Format CSV, encodage UTF-8</p>
          </div>
        )}

        {/* ── Étape 2 : Aperçu ── */}
        {etape === 'apercu' && (
          <>
            {/* Résumé */}
            <div className={styles.resumeGrid}>
              <div className={styles.resumeCard}>
                <div className={styles.resumeNum} style={{ color: '#16A34A' }}>{elevesValides.length}</div>
                <div className={styles.resumeLabel}>Élèves à importer</div>
              </div>
              <div className={styles.resumeCard}>
                <div className={styles.resumeNum}>{classesCSV.length}</div>
                <div className={styles.resumeLabel}>Classes détectées</div>
              </div>
              {elevesInvalides.length > 0 && (
                <div className={styles.resumeCard}>
                  <div className={styles.resumeNum} style={{ color: '#DC2626' }}>{elevesInvalides.length}</div>
                  <div className={styles.resumeLabel}>Lignes ignorées</div>
                </div>
              )}
            </div>

            {/* Classes détectées */}
            <div className={styles.card} style={{ marginBottom: 20 }}>
              <h3 className={styles.cardTitle}>Classes dans le fichier</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {classesCSV.map(c => {
                  const existe = classes.some(cl => cl.nom.toLowerCase() === c.toLowerCase())
                  return (
                    <span key={c} style={{
                      background: existe ? 'rgba(22,163,74,0.08)' : 'rgba(217,119,6,0.08)',
                      color: existe ? '#16A34A' : '#D97706',
                      fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 8,
                    }}>
                      {c} {existe ? '· existe' : '· sera créée'}
                    </span>
                  )
                })}
              </div>
            </div>

            {/* Tableau aperçu */}
            <div className={styles.tableContainer} style={{ marginBottom: 24 }}>
              <div className={styles.tableHeader}>
                Aperçu · {Math.min(10, elevesValides.length)} premiers élèves
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead style={{ background: 'var(--bg-gray)', borderBottom: '1px solid var(--border-main)' }}>
                    <tr>
                      {['Nom', 'Prénom', 'Classe', 'N° INE', 'Date naissance', 'Sexe'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {elevesValides.slice(0, 10).map((e, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--primary-dark)' }}>{e.nom}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-primary)' }}>{e.prenom}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{e.classe}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>{e.numero_ine || '—'}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{e.date_naissance || '—'}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{e.sexe || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Lignes invalides */}
            {elevesInvalides.length > 0 && (
              <div className={styles.erreurBanner} style={{ marginBottom: 20 }}>
                <strong>{elevesInvalides.length} ligne(s) ignorée(s)</strong> : {elevesInvalides.map(e => e._erreur).join(', ')}
              </div>
            )}

            <div className={styles.actionRow}>
              <button className={styles.btnOutline} onClick={() => setEtape('upload')}>← Recommencer</button>
              <button className={styles.btnPrimary} onClick={lancerImport} disabled={elevesValides.length === 0}>
                Importer {elevesValides.length} élèves →
              </button>
            </div>
          </>
        )}

        {/* ── Étape 3 : Import en cours ── */}
        {etape === 'import' && (
          <div className={styles.progressCard}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <h2 className={styles.cardTitle}>Import en cours…</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              {progression}% — Ne fermez pas cette page
            </p>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progression}%` }} />
            </div>
          </div>
        )}

        {/* ── Étape 4 : Terminé ── */}
        {etape === 'done' && (
          <div className={styles.progressCard}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 className={styles.cardTitle}>Import terminé !</h2>
            <div className={styles.resumeGrid} style={{ marginTop: 24, marginBottom: 24 }}>
              <div className={styles.resumeCard} style={{ background: 'rgba(22,163,74,0.06)' }}>
                <div className={styles.resumeNum} style={{ color: '#16A34A' }}>{resultats.importes}</div>
                <div className={styles.resumeLabel}>Nouveaux élèves</div>
              </div>
              <div className={styles.resumeCard} style={{ background: 'rgba(37,99,235,0.06)' }}>
                <div className={styles.resumeNum} style={{ color: '#2563EB' }}>{resultats.mises_a_jour}</div>
                <div className={styles.resumeLabel}>Mis à jour</div>
              </div>
              {resultats.classes_creees > 0 && (
                <div className={styles.resumeCard}>
                  <div className={styles.resumeNum}>{resultats.classes_creees}</div>
                  <div className={styles.resumeLabel}>Classes créées</div>
                </div>
              )}
              {resultats.erreurs > 0 && (
                <div className={styles.resumeCard} style={{ background: 'rgba(220,38,38,0.06)' }}>
                  <div className={styles.resumeNum} style={{ color: '#DC2626' }}>{resultats.erreurs}</div>
                  <div className={styles.resumeLabel}>Erreurs</div>
                </div>
              )}
            </div>
            <div className={styles.actionRow}>
              <button className={styles.btnOutline} onClick={() => { setEtape('upload'); setEleves([]) }}>
                Nouvel import
              </button>
              <button className={styles.btnPrimary} onClick={() => router.push('/dashboard/eleves')}>
                Voir les élèves →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
