'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'

// ── Types ──────────────────────────────────────────────────────────────────────

type Etablissement = {
  id: string; nom: string; type: string; type_reseau: string
  ville: string | null; departement: string | null; circonscription: string | null
}
type Periode = {
  id: string; code: string; label: string; actif: boolean
  etablissement_id: string; date_debut: string | null; date_fin: string | null
  saisie_ouverte: boolean; type: string | null
}
type Norme = { id: string; niveau: string; seuil_min: number; seuil_attendu: number; periode_id: string | null }
type CoorDoEtab = {
  id: string; coordo_id: string; etablissement_id: string
  coordo: { nom: string; prenom: string } | null; etablissement: { nom: string } | null
}
type IenEtab = {
  id: string; ien_id: string; etablissement_id: string
  ien: { nom: string; prenom: string } | null; etablissement: { nom: string } | null
}
type ProfilOption = { id: string; nom: string; prenom: string; role: string }
type Invitation = {
  id: string; code: string; role: string; etablissement_id: string | null; actif: boolean
}
type UserRow = { id: string; nom: string; prenom: string; role: string; etablissement_id: string | null }

// ── Constantes ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  enseignant: 'Enseignant', directeur: 'Directeur', principal: 'Principal',
  coordo_rep: 'Coordo REP+', ien: 'IEN', ia_dasen: 'IA-DASEN', recteur: 'Recteur', admin: 'Admin',
}

// ── Composant principal ────────────────────────────────────────────────────────

export default function Admin() {
  const [onglet, setOnglet]                   = useState(0)
  const [etablissements, setEtablissements]   = useState<Etablissement[]>([])
  const [periodes, setPeriodes]               = useState<Periode[]>([])
  const [coordoEtabs, setCoordoEtabs]         = useState<CoorDoEtab[]>([])
  const [ienEtabs, setIenEtabs]               = useState<IenEtab[]>([])
  const [invitations, setInvitations]         = useState<Invitation[]>([])
  const [monReseau, setMonReseau]             = useState<Etablissement[]>([])
  const [loading, setLoading]                 = useState(true)
  const [newPeriodeCode, setNewPeriodeCode]   = useState('')
  const [newPeriodeLabel, setNewPeriodeLabel] = useState('')
  const [newPeriodeType, setNewPeriodeType]   = useState('regular')
  const { profil, loading: profilLoading }    = useProfil()
  const router   = useRouter()
  const supabase = createClient()

  const isReseau = profil?.role === 'coordo_rep' || profil?.role === 'ien'

  const ONGLETS = isReseau
    ? ['Mon réseau', 'Périodes', 'Normes']
    : ['Vue d\'ensemble', 'Établissements', 'Périodes', 'Normes', 'Utilisateurs', 'Invitations', 'Affectations']

  const periodesOnglet = isReseau ? 1 : 2
  const normesOnglet   = isReseau ? 2 : 3

  useEffect(() => {
    if (!profilLoading && profil) {
      if (!['admin', 'ia_dasen', 'recteur', 'principal', 'coordo_rep', 'ien'].includes(profil.role)) {
        router.push('/dashboard')
        return
      }
      chargerDonnees()
    }
  }, [profil, profilLoading])

  async function chargerDonnees() {
    if (isReseau) {
      const reseauTable = profil!.role === 'ien' ? 'ien_etablissements' : 'coordo_etablissements'
      const reseauField = profil!.role === 'ien' ? 'ien_id' : 'coordo_id'
      const { data: ceData } = await supabase
        .from(reseauTable)
        .select('etablissement_id, etablissement:etablissements(id, nom, type, type_reseau)')
        .eq(reseauField, profil!.id)
      const etabIds = (ceData || []).map((ce: any) => ce.etablissement_id)
      setMonReseau((ceData || []).map((ce: any) => ce.etablissement).filter(Boolean))

      let periQuery = supabase.from('periodes')
        .select('id, code, label, actif, etablissement_id, date_debut, date_fin, saisie_ouverte, type')
        .order('code')
      if (etabIds.length > 0) periQuery = periQuery.in('etablissement_id', etabIds)
      const { data: periData } = await periQuery
      const seenCodes = new Set<string>()
      const periodesDedup = (periData || []).filter((p: any) => {
        if (seenCodes.has(p.code)) return false
        seenCodes.add(p.code); return true
      })
      setPeriodes(periodesDedup)
      setLoading(false)
      return
    }

    const [etabRes, periRes, ceRes, ienRes, invRes] = await Promise.all([
      supabase.from('etablissements')
        .select('id, nom, type, type_reseau, ville, departement, circonscription').order('nom'),
      supabase.from('periodes')
        .select('id, code, label, actif, etablissement_id, date_debut, date_fin, saisie_ouverte, type').order('code'),
      supabase.from('coordo_etablissements')
        .select('id, coordo_id, etablissement_id, coordo:profils(nom, prenom), etablissement:etablissements(nom)').order('coordo_id'),
      supabase.from('ien_etablissements')
        .select('id, ien_id, etablissement_id, ien:profils(nom, prenom), etablissement:etablissements(nom)').order('ien_id'),
      supabase.from('invitations')
        .select('id, code, role, etablissement_id, actif').order('code'),
    ])
    setEtablissements(etabRes.data || [])
    setPeriodes(periRes.data || [])
    setCoordoEtabs((ceRes.data || []) as unknown as CoorDoEtab[])
    setIenEtabs((ienRes.data || []) as unknown as IenEtab[])
    setInvitations((invRes.data || []) as unknown as Invitation[])
    setLoading(false)
  }

  async function togglePeriode(id: string, actif: boolean) {
    await supabase.from('periodes').update({ actif: !actif }).eq('id', id)
    setPeriodes(prev => prev.map(p => p.id === id ? { ...p, actif: !actif } : p))
  }

  async function toggleSaisie(id: string, ouvert: boolean) {
    await supabase.from('periodes').update({ saisie_ouverte: !ouvert }).eq('id', id)
    setPeriodes(prev => prev.map(p => p.id === id ? { ...p, saisie_ouverte: !ouvert } : p))
  }

  async function updateDates(id: string, debut: string | null, fin: string | null) {
    await supabase.from('periodes').update({ date_debut: debut || null, date_fin: fin || null }).eq('id', id)
    setPeriodes(prev => prev.map(p => p.id === id ? { ...p, date_debut: debut, date_fin: fin } : p))
  }

  async function updateTypePeriode(id: string, type: string) {
    await supabase.from('periodes').update({ type }).eq('id', id)
    setPeriodes(prev => prev.map(p => p.id === id ? { ...p, type } : p))
  }

  async function creerPeriode() {
    if (!newPeriodeCode.trim() || !newPeriodeLabel.trim()) return
    await supabase.from('periodes').insert({
      code: newPeriodeCode.trim().toUpperCase(),
      label: newPeriodeLabel.trim(),
      actif: true,
      saisie_ouverte: true,
      type: newPeriodeType,
    })
    setNewPeriodeCode(''); setNewPeriodeLabel(''); setNewPeriodeType('regular')
    chargerDonnees()
  }

  async function supprimerAffectation(id: string) {
    if (!window.confirm('Supprimer cette affectation ?')) return
    await supabase.from('coordo_etablissements').delete().eq('id', id)
    setCoordoEtabs(prev => prev.filter(c => c.id !== id))
  }

  async function supprimerAffectationIen(id: string) {
    if (!window.confirm('Supprimer cette affectation IEN ?')) return
    await supabase.from('ien_etablissements').delete().eq('id', id)
    setIenEtabs(prev => prev.filter(c => c.id !== id))
  }

  async function toggleInvitation(id: string, actif: boolean) {
    await supabase.from('invitations').update({ actif: !actif }).eq('id', id)
    setInvitations(prev => prev.map(inv => inv.id === id ? { ...inv, actif: !actif } : inv))
  }

  async function supprimerInvitation(id: string) {
    if (!window.confirm('Supprimer définitivement ce code d\'invitation ?')) return
    await supabase.from('invitations').delete().eq('id', id)
    setInvitations(prev => prev.filter(inv => inv.id !== id))
  }

  if (profilLoading || loading) {
    return (
      <>
        <Sidebar />
        <div style={{ marginLeft: 'var(--sidebar-width)', padding: 32, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Chargement...</div>
      </>
    )
  }

  const S = {
    card:       { background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', overflow: 'hidden' as const },
    th:         { padding: '12px 20px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.5, textTransform: 'uppercase' as const, background: 'var(--bg-gray)', fontFamily: 'var(--font-sans)', borderBottom: '1.5px solid var(--border-light)' },
    thC:        { padding: '12px 20px', textAlign: 'center' as const, fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.5, textTransform: 'uppercase' as const, background: 'var(--bg-gray)', fontFamily: 'var(--font-sans)', borderBottom: '1.5px solid var(--border-light)' },
    td:         { padding: '14px 20px', fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', borderBottom: '1px solid var(--border-light)' },
    tdBold:     { padding: '14px 20px', fontSize: 14, fontWeight: 700, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', borderBottom: '1px solid var(--border-light)' },
    tdC:        { padding: '14px 20px', fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', textAlign: 'center' as const, borderBottom: '1px solid var(--border-light)' },
    btnPrimary: { background: 'var(--primary-dark)', color: 'white', border: 'none', padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' as const },
    btnDanger:  { background: 'transparent', color: '#dc2626', border: '1.5px solid #fca5a5', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' as const },
    input:      { border: '1.5px solid var(--border-main)', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' as const },
    badge:      (color: string) => ({ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: color === 'REP+' ? '#f3e8ff' : color === 'REP' ? '#dbeafe' : 'var(--bg-gray)', color: color === 'REP+' ? '#7e22ce' : color === 'REP' ? '#1d4ed8' : 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }),
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-light)' }}>
      <Sidebar />
      <ImpersonationBar />

      <div style={{ marginLeft: 'var(--sidebar-width)', padding: 32, maxWidth: 1100 }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>
            {isReseau ? 'Mon espace IEN / Coordo' : 'Administration'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 15, fontFamily: 'var(--font-sans)' }}>
            {isReseau ? 'Consultation de votre réseau d\'établissements' : 'Gestion de l\'application'}
          </p>
        </div>

        {/* Onglets */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '2px solid var(--border-light)', flexWrap: 'wrap' as const }}>
          {ONGLETS.map((o, i) => (
            <button key={o} onClick={() => setOnglet(i)} style={{
              padding: '10px 18px', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)',
              background: 'none', border: 'none', cursor: 'pointer', marginBottom: -2,
              borderBottom: `2px solid ${onglet === i ? 'var(--primary-dark)' : 'transparent'}`,
              color: onglet === i ? 'var(--primary-dark)' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}>
              {o}
            </button>
          ))}
        </div>

        {/* ── Mon réseau (IEN / Coordo) ── */}
        {isReseau && onglet === 0 && (
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
              {monReseau.length} établissement{monReseau.length > 1 ? 's' : ''} dans votre réseau
            </p>
            {monReseau.length === 0 ? (
              <div style={{ ...S.card, padding: 40, textAlign: 'center' as const }}>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                  Aucun établissement affecté. Contactez l'administrateur pour configurer votre réseau.
                </p>
              </div>
            ) : (
              <div style={S.card}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={S.th}>Établissement</th>
                    <th style={S.th}>Type</th>
                    <th style={S.th}>Réseau</th>
                  </tr></thead>
                  <tbody>
                    {monReseau.map((e: any) => (
                      <tr key={e.id}>
                        <td style={S.tdBold}>{e.nom}</td>
                        <td style={S.td}>{e.type || '—'}</td>
                        <td style={S.td}><span style={S.badge(e.type_reseau)}>{e.type_reseau || '—'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Vue d'ensemble ── */}
        {!isReseau && onglet === 0 && (
          <VueEnsembleTab
            supabase={supabase}
            etablissements={etablissements}
            periodes={periodes}
            invitations={invitations}
          />
        )}

        {/* ── Établissements ── */}
        {!isReseau && onglet === 1 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', margin: 0 }}>
                {etablissements.length} établissement{etablissements.length > 1 ? 's' : ''}
              </p>
              <button onClick={() => router.push('/dashboard/admin/etablissement')} style={S.btnPrimary}>
                + Ajouter
              </button>
            </div>
            <div style={S.card}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={S.th}>Nom</th>
                  <th style={S.th}>Type</th>
                  <th style={S.th}>Réseau</th>
                  <th style={S.th}>Ville</th>
                  <th style={S.th}>Circonscription</th>
                </tr></thead>
                <tbody>
                  {etablissements.map(e => (
                    <tr key={e.id}>
                      <td style={S.tdBold}>{e.nom}</td>
                      <td style={S.td}>{e.type}</td>
                      <td style={S.td}><span style={S.badge(e.type_reseau)}>{e.type_reseau || '—'}</span></td>
                      <td style={S.td}>{e.ville || '—'}</td>
                      <td style={S.td}>{e.circonscription || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Périodes ── */}
        {onglet === periodesOnglet && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' as const, gap: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', margin: 0 }}>
                Périodes de passation
              </p>
              {!isReseau && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                  <input type="text" placeholder="Code (T1…)" value={newPeriodeCode}
                    onChange={e => setNewPeriodeCode(e.target.value)}
                    style={{ ...S.input, width: 80 }} />
                  <input type="text" placeholder="Libellé" value={newPeriodeLabel}
                    onChange={e => setNewPeriodeLabel(e.target.value)}
                    style={{ ...S.input, width: 180 }} />
                  <select value={newPeriodeType} onChange={e => setNewPeriodeType(e.target.value)}
                    style={{ ...S.input, width: 170 }}>
                    <option value="regular">Classique</option>
                    <option value="evaluation_nationale">Éval. nationale</option>
                  </select>
                  <button onClick={creerPeriode} disabled={!newPeriodeCode || !newPeriodeLabel}
                    style={{ ...S.btnPrimary, opacity: (!newPeriodeCode || !newPeriodeLabel) ? 0.4 : 1 }}>
                    + Créer
                  </button>
                </div>
              )}
            </div>
            <div style={S.card}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={S.th}>Code</th>
                  <th style={S.th}>Libellé</th>
                  <th style={S.th}>Type</th>
                  <th style={S.th}>Début</th>
                  <th style={S.th}>Fin</th>
                  <th style={S.thC}>Saisie</th>
                  <th style={S.thC}>Active</th>
                </tr></thead>
                <tbody>
                  {periodes.map(p => (
                    <PeriodeRow key={p.id} periode={p}
                      isReseau={isReseau}
                      onToggleActif={() => togglePeriode(p.id, p.actif)}
                      onToggleSaisie={() => toggleSaisie(p.id, p.saisie_ouverte)}
                      onUpdateDates={(d, f) => updateDates(p.id, d, f)}
                      onUpdateType={t => updateTypePeriode(p.id, t)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Normes ── */}
        {onglet === normesOnglet && (
          <NormesTab supabase={supabase} periodes={periodes} profil={profil} />
        )}

        {/* ── Utilisateurs ── */}
        {!isReseau && onglet === 4 && (
          <UtilisateursTab supabase={supabase} etablissements={etablissements} />
        )}

        {/* ── Invitations ── */}
        {!isReseau && onglet === 5 && (
          <InvitationsTab
            etablissements={etablissements}
            invitations={invitations}
            onToggle={toggleInvitation}
            onSupprimer={supprimerInvitation}
            onRefresh={chargerDonnees}
            supabase={supabase}
          />
        )}

        {/* ── Affectations ── */}
        {!isReseau && onglet === 6 && (
          <AffectationsTab
            supabase={supabase}
            etablissements={etablissements}
            coordoEtabs={coordoEtabs}
            ienEtabs={ienEtabs}
            onSupprimerCoordo={supprimerAffectation}
            onSupprimerIen={supprimerAffectationIen}
            onRefresh={chargerDonnees}
          />
        )}
      </div>
    </div>
  )
}

// ── Styles partagés ────────────────────────────────────────────────────────────

const A = {
  card:         { background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', overflow: 'hidden' as const },
  th:           { padding: '12px 20px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.5, textTransform: 'uppercase' as const, background: 'var(--bg-gray)', fontFamily: 'var(--font-sans)', borderBottom: '1.5px solid var(--border-light)' },
  thC:          { padding: '12px 20px', textAlign: 'center' as const, fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.5, textTransform: 'uppercase' as const, background: 'var(--bg-gray)', fontFamily: 'var(--font-sans)', borderBottom: '1.5px solid var(--border-light)' },
  td:           { padding: '14px 20px', fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', borderBottom: '1px solid var(--border-light)' },
  tdBold:       { padding: '14px 20px', fontSize: 14, fontWeight: 700, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', borderBottom: '1px solid var(--border-light)' },
  tdC:          { padding: '14px 20px', fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', textAlign: 'center' as const, borderBottom: '1px solid var(--border-light)' },
  btnPrimary:   { background: 'var(--primary-dark)', color: 'white', border: 'none', padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' as const },
  btnGhost:     { background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border-light)', padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' as const },
  btnDanger:    { background: 'transparent', color: '#dc2626', border: '1.5px solid #fca5a5', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' as const },
  input:        { border: '1.5px solid var(--border-main)', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' },
  select:       { width: '100%', border: '1.5px solid var(--border-main)', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' },
  label:        { fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.2, textTransform: 'uppercase' as const, fontFamily: 'var(--font-sans)', display: 'block' as const, marginBottom: 6 },
  sectionTitle: { fontSize: 15, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: '0 0 16px 0' },
  emptyState:   { background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', padding: 40, textAlign: 'center' as const, fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' },
}

// ── VueEnsembleTab ─────────────────────────────────────────────────────────────

function VueEnsembleTab({ supabase, etablissements, periodes, invitations }: {
  supabase: any
  etablissements: Etablissement[]
  periodes: Periode[]
  invitations: Invitation[]
}) {
  const [userCounts, setUserCounts]   = useState<Record<string, number>>({})
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    supabase.from('profils').select('role')
      .then(({ data }: any) => {
        const counts: Record<string, number> = {}
        ;(data || []).forEach((u: any) => { counts[u.role] = (counts[u.role] || 0) + 1 })
        setUserCounts(counts)
        setLoadingStats(false)
      })
  }, [])

  const totalUsers          = Object.values(userCounts).reduce((s, n) => s + n, 0)
  const periodesActives     = periodes.filter(p => p.actif).length
  const invitationsActives  = invitations.filter(i => i.actif).length

  const statCards = [
    { label: 'Établissements',  value: etablissements.length, icon: '🏫', bg: '#dbeafe', color: '#1d4ed8' },
    { label: 'Utilisateurs',    value: loadingStats ? '…' : totalUsers, icon: '👥', bg: '#dcfce7', color: '#16a34a' },
    { label: 'Périodes actives', value: periodesActives, icon: '📅', bg: '#fef9c3', color: '#854d0e' },
    { label: 'Codes d\'invitation actifs', value: invitationsActives, icon: '🔑', bg: '#f3e8ff', color: '#7e22ce' },
  ]

  return (
    <div>
      {/* Cards stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {statCards.map(card => (
          <div key={card.label} style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', lineHeight: 1 }}>
                {card.value}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginTop: 4 }}>
                {card.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Utilisateurs par rôle */}
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', padding: 24 }}>
          <h3 style={A.sectionTitle}>Utilisateurs par rôle</h3>
          {loadingStats ? (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Chargement…</p>
          ) : Object.keys(userCounts).length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>Aucun utilisateur.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(userCounts).sort((a, b) => b[1] - a[1]).map(([role, count]) => (
                <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 130, fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
                    {ROLE_LABELS[role] || role}
                  </div>
                  <div style={{ flex: 1, height: 8, background: 'var(--bg-gray)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round((count / totalUsers) * 100)}%`, background: 'var(--primary-dark)', borderRadius: 4, transition: 'width 0.4s' }} />
                  </div>
                  <div style={{ width: 24, fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', textAlign: 'right' as const }}>
                    {count}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* État des périodes */}
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', padding: 24 }}>
          <h3 style={A.sectionTitle}>État des périodes</h3>
          {periodes.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>Aucune période configurée.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {periodes.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: 'var(--bg-gray)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)' }}>{p.code}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>{p.label}</span>
                    {p.type === 'evaluation_nationale' && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#f3e8ff', color: '#7e22ce', fontFamily: 'var(--font-sans)' }}>Éval. nat.</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: p.actif ? '#dbeafe' : 'white', color: p.actif ? '#1d4ed8' : 'var(--text-tertiary)', border: `1px solid ${p.actif ? '#bfdbfe' : 'var(--border-light)'}`, fontFamily: 'var(--font-sans)' }}>
                      {p.actif ? 'Active' : 'Inactive'}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: p.saisie_ouverte ? '#dcfce7' : 'white', color: p.saisie_ouverte ? '#16a34a' : 'var(--text-tertiary)', border: `1px solid ${p.saisie_ouverte ? '#bbf7d0' : 'var(--border-light)'}`, fontFamily: 'var(--font-sans)' }}>
                      {p.saisie_ouverte ? 'Saisie ouverte' : 'Saisie fermée'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── InvitationsTab ─────────────────────────────────────────────────────────────

function InvitationsTab({ supabase, etablissements, invitations, onToggle, onSupprimer, onRefresh }: {
  supabase: any
  etablissements: Etablissement[]
  invitations: Invitation[]
  onToggle: (id: string, actif: boolean) => void
  onSupprimer: (id: string) => void
  onRefresh: () => void
}) {
  const [newCode, setNewCode]           = useState('')
  const [newRole, setNewRole]           = useState('enseignant')
  const [newEtab, setNewEtab]           = useState('')
  const [saving, setSaving]             = useState(false)
  const [copied, setCopied]             = useState<string | null>(null)
  const [filterActif, setFilterActif]   = useState<'all' | 'actif' | 'inactif'>('all')

  function genererCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
    setNewCode(code)
  }

  async function creerInvitation() {
    if (!newCode.trim() || !newRole) return
    setSaving(true)
    await supabase.from('invitations').insert({
      code: newCode.trim().toUpperCase(),
      role: newRole,
      etablissement_id: newEtab || null,
      actif: true,
    })
    setNewCode(''); setNewRole('enseignant'); setNewEtab('')
    setSaving(false)
    onRefresh()
  }

  async function copierCode(code: string) {
    await navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  const nbActifs   = invitations.filter(i => i.actif).length
  const nbInactifs = invitations.filter(i => !i.actif).length
  const filtered   = invitations.filter(inv => {
    if (filterActif === 'actif')   return inv.actif
    if (filterActif === 'inactif') return !inv.actif
    return true
  })

  return (
    <div>
      {/* Formulaire création */}
      <div style={{ ...A.card, padding: 24, marginBottom: 24 }}>
        <h3 style={A.sectionTitle}>Créer un code d'invitation</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label style={A.label}>Code</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={newCode}
                onChange={e => setNewCode(e.target.value.toUpperCase())}
                placeholder="ex: ECOLE2026"
                style={{ ...A.input, flex: 1, textTransform: 'uppercase' as const }} />
              <button onClick={genererCode} title="Générer aléatoirement"
                style={{ ...A.btnGhost, padding: '8px 12px', flexShrink: 0, fontSize: 16 }}>🎲</button>
            </div>
          </div>
          <div>
            <label style={A.label}>Rôle</label>
            <select value={newRole} onChange={e => setNewRole(e.target.value)} style={A.select}>
              <option value="enseignant">Enseignant</option>
              <option value="directeur">Directeur</option>
              <option value="principal">Principal</option>
              <option value="coordo_rep">Coordo REP+</option>
              <option value="ien">IEN</option>
              <option value="ia_dasen">IA-DASEN</option>
              <option value="recteur">Recteur</option>
            </select>
          </div>
          <div>
            <label style={A.label}>Établissement (optionnel)</label>
            <select value={newEtab} onChange={e => setNewEtab(e.target.value)} style={A.select}>
              <option value="">Aucun (multi-étab.)</option>
              {etablissements.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
          </div>
          <button onClick={creerInvitation} disabled={!newCode.trim() || saving}
            style={{ ...A.btnPrimary, opacity: (!newCode.trim() || saving) ? 0.4 : 1, whiteSpace: 'nowrap' as const }}>
            + Créer
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)', margin: '12px 0 0 0' }}>
          Le code sera fourni à l'utilisateur lors de son inscription. Laissez l'établissement vide pour les rôles multi-établissements (IEN, Coordo, Recteur…).
        </p>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'all',     label: `Tous (${invitations.length})` },
          { key: 'actif',   label: `Actifs (${nbActifs})` },
          { key: 'inactif', label: `Inactifs (${nbInactifs})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilterActif(f.key as any)} style={{
            fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            background: filterActif === f.key ? 'var(--primary-dark)' : 'white',
            color: filterActif === f.key ? 'white' : 'var(--text-secondary)',
            border: `1.5px solid ${filterActif === f.key ? 'var(--primary-dark)' : 'var(--border-light)'}`,
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={A.emptyState}>Aucun code d'invitation.</div>
      ) : (
        <div style={A.card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={A.th}>Code</th>
              <th style={A.th}>Rôle</th>
              <th style={A.th}>Établissement</th>
              <th style={A.thC}>Statut</th>
              <th style={A.thC}>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id}>
                  <td style={A.tdBold}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 15, letterSpacing: 2 }}>{inv.code}</span>
                      <button onClick={() => copierCode(inv.code)} title="Copier le code"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 2, opacity: 0.7 }}>
                        {copied === inv.code ? '✅' : '📋'}
                      </button>
                    </div>
                  </td>
                  <td style={A.td}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--bg-gray)', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                      {ROLE_LABELS[inv.role] || inv.role}
                    </span>
                  </td>
                  <td style={A.td}>
                    {etablissements.find(e => e.id === inv.etablissement_id)?.nom || (
                      <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic', fontSize: 13 }}>Multi-établissement</span>
                    )}
                  </td>
                  <td style={A.tdC}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: inv.actif ? '#dcfce7' : 'var(--bg-gray)', color: inv.actif ? '#16a34a' : 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>
                      {inv.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td style={A.tdC}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button onClick={() => onToggle(inv.id, inv.actif)} style={{
                        fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                        border: '1.5px solid var(--border-main)', background: 'white',
                        color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)',
                      }}>
                        {inv.actif ? 'Désactiver' : 'Activer'}
                      </button>
                      <button onClick={() => onSupprimer(inv.id)} style={A.btnDanger}>Supprimer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── AffectationsTab ────────────────────────────────────────────────────────────

function AffectationsTab({ supabase, etablissements, coordoEtabs, ienEtabs, onSupprimerCoordo, onSupprimerIen, onRefresh }: {
  supabase: any
  etablissements: Etablissement[]
  coordoEtabs: CoorDoEtab[]
  ienEtabs: IenEtab[]
  onSupprimerCoordo: (id: string) => void
  onSupprimerIen: (id: string) => void
  onRefresh: () => void
}) {
  const [iens, setIens]               = useState<ProfilOption[]>([])
  const [coordos, setCoordo]          = useState<ProfilOption[]>([])
  const [newIenId, setNewIenId]       = useState('')
  const [newIenEtab, setNewIenEtab]   = useState('')
  const [newCoordoId, setNewCoordoId] = useState('')
  const [newCoordoEtab, setNewCoordoEtab] = useState('')
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    supabase.from('profils').select('id, nom, prenom, role')
      .in('role', ['ien', 'coordo_rep']).order('nom')
      .then(({ data }: any) => {
        const all = data || []
        setIens(all.filter((p: ProfilOption) => p.role === 'ien'))
        setCoordo(all.filter((p: ProfilOption) => p.role === 'coordo_rep'))
      })
  }, [])

  async function ajouterIen() {
    if (!newIenId || !newIenEtab) return
    setSaving(true)
    await supabase.from('ien_etablissements').insert({ ien_id: newIenId, etablissement_id: newIenEtab })
    setNewIenId(''); setNewIenEtab('')
    setSaving(false)
    onRefresh()
  }

  async function ajouterCoordo() {
    if (!newCoordoId || !newCoordoEtab) return
    setSaving(true)
    await supabase.from('coordo_etablissements').insert({ coordo_id: newCoordoId, etablissement_id: newCoordoEtab })
    setNewCoordoId(''); setNewCoordoEtab('')
    setSaving(false)
    onRefresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

      {/* IEN */}
      <div>
        <h3 style={A.sectionTitle}>Affectations IEN → Établissements</h3>
        <div style={{ ...A.card, padding: 20, marginBottom: 12, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' as const }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={A.label}>IEN</label>
            <select value={newIenId} onChange={e => setNewIenId(e.target.value)} style={A.select}>
              <option value="">Choisir un IEN…</option>
              {iens.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={A.label}>Établissement</label>
            <select value={newIenEtab} onChange={e => setNewIenEtab(e.target.value)} style={A.select}>
              <option value="">Choisir un établissement…</option>
              {etablissements.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
          </div>
          <button onClick={ajouterIen} disabled={!newIenId || !newIenEtab || saving}
            style={{ ...A.btnPrimary, opacity: (!newIenId || !newIenEtab || saving) ? 0.4 : 1 }}>
            + Rattacher
          </button>
        </div>
        {ienEtabs.length === 0 ? (
          <div style={A.emptyState}>Aucune affectation IEN pour l'instant.</div>
        ) : (
          <div style={A.card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={A.th}>IEN</th>
                <th style={A.th}>Établissement</th>
                <th style={A.thC}>Action</th>
              </tr></thead>
              <tbody>
                {ienEtabs.map(ie => (
                  <tr key={ie.id}>
                    <td style={A.tdBold}>{ie.ien?.prenom} {ie.ien?.nom}</td>
                    <td style={A.td}>{ie.etablissement?.nom || '—'}</td>
                    <td style={A.tdC}><button onClick={() => onSupprimerIen(ie.id)} style={A.btnDanger}>Retirer</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Coordo */}
      <div>
        <h3 style={A.sectionTitle}>Affectations Coordo REP/REP+ → Établissements</h3>
        <div style={{ ...A.card, padding: 20, marginBottom: 12, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' as const }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={A.label}>Coordonnateur</label>
            <select value={newCoordoId} onChange={e => setNewCoordoId(e.target.value)} style={A.select}>
              <option value="">Choisir un coordo…</option>
              {coordos.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={A.label}>Établissement</label>
            <select value={newCoordoEtab} onChange={e => setNewCoordoEtab(e.target.value)} style={A.select}>
              <option value="">Choisir un établissement…</option>
              {etablissements.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
          </div>
          <button onClick={ajouterCoordo} disabled={!newCoordoId || !newCoordoEtab || saving}
            style={{ ...A.btnPrimary, opacity: (!newCoordoId || !newCoordoEtab || saving) ? 0.4 : 1 }}>
            + Rattacher
          </button>
        </div>
        {coordoEtabs.length === 0 ? (
          <div style={A.emptyState}>Aucune affectation coordo pour l'instant.</div>
        ) : (
          <div style={A.card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={A.th}>Coordonnateur</th>
                <th style={A.th}>Établissement</th>
                <th style={A.thC}>Action</th>
              </tr></thead>
              <tbody>
                {coordoEtabs.map(ce => (
                  <tr key={ce.id}>
                    <td style={A.tdBold}>{ce.coordo?.prenom} {ce.coordo?.nom}</td>
                    <td style={A.td}>{ce.etablissement?.nom || '—'}</td>
                    <td style={A.tdC}><button onClick={() => onSupprimerCoordo(ce.id)} style={A.btnDanger}>Retirer</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── PeriodeRow ─────────────────────────────────────────────────────────────────

function PeriodeRow({ periode, isReseau, onToggleActif, onToggleSaisie, onUpdateDates, onUpdateType }: {
  periode: Periode
  isReseau: boolean
  onToggleActif: () => void
  onToggleSaisie: () => void
  onUpdateDates: (debut: string | null, fin: string | null) => void
  onUpdateType: (type: string) => void
}) {
  const [debut, setDebut] = useState(periode.date_debut || '')
  const [fin,   setFin]   = useState(periode.date_fin   || '')

  return (
    <tr>
      <td style={{ ...A.tdBold, fontSize: 16 }}>{periode.code}</td>
      <td style={A.td}>{periode.label}</td>
      <td style={A.td}>
        {isReseau ? (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
            {periode.type === 'evaluation_nationale' ? 'Éval. nationale' : 'Classique'}
          </span>
        ) : (
          <select value={periode.type || 'regular'} onChange={e => onUpdateType(e.target.value)}
            style={{ ...A.input, padding: '6px 10px', fontSize: 12, width: 160 }}>
            <option value="regular">Classique</option>
            <option value="evaluation_nationale">Éval. nationale</option>
          </select>
        )}
      </td>
      <td style={A.td}>
        <input type="date" value={debut}
          onChange={e => setDebut(e.target.value)}
          onBlur={() => onUpdateDates(debut || null, fin || null)}
          style={{ ...A.input, padding: '6px 10px', fontSize: 13, width: 140 }}
          disabled={isReseau} />
      </td>
      <td style={A.td}>
        <input type="date" value={fin}
          onChange={e => setFin(e.target.value)}
          onBlur={() => onUpdateDates(debut || null, fin || null)}
          style={{ ...A.input, padding: '6px 10px', fontSize: 13, width: 140 }}
          disabled={isReseau} />
      </td>
      <td style={A.tdC}>
        <button onClick={isReseau ? undefined : onToggleSaisie} style={{
          fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, border: 'none',
          cursor: isReseau ? 'default' : 'pointer',
          background: periode.saisie_ouverte ? '#dcfce7' : 'var(--bg-gray)',
          color: periode.saisie_ouverte ? '#16a34a' : 'var(--text-tertiary)',
          fontFamily: 'var(--font-sans)',
        }}>
          {periode.saisie_ouverte ? 'Ouverte' : 'Fermée'}
        </button>
      </td>
      <td style={A.tdC}>
        <button onClick={isReseau ? undefined : onToggleActif} style={{
          fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, border: 'none',
          cursor: isReseau ? 'default' : 'pointer',
          background: periode.actif ? '#dbeafe' : 'var(--bg-gray)',
          color: periode.actif ? '#1d4ed8' : 'var(--text-tertiary)',
          fontFamily: 'var(--font-sans)',
        }}>
          {periode.actif ? 'Active' : 'Inactive'}
        </button>
      </td>
    </tr>
  )
}

// ── UtilisateursTab ────────────────────────────────────────────────────────────

function UtilisateursTab({ supabase, etablissements }: { supabase: any; etablissements: Etablissement[] }) {
  const [users, setUsers]             = useState<UserRow[]>([])
  const [search, setSearch]           = useState('')
  const [roleFilter, setRoleFilter]   = useState('')
  const [editRoleId, setEditRoleId]   = useState<string | null>(null)
  const [editRoleVal, setEditRoleVal] = useState('')

  useEffect(() => {
    supabase.from('profils')
      .select('id, nom, prenom, role, etablissement_id')
      .order('nom')
      .then(({ data }: any) => setUsers(data || []))
  }, [])

  const roleCounts: Record<string, number> = {}
  users.forEach(u => { roleCounts[u.role] = (roleCounts[u.role] || 0) + 1 })

  const filtered = users.filter(u => {
    const matchSearch = !search || `${u.prenom} ${u.nom}`.toLowerCase().includes(search.toLowerCase())
    const matchRole   = !roleFilter || u.role === roleFilter
    return matchSearch && matchRole
  })

  async function changerRole(id: string, newRole: string) {
    await supabase.from('profils').update({ role: newRole }).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u))
    setEditRoleId(null)
  }

  async function supprimerUtilisateur(id: string, nom: string) {
    if (!window.confirm(`Supprimer le compte de ${nom} ? Cette action est irréversible.`)) return
    await supabase.from('profils').delete().eq('id', id)
    setUsers(prev => prev.filter(u => u.id !== id))
  }

  return (
    <div>
      {/* Chips par rôle */}
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginBottom: 16 }}>
        {Object.entries(roleCounts).sort().map(([role, count]) => (
          <button key={role} onClick={() => setRoleFilter(roleFilter === role ? '' : role)} style={{
            fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
            fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
            background: roleFilter === role ? 'var(--primary-dark)' : 'white',
            color: roleFilter === role ? 'white' : 'var(--text-secondary)',
            border: `1.5px solid ${roleFilter === role ? 'var(--primary-dark)' : 'var(--border-light)'}`,
          }}>
            {ROLE_LABELS[role] || role} · {count}
          </button>
        ))}
      </div>

      {/* Recherche */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
        <input type="text" placeholder="Rechercher un utilisateur…" value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...A.input, width: '100%', paddingLeft: 36, boxSizing: 'border-box' as const }} />
        {search && (
          <button onClick={() => setSearch('')}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 14 }}>✕</button>
        )}
      </div>

      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: 12 }}>
        {filtered.length} utilisateur{filtered.length > 1 ? 's' : ''}
        {(search || roleFilter) ? ` (filtrés sur ${users.length})` : ''}
      </p>

      <div style={A.card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={A.th}>Nom</th>
            <th style={A.th}>Rôle</th>
            <th style={A.th}>Établissement</th>
            <th style={A.thC}>Actions</th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={4} style={{ ...A.tdC, padding: 40, color: 'var(--text-tertiary)' }}>Aucun utilisateur trouvé</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id}>
                <td style={A.tdBold}>{u.prenom} {u.nom}</td>
                <td style={A.td}>
                  {editRoleId === u.id ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <select value={editRoleVal} onChange={e => setEditRoleVal(e.target.value)}
                        style={{ ...A.select, width: 160 }} autoFocus>
                        {Object.entries(ROLE_LABELS).map(([r, l]) => (
                          <option key={r} value={r}>{l}</option>
                        ))}
                      </select>
                      <button onClick={() => changerRole(u.id, editRoleVal)} style={{ ...A.btnPrimary, padding: '6px 12px' }}>✓</button>
                      <button onClick={() => setEditRoleId(null)} style={{ ...A.btnGhost, padding: '6px 10px' }}>✕</button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--bg-gray)', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  )}
                </td>
                <td style={A.td}>{etablissements.find(e => e.id === u.etablissement_id)?.nom || '—'}</td>
                <td style={A.tdC}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                    <button onClick={() => { setEditRoleId(u.id); setEditRoleVal(u.role) }} style={{
                      fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                      border: '1.5px solid var(--border-main)', background: 'white',
                      color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)',
                    }}>
                      Modifier le rôle
                    </button>
                    <button onClick={() => supprimerUtilisateur(u.id, `${u.prenom} ${u.nom}`)} style={A.btnDanger}>
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── NormeRow ───────────────────────────────────────────────────────────────────

function NormeRow({ norme, onSave }: { norme: Norme; onSave: (n: Norme) => void }) {
  const [min,     setMin]     = useState(String(norme.seuil_min))
  const [attendu, setAttendu] = useState(String(norme.seuil_attendu))

  function handleBlur() {
    const newMin     = parseInt(min)     || norme.seuil_min
    const newAttendu = parseInt(attendu) || norme.seuil_attendu
    if (newMin !== norme.seuil_min || newAttendu !== norme.seuil_attendu) {
      onSave({ ...norme, seuil_min: newMin, seuil_attendu: newAttendu })
    }
  }

  return (
    <tr>
      <td style={A.tdBold}>{norme.niveau}</td>
      <td style={A.tdC}>
        <input type="number" value={min}
          onChange={e => setMin(e.target.value)}
          onBlur={handleBlur}
          style={{ ...A.input, width: 80, textAlign: 'center' as const, padding: '6px 8px' }} />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4, fontFamily: 'var(--font-sans)' }}>m/min</span>
      </td>
      <td style={A.tdC}>
        <input type="number" value={attendu}
          onChange={e => setAttendu(e.target.value)}
          onBlur={handleBlur}
          style={{ ...A.input, width: 80, textAlign: 'center' as const, padding: '6px 8px' }} />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4, fontFamily: 'var(--font-sans)' }}>m/min</span>
      </td>
    </tr>
  )
}

// ── NormesTab ──────────────────────────────────────────────────────────────────

function NormesTab({ supabase, periodes, profil }: { supabase: any; periodes: Periode[]; profil: any }) {
  const [normes,    setNormes]    = useState<Norme[]>([])
  const [periodeId, setPeriodeId] = useState('')
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (periodes.length > 0 && !periodeId) setPeriodeId(periodes[0].id)
  }, [periodes])

  useEffect(() => { chargerNormes() }, [periodeId])

  async function chargerNormes() {
    let query = supabase.from('config_normes')
      .select('id, niveau, seuil_min, seuil_attendu, periode_id').order('niveau')
    if (periodeId) query = query.eq('periode_id', periodeId)
    const { data } = await query
    setNormes(data || [])
  }

  async function sauvegarderNorme(norme: Norme) {
    const etabId = profil?.etablissement_id
    if (!etabId) return
    await supabase.from('config_normes').upsert(
      { niveau: norme.niveau, seuil_min: norme.seuil_min, seuil_attendu: norme.seuil_attendu,
        etablissement_id: etabId, periode_id: periodeId || null },
      { onConflict: 'niveau,etablissement_id,periode_id' }
    )
    chargerNormes()
  }

  async function chargerDefaut() {
    const etabId = profil?.etablissement_id
    if (!etabId) { alert('Configurez votre établissement dans votre profil.'); return }
    setSaving(true)
    const normesDef = [
      { niveau: 'CP',  seuil_min: 40,  seuil_attendu: 55  },
      { niveau: 'CE1', seuil_min: 65,  seuil_attendu: 80  },
      { niveau: 'CE2', seuil_min: 80,  seuil_attendu: 90  },
      { niveau: 'CM1', seuil_min: 90,  seuil_attendu: 100 },
      { niveau: 'CM2', seuil_min: 100, seuil_attendu: 110 },
      { niveau: '6e',  seuil_min: 110, seuil_attendu: 120 },
      { niveau: '5e',  seuil_min: 120, seuil_attendu: 130 },
      { niveau: '4e',  seuil_min: 125, seuil_attendu: 135 },
      { niveau: '3e',  seuil_min: 130, seuil_attendu: 140 },
    ]
    for (const n of normesDef) {
      await supabase.from('config_normes').upsert(
        { ...n, etablissement_id: etabId, periode_id: periodeId || null },
        { onConflict: 'niveau,etablissement_id,periode_id' }
      )
    }
    await chargerNormes()
    setSaving(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' as const }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Période :</span>
        {periodes.map(p => (
          <button key={p.id} onClick={() => setPeriodeId(p.id)} style={{
            padding: '6px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
            background: periodeId === p.id ? 'var(--primary-dark)' : 'white',
            color: periodeId === p.id ? 'white' : 'var(--text-secondary)',
            border: `1.5px solid ${periodeId === p.id ? 'var(--primary-dark)' : 'var(--border-light)'}`,
          }}>
            {p.code}
          </button>
        ))}
        <button onClick={chargerDefaut} disabled={saving}
          style={{ ...A.btnPrimary, marginLeft: 'auto', opacity: saving ? 0.5 : 1 }}>
          {saving ? 'Enregistrement...' : 'Charger normes par défaut'}
        </button>
      </div>

      {normes.length === 0 ? (
        <div style={A.emptyState}>
          {periodeId ? 'Aucune norme configurée pour cette période.' : 'Sélectionnez une période ci-dessus.'}
          {' '}Cliquez sur "Charger normes par défaut" pour initialiser.
        </div>
      ) : (
        <div style={A.card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={A.th}>Niveau</th>
              <th style={A.thC}>Seuil minimum</th>
              <th style={A.thC}>Score attendu</th>
            </tr></thead>
            <tbody>
              {normes.map(n => (
                <NormeRow key={n.id} norme={n} onSave={sauvegarderNorme} />
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '10px 20px', background: 'var(--bg-gray)', borderTop: '1px solid var(--border-light)', fontFamily: 'var(--font-sans)' }}>
            Cliquez sur une valeur pour la modifier · Tab ou clic ailleurs pour enregistrer
          </div>
        </div>
      )}
    </div>
  )
}
