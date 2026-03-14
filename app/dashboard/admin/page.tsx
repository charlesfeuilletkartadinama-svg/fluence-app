'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'

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
}

type Norme = {
  id: string
  niveau: string
  seuil_min: number
  seuil_attendu: number
}

const ONGLETS = ['Établissements', 'Périodes', 'Normes', 'Utilisateurs']

export default function Admin() {
  const [onglet, setOnglet]             = useState(0)
  const [etablissements, setEtablissements] = useState<Etablissement[]>([])
  const [periodes, setPeriodes]         = useState<Periode[]>([])
  const [normes, setNormes]             = useState<Norme[]>([])
  const [loading, setLoading]           = useState(true)
  const { profil, loading: profilLoading } = useProfil()
  const router  = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!profilLoading && profil) {
      if (!['admin','ia_dasen','recteur','principal'].includes(profil.role)) {
        router.push('/dashboard')
        return
      }
      chargerDonnees()
    }
  }, [profil, profilLoading])

  async function chargerDonnees() {
    const [etabRes, periRes, normRes] = await Promise.all([
      supabase.from('etablissements')
        .select('id, nom, type, type_reseau, circonscription:circonscriptions(nom)')
        .order('nom'),
      supabase.from('periodes')
        .select('id, code, label, actif, etablissement_id')
        .order('code'),
      supabase.from('config_normes')
        .select('id, niveau, seuil_min, seuil_attendu')
        .order('niveau'),
    ])
    setEtablissements(etabRes.data || [])
    setPeriodes(periRes.data || [])
    setNormes(normRes.data || [])
    setLoading(false)
  }

  async function togglePeriode(id: string, actif: boolean) {
    await supabase.from('periodes').update({ actif: !actif }).eq('id', id)
    setPeriodes(prev => prev.map(p => p.id === id ? { ...p, actif: !actif } : p))
  }

  if (profilLoading || loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Chargement...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-blue-900 text-white p-6">
        <div className="mb-8">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mb-3">
            <span className="text-blue-900 font-bold text-lg">F</span>
          </div>
          <h1 className="font-bold text-lg">Test de Fluence</h1>
          <p className="text-blue-300 text-xs mt-1">Académie de Guyane</p>
        </div>
        <nav className="space-y-1">
          <a href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 text-sm font-medium transition">
            📊 Tableau de bord
          </a>
          <a href="/dashboard/eleves" className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 text-sm font-medium transition">
            👥 Élèves
          </a>
          <a href="/dashboard/statistiques" className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 text-sm font-medium transition">
            📈 Statistiques
          </a>
          <a href="/dashboard/admin" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-800 text-white text-sm font-medium">
            ⚙️ Administration
          </a>
        </nav>
        {profil && (
          <div className="absolute bottom-6 left-6 right-6">
            <a href="/dashboard/profil" className="block bg-blue-800 rounded-xl p-3 hover:bg-blue-700 transition">
              <p className="text-xs text-blue-300 mb-1">{profil.role}</p>
              <p className="text-sm font-bold text-white">{profil.prenom} {profil.nom}</p>
            </a>
          </div>
        )}
      </div>

      {/* Main */}
      <div className="ml-64 p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-blue-900">Administration</h2>
          <p className="text-slate-500 mt-1">Gestion de l'application</p>
        </div>

        {/* Onglets */}
        <div className="flex gap-2 mb-6 border-b border-slate-200">
          {ONGLETS.map((o, i) => (
            <button key={o} onClick={() => setOnglet(i)}
              className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-px
                ${onglet === i
                  ? 'border-blue-900 text-blue-900'
                  : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              {o}
            </button>
          ))}
        </div>

        {/* ── Onglet Établissements ── */}
        {onglet === 0 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-blue-900">
                {etablissements.length} établissement{etablissements.length > 1 ? 's' : ''}
              </h3>
              <button
                onClick={() => router.push('/dashboard/admin/etablissement')}
                className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800 transition">
                + Ajouter
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Nom</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Réseau</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Circonscription</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {etablissements.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-semibold text-blue-900">{e.nom}</td>
                      <td className="px-6 py-4 text-slate-500 capitalize">{e.type}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full
                          ${e.type_reseau === 'REP+' ? 'bg-purple-100 text-purple-700' :
                            e.type_reseau === 'REP' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-500'}`}>
                          {e.type_reseau}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {(e.circonscription as any)?.[0]?.nom || '—'}
                      </td>
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
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-blue-900">
                Périodes de passation
              </h3>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Libellé</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Statut</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {periodes.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-bold text-blue-900 text-lg">{p.code}</td>
                      <td className="px-6 py-4 text-slate-600">{p.label}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full
                          ${p.actif ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                          {p.actif ? '✅ Active' : '⏸ Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => togglePeriode(p.id, p.actif)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition
                            ${p.actif
                              ? 'border-red-200 text-red-600 hover:bg-red-50'
                              : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                          {p.actif ? 'Désactiver' : 'Activer'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Onglet Normes ── */}
        {onglet === 2 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-blue-900">Normes de fluence</h3>
              <button
                onClick={async () => {
                  // Insérer les normes par défaut si vides
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
                  const etabId = profil?.etablissement_id
                  if (!etabId) { alert('Configurez votre établissement dans votre profil.'); return }
                  for (const n of normesDef) {
                    await supabase.from('config_normes').upsert(
                      { ...n, etablissement_id: etabId },
                      { onConflict: 'niveau,etablissement_id' }
                    )
                  }
                  const { data } = await supabase.from('config_normes').select('*').order('niveau')
                  setNormes(data || [])
                }}
                className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800 transition">
                Charger normes par défaut
              </button>
            </div>

            {normes.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
                <p className="text-slate-400 text-sm">Aucune norme configurée. Cliquez sur "Charger normes par défaut".</p>
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
                      <tr key={n.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-bold text-blue-900">{n.niveau}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-red-50 text-red-700 font-bold px-3 py-1 rounded-full text-sm">
                            {n.seuil_min} m/min
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-green-50 text-green-700 font-bold px-3 py-1 rounded-full text-sm">
                            {n.seuil_attendu} m/min
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Onglet Utilisateurs ── */}
        {onglet === 3 && (
          <UtilisateursTab supabase={supabase} />
        )}
      </div>
    </div>
  )
}

function UtilisateursTab({ supabase }: { supabase: any }) {
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    supabase.from('profils')
      .select('id, nom, prenom, role, etablissement:etablissements(nom)')
      .order('nom')
      .then(({ data }: any) => setUsers(data || []))
  }, [])

  const ROLE_LABELS: Record<string, string> = {
    enseignant: '👨‍🏫 Enseignant',
    directeur:  '🏫 Directeur',
    principal:  '🏛️ Principal',
    coordo_rep: '🎯 Coordo REP+',
    ien:        '📋 IEN',
    ia_dasen:   '🏢 IA-DASEN',
    recteur:    '⭐ Recteur',
    admin:      '🔧 Admin',
  }

  return (
    <div>
      <h3 className="font-bold text-blue-900 mb-4">{users.length} utilisateur{users.length > 1 ? 's' : ''}</h3>
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
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-semibold text-blue-900">
                  {u.prenom} {u.nom}
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {ROLE_LABELS[u.role] || u.role}
                </td>
                <td className="px-6 py-4 text-slate-500">
                  {u.etablissement?.nom || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}