'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { logAction } from '@/app/lib/auditLog'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'
import type { Etablissement, Periode, Norme, CoorDoEtab, IenEtab, ProfilOption, Invitation, UserRow, Departement, Circonscription, Ville, QcmTest, QcmQuestion } from '@/app/lib/types'
import { ROLE_LABELS } from '@/app/lib/types'

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
  const [departements, setDepartements]       = useState<Departement[]>([])
  const [circonscriptions, setCirconscriptions] = useState<Circonscription[]>([])
  const [villes, setVilles]                   = useState<Ville[]>([])
  const [editingEtabId, setEditingEtabId]     = useState<string | null>(null)
  const [newPeriodeCode, setNewPeriodeCode]   = useState('')
  const [newPeriodeLabel, setNewPeriodeLabel] = useState('')
  const [newPeriodeType, setNewPeriodeType]   = useState('regular')
  const { profil, loading: profilLoading }    = useProfil()
  const router   = useRouter()
  const supabase = createClient()

  const isReseau = profil?.role === 'coordo_rep' || profil?.role === 'ien'

  const ONGLETS = isReseau
    ? ['Mon réseau', 'Périodes', 'Normes', 'QCM']
    : ['Établissements', 'Géographie', 'Périodes', 'Normes', 'Utilisateurs', 'Invitations', 'Affectations', 'QCM', 'Structure']

  const periodesOnglet  = isReseau ? 1 : 2
  const normesOnglet    = isReseau ? 2 : 3
  const qcmOnglet       = isReseau ? 3 : 7
  const structureOnglet = 8

  // GeoData dynamique (construit depuis Supabase)
  const geoData: Record<string, Record<string, string[]>> = {}
  for (const dept of departements) {
    geoData[dept.nom] = {}
    for (const circo of circonscriptions.filter(c => c.departement_id === dept.id)) {
      geoData[dept.nom][circo.nom] = villes
        .filter(v => v.circonscription_id === circo.id)
        .map(v => v.nom)
    }
  }

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

    const [etabRes, periRes, ceRes, ienRes, invRes, deptRes, circoRes, villeRes] = await Promise.all([
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
      supabase.from('departements').select('id, nom').order('nom'),
      supabase.from('circonscriptions').select('id, nom, departement_id').order('nom'),
      supabase.from('villes').select('id, nom, circonscription_id').order('nom'),
    ])
    setEtablissements(etabRes.data || [])
    // Dédupliquer les périodes par code (une seule ligne par code)
    const allPeriodes = periRes.data || []
    const seenCodes = new Set<string>()
    const dedupPeriodes = allPeriodes.filter((p: any) => {
      if (seenCodes.has(p.code)) return false
      seenCodes.add(p.code); return true
    })
    setPeriodes(dedupPeriodes)
    setCoordoEtabs((ceRes.data || []) as unknown as CoorDoEtab[])
    setIenEtabs((ienRes.data || []) as unknown as IenEtab[])
    setInvitations((invRes.data || []) as unknown as Invitation[])
    setDepartements(deptRes.data || [])
    setCirconscriptions(circoRes.data || [])
    setVilles(villeRes.data || [])
    setLoading(false)
  }


  async function creerPeriode() {
    if (!newPeriodeCode.trim() || !newPeriodeLabel.trim()) return
    const code = newPeriodeCode.trim().toUpperCase()
    const label = newPeriodeLabel.trim()
    const type = newPeriodeType

    // Vérifier si le code existe déjà
    const existe = periodes.some(p => p.code === code)
    if (existe) { alert(`Le code "${code}" existe déjà.`); return }

    if (etablissements.length > 0) {
      const rows = etablissements.map(e => ({
        code, label, actif: true, saisie_ouverte: true, type,
        etablissement_id: e.id,
      }))
      await supabase.from('periodes').insert(rows)
    } else {
      await supabase.from('periodes').insert({ code, label, actif: true, saisie_ouverte: true, type })
    }
    setNewPeriodeCode(''); setNewPeriodeLabel(''); setNewPeriodeType('regular')
    chargerDonnees()
  }

  async function supprimerPeriode(code: string) {
    if (!window.confirm(`Supprimer toutes les périodes "${code}" ? Les passations liées seront aussi supprimées.`)) return
    await supabase.from('periodes').delete().eq('code', code)
    logAction('supprimer_periode', { code })
    chargerDonnees()
  }

  async function updatePeriodeLabel(code: string, newLabel: string) {
    if (!newLabel.trim()) return
    // Mettre à jour le libellé pour toutes les périodes avec ce code
    await supabase.from('periodes').update({ label: newLabel.trim() }).eq('code', code)
    setPeriodes(prev => prev.map(p => p.code === code ? { ...p, label: newLabel.trim() } : p))
  }

  async function togglePeriodeByCode(code: string, field: 'actif' | 'saisie_ouverte', currentValue: boolean) {
    await supabase.from('periodes').update({ [field]: !currentValue }).eq('code', code)
    setPeriodes(prev => prev.map(p => p.code === code ? { ...p, [field]: !currentValue } : p))
  }

  async function updateDatesByCode(code: string, debut: string | null, fin: string | null) {
    await supabase.from('periodes').update({ date_debut: debut || null, date_fin: fin || null }).eq('code', code)
    setPeriodes(prev => prev.map(p => p.code === code ? { ...p, date_debut: debut, date_fin: fin } : p))
  }

  async function updateTypeByCode(code: string, type: string) {
    await supabase.from('periodes').update({ type }).eq('code', code)
    setPeriodes(prev => prev.map(p => p.code === code ? { ...p, type } : p))
  }

  async function updateEtablissement(id: string, data: Partial<Etablissement>) {
    await supabase.from('etablissements').update(data).eq('id', id)
    setEtablissements(prev => prev.map(e => e.id === id ? { ...e, ...data } : e))
  }

  async function supprimerEtablissement(id: string) {
    if (!window.confirm('Supprimer cet établissement ? Cette action est irréversible.')) return
    const etab = etablissements.find(e => e.id === id)
    await supabase.from('etablissements').delete().eq('id', id)
    logAction('supprimer_etablissement', { id, nom: etab?.nom })
    setEtablissements(prev => prev.filter(e => e.id !== id))
  }

  async function supprimerAffectation(id: string) {
    if (!window.confirm('Supprimer cette affectation ?')) return
    await supabase.from('coordo_etablissements').delete().eq('id', id)
    logAction('supprimer_affectation_coordo', { id })
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
        {false && onglet === -1 && (
          <VueEnsembleTab
            supabase={supabase}
            etablissements={etablissements}
            periodes={periodes}
            invitations={invitations}
          />
        )}

        {/* ── Établissements ── */}
        {!isReseau && onglet === 0 && (
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
                  <th style={S.th}>Circonscription</th>
                  <th style={S.th}>Ville</th>
                  <th style={S.th}>Établissement</th>
                  <th style={S.th}>Type</th>
                  <th style={S.th}>Réseau</th>
                  <th style={S.thC}>Actions</th>
                </tr></thead>
                <tbody>
                  {etablissements.map(e => (
                    <EtablissementRow
                      key={e.id}
                      e={e}
                      geoData={geoData}
                      editing={editingEtabId === e.id}
                      onEdit={() => setEditingEtabId(e.id)}
                      onCancel={() => setEditingEtabId(null)}
                      onSave={async data => { await updateEtablissement(e.id, data); setEditingEtabId(null) }}
                      onDelete={() => supprimerEtablissement(e.id)}
                    />
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
                  <th style={S.thC}></th>
                </tr></thead>
                <tbody>
                  {periodes.map(p => (
                    <PeriodeRow key={p.code} periode={p}
                      isReseau={isReseau}
                      onToggleActif={() => togglePeriodeByCode(p.code, 'actif', !!p.actif)}
                      onToggleSaisie={() => togglePeriodeByCode(p.code, 'saisie_ouverte', !!p.saisie_ouverte)}
                      onUpdateDates={(d, f) => updateDatesByCode(p.code, d, f)}
                      onUpdateType={t => updateTypeByCode(p.code, t)}
                      onUpdateLabel={l => updatePeriodeLabel(p.code, l)}
                      onSupprimer={() => supprimerPeriode(p.code)}
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

        {/* ── Géographie ── */}
        {!isReseau && onglet === 1 && (
          <GeographieTab
            supabase={supabase}
            departements={departements} setDepartements={setDepartements}
            circonscriptions={circonscriptions} setCirconscriptions={setCirconscriptions}
            villes={villes} setVilles={setVilles}
          />
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

        {/* ── QCM ── */}
        {onglet === qcmOnglet && (
          <QcmTab supabase={supabase} profil={profil} periodes={periodes} />
        )}

        {/* ── Structure ── */}
        {!isReseau && onglet === structureOnglet && (
          <StructureTab supabase={supabase} etablissements={etablissements} />
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

// ── EtablissementRow ───────────────────────────────────────────────────────────

function EtablissementRow({ e, geoData, editing, onEdit, onCancel, onSave, onDelete }: {
  e: Etablissement
  geoData: Record<string, Record<string, string[]>>
  editing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (data: Partial<Etablissement>) => Promise<void>
  onDelete: () => void
}) {
  const [nom,    setNom]    = useState(e.nom)
  const [type,   setType]   = useState(e.type)
  const [reseau, setReseau] = useState(e.type_reseau)
  const [dept,   setDept]   = useState(e.departement   || '')
  const [circo,  setCirco]  = useState(e.circonscription || '')
  const [ville,  setVille]  = useState(e.ville          || '')
  const [saving, setSaving] = useState(false)

  const depts  = Object.keys(geoData)
  const circos = dept ? Object.keys(geoData[dept] || {}) : []
  const villes = dept && circo ? (geoData[dept]?.[circo] || []) : []

  function onDeptChange(val: string) { setDept(val); setCirco(''); setVille('') }
  function onCircoChange(val: string) { setCirco(val); setVille('') }

  async function handleSave() {
    if (!nom.trim()) return
    setSaving(true)
    await onSave({ nom: nom.trim(), type, type_reseau: reseau, departement: dept || null, circonscription: circo || null, ville: ville || null })
    setSaving(false)
  }

  const badge = (color: string) => ({
    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
    background: color === 'REP+' ? '#f3e8ff' : color === 'REP' ? '#dbeafe' : 'var(--bg-gray)',
    color: color === 'REP+' ? '#7e22ce' : color === 'REP' ? '#1d4ed8' : 'var(--text-tertiary)',
    fontFamily: 'var(--font-sans)',
  })

  return (
    <>
      <tr>
        <td style={A.td}>{e.circonscription || '—'}</td>
        <td style={A.td}>{e.ville || '—'}</td>
        <td style={A.tdBold}>{e.nom}</td>
        <td style={A.td}>{e.type}</td>
        <td style={A.td}><span style={badge(e.type_reseau)}>{e.type_reseau || '—'}</span></td>
        <td style={A.tdC}>
          <button onClick={onEdit} style={{
            fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 8, cursor: 'pointer',
            border: '1.5px solid var(--border-main)', background: 'white',
            color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)',
          }}>
            Modifier
          </button>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={6} style={{ padding: 0, borderBottom: '2px solid var(--primary-dark)' }}>
            <div style={{ padding: '20px 24px', background: 'var(--bg-gray)', borderLeft: '3px solid var(--primary-dark)' }}>

              {/* Entonnoir géographique */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={A.label}>Département</label>
                  <select value={dept} onChange={e => onDeptChange(e.target.value)} style={A.select}>
                    <option value="">— Choisir —</option>
                    {depts.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={A.label}>Circonscription</label>
                  <select value={circo} onChange={e => onCircoChange(e.target.value)} style={{ ...A.select, opacity: dept ? 1 : 0.4 }} disabled={!dept}>
                    <option value="">— Choisir —</option>
                    {circos.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={A.label}>Ville / Commune</label>
                  <select value={ville} onChange={e => setVille(e.target.value)} style={{ ...A.select, opacity: circo ? 1 : 0.4 }} disabled={!circo}>
                    <option value="">— Choisir —</option>
                    {villes.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>

              {/* Identité */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={A.label}>Nom de l'établissement</label>
                  <input value={nom} onChange={e => setNom(e.target.value)}
                    style={{ ...A.input, width: '100%', boxSizing: 'border-box' as const }} />
                </div>
                <div>
                  <label style={A.label}>Type</label>
                  <select value={type} onChange={e => setType(e.target.value)} style={A.select}>
                    {['école', 'collège', 'lycée'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={A.label}>Réseau</label>
                  <select value={reseau} onChange={e => setReseau(e.target.value)} style={A.select}>
                    {['Hors REP', 'REP', 'REP+'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* Boutons */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                <button onClick={onDelete} style={A.btnDanger}>Supprimer</button>
                <button onClick={onCancel} style={A.btnGhost}>Annuler</button>
                <button onClick={handleSave} disabled={saving || !nom.trim()} style={{ ...A.btnPrimary, opacity: (saving || !nom.trim()) ? 0.4 : 1 }}>
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── GeographieTab ──────────────────────────────────────────────────────────────

function GeographieTab({ supabase, departements, setDepartements, circonscriptions, setCirconscriptions, villes, setVilles }: {
  supabase: any
  departements: Departement[]
  setDepartements: React.Dispatch<React.SetStateAction<Departement[]>>
  circonscriptions: Circonscription[]
  setCirconscriptions: React.Dispatch<React.SetStateAction<Circonscription[]>>
  villes: Ville[]
  setVilles: React.Dispatch<React.SetStateAction<Ville[]>>
}) {
  const [selDept,  setSelDept]  = useState('')
  const [selCirco, setSelCirco] = useState('')
  const [newDept,  setNewDept]  = useState('')
  const [newCirco, setNewCirco] = useState('')
  const [newVille, setNewVille] = useState('')
  const [errDept,  setErrDept]  = useState('')
  const [errCirco, setErrCirco] = useState('')
  const [errVille, setErrVille] = useState('')

  const visCircos = circonscriptions.filter(c => c.departement_id === selDept)
  const visVilles = villes.filter(v => v.circonscription_id === selCirco)

  async function ajouterDept() {
    if (!newDept.trim()) return
    setErrDept('')
    const { data, error } = await supabase.from('departements').insert({ nom: newDept.trim() }).select().single()
    if (error) { setErrDept('Ce département existe déjà.'); return }
    if (data) { setDepartements(prev => [...prev, data]); setNewDept('') }
  }
  async function supprimerDept(id: string) {
    if (!window.confirm('Supprimer ce département et toutes ses circonscriptions / villes ?')) return
    await supabase.from('departements').delete().eq('id', id)
    const ids = circonscriptions.filter(c => c.departement_id === id).map(c => c.id)
    setVilles(prev => prev.filter(v => !ids.includes(v.circonscription_id)))
    setCirconscriptions(prev => prev.filter(c => c.departement_id !== id))
    setDepartements(prev => prev.filter(d => d.id !== id))
    if (selDept === id) { setSelDept(''); setSelCirco('') }
  }
  async function ajouterCirco() {
    if (!newCirco.trim() || !selDept) return
    setErrCirco('')
    const { data, error } = await supabase.from('circonscriptions').insert({ nom: newCirco.trim(), departement_id: selDept }).select().single()
    if (error) { setErrCirco('Cette circonscription existe déjà.'); return }
    if (data) { setCirconscriptions(prev => [...prev, data]); setNewCirco('') }
  }
  async function supprimerCirco(id: string) {
    if (!window.confirm('Supprimer cette circonscription et toutes ses villes ?')) return
    await supabase.from('circonscriptions').delete().eq('id', id)
    setVilles(prev => prev.filter(v => v.circonscription_id !== id))
    setCirconscriptions(prev => prev.filter(c => c.id !== id))
    if (selCirco === id) setSelCirco('')
  }
  async function ajouterVille() {
    if (!newVille.trim() || !selCirco) return
    setErrVille('')
    const { data, error } = await supabase.from('villes').insert({ nom: newVille.trim(), circonscription_id: selCirco }).select().single()
    if (error) { setErrVille('Cette ville existe déjà.'); return }
    if (data) { setVilles(prev => [...prev, data]); setNewVille('') }
  }
  async function supprimerVille(id: string) {
    await supabase.from('villes').delete().eq('id', id)
    setVilles(prev => prev.filter(v => v.id !== id))
  }

  const panel: React.CSSProperties = { background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }
  const panelHead: React.CSSProperties = { padding: '12px 16px', borderBottom: '1.5px solid var(--border-light)', background: 'var(--bg-gray)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
  const panelTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.2, textTransform: 'uppercase', fontFamily: 'var(--font-sans)' }
  const hint: React.CSSProperties = { fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }
  const item = (sel: boolean): React.CSSProperties => ({
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)',
    background: sel ? 'var(--bg-light)' : 'white',
    fontFamily: 'var(--font-sans)', fontSize: 13,
    color: sel ? 'var(--primary-dark)' : 'var(--text-secondary)', fontWeight: sel ? 700 : 400,
  })
  const addRow: React.CSSProperties = { padding: '10px 12px', borderTop: '1.5px solid var(--border-light)', display: 'flex', gap: 8 }
  const btnX: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 13, padding: '0 4px', lineHeight: 1 }
  const empty: React.CSSProperties = { padding: '20px 16px', fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)', textAlign: 'center' }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, alignItems: 'start' }}>

      {/* Départements */}
      <div style={panel}>
        <div style={panelHead}>
          <span style={panelTitle}>Départements ({departements.length})</span>
        </div>
        <div style={{ overflowY: 'auto', maxHeight: 420 }}>
          {departements.length === 0 && <p style={empty}>Aucun département</p>}
          {departements.map(d => (
            <div key={d.id} style={item(selDept === d.id)} onClick={() => { setSelDept(d.id); setSelCirco('') }}>
              <span>{d.nom}</span>
              <button onClick={ev => { ev.stopPropagation(); supprimerDept(d.id) }} style={btnX}>✕</button>
            </div>
          ))}
        </div>
        <div style={addRow}>
          <input value={newDept} onChange={e => setNewDept(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ajouterDept()}
            placeholder="Ex : Guyane (973)"
            style={{ ...A.input, flex: 1, fontSize: 12 }} />
          <button onClick={ajouterDept} disabled={!newDept.trim()} style={{ ...A.btnPrimary, padding: '7px 14px', opacity: newDept.trim() ? 1 : 0.4 }}>+</button>
        </div>
        {errDept && <p style={{ fontSize: 11, color: '#dc2626', fontFamily: 'var(--font-sans)', padding: '4px 12px', margin: 0 }}>{errDept}</p>}
      </div>

      {/* Circonscriptions */}
      <div style={panel}>
        <div style={panelHead}>
          <span style={panelTitle}>Circonscriptions ({visCircos.length})</span>
          {!selDept && <span style={hint}>← choisir un département</span>}
        </div>
        <div style={{ overflowY: 'auto', maxHeight: 420 }}>
          {selDept && visCircos.length === 0 && <p style={empty}>Aucune circonscription</p>}
          {visCircos.map(c => (
            <div key={c.id} style={item(selCirco === c.id)} onClick={() => setSelCirco(c.id)}>
              <span>{c.nom}</span>
              <button onClick={ev => { ev.stopPropagation(); supprimerCirco(c.id) }} style={btnX}>✕</button>
            </div>
          ))}
        </div>
        {selDept && (
          <div style={addRow}>
            <input value={newCirco} onChange={e => setNewCirco(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ajouterCirco()}
              placeholder="Ex : Cayenne 1 – Saül"
              style={{ ...A.input, flex: 1, fontSize: 12 }} />
            <button onClick={ajouterCirco} disabled={!newCirco.trim()} style={{ ...A.btnPrimary, padding: '7px 14px', opacity: newCirco.trim() ? 1 : 0.4 }}>+</button>
          </div>
        )}
        {errCirco && <p style={{ fontSize: 11, color: '#dc2626', fontFamily: 'var(--font-sans)', padding: '4px 12px', margin: 0 }}>{errCirco}</p>}
      </div>

      {/* Villes */}
      <div style={panel}>
        <div style={panelHead}>
          <span style={panelTitle}>Villes / Communes ({visVilles.length})</span>
          {!selCirco && <span style={hint}>← choisir une circo</span>}
        </div>
        <div style={{ overflowY: 'auto', maxHeight: 420 }}>
          {selCirco && visVilles.length === 0 && <p style={empty}>Aucune ville</p>}
          {visVilles.map(v => (
            <div key={v.id} style={item(false)}>
              <span>{v.nom}</span>
              <button onClick={() => supprimerVille(v.id)} style={btnX}>✕</button>
            </div>
          ))}
        </div>
        {selCirco && (
          <div style={addRow}>
            <input value={newVille} onChange={e => setNewVille(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ajouterVille()}
              placeholder="Ex : Cayenne"
              style={{ ...A.input, flex: 1, fontSize: 12 }} />
            <button onClick={ajouterVille} disabled={!newVille.trim()} style={{ ...A.btnPrimary, padding: '7px 14px', opacity: newVille.trim() ? 1 : 0.4 }}>+</button>
          </div>
        )}
        {errVille && <p style={{ fontSize: 11, color: '#dc2626', fontFamily: 'var(--font-sans)', padding: '4px 12px', margin: 0 }}>{errVille}</p>}
      </div>

    </div>
  )
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

function PeriodeRow({ periode, isReseau, onToggleActif, onToggleSaisie, onUpdateDates, onUpdateType, onUpdateLabel, onSupprimer }: {
  periode: Periode
  isReseau: boolean
  onToggleActif: () => void
  onToggleSaisie: () => void
  onUpdateDates: (debut: string | null, fin: string | null) => void
  onUpdateType: (type: string) => void
  onUpdateLabel?: (label: string) => void
  onSupprimer?: () => void
}) {
  const [debut, setDebut] = useState(periode.date_debut || '')
  const [fin,   setFin]   = useState(periode.date_fin   || '')
  const [label, setLabel] = useState(periode.label || '')

  return (
    <tr>
      <td style={{ ...A.tdBold, fontSize: 16 }}>{periode.code}</td>
      <td style={A.td}>
        {isReseau ? (
          <span>{periode.label}</span>
        ) : (
          <input value={label} onChange={e => setLabel(e.target.value)}
            onBlur={() => onUpdateLabel?.(label)}
            style={{ ...A.input, padding: '5px 8px', fontSize: 12, width: 120 }} />
        )}
      </td>
      <td style={A.td}>
        {isReseau ? (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
            {periode.type === 'evaluation_nationale' ? 'Éval. nat.' : 'Classique'}
          </span>
        ) : (
          <select value={periode.type || 'regular'} onChange={e => onUpdateType(e.target.value)}
            style={{ ...A.input, padding: '5px 6px', fontSize: 11, width: 120 }}>
            <option value="regular">Classique</option>
            <option value="evaluation_nationale">Éval. nat.</option>
          </select>
        )}
      </td>
      <td style={A.td}>
        <input type="date" value={debut}
          onChange={e => setDebut(e.target.value)}
          onBlur={() => onUpdateDates(debut || null, fin || null)}
          style={{ ...A.input, padding: '5px 6px', fontSize: 12, width: 120 }}
          disabled={isReseau} />
      </td>
      <td style={A.td}>
        <input type="date" value={fin}
          onChange={e => setFin(e.target.value)}
          onBlur={() => onUpdateDates(debut || null, fin || null)}
          style={{ ...A.input, padding: '5px 6px', fontSize: 12, width: 120 }}
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
      <td style={A.tdC}>
        {onSupprimer && (
          <button onClick={onSupprimer} style={{
            background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fca5a5',
            padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
            fontFamily: 'var(--font-sans)', cursor: 'pointer',
          }}>Supprimer</button>
        )}
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

// ── QCM Tab ───────────────────────────────────────────────────────────────────

const NIVEAUX_QCM = ['CP', 'CE1', 'CE2', 'CM1', 'CM2', '6eme', '5eme', '4eme', '3eme']

function QcmTab({ supabase, profil, periodes }: { supabase: any; profil: any; periodes: Periode[] }) {
  const [tests, setTests] = useState<(QcmTest & { qcm_questions?: QcmQuestion[] })[]>([])
  const [loadingQcm, setLoadingQcm] = useState(true)
  const [mode, setMode] = useState<'liste' | 'edit'>('liste')
  const [editTest, setEditTest] = useState<QcmTest | null>(null)
  const [titre, setTitre] = useState('')
  const [texteRef, setTexteRef] = useState('')
  const [qcmPeriodeId, setQcmPeriodeId] = useState('')
  const [niveau, setNiveau] = useState('')
  const [questions, setQuestions] = useState<QcmQuestion[]>([])
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState('')

  useEffect(() => { chargerQcm() }, [])

  async function chargerQcm() {
    setLoadingQcm(true)
    const { data: testsData } = await supabase
      .from('qcm_tests')
      .select('*, qcm_questions(*)')
      .order('created_at', { ascending: false })
    setTests(testsData || [])
    setLoadingQcm(false)
  }

  function initQuestions(): QcmQuestion[] {
    return Array.from({ length: 6 }, (_, i) => ({
      id: '', qcm_test_id: '', numero: i + 1,
      question_text: '', option_a: '', option_b: '', option_c: '', option_d: '',
      reponse_correcte: 'A' as const,
    }))
  }

  function ouvrirCreation() {
    setEditTest(null)
    setTitre(''); setTexteRef(''); setQcmPeriodeId(''); setNiveau('')
    setQuestions(initQuestions())
    setErreur('')
    setMode('edit')
  }

  function ouvrirEdition(test: QcmTest & { qcm_questions?: QcmQuestion[] }) {
    setEditTest(test)
    setTitre(test.titre || '')
    setTexteRef(test.texte_reference || '')
    setQcmPeriodeId(test.periode_id)
    setNiveau(test.niveau)
    const qs = (test.qcm_questions || []).sort((a, b) => a.numero - b.numero)
    const filled: QcmQuestion[] = Array.from({ length: 6 }, (_, i) => {
      const existing = qs.find(q => q.numero === i + 1)
      return existing || { id: '', qcm_test_id: test.id, numero: i + 1, question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', reponse_correcte: 'A' as const }
    })
    setQuestions(filled)
    setErreur('')
    setMode('edit')
  }

  function updateQuestion(idx: number, field: string, value: string) {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q))
  }

  async function sauvegarder() {
    setErreur('')
    if (!qcmPeriodeId || !niveau) { setErreur('Sélectionnez une période et un niveau.'); return }
    const incomplete = questions.some(q => !q.question_text.trim() || !q.option_a.trim() || !q.option_b.trim() || !q.option_c.trim() || !q.option_d.trim())
    if (incomplete) { setErreur('Toutes les questions doivent avoir un énoncé et 4 options.'); return }

    setSaving(true)
    try {
      let testId = editTest?.id
      if (editTest) {
        const { error } = await supabase.from('qcm_tests').update({
          titre: titre.trim() || null,
          texte_reference: texteRef.trim() || null,
          periode_id: qcmPeriodeId,
          niveau,
        }).eq('id', editTest.id)
        if (error) { setErreur(error.message); setSaving(false); return }
      } else {
        const { data, error } = await supabase.from('qcm_tests').insert({
          titre: titre.trim() || null,
          texte_reference: texteRef.trim() || null,
          periode_id: qcmPeriodeId,
          niveau,
          created_by: profil.id,
        }).select('id').single()
        if (error) { setErreur(error.message); setSaving(false); return }
        testId = data.id
      }

      await supabase.from('qcm_questions').delete().eq('qcm_test_id', testId)
      const rows = questions.map(q => ({
        qcm_test_id: testId,
        numero: q.numero,
        question_text: q.question_text.trim(),
        option_a: q.option_a.trim(),
        option_b: q.option_b.trim(),
        option_c: q.option_c.trim(),
        option_d: q.option_d.trim(),
        reponse_correcte: q.reponse_correcte,
      }))
      const { error: qErr } = await supabase.from('qcm_questions').insert(rows)
      if (qErr) { setErreur(qErr.message); setSaving(false); return }

      await chargerQcm()
      setMode('liste')
    } finally {
      setSaving(false)
    }
  }

  async function supprimerTest(id: string) {
    if (!window.confirm('Supprimer ce test QCM ? Les questions seront aussi supprimées.')) return
    await supabase.from('qcm_tests').delete().eq('id', id)
    await chargerQcm()
  }

  function qcmPeriodeLabel(pid: string) {
    const p = periodes.find(pr => pr.id === pid)
    return p ? `${p.code} — ${p.label}` : pid
  }

  if (loadingQcm) return <div style={{ padding: 32, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>Chargement…</div>

  if (mode === 'edit') return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>
          {editTest ? 'Modifier le test QCM' : 'Nouveau test QCM'}
        </h3>
        <button onClick={() => setMode('liste')} style={A.btnGhost}>← Retour</button>
      </div>

      {erreur && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#dc2626', fontFamily: 'var(--font-sans)' }}>{erreur}</div>}

      <div style={{ ...A.card, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={A.label}>Période *</label>
            <select value={qcmPeriodeId} onChange={e => setQcmPeriodeId(e.target.value)} style={A.select}>
              <option value="">— Choisir —</option>
              {periodes.filter(p => p.actif).map(p => (
                <option key={p.id} value={p.id}>{p.code} — {p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={A.label}>Niveau *</label>
            <select value={niveau} onChange={e => setNiveau(e.target.value)} style={A.select}>
              <option value="">— Choisir —</option>
              {NIVEAUX_QCM.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label style={A.label}>Titre (optionnel)</label>
            <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Ex: Le petit prince" style={{ ...A.input, width: '100%' }} />
          </div>
        </div>
        <div>
          <label style={A.label}>Texte de référence (le passage que l'élève lit)</label>
          <textarea value={texteRef} onChange={e => setTexteRef(e.target.value)} rows={5} placeholder="Collez ici le texte que les élèves doivent lire avant de répondre aux questions…" style={{ ...A.input, width: '100%', resize: 'vertical' as const }} />
        </div>
      </div>

      {questions.map((q, idx) => (
        <div key={idx} style={{ ...A.card, padding: 20, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ background: 'var(--primary-dark)', color: 'white', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-sans)', flexShrink: 0 }}>Q{q.numero}</span>
            <input value={q.question_text} onChange={e => updateQuestion(idx, 'question_text', e.target.value)} placeholder="Énoncé de la question…" style={{ ...A.input, flex: 1 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingLeft: 44 }}>
            {(['A', 'B', 'C', 'D'] as const).map(letter => (
              <div key={letter} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="radio"
                  name={`correct-${idx}`}
                  checked={q.reponse_correcte === letter}
                  onChange={() => updateQuestion(idx, 'reponse_correcte', letter)}
                  style={{ accentColor: 'var(--primary-dark)' }}
                />
                <span style={{ fontSize: 13, fontWeight: 700, color: q.reponse_correcte === letter ? '#16a34a' : 'var(--text-tertiary)', fontFamily: 'var(--font-sans)', minWidth: 16 }}>{letter}.</span>
                <input
                  value={(q as any)[`option_${letter.toLowerCase()}`] || ''}
                  onChange={e => updateQuestion(idx, `option_${letter.toLowerCase()}`, e.target.value)}
                  placeholder={`Option ${letter}`}
                  style={{ ...A.input, flex: 1 }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button onClick={sauvegarder} disabled={saving} style={{ ...A.btnPrimary, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Enregistrement…' : editTest ? 'Mettre à jour' : 'Créer le test'}
        </button>
        <button onClick={() => setMode('liste')} style={A.btnGhost}>Annuler</button>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>
          Tests QCM de compréhension
        </h3>
        <button onClick={ouvrirCreation} style={A.btnPrimary}>+ Nouveau test</button>
      </div>

      {tests.length === 0 ? (
        <div style={A.emptyState}>
          Aucun test QCM créé. Cliquez sur « + Nouveau test » pour commencer.
        </div>
      ) : (
        <div style={A.card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={A.th}>Période</th>
              <th style={A.th}>Niveau</th>
              <th style={A.th}>Titre</th>
              <th style={A.thC}>Questions</th>
              <th style={A.thC}>Actions</th>
            </tr></thead>
            <tbody>
              {tests.map(t => (
                <tr key={t.id}>
                  <td style={A.td}>{qcmPeriodeLabel(t.periode_id)}</td>
                  <td style={A.tdBold}>{t.niveau}</td>
                  <td style={A.td}>{t.titre || '—'}</td>
                  <td style={A.tdC}>{(t.qcm_questions || []).length} / 6</td>
                  <td style={A.tdC}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button onClick={() => ouvrirEdition(t)} style={A.btnGhost}>Modifier</button>
                      <button onClick={() => supprimerTest(t.id)} style={A.btnDanger}>Supprimer</button>
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

// ── Structure Tab ─────────────────────────────────────────────────────────────

type EnseignantRow = { id: string; nom: string; prenom: string; classes: string[] }

function StructureTab({ supabase, etablissements }: { supabase: any; etablissements: Etablissement[] }) {
  const [selectedEtab, setSelectedEtab] = useState('')
  const [classes, setClasses]           = useState<{ id: string; nom: string; niveau: string }[]>([])
  const [enseignants, setEnseignants]   = useState<EnseignantRow[]>([])
  const [loadingStruct, setLoadingStruct] = useState(false)
  const [nomClasse, setNomClasse]       = useState('')
  const [niveauClasse, setNiveauClasse] = useState('CP')
  const [adding, setAdding]             = useState(false)
  const [assignModal, setAssignModal]   = useState<EnseignantRow | null>(null)
  const [classesSel, setClassesSel]     = useState<string[]>([])
  const [savingAssign, setSavingAssign] = useState(false)

  const NIVEAUX = ['CP', 'CE1', 'CE2', 'CM1', 'CM2', 'ULIS', '6ème', '5ème', '4ème', '3ème', 'Autre']

  async function chargerStructure(etabId: string) {
    if (!etabId) return
    setLoadingStruct(true)
    const [cls, profs] = await Promise.all([
      supabase.from('classes').select('id, nom, niveau').eq('etablissement_id', etabId).order('niveau'),
      supabase.from('profils').select('id, nom, prenom').eq('etablissement_id', etabId).eq('role', 'enseignant'),
    ])
    setClasses(cls.data || [])
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
    setLoadingStruct(false)
  }

  async function ajouterClasse() {
    if (!nomClasse.trim() || !selectedEtab) return
    setAdding(true)
    await supabase.from('classes').insert({ nom: nomClasse.trim(), niveau: niveauClasse, etablissement_id: selectedEtab })
    setNomClasse('')
    await chargerStructure(selectedEtab)
    setAdding(false)
  }

  async function supprimerClasse(id: string, nom: string) {
    const { count } = await supabase.from('eleves').select('*', { count: 'exact', head: true }).eq('classe_id', id)
    if (count && count > 0) { alert(`"${nom}" contient ${count} élève(s). Supprimez d'abord les élèves.`); return }
    if (!window.confirm(`Supprimer la classe "${nom}" ?`)) return
    await supabase.from('classes').delete().eq('id', id)
    await chargerStructure(selectedEtab)
  }

  async function sauvegarderAssign() {
    if (!assignModal) return
    setSavingAssign(true)
    await supabase.from('enseignant_classes').delete().eq('enseignant_id', assignModal.id)
    if (classesSel.length > 0) {
      await supabase.from('enseignant_classes').insert(classesSel.map(cid => ({ enseignant_id: assignModal.id, classe_id: cid })))
    }
    setAssignModal(null); setSavingAssign(false)
    await chargerStructure(selectedEtab)
  }

  return (
    <div>
      {/* Modal assignation */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 32, width: 440, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary-dark)', marginBottom: 4, fontFamily: 'var(--font-sans)' }}>Assigner des classes</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, fontFamily: 'var(--font-sans)' }}>{assignModal.prenom} {assignModal.nom}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {classes.map(c => {
                const sel = classesSel.includes(c.id)
                return (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderRadius: 10, cursor: 'pointer', background: sel ? 'rgba(0,24,69,0.06)' : 'var(--bg-gray)', border: `1.5px solid ${sel ? 'var(--primary-dark)' : 'var(--border-light)'}`, fontFamily: 'var(--font-sans)' }}>
                    <input type="checkbox" checked={sel} onChange={() => setClassesSel(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])} style={{ accentColor: 'var(--primary-dark)', width: 16, height: 16 }} />
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary-dark)' }}>{c.nom}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.niveau}</span>
                  </label>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setAssignModal(null)} style={A.btnGhost}>Annuler</button>
              <button onClick={sauvegarderAssign} disabled={savingAssign} style={{ ...A.btnPrimary, opacity: savingAssign ? 0.6 : 1 }}>{savingAssign ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Sélecteur d'établissement */}
      <div style={{ ...A.card, display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', marginBottom: 24, background: '#eff6ff', borderColor: '#bfdbfe' }}>
        <span style={{ fontSize: 22 }}>🏫</span>
        <div style={{ flex: 1 }}>
          <label style={{ ...A.label, color: '#1d4ed8', marginBottom: 4 }}>Établissement</label>
          <select value={selectedEtab} onChange={e => { setSelectedEtab(e.target.value); chargerStructure(e.target.value) }} style={{ ...A.select, width: '100%', fontWeight: 600 }}>
            <option value="">— Choisir un établissement —</option>
            {etablissements.map(e => (
              <option key={e.id} value={e.id}>{e.nom} ({e.type}{e.ville ? ` · ${e.ville}` : ''})</option>
            ))}
          </select>
        </div>
      </div>

      {!selectedEtab ? (
        <div style={A.emptyState}>Sélectionnez un établissement pour gérer sa structure.</div>
      ) : loadingStruct ? (
        <div style={{ padding: 32, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>Chargement…</div>
      ) : (
        <>
          {/* ── Classes ── */}
          <h3 style={A.sectionTitle}>Classes ({classes.length})</h3>
          <div style={{ ...A.card, marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
              <input value={nomClasse} onChange={e => setNomClasse(e.target.value)} placeholder="Nom de la classe" style={{ ...A.input, flex: 1 }} />
              <select value={niveauClasse} onChange={e => setNiveauClasse(e.target.value)} style={{ ...A.select, width: 120 }}>
                {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <button onClick={ajouterClasse} disabled={adding || !nomClasse.trim()} style={{ ...A.btnPrimary, opacity: (adding || !nomClasse.trim()) ? 0.5 : 1 }}>
                {adding ? '…' : '+ Ajouter'}
              </button>
            </div>
            {classes.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>Aucune classe.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={A.th}>Classe</th>
                  <th style={A.th}>Niveau</th>
                  <th style={A.thC}></th>
                </tr></thead>
                <tbody>
                  {classes.map(c => (
                    <tr key={c.id}>
                      <td style={A.tdBold}>{c.nom}</td>
                      <td style={A.td}>{c.niveau}</td>
                      <td style={A.tdC}>
                        <button onClick={() => supprimerClasse(c.id, c.nom)} style={A.btnDanger}>Supprimer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Enseignants ── */}
          <h3 style={A.sectionTitle}>Enseignants ({enseignants.length})</h3>
          <div style={A.card}>
            {enseignants.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>Aucun enseignant inscrit pour cet établissement.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={A.th}>Enseignant</th>
                  <th style={A.th}>Classes assignées</th>
                  <th style={A.thC}></th>
                </tr></thead>
                <tbody>
                  {enseignants.map(ens => (
                    <tr key={ens.id}>
                      <td style={A.tdBold}>{ens.prenom} {ens.nom}</td>
                      <td style={A.td}>
                        {ens.classes.length === 0 ? (
                          <span style={{ color: 'var(--text-tertiary)', fontSize: 12, fontStyle: 'italic' }}>Aucune</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {ens.classes.map(cid => {
                              const cl = classes.find(c => c.id === cid)
                              return cl ? (
                                <span key={cid} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#dbeafe', color: '#1d4ed8', fontFamily: 'var(--font-sans)' }}>{cl.nom}</span>
                              ) : null
                            })}
                          </div>
                        )}
                      </td>
                      <td style={A.tdC}>
                        <button onClick={() => { setAssignModal(ens); setClassesSel([...ens.classes]) }} style={A.btnGhost}>Assigner</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Normes Tab ────────────────────────────────────────────────────────────────

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
