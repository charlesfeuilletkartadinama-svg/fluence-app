'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'

type Classe     = { id: string; nom: string; niveau: string }
type Enseignant = { id: string; nom: string; prenom: string; email: string; classes: string[] }
type Invitation = { id: string; code: string; role: string; actif: boolean }

const NIVEAUX = ['CP', 'CE1', 'CE2', 'CM1', 'CM2', 'ULIS', '6ème', '5ème', '4ème', '3ème', 'Autre']

// ── Styles inline partagés ────────────────────────────────────────────────────

const btn = (variant: 'primary' | 'outline' | 'danger' | 'gold') => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: variant === 'primary' || variant === 'gold' ? '11px 22px' : '9px 18px',
  borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'var(--font-sans)', border: 'none', transition: 'opacity 0.15s',
  background:
    variant === 'primary' ? 'var(--primary-dark)'
    : variant === 'gold'  ? 'var(--accent-gold)'
    : variant === 'danger' ? '#DC2626'
    : 'white',
  color:
    variant === 'outline' ? 'var(--text-secondary)' : 'white',
  ...(variant === 'outline' && { border: '1.5px solid var(--border-light)' }),
})

const card = {
  background: 'white', borderRadius: 16, padding: 28,
  border: '1.5px solid var(--border-light)', marginBottom: 20,
}

export default function Onboarding() {
  const [etape, setEtape]             = useState(1)
  const [classes, setClasses]         = useState<Classe[]>([])
  const [enseignants, setEnseignants] = useState<Enseignant[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading]         = useState(true)
  const [codeGenere, setCodeGenere]   = useState('')

  // Ajout classe
  const [nomClasse, setNomClasse]       = useState('')
  const [niveauClasse, setNiveauClasse] = useState('CP')
  const [addingClass, setAddingClass]   = useState(false)

  // Assignation enseignant → classes
  const [assignModal, setAssignModal]               = useState<Enseignant | null>(null)
  const [classesSelectionnees, setClassesSelectionnees] = useState<string[]>([])
  const [savingAssign, setSavingAssign]              = useState(false)

  const { profil } = useProfil()
  const supabase   = createClient()
  const router     = useRouter()

  useEffect(() => { if (profil) charger() }, [profil])

  async function charger() {
    if (!profil?.etablissement_id) { setLoading(false); return }

    const { data: cls } = await supabase.from('classes').select('id, nom, niveau')
      .eq('etablissement_id', profil.etablissement_id).order('niveau')
    setClasses(cls || [])

    const { data: inv } = await supabase.from('invitations').select('id, code, role, actif')
      .eq('etablissement_id', profil.etablissement_id)
    setInvitations(inv || [])

    const { data: profs } = await supabase.from('profils')
      .select('id, nom, prenom, email')
      .eq('etablissement_id', profil.etablissement_id)
      .eq('role', 'enseignant')

    if (profs && profs.length > 0) {
      const { data: ec } = await supabase.from('enseignant_classes')
        .select('enseignant_id, classe_id')
        .in('enseignant_id', profs.map((p: any) => p.id))
      const ensMap: Record<string, string[]> = {}
      ;(ec || []).forEach((r: any) => {
        if (!ensMap[r.enseignant_id]) ensMap[r.enseignant_id] = []
        ensMap[r.enseignant_id].push(r.classe_id)
      })
      setEnseignants(profs.map((p: any) => ({ ...p, classes: ensMap[p.id] || [] })))
    } else {
      setEnseignants([])
    }

    setLoading(false)
  }

  async function ajouterClasse() {
    if (!nomClasse.trim() || !profil?.etablissement_id) return
    setAddingClass(true)
    await supabase.from('classes').insert({
      nom: nomClasse.trim(), niveau: niveauClasse,
      etablissement_id: profil.etablissement_id, annee_scolaire: '2025-2026',
    })
    setNomClasse('')
    await charger()
    setAddingClass(false)
  }

  async function supprimerClasse(id: string, nomC: string) {
    const { count } = await supabase.from('eleves')
      .select('*', { count: 'exact', head: true }).eq('classe_id', id)
    if (count && count > 0) {
      alert(`La classe "${nomC}" contient ${count} élève(s). Supprimez d'abord les élèves avant de supprimer la classe.`)
      return
    }
    if (!confirm(`Supprimer la classe "${nomC}" ?`)) return
    await supabase.from('classes').delete().eq('id', id)
    await charger()
  }

  async function genererCode() {
    if (!profil?.etablissement_id) return
    const code = 'ENS-' + Math.random().toString(36).substring(2, 8).toUpperCase()
    const { error } = await supabase.from('invitations').insert({
      code, role: 'enseignant', etablissement_id: profil.etablissement_id, actif: true,
    })
    if (!error) { setCodeGenere(code); await charger() }
  }

  async function desactiverCode(id: string) {
    await supabase.from('invitations').update({ actif: false }).eq('id', id)
    await charger()
  }

  function ouvrirAssign(ens: Enseignant) {
    setAssignModal(ens)
    setClassesSelectionnees([...ens.classes])
  }

  async function sauvegarderAssign() {
    if (!assignModal) return
    setSavingAssign(true)
    await supabase.from('enseignant_classes').delete().eq('enseignant_id', assignModal.id)
    if (classesSelectionnees.length > 0) {
      await supabase.from('enseignant_classes').insert(
        classesSelectionnees.map(cid => ({ enseignant_id: assignModal.id, classe_id: cid }))
      )
    }
    setAssignModal(null)
    setSavingAssign(false)
    await charger()
  }

  function toggleClasseAssign(id: string) {
    setClassesSelectionnees(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function telechargerModeleCSV() {
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

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ marginLeft: 'var(--sidebar-width)', padding: 48 }}>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Chargement...</p>
      </main>
    </div>
  )

  const steps = [
    { n: 1, label: 'Structure' },
    { n: 2, label: 'Enseignants' },
    { n: 3, label: 'Élèves' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-gray)' }}>
      <Sidebar />

      {/* Modal assignation enseignant */}
      {assignModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 32, width: 440, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-dark)', marginBottom: 4, fontFamily: 'var(--font-sans)' }}>
              Assigner des classes
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              {assignModal.prenom} {assignModal.nom}
            </p>
            {classes.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '16px 0' }}>
                Aucune classe. Créez d'abord vos classes à l'étape 1.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {classes.map(c => {
                  const sel = classesSelectionnees.includes(c.id)
                  return (
                    <label key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                      borderRadius: 10, cursor: 'pointer',
                      background: sel ? 'rgba(0,24,69,0.06)' : 'var(--bg-gray)',
                      border: `1.5px solid ${sel ? 'var(--primary-dark)' : 'var(--border-light)'}`,
                      transition: 'all 0.1s',
                    }}>
                      <input type="checkbox" checked={sel} onChange={() => toggleClasseAssign(c.id)}
                        style={{ accentColor: 'var(--primary-dark)', width: 16, height: 16 }} />
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary-dark)' }}>{c.nom}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4 }}>{c.niveau}</span>
                    </label>
                  )
                })}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setAssignModal(null)} style={btn('outline') as any}>Annuler</button>
              <button onClick={sauvegarderAssign} disabled={savingAssign} style={btn('primary') as any}>
                {savingAssign ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <main style={{ marginLeft: 'var(--sidebar-width)', padding: 48, flex: 1, maxWidth: 860 }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--primary-dark)', marginBottom: 6 }}>
            Configuration de l'établissement
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Paramétrez votre école en 3 étapes
          </p>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
          {steps.map((s, i) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
              <button onClick={() => setEtape(s.n)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
                borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                background: etape === s.n ? 'var(--primary-dark)' : etape > s.n ? 'rgba(22,163,74,0.1)' : 'white',
                color: etape === s.n ? 'white' : etape > s.n ? '#16A34A' : 'var(--text-secondary)',
                fontWeight: 700, fontSize: 14, transition: 'all 0.15s',
                boxShadow: etape === s.n ? '0 2px 8px rgba(0,24,69,0.15)' : 'none',
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: etape === s.n ? 'rgba(255,255,255,0.2)' : etape > s.n ? '#16A34A' : 'var(--bg-gray)',
                  color: etape === s.n ? 'white' : etape > s.n ? 'white' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 800,
                }}>
                  {etape > s.n ? '✓' : s.n}
                </div>
                {s.label}
              </button>
              {i < steps.length - 1 && (
                <div style={{ width: 32, height: 2, background: etape > s.n ? '#16A34A' : 'var(--border-light)' }} />
              )}
            </div>
          ))}
        </div>

        {/* ── Étape 1 — Structure ─────────────────────────────────────────────── */}
        {etape === 1 && (
          <div>
            <div style={card as any}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>
                    Classes de l'établissement
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                    {classes.length} classe{classes.length > 1 ? 's' : ''} configurée{classes.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Formulaire d'ajout */}
              <div style={{
                background: 'var(--bg-gray)', borderRadius: 12, padding: '16px 20px',
                border: '1.5px dashed var(--border-light)', marginBottom: 20,
              }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  Ajouter une classe
                </p>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 2, minWidth: 160 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                      Nom de la classe
                    </label>
                    <input
                      value={nomClasse}
                      onChange={e => setNomClasse(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && ajouterClasse()}
                      placeholder="ex : CP A, CE1 Malouet…"
                      style={{
                        width: '100%', border: '1.5px solid var(--border-light)', borderRadius: 8,
                        padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'var(--font-sans)',
                        background: 'white',
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                      Niveau
                    </label>
                    <select
                      value={niveauClasse}
                      onChange={e => setNiveauClasse(e.target.value)}
                      style={{
                        width: '100%', border: '1.5px solid var(--border-light)', borderRadius: 8,
                        padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'var(--font-sans)',
                        background: 'white',
                      }}
                    >
                      {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <button
                    onClick={ajouterClasse}
                    disabled={addingClass || !nomClasse.trim()}
                    style={{ ...btn('primary') as any, opacity: !nomClasse.trim() ? 0.5 : 1 }}
                  >
                    {addingClass ? '…' : '+ Ajouter'}
                  </button>
                </div>
              </div>

              {/* Liste des classes */}
              {classes.length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
                  Aucune classe encore. Utilisez le formulaire ci-dessus pour en créer.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {classes.map(c => (
                    <div key={c.id} style={{
                      background: 'var(--bg-gray)', borderRadius: 12, padding: '14px 16px',
                      border: '1.5px solid var(--border-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)' }}>{c.nom}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>{c.niveau}</div>
                      </div>
                      <button
                        onClick={() => supprimerClasse(c.id, c.nom)}
                        title="Supprimer"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626',
                          fontSize: 16, padding: '4px 6px', borderRadius: 6, lineHeight: 1,
                          opacity: 0.6,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => setEtape(2)} style={btn('primary') as any}>
              Étape suivante → Enseignants
            </button>
          </div>
        )}

        {/* ── Étape 2 — Enseignants ───────────────────────────────────────────── */}
        {etape === 2 && (
          <div>
            {/* Enseignants inscrits */}
            <div style={card as any}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>
                    Enseignants de l'établissement
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                    {enseignants.length} enseignant{enseignants.length > 1 ? 's' : ''} inscrit{enseignants.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {enseignants.length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                  Aucun enseignant inscrit pour l'instant. Partagez un code d'invitation ci-dessous.
                </p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 4 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-gray)' }}>
                      {['Enseignant', 'Adresse email', 'Classes assignées', 'Action'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {enseignants.map(ens => {
                      const nomClasses = ens.classes.map(cid => classes.find(c => c.id === cid)?.nom || '?').join(', ')
                      return (
                        <tr key={ens.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary-dark)' }}>
                            {ens.prenom} {ens.nom}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 12 }}>
                            {ens.email}
                          </td>
                          <td style={{ padding: '12px 16px', color: ens.classes.length > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: 12 }}>
                            {ens.classes.length > 0 ? nomClasses : 'Aucune classe assignée'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <button onClick={() => ouvrirAssign(ens)} style={btn('outline') as any}>
                              Assigner
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Codes d'invitation */}
            <div style={card as any}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>
                    Codes d'invitation
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                    Partagez ces codes avec vos enseignants pour créer leur compte
                  </p>
                </div>
                <button onClick={genererCode} style={btn('gold') as any}>
                  + Générer un code
                </button>
              </div>

              {codeGenere && (
                <div style={{
                  background: 'rgba(22,163,74,0.08)', border: '1.5px solid #86efac',
                  borderRadius: 12, padding: '14px 20px', marginBottom: 20,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <span style={{ fontSize: 20 }}>✅</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#16A34A', fontSize: 13 }}>Code généré — à partager avec l'enseignant</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: 'var(--primary-dark)', letterSpacing: 3 }}>{codeGenere}</div>
                  </div>
                </div>
              )}

              {invitations.filter(i => i.role === 'enseignant').length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                  Aucun code généré.
                </p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-gray)' }}>
                      {['Code', 'Statut', 'Action'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.filter(i => i.role === 'enseignant').map(inv => (
                      <tr key={inv.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-dark)', fontSize: 16, letterSpacing: 2 }}>{inv.code}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {inv.actif
                            ? <span style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A', fontWeight: 700, fontSize: 12, padding: '3px 10px', borderRadius: 6 }}>Actif</span>
                            : <span style={{ background: 'var(--bg-gray)', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 12, padding: '3px 10px', borderRadius: 6 }}>Désactivé</span>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {inv.actif && (
                            <button onClick={() => desactiverCode(inv.id)} style={btn('outline') as any}>
                              Désactiver
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setEtape(1)} style={btn('outline') as any}>← Retour</button>
              <button onClick={() => setEtape(3)} style={btn('primary') as any}>Étape suivante → Importer les élèves</button>
            </div>
          </div>
        )}

        {/* ── Étape 3 — Import élèves ─────────────────────────────────────────── */}
        {etape === 3 && (
          <div>
            <div style={card as any}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: '0 0 8px' }}>
                Importer les élèves
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24, lineHeight: 1.7 }}>
                Importez vos listes d'élèves par classe au format CSV.
                Chaque ligne doit contenir : <strong>nom, prénom, date de naissance, sexe, classe, numéro INE</strong>.
              </p>

              {/* Téléchargement modèle */}
              <div style={{
                background: 'rgba(0,24,69,0.04)', borderRadius: 12, padding: '18px 20px',
                border: '1.5px solid var(--border-light)', marginBottom: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary-dark)', marginBottom: 4 }}>
                    Modèle CSV prêt à remplir
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Colonnes : <code style={{ background: 'var(--bg-gray)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>
                      nom ; prenom ; date_naissance ; sexe ; classe ; numero_ine
                    </code>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    Format date : AAAA-MM-JJ — Sexe : M ou F — Séparateur : point-virgule
                  </div>
                </div>
                <button onClick={telechargerModeleCSV} style={btn('gold') as any}>
                  ⬇ Télécharger le modèle
                </button>
              </div>

              <a href="/dashboard/import" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'var(--primary-dark)', color: 'white',
                padding: '13px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700,
                textDecoration: 'none', fontFamily: 'var(--font-sans)',
              }}>
                Aller à l'importation →
              </a>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button onClick={() => setEtape(2)} style={btn('outline') as any}>← Retour</button>
              <button onClick={() => router.push('/dashboard')} style={{
                ...btn('primary') as any,
                background: '#16A34A',
              }}>
                ✓ Terminer la configuration
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
