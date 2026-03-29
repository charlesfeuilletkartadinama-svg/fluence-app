'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import type { Classe, Periode, Etablissement } from '@/app/lib/types'

// ── Types ──────────────────────────────────────────────────────────────────

type Enseignant = { id: string; nom: string; prenom: string; email: string; classes: string[] }
type Invitation = { id: string; code: string; role: string; actif: boolean }
type OngletConfig = 'structure' | 'passations'

const NIVEAUX      = ['CP', 'CE1', 'CE2', 'CM1', 'CM2', 'ULIS', '6ème', '5ème', '4ème', '3ème', 'Autre']
const PERIODES_STD = ['T1', 'T2', 'T3']

// ── Style helpers ──────────────────────────────────────────────────────────

const card = { background: 'white', borderRadius: 16, padding: 28, border: '1.5px solid var(--border-light)', marginBottom: 20 } as const

function Btn({ label, variant, onClick, disabled }: { label: string; variant: 'primary'|'outline'|'gold'|'danger'; onClick?: () => void; disabled?: boolean }) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--primary-dark)', color: 'white', border: 'none' },
    outline:  { background: 'white', color: 'var(--text-secondary)', border: '1.5px solid var(--border-light)' },
    gold:     { background: 'var(--accent-gold)', color: 'white', border: 'none' },
    danger:   { background: '#DC2626', color: 'white', border: 'none' },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...styles[variant],
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)',
      opacity: disabled ? 0.5 : 1, transition: 'opacity 0.15s',
    }}>
      {label}
    </button>
  )
}

// ── Composant principal ────────────────────────────────────────────────────

export default function Configuration() {
  const [onglet, setOnglet]           = useState<OngletConfig>('structure')
  const [etape, setEtape]             = useState(1)

  // Structure
  const [classes, setClasses]         = useState<Classe[]>([])
  const [enseignants, setEnseignants] = useState<Enseignant[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [nomClasse, setNomClasse]     = useState('')
  const [niveauClasse, setNiveauClasse] = useState('CP')
  const [addingClass, setAddingClass] = useState(false)
  const [assignModal, setAssignModal] = useState<Enseignant|null>(null)
  const [classesSel, setClassesSel]   = useState<string[]>([])
  const [savingAssign, setSavingAssign] = useState(false)
  const [codeGenere, setCodeGenere]   = useState('')

  // Passations
  const [periodes, setPeriodes]       = useState<Periode[]>([])
  const [newCode, setNewCode]         = useState('T1')
  const [newLabel, setNewLabel]       = useState('')
  const [newDebut, setNewDebut]       = useState('')
  const [newFin, setNewFin]           = useState('')
  const [newType, setNewType]         = useState<'regular'|'evaluation_nationale'>('regular')
  const [addingPer, setAddingPer]     = useState(false)
  const [editPer, setEditPer]         = useState<Periode|null>(null)

  // Admin : sélecteur d'établissement
  const [allEtabs, setAllEtabs]       = useState<Etablissement[]>([])
  const [selectedEtabId, setSelectedEtabId] = useState('')

  const [loading, setLoading] = useState(true)
  const { profil } = useProfil()
  const supabase   = createClient()
  const router     = useRouter()
  const isAdmin    = profil?.role === 'admin'

  // L'établissement actif : soit celui du profil, soit celui sélectionné par l'admin
  const etabId: string = isAdmin ? selectedEtabId : (profil?.etablissement_id || '')

  useEffect(() => {
    if (!profil) return
    if (isAdmin) {
      // Charger la liste des établissements pour le sélecteur
      supabase.from('etablissements').select('id, nom, type, type_reseau, ville, departement, circonscription').order('nom')
        .then(({ data }) => {
          setAllEtabs(data || [])
          setLoading(false)
        })
    } else {
      charger()
    }
  }, [profil])

  useEffect(() => {
    if (isAdmin && selectedEtabId) charger()
  }, [selectedEtabId])

  // ── Chargement ──────────────────────────────────────────────────────────

  async function charger() {
    if (!etabId) { setLoading(false); return }
    setLoading(true)

    const [cls, inv, per, profs] = await Promise.all([
      supabase.from('classes').select('id, nom, niveau').eq('etablissement_id', etabId).order('niveau'),
      supabase.from('invitations').select('id, code, role, actif').eq('etablissement_id', etabId),
      supabase.from('periodes').select('id, code, label, date_debut, date_fin, actif, type').eq('etablissement_id', etabId).order('code'),
      supabase.from('profils').select('id, nom, prenom, email').eq('etablissement_id', etabId).eq('role', 'enseignant'),
    ])

    setClasses(cls.data || [])
    setInvitations(inv.data || [])
    setPeriodes((per.data || []).map((p: any) => ({ ...p, type: p.type || 'regular' })))

    if (profs.data && profs.data.length > 0) {
      const { data: ec } = await supabase.from('enseignant_classes')
        .select('enseignant_id, classe_id').in('enseignant_id', profs.data.map((p: any) => p.id))
      const ensMap: Record<string, string[]> = {}
      ;(ec || []).forEach((r: any) => {
        if (!ensMap[r.enseignant_id]) ensMap[r.enseignant_id] = []
        ensMap[r.enseignant_id].push(r.classe_id)
      })
      setEnseignants(profs.data.map((p: any) => ({ ...p, classes: ensMap[p.id] || [] })))
    } else { setEnseignants([]) }

    setLoading(false)
  }

  // ── Structure : Classes ─────────────────────────────────────────────────

  async function ajouterClasse() {
    if (!nomClasse.trim() || !etabId) return
    setAddingClass(true)
    await supabase.from('classes').insert({
      nom: nomClasse.trim(), niveau: niveauClasse,
      etablissement_id: etabId, annee_scolaire: '2025-2026',
    })
    setNomClasse('')
    await charger()
    setAddingClass(false)
  }

  async function supprimerClasse(id: string, nom: string) {
    const { count } = await supabase.from('eleves').select('*', { count: 'exact', head: true }).eq('classe_id', id)
    if (count && count > 0) { alert(`"${nom}" contient ${count} élève(s). Supprimez d'abord les élèves.`); return }
    if (!confirm(`Supprimer la classe "${nom}" ?`)) return
    await supabase.from('classes').delete().eq('id', id)
    await charger()
  }

  // ── Structure : Enseignants ─────────────────────────────────────────────

  async function genererCode() {
    if (!etabId) return
    const code = 'ENS-' + Math.random().toString(36).substring(2, 8).toUpperCase()
    const { error } = await supabase.from('invitations').insert({ code, role: 'enseignant', etablissement_id: etabId, actif: true })
    if (!error) { setCodeGenere(code); await charger() }
  }

  async function desactiverCode(id: string) {
    await supabase.from('invitations').update({ actif: false }).eq('id', id)
    await charger()
  }

  function ouvrirAssign(ens: Enseignant) { setAssignModal(ens); setClassesSel([...ens.classes]) }

  async function sauvegarderAssign() {
    if (!assignModal) return
    setSavingAssign(true)
    await supabase.from('enseignant_classes').delete().eq('enseignant_id', assignModal.id)
    if (classesSel.length > 0) {
      await supabase.from('enseignant_classes').insert(classesSel.map(cid => ({ enseignant_id: assignModal.id, classe_id: cid })))
    }
    setAssignModal(null); setSavingAssign(false); await charger()
  }

  // ── Passations ──────────────────────────────────────────────────────────

  async function ajouterPeriode() {
    if (!newCode.trim() || !newLabel.trim() || !etabId) return
    setAddingPer(true)
    await supabase.from('periodes').insert({
      code: newCode.trim(), label: newLabel.trim(),
      date_debut: newDebut || null, date_fin: newFin || null,
      type: newType, actif: true,
      etablissement_id: etabId,
    })
    setNewCode('T1'); setNewLabel(''); setNewDebut(''); setNewFin(''); setNewType('regular')
    await charger(); setAddingPer(false)
  }

  async function toggleActifPeriode(id: string, actif: boolean) {
    await supabase.from('periodes').update({ actif: !actif }).eq('id', id)
    await charger()
  }

  async function supprimerPeriode(id: string, code: string) {
    if (!confirm(`Supprimer la période "${code}" ? Les passations associées resteront en base mais ne seront plus accessibles via cette période.`)) return
    await supabase.from('periodes').delete().eq('id', id)
    await charger()
  }

  async function sauvegarderEdition() {
    if (!editPer) return
    await supabase.from('periodes').update({
      label: editPer.label,
      date_debut: editPer.date_debut || null,
      date_fin:   editPer.date_fin   || null,
    }).eq('id', editPer.id)
    setEditPer(null); await charger()
  }

  // ── Rendu ──────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ marginLeft: 'var(--sidebar-width)', padding: 48 }}>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Chargement…</p>
      </main>
    </div>
  )

  const periodesReg = periodes.filter(p => p.type !== 'evaluation_nationale')
  const periodesEN  = periodes.filter(p => p.type === 'evaluation_nationale')

  const stepsStructure = [
    { n: 1, label: 'Classes' },
    { n: 2, label: 'Enseignants' },
    { n: 3, label: 'Élèves' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-gray)' }}>
      <Sidebar />

      {/* Modal assignation */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 32, width: 440, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary-dark)', marginBottom: 4, fontFamily: 'var(--font-sans)' }}>Assigner des classes</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>{assignModal.prenom} {assignModal.nom}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {classes.map(c => {
                const sel = classesSel.includes(c.id)
                return (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderRadius: 10, cursor: 'pointer', background: sel ? 'rgba(0,24,69,0.06)' : 'var(--bg-gray)', border: `1.5px solid ${sel ? 'var(--primary-dark)' : 'var(--border-light)'}` }}>
                    <input type="checkbox" checked={sel} onChange={() => setClassesSel(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])} style={{ accentColor: 'var(--primary-dark)', width: 16, height: 16 }} />
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary-dark)' }}>{c.nom}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.niveau}</span>
                  </label>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn label="Annuler" variant="outline" onClick={() => setAssignModal(null)} />
              <Btn label={savingAssign ? 'Enregistrement…' : 'Enregistrer'} variant="primary" onClick={sauvegarderAssign} disabled={savingAssign} />
            </div>
          </div>
        </div>
      )}

      {/* Modal édition période */}
      {editPer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 32, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary-dark)', marginBottom: 20, fontFamily: 'var(--font-sans)' }}>
              Modifier · {editPer.code}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>Libellé</label>
                <input value={editPer.label} onChange={e => setEditPer({ ...editPer, label: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Date début</label>
                  <input type="date" value={editPer.date_debut || ''} onChange={e => setEditPer({ ...editPer, date_debut: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Date fin</label>
                  <input type="date" value={editPer.date_fin || ''} onChange={e => setEditPer({ ...editPer, date_fin: e.target.value })} style={inputStyle} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn label="Annuler" variant="outline" onClick={() => setEditPer(null)} />
              <Btn label="Enregistrer" variant="primary" onClick={sauvegarderEdition} />
            </div>
          </div>
        </div>
      )}

      <main style={{ marginLeft: 'var(--sidebar-width)', padding: 48, flex: 1, maxWidth: 900 }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--primary-dark)', marginBottom: 6 }}>
            Configuration de l'établissement
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Structurez votre école et planifiez vos passations
          </p>
        </div>

        {/* ── Sélecteur établissement (admin) ── */}
        {isAdmin && (
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', marginBottom: 24, background: '#eff6ff', borderColor: '#bfdbfe' }}>
            <span style={{ fontSize: 22 }}>🏫</span>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', letterSpacing: 1, textTransform: 'uppercase' as const, fontFamily: 'var(--font-sans)', display: 'block', marginBottom: 4 }}>
                Établissement à configurer
              </label>
              <select
                value={selectedEtabId}
                onChange={e => { setSelectedEtabId(e.target.value); setEtape(1); setOnglet('structure') }}
                style={{ width: '100%', border: '1.5px solid #bfdbfe', borderRadius: 10, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white', fontWeight: 600, color: 'var(--primary-dark)' }}
              >
                <option value="">— Choisir un établissement —</option>
                {allEtabs.map(e => (
                  <option key={e.id} value={e.id}>{e.nom} ({e.type}{e.ville ? ` · ${e.ville}` : ''})</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Si admin sans établissement sélectionné, ne pas afficher le reste */}
        {isAdmin && !selectedEtabId ? (
          <div style={{ ...card, textAlign: 'center' as const, padding: 48 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>👆</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', marginBottom: 8 }}>
              Sélectionnez un établissement
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
              Choisissez l'établissement que vous souhaitez configurer dans le sélecteur ci-dessus.
            </p>
          </div>
        ) : (
        <>

        {/* ── Onglets principaux ── */}
        {!isAdmin && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 32, background: 'white', borderRadius: 14, padding: 5, border: '1.5px solid var(--border-light)', width: 'fit-content' }}>
          {[
            { id: 'structure'  as OngletConfig, icon: '🏫', label: 'Structure établissement' },
            { id: 'passations' as OngletConfig, icon: '📅', label: 'Passations' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setOnglet(tab.id)} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px',
              borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
              fontWeight: 700, fontSize: 14, transition: 'all 0.15s',
              background: onglet === tab.id ? 'var(--primary-dark)' : 'transparent',
              color: onglet === tab.id ? 'white' : 'var(--text-secondary)',
            }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        )}

        {/* ════════════════════════════════════════════
            ONGLET STRUCTURE
        ════════════════════════════════════════════ */}
        {onglet === 'structure' && (
          <>
            {/* Stepper structure */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
              {stepsStructure.map((s, i) => (
                <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
                  <button onClick={() => setEtape(s.n)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
                    borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    background: etape === s.n ? 'var(--primary-dark)' : etape > s.n ? 'rgba(22,163,74,0.1)' : 'white',
                    color: etape === s.n ? 'white' : etape > s.n ? '#16A34A' : 'var(--text-secondary)',
                    fontWeight: 700, fontSize: 14,
                    boxShadow: etape === s.n ? '0 2px 8px rgba(0,24,69,0.15)' : 'none',
                  }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: etape === s.n ? 'rgba(255,255,255,0.2)' : etape > s.n ? '#16A34A' : 'var(--bg-gray)', color: etape === s.n ? 'white' : etape > s.n ? 'white' : 'var(--text-secondary)', fontSize: 12, fontWeight: 800 }}>
                      {etape > s.n ? '✓' : s.n}
                    </div>
                    {s.label}
                  </button>
                  {i < stepsStructure.length - 1 && <div style={{ width: 32, height: 2, background: etape > s.n ? '#16A34A' : 'var(--border-light)' }} />}
                </div>
              ))}
            </div>

            {/* Étape 1 — Classes */}
            {etape === 1 && (
              <div>
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div>
                      <h2 style={sectionTitleStyle}>Classes de l'établissement</h2>
                      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>{classes.length} classe{classes.length > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-gray)', borderRadius: 12, padding: '16px 20px', border: '1.5px dashed var(--border-light)', marginBottom: 20 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Ajouter une classe</p>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div style={{ flex: 2, minWidth: 160 }}>
                        <label style={labelStyle}>Nom de la classe</label>
                        <input value={nomClasse} onChange={e => setNomClasse(e.target.value)} onKeyDown={e => e.key === 'Enter' && ajouterClasse()} placeholder="ex : CP A, CE1 Malouet…" style={inputStyle} />
                      </div>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <label style={labelStyle}>Niveau</label>
                        <select value={niveauClasse} onChange={e => setNiveauClasse(e.target.value)} style={inputStyle}>
                          {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <Btn label={addingClass ? '…' : '+ Ajouter'} variant="primary" onClick={ajouterClasse} disabled={addingClass || !nomClasse.trim()} />
                    </div>
                  </div>
                  {classes.length === 0 ? (
                    <p style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Aucune classe. Utilisez le formulaire ci-dessus.</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                      {classes.map(c => (
                        <div key={c.id} style={{ background: 'var(--bg-gray)', borderRadius: 12, padding: '12px 16px', border: '1.5px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--primary-dark)' }}>{c.nom}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>{c.niveau}</div>
                          </div>
                          <button onClick={() => supprimerClasse(c.id, c.nom)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 16, padding: '4px 6px', opacity: 0.5 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Btn label="Étape suivante → Enseignants" variant="primary" onClick={() => setEtape(2)} />
              </div>
            )}

            {/* Étape 2 — Enseignants */}
            {etape === 2 && (
              <div>
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div>
                      <h2 style={sectionTitleStyle}>Enseignants de l'établissement</h2>
                      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>{enseignants.length} enseignant{enseignants.length > 1 ? 's' : ''} inscrit{enseignants.length > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  {enseignants.length === 0 ? (
                    <p style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Aucun enseignant inscrit. Partagez un code d'invitation.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 4 }}>
                      <thead><tr style={{ background: 'var(--bg-gray)' }}>
                        {['Enseignant', 'Email', 'Classes', 'Action'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {enseignants.map(ens => (
                          <tr key={ens.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '11px 16px', fontWeight: 700, color: 'var(--primary-dark)' }}>{ens.prenom} {ens.nom}</td>
                            <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>{ens.email}</td>
                            <td style={{ padding: '11px 16px', fontSize: 12, color: ens.classes.length > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                              {ens.classes.length > 0 ? ens.classes.map(cid => classes.find(c => c.id === cid)?.nom || '?').join(', ') : 'Aucune classe'}
                            </td>
                            <td style={{ padding: '11px 16px' }}><Btn label="Assigner" variant="outline" onClick={() => ouvrirAssign(ens)} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div>
                      <h2 style={sectionTitleStyle}>Codes d'invitation</h2>
                      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>Partagez ces codes avec vos enseignants</p>
                    </div>
                    <Btn label="+ Générer un code" variant="gold" onClick={genererCode} />
                  </div>
                  {codeGenere && (
                    <div style={{ background: 'rgba(22,163,74,0.08)', border: '1.5px solid #86efac', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span>✅</span>
                      <div>
                        <div style={{ fontWeight: 700, color: '#16A34A', fontSize: 13 }}>Code généré</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: 'var(--primary-dark)', letterSpacing: 3 }}>{codeGenere}</div>
                      </div>
                    </div>
                  )}
                  {invitations.filter(i => i.role === 'enseignant').length === 0 ? (
                    <p style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Aucun code généré.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead><tr style={{ background: 'var(--bg-gray)' }}>
                        {['Code', 'Statut', 'Action'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {invitations.filter(i => i.role === 'enseignant').map(inv => (
                          <tr key={inv.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-dark)', fontSize: 15, letterSpacing: 2 }}>{inv.code}</td>
                            <td style={{ padding: '11px 16px' }}>
                              {inv.actif
                                ? <span style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A', fontWeight: 700, fontSize: 12, padding: '3px 10px', borderRadius: 6 }}>Actif</span>
                                : <span style={{ background: 'var(--bg-gray)', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 12, padding: '3px 10px', borderRadius: 6 }}>Désactivé</span>}
                            </td>
                            <td style={{ padding: '11px 16px' }}>
                              {inv.actif && <Btn label="Désactiver" variant="outline" onClick={() => desactiverCode(inv.id)} />}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Btn label="← Retour" variant="outline" onClick={() => setEtape(1)} />
                  <Btn label="Étape suivante → Élèves" variant="primary" onClick={() => setEtape(3)} />
                </div>
              </div>
            )}

            {/* Étape 3 — Élèves */}
            {etape === 3 && (
              <div>
                <div style={card}>
                  <h2 style={sectionTitleStyle}>Importer les élèves</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24, lineHeight: 1.7 }}>
                    Importez vos listes d'élèves par classe au format CSV.<br />
                    Colonnes : <strong>nom ; prenom ; date_naissance ; sexe ; classe ; numero_ine</strong>
                  </p>
                  <div style={{ background: 'rgba(0,24,69,0.04)', borderRadius: 12, padding: '16px 20px', border: '1.5px solid var(--border-light)', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary-dark)', marginBottom: 4 }}>Modèle CSV prêt à remplir</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Format date : AAAA-MM-JJ · Sexe : M ou F · Séparateur : point-virgule</div>
                    </div>
                    <button onClick={() => {
                      const lignes = ['nom;prenom;date_naissance;sexe;classe;numero_ine','DUPONT;Marie;2016-09-15;F;CPA;1234567890A','MARTIN;Paul;2016-11-03;M;CPA;0987654321B']
                      const blob = new Blob([lignes.join('\n')], { type: 'text/csv;charset=utf-8;' })
                      const url = URL.createObjectURL(blob); const a = document.createElement('a')
                      a.href = url; a.download = 'modele_import_eleves.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
                    }} style={{ background: 'var(--accent-gold)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      ⬇ Télécharger le modèle
                    </button>
                  </div>
                  <a href="/dashboard/import" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--primary-dark)', color: 'white', padding: '12px 22px', borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: 'none', fontFamily: 'var(--font-sans)' }}>
                    Aller à l'importation →
                  </a>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Btn label="← Retour" variant="outline" onClick={() => setEtape(2)} />
                  <button onClick={() => router.push('/dashboard')} style={{ background: '#16A34A', color: 'white', border: 'none', borderRadius: 12, padding: '11px 26px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    ✓ Terminer la configuration
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════
            ONGLET PASSATIONS
        ════════════════════════════════════════════ */}
        {onglet === 'passations' && (
          <div>

            {/* ── Périodes de l'année ── */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={sectionTitleStyle}>Périodes de l'année scolaire</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                    Définissez vos fenêtres de passation T1, T2, T3…
                  </p>
                </div>
              </div>

              {/* Grille des périodes existantes */}
              {periodesReg.length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                  Aucune période définie. Ajoutez votre première période ci-dessous.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 24 }}>
                  {periodesReg.map(p => (
                    <div key={p.id} style={{
                      borderRadius: 14, padding: '16px 18px',
                      border: `2px solid ${p.actif ? 'var(--primary-dark)' : 'var(--border-light)'}`,
                      background: p.actif ? 'rgba(0,24,69,0.03)' : 'var(--bg-gray)',
                      position: 'relative',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ background: p.actif ? 'var(--primary-dark)' : 'var(--border-light)', color: p.actif ? 'white' : 'var(--text-secondary)', fontWeight: 800, fontSize: 14, padding: '3px 12px', borderRadius: 8, fontFamily: 'var(--font-sans)' }}>
                          {p.code}
                        </span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setEditPer(p)} title="Modifier" style={{ background: 'none', border: '1.5px solid var(--border-light)', borderRadius: 7, padding: '3px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>✎</button>
                          <button onClick={() => supprimerPeriode(p.id, p.code)} title="Supprimer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 15, opacity: 0.5, padding: '3px 6px' }}>✕</button>
                        </div>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 6 }}>{p.label}</div>
                      {(p.date_debut || p.date_fin) ? (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>📅</span>
                          <span>{p.date_debut ? new Date(p.date_debut).toLocaleDateString('fr-FR') : '?'}</span>
                          <span>→</span>
                          <span>{p.date_fin ? new Date(p.date_fin).toLocaleDateString('fr-FR') : '?'}</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Aucune date définie</div>
                      )}
                      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: p.actif ? '#16A34A' : 'var(--text-tertiary)', background: p.actif ? 'rgba(22,163,74,0.1)' : 'var(--bg-gray)', padding: '3px 10px', borderRadius: 6 }}>
                          {p.actif ? 'Active' : 'Inactive'}
                        </span>
                        <button onClick={() => toggleActifPeriode(p.id, !!p.actif)} style={{ background: 'none', border: '1.5px solid var(--border-light)', borderRadius: 7, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                          {p.actif ? 'Désactiver' : 'Activer'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Formulaire ajout période */}
              <div style={{ background: 'var(--bg-gray)', borderRadius: 12, padding: '18px 20px', border: '1.5px dashed var(--border-light)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Ajouter une période</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <label style={labelStyle}>Code</label>
                    <select value={newCode} onChange={e => setNewCode(e.target.value)} style={inputStyle}>
                      {PERIODES_STD.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="custom">Autre…</option>
                    </select>
                    {newCode === 'custom' && (
                      <input placeholder="ex : T4" value={newCode === 'custom' ? '' : newCode} onChange={e => setNewCode(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>Libellé</label>
                    <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="ex : Trimestre 1 — Octobre 2025" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Date début</label>
                    <input type="date" value={newDebut} onChange={e => setNewDebut(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Date fin</label>
                    <input type="date" value={newFin} onChange={e => setNewFin(e.target.value)} style={inputStyle} />
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <Btn label={addingPer ? '…' : '+ Ajouter la période'} variant="primary" onClick={ajouterPeriode} disabled={addingPer || !newLabel.trim() || !newCode.trim()} />
                </div>
              </div>
            </div>

            {/* ── Évaluation Nationale ── */}
            <div style={{ ...card, border: '2px solid #D97706' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 32 }}>🇫🇷</div>
                <div>
                  <h2 style={{ ...sectionTitleStyle, marginBottom: 4 }}>Évaluation Nationale</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                    Obligatoire, nationale, sans questions de compréhension. Le score est conservé séparément des périodes T1/T2/T3
                    et ne rentre pas dans les moyennes de fluence guidée.
                  </p>
                </div>
              </div>

              {periodesEN.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 20 }}>
                  {periodesEN.map(p => (
                    <div key={p.id} style={{ borderRadius: 14, padding: '16px 18px', border: '2px solid #D97706', background: 'rgba(217,119,6,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ background: '#D97706', color: 'white', fontWeight: 800, fontSize: 14, padding: '3px 12px', borderRadius: 8 }}>EN {p.code !== 'EN' ? p.code : ''}</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setEditPer(p)} style={{ background: 'none', border: '1.5px solid #D97706', borderRadius: 7, padding: '3px 10px', cursor: 'pointer', fontSize: 12, color: '#D97706' }}>✎</button>
                          <button onClick={() => supprimerPeriode(p.id, p.code)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 15, opacity: 0.5, padding: '3px 6px' }}>✕</button>
                        </div>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 6 }}>{p.label}</div>
                      {(p.date_debut || p.date_fin) ? (
                        <div style={{ fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>📅</span>
                          <span>{p.date_debut ? new Date(p.date_debut).toLocaleDateString('fr-FR') : '?'} → {p.date_fin ? new Date(p.date_fin).toLocaleDateString('fr-FR') : '?'}</span>
                        </div>
                      ) : <div style={{ fontSize: 12, color: '#B45309', fontStyle: 'italic' }}>Aucune date définie</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 16 }}>Aucune évaluation nationale définie.</p>
              )}

              {/* Formulaire ajout EN */}
              <div style={{ background: 'rgba(217,119,6,0.06)', borderRadius: 12, padding: '16px 20px', border: '1.5px dashed #D97706' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Ajouter une Évaluation Nationale</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: 10, alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ ...labelStyle, color: '#92400E' }}>Année / code</label>
                    <input placeholder="ex : EN-2025" style={{ ...inputStyle, borderColor: '#D97706' }}
                      id="en-code" defaultValue="EN" />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: '#92400E' }}>Libellé</label>
                    <input placeholder="ex : Évaluation Nationale CP 2025" style={{ ...inputStyle, borderColor: '#D97706' }} id="en-label" />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: '#92400E' }}>Date début</label>
                    <input type="date" style={{ ...inputStyle, borderColor: '#D97706' }} id="en-debut" />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: '#92400E' }}>Date fin</label>
                    <input type="date" style={{ ...inputStyle, borderColor: '#D97706' }} id="en-fin" />
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <button onClick={() => {
                    const code  = (document.getElementById('en-code')  as HTMLInputElement)?.value.trim()
                    const label = (document.getElementById('en-label') as HTMLInputElement)?.value.trim()
                    const debut = (document.getElementById('en-debut') as HTMLInputElement)?.value
                    const fin   = (document.getElementById('en-fin')   as HTMLInputElement)?.value
                    if (!code || !label || !etabId) return
                    supabase.from('periodes').insert({ code, label, date_debut: debut || null, date_fin: fin || null, type: 'evaluation_nationale', actif: true, etablissement_id: etabId })
                      .then(() => charger())
                  }} style={{ background: '#D97706', color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    + Ajouter l'Évaluation Nationale
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

        </>
        )}

      </main>
    </div>
  )
}

// ── Styles constants ────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5,
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1.5px solid var(--border-light)', borderRadius: 8,
  padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'var(--font-sans)',
  background: 'white', boxSizing: 'border-box',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 17, fontWeight: 800, color: 'var(--primary-dark)',
  fontFamily: 'var(--font-sans)', margin: 0,
}

const thStyle: React.CSSProperties = {
  padding: '10px 16px', textAlign: 'left', fontWeight: 600,
  color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em',
}
