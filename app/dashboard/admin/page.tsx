'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'

type Etablissement = {
  id: string
  nom: string
  type: string
  type_reseau: string
  circonscription: { nom: string }[] | null
}

type Periode = {
  id: string
  code: string
  label: string
  actif: boolean
  etablissement_id: string
  date_debut: string | null
  date_fin: string | null
  saisie_ouverte: boolean
}

type Norme = {
  id: string
  niveau: string
  seuil_min: number
  seuil_attendu: number
  periode_id: string | null
}

type CoorDoEtab = {
  id: string
  coordo_id: string
  etablissement_id: string
  coordo: { nom: string; prenom: string } | null
  etablissement: { nom: string } | null
}

type IenEtab = {
  id: string
  ien_id: string
  etablissement_id: string
  ien: { nom: string; prenom: string } | null
  etablissement: { nom: string } | null
}

type ProfilOption = { id: string; nom: string; prenom: string; role: string }

export default function Admin() {
  const [onglet, setOnglet]               = useState(0)
  const [etablissements, setEtablissements] = useState<Etablissement[]>([])
  const [periodes, setPeriodes]           = useState<Periode[]>([])
  const [coordoEtabs, setCoordoEtabs]     = useState<CoorDoEtab[]>([])
  const [ienEtabs, setIenEtabs]           = useState<IenEtab[]>([])
  const [monReseau, setMonReseau]         = useState<Etablissement[]>([])
  const [loading, setLoading]             = useState(true)
  const [newPeriodeCode, setNewPeriodeCode] = useState('')
  const [newPeriodeLabel, setNewPeriodeLabel] = useState('')
  const { profil, loading: profilLoading } = useProfil()
  const router  = useRouter()
  const supabase = createClient()

  const isReseau = profil?.role === 'coordo_rep' || profil?.role === 'ien'
  const isAdmin  = profil && ['admin','ia_dasen','recteur'].includes(profil.role)

  const ONGLETS = isReseau
    ? ['Mon réseau', 'Périodes', 'Normes']
    : ['Établissements', 'Périodes', 'Normes', 'Utilisateurs', 'Affectations']

  useEffect(() => {
    if (!profilLoading && profil) {
      if (!['admin','ia_dasen','recteur','principal','coordo_rep','ien'].includes(profil.role)) {
        router.push('/dashboard')
        return
      }
      chargerDonnees()
    }
  }, [profil, profilLoading])

  async function chargerDonnees() {
    if (isReseau) {
      // Coordo / IEN : voir son réseau + les périodes de ses établissements
      const reseauTable = profil!.role === 'ien' ? 'ien_etablissements' : 'coordo_etablissements'
      const reseauField = profil!.role === 'ien' ? 'ien_id' : 'coordo_id'
      const { data: ceData } = await supabase
        .from(reseauTable)
        .select('etablissement_id, etablissement:etablissements(id, nom, type, type_reseau)')
        .eq(reseauField, profil!.id)
      const etabIds = (ceData || []).map((ce: any) => ce.etablissement_id)
      setMonReseau((ceData || []).map((ce: any) => ce.etablissement).filter(Boolean))

      let periQuery = supabase.from('periodes').select('id, code, label, actif, etablissement_id, date_debut, date_fin, saisie_ouverte').order('code')
      if (etabIds.length > 0) periQuery = periQuery.in('etablissement_id', etabIds)
      const { data: periData } = await periQuery
      // Dédupliquer par code (garder le plus récent)
      const seenCodes = new Set<string>()
      const periodesDedup = (periData || []).filter(p => {
        if (seenCodes.has(p.code)) return false
        seenCodes.add(p.code); return true
      })
      setPeriodes(periodesDedup)

      setLoading(false)
      return
    }

    const [etabRes, periRes, ceRes, ienRes] = await Promise.all([
      supabase.from('etablissements')
        .select('id, nom, type, type_reseau, circonscription:circonscriptions(nom)')
        .order('nom'),
      supabase.from('periodes')
        .select('id, code, label, actif, etablissement_id, date_debut, date_fin, saisie_ouverte')
        .order('code'),
      supabase.from('coordo_etablissements')
        .select('id, coordo_id, etablissement_id, coordo:profils(nom, prenom), etablissement:etablissements(nom)')
        .order('coordo_id'),
      supabase.from('ien_etablissements')
        .select('id, ien_id, etablissement_id, ien:profils(nom, prenom), etablissement:etablissements(nom)')
        .order('ien_id'),
    ])
    setEtablissements(etabRes.data || [])
    setPeriodes(periRes.data || [])
    setCoordoEtabs((ceRes.data || []) as unknown as CoorDoEtab[])
    setIenEtabs((ienRes.data || []) as unknown as IenEtab[])
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

  async function creerPeriode() {
    if (!newPeriodeCode.trim() || !newPeriodeLabel.trim()) return
    await supabase.from('periodes').insert({
      code: newPeriodeCode.trim().toUpperCase(),
      label: newPeriodeLabel.trim(),
      actif: true,
      saisie_ouverte: true,
    })
    setNewPeriodeCode('')
    setNewPeriodeLabel('')
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

  if (profilLoading || loading) {
    return (
      <>
        <Sidebar />
        <div style={{ marginLeft: 'var(--sidebar-width)', padding: 32, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Chargement...</div>
      </>
    )
  }

  const S = {
    card:    { background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', overflow: 'hidden' as const },
    th:      { padding: '12px 20px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.5, textTransform: 'uppercase' as const, background: 'var(--bg-gray)', fontFamily: 'var(--font-sans)', borderBottom: '1.5px solid var(--border-light)' },
    thC:     { padding: '12px 20px', textAlign: 'center' as const, fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.5, textTransform: 'uppercase' as const, background: 'var(--bg-gray)', fontFamily: 'var(--font-sans)', borderBottom: '1.5px solid var(--border-light)' },
    td:      { padding: '14px 20px', fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', borderBottom: '1px solid var(--border-light)' },
    tdBold:  { padding: '14px 20px', fontSize: 14, fontWeight: 700, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', borderBottom: '1px solid var(--border-light)' },
    tdC:     { padding: '14px 20px', fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', textAlign: 'center' as const, borderBottom: '1px solid var(--border-light)' },
    btnPrimary: { background: 'var(--primary-dark)', color: 'white', border: 'none', padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' },
    btnDanger:  { background: 'transparent', color: '#dc2626', border: '1.5px solid #fca5a5', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' },
    input:   { border: '1.5px solid var(--border-main)', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' },
    badge:   (color: string) => ({ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: color === 'REP+' ? '#f3e8ff' : color === 'REP' ? '#dbeafe' : 'var(--bg-gray)', color: color === 'REP+' ? '#7e22ce' : color === 'REP' ? '#1d4ed8' : 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }),
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
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '2px solid var(--border-light)' }}>
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

        {/* ── Onglet Mon réseau (IEN / Coordo) ── */}
        {isReseau && onglet === 0 && (
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
              {monReseau.length} établissement{monReseau.length > 1 ? 's' : ''} dans votre réseau
            </p>
            {monReseau.length === 0 ? (
              <div style={{ ...S.card, padding: 40, textAlign: 'center' }}>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                  Aucun établissement affecté. Contactez l'administrateur pour configurer votre réseau.
                </p>
              </div>
            ) : (
              <div style={S.card}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={S.th}>Établissement</th>
                      <th style={S.th}>Type</th>
                      <th style={S.th}>Réseau</th>
                    </tr>
                  </thead>
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

        {/* ── Onglet Établissements (admin) ── */}
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
                <thead>
                  <tr>
                    <th style={S.th}>Nom</th>
                    <th style={S.th}>Type</th>
                    <th style={S.th}>Réseau</th>
                    <th style={S.th}>Circonscription</th>
                  </tr>
                </thead>
                <tbody>
                  {etablissements.map(e => (
                    <tr key={e.id}>
                      <td style={S.tdBold}>{e.nom}</td>
                      <td style={S.td}>{e.type}</td>
                      <td style={S.td}><span style={S.badge(e.type_reseau)}>{e.type_reseau || '—'}</span></td>
                      <td style={S.td}>{(e.circonscription as any)?.[0]?.nom || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Onglet Périodes ── */}
        {onglet === 1 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', margin: 0 }}>Périodes de passation</p>
              {!isReseau && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" placeholder="Code (T1…)" value={newPeriodeCode}
                    onChange={e => setNewPeriodeCode(e.target.value)}
                    style={{ ...S.input, width: 80 }} />
                  <input type="text" placeholder="Libellé" value={newPeriodeLabel}
                    onChange={e => setNewPeriodeLabel(e.target.value)}
                    style={{ ...S.input, width: 180 }} />
                  <button onClick={creerPeriode} disabled={!newPeriodeCode || !newPeriodeLabel}
                    style={{ ...S.btnPrimary, opacity: (!newPeriodeCode || !newPeriodeLabel) ? 0.4 : 1 }}>
                    + Créer
                  </button>
                </div>
              )}
            </div>
            <div style={S.card}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={S.th}>Code</th>
                    <th style={S.th}>Libellé</th>
                    <th style={S.th}>Début</th>
                    <th style={S.th}>Fin</th>
                    <th style={S.thC}>Saisie</th>
                    <th style={S.thC}>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {periodes.map(p => (
                    <PeriodeRow key={p.id} periode={p}
                      onToggleActif={() => togglePeriode(p.id, p.actif)}
                      onToggleSaisie={() => toggleSaisie(p.id, p.saisie_ouverte)}
                      onUpdateDates={(d, f) => updateDates(p.id, d, f)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Onglet Normes ── */}
        {onglet === 2 && (
          <NormesTab supabase={supabase} periodes={periodes} profil={profil} />
        )}

        {/* ── Onglet Utilisateurs ── */}
        {!isReseau && onglet === 3 && (
          <UtilisateursTab supabase={supabase} />
        )}

        {/* ── Onglet Affectations (admin) ── */}
        {!isReseau && onglet === 4 && (
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* ── Section IEN ── */}
      <div>
        <h3 className="font-bold text-blue-900 mb-4">Affectations IEN → Établissements</h3>

        {/* Formulaire ajout IEN */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-4 flex gap-3 items-end flex-wrap">
          <div style={{ flex: 1, minWidth: 180 }}>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">IEN</label>
            <select value={newIenId} onChange={e => setNewIenId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              <option value="">Choisir un IEN…</option>
              {iens.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Établissement</label>
            <select value={newIenEtab} onChange={e => setNewIenEtab(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              <option value="">Choisir un établissement…</option>
              {etablissements.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
          </div>
          <button onClick={ajouterIen} disabled={!newIenId || !newIenEtab || saving}
            className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800 transition disabled:opacity-40">
            + Rattacher
          </button>
        </div>

        {ienEtabs.length === 0 ? (
          <p className="text-sm text-slate-400 bg-white rounded-xl p-6 text-center border border-slate-100">
            Aucune affectation IEN pour l'instant.
          </p>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">IEN</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Établissement</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ienEtabs.map(ie => (
                  <tr key={ie.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-semibold text-blue-900">{ie.ien?.prenom} {ie.ien?.nom}</td>
                    <td className="px-6 py-4 text-slate-600">{ie.etablissement?.nom || '—'}</td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => onSupprimerIen(ie.id)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition">
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section Coordo ── */}
      <div>
        <h3 className="font-bold text-blue-900 mb-4">Affectations Coordo REP/REP+ → Établissements</h3>

        {/* Formulaire ajout Coordo */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-4 flex gap-3 items-end flex-wrap">
          <div style={{ flex: 1, minWidth: 180 }}>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Coordonnateur</label>
            <select value={newCoordoId} onChange={e => setNewCoordoId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              <option value="">Choisir un coordo…</option>
              {coordos.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Établissement</label>
            <select value={newCoordoEtab} onChange={e => setNewCoordoEtab(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              <option value="">Choisir un établissement…</option>
              {etablissements.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
          </div>
          <button onClick={ajouterCoordo} disabled={!newCoordoId || !newCoordoEtab || saving}
            className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800 transition disabled:opacity-40">
            + Rattacher
          </button>
        </div>

        {coordoEtabs.length === 0 ? (
          <p className="text-sm text-slate-400 bg-white rounded-xl p-6 text-center border border-slate-100">
            Aucune affectation coordo pour l'instant.
          </p>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Coordonnateur</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Établissement</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {coordoEtabs.map(ce => (
                  <tr key={ce.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-semibold text-blue-900">{ce.coordo?.prenom} {ce.coordo?.nom}</td>
                    <td className="px-6 py-4 text-slate-600">{ce.etablissement?.nom || '—'}</td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => onSupprimerCoordo(ce.id)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition">
                        Retirer
                      </button>
                    </td>
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

function PeriodeRow({ periode, onToggleActif, onToggleSaisie, onUpdateDates }: {
  periode: Periode
  onToggleActif: () => void
  onToggleSaisie: () => void
  onUpdateDates: (debut: string | null, fin: string | null) => void
}) {
  const [debut, setDebut] = useState(periode.date_debut || '')
  const [fin,   setFin]   = useState(periode.date_fin   || '')

  return (
    <tr className="hover:bg-slate-50 transition">
      <td className="px-5 py-3 font-bold text-blue-900 text-lg">{periode.code}</td>
      <td className="px-5 py-3 text-slate-600">{periode.label}</td>
      <td className="px-5 py-3">
        <input type="date" value={debut}
          onChange={e => setDebut(e.target.value)}
          onBlur={() => onUpdateDates(debut || null, fin || null)}
          className="border border-slate-200 rounded-lg px-2 py-1 text-sm w-36" />
      </td>
      <td className="px-5 py-3">
        <input type="date" value={fin}
          onChange={e => setFin(e.target.value)}
          onBlur={() => onUpdateDates(debut || null, fin || null)}
          className="border border-slate-200 rounded-lg px-2 py-1 text-sm w-36" />
      </td>
      <td className="px-5 py-3 text-center">
        <button onClick={onToggleSaisie}
          className={`text-xs font-bold px-3 py-1 rounded-full transition
            ${periode.saisie_ouverte
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
          {periode.saisie_ouverte ? 'Ouverte' : 'Fermée'}
        </button>
      </td>
      <td className="px-5 py-3 text-center">
        <button onClick={onToggleActif}
          className={`text-xs font-bold px-3 py-1 rounded-full transition
            ${periode.actif
              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
          {periode.actif ? 'Active' : 'Inactive'}
        </button>
      </td>
    </tr>
  )
}

type UserRow = { id: string; nom: string; prenom: string; role: string; etablissement: { nom: string } | null }

function UtilisateursTab({ supabase }: { supabase: any }) {
  const [users, setUsers]         = useState<UserRow[]>([])
  const [search, setSearch]       = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  useEffect(() => {
    supabase.from('profils')
      .select('id, nom, prenom, role, etablissement:etablissements(nom)')
      .order('nom')
      .then(({ data }: any) => setUsers(data || []))
  }, [])

  const ROLE_LABELS: Record<string, string> = {
    enseignant: 'Enseignant',
    directeur:  'Directeur',
    principal:  'Principal',
    coordo_rep: 'Coordo REP+',
    ien:        'IEN',
    ia_dasen:   'IA-DASEN',
    recteur:    'Recteur',
    admin:      'Admin',
  }

  const roleCounts: Record<string, number> = {}
  users.forEach(u => { roleCounts[u.role] = (roleCounts[u.role] || 0) + 1 })

  const filtered = users.filter(u => {
    const matchSearch = !search || `${u.prenom} ${u.nom}`.toLowerCase().includes(search.toLowerCase())
    const matchRole   = !roleFilter || u.role === roleFilter
    return matchSearch && matchRole
  })

  return (
    <div>
      {/* Chips par rôle */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(roleCounts).sort().map(([role, count]) => (
          <button key={role}
            onClick={() => setRoleFilter(roleFilter === role ? '' : role)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full border transition
              ${roleFilter === role
                ? 'bg-blue-900 text-white border-blue-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'}`}>
            {ROLE_LABELS[role] || role} · {count}
          </button>
        ))}
      </div>

      {/* Barre de recherche */}
      <div className="relative mb-4">
        <input type="text" placeholder="Rechercher un utilisateur…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pl-10 text-sm outline-none focus:border-blue-600 bg-white" />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base pointer-events-none">🔍</span>
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">✕</button>
        )}
      </div>

      <h3 className="font-bold text-blue-900 mb-3">
        {filtered.length} utilisateur{filtered.length > 1 ? 's' : ''}
        {(search || roleFilter) ? ` (filtrés sur ${users.length})` : ''}
      </h3>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Nom</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Rôle</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Établissement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-slate-400 text-sm">Aucun utilisateur trouvé</td>
              </tr>
            ) : filtered.map(u => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-semibold text-blue-900">{u.prenom} {u.nom}</td>
                <td className="px-6 py-4">
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500">{u.etablissement?.nom || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── NormeRow : édition inline ──────────────────────────────────────────────

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
    <tr className="hover:bg-slate-50">
      <td className="px-6 py-3 font-bold text-blue-900">{norme.niveau}</td>
      <td className="px-6 py-3 text-center">
        <input type="number" value={min}
          onChange={e => setMin(e.target.value)}
          onBlur={handleBlur}
          className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:border-blue-500" />
        <span className="text-xs text-slate-400 ml-1">m/min</span>
      </td>
      <td className="px-6 py-3 text-center">
        <input type="number" value={attendu}
          onChange={e => setAttendu(e.target.value)}
          onBlur={handleBlur}
          className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:border-blue-500" />
        <span className="text-xs text-slate-400 ml-1">m/min</span>
      </td>
    </tr>
  )
}

// ── NormesTab : onglet normes avec sélecteur de période ───────────────────

function NormesTab({ supabase, periodes, profil }: { supabase: any; periodes: Periode[]; profil: any }) {
  const [normes,    setNormes]    = useState<Norme[]>([])
  const [periodeId, setPeriodeId] = useState('')
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (periodes.length > 0 && !periodeId) setPeriodeId(periodes[0].id)
  }, [periodes])

  useEffect(() => {
    chargerNormes()
  }, [periodeId])

  async function chargerNormes() {
    let query = supabase.from('config_normes')
      .select('id, niveau, seuil_min, seuil_attendu, periode_id')
      .order('niveau')
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
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <span className="text-sm font-semibold text-slate-500">Période :</span>
        {periodes.map(p => (
          <button key={p.id}
            onClick={() => setPeriodeId(p.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition border
              ${periodeId === p.id
                ? 'bg-blue-900 text-white border-blue-900'
                : 'border-slate-200 text-slate-600 hover:border-blue-400'}`}>
            {p.code}
          </button>
        ))}
        <button onClick={chargerDefaut} disabled={saving}
          className="ml-auto bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800 transition disabled:opacity-50">
          {saving ? 'Enregistrement...' : 'Charger normes par défaut'}
        </button>
      </div>

      {normes.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
          <p className="text-slate-400 text-sm">
            {periodeId ? 'Aucune norme configurée pour cette période.' : 'Sélectionnez une période ci-dessus.'}
            {' '}Cliquez sur "Charger normes par défaut" pour initialiser.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Niveau</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Seuil minimum</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Score attendu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {normes.map(n => (
                <NormeRow key={n.id} norme={n} onSave={sauvegarderNorme} />
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-400 px-6 py-3 bg-slate-50 border-t border-slate-100">
            Cliquez sur une valeur pour la modifier · Tab ou clic ailleurs pour enregistrer
          </p>
        </div>
      )}
    </div>
  )
}