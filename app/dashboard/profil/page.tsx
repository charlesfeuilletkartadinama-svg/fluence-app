'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useRouter } from 'next/navigation'

type Etablissement = {
  id: string
  nom: string
  type: string
  type_reseau: string
}

const ROLES = [
  { code: 'enseignant',  label: 'Enseignant',           icon: '👨‍🏫', desc: 'Accès à mes classes et mes élèves' },
  { code: 'directeur',   label: 'Directeur d\'école',   icon: '🏫', desc: 'Accès à tout mon établissement' },
  { code: 'principal',   label: 'Principal / Principal Adjoint', icon: '🏛️', desc: 'Accès à tout mon établissement' },
  { code: 'coordo_rep',  label: 'Coordonnateur REP+',   icon: '🎯', desc: 'Accès à tous les établissements du réseau' },
  { code: 'ien',         label: 'IEN',                  icon: '📋', desc: 'Accès à toute la circonscription' },
  { code: 'ia_dasen',    label: 'IA-DASEN',             icon: '🏢', desc: 'Accès à toute l\'académie' },
  { code: 'recteur',     label: 'Recteur',              icon: '⭐', desc: 'Accès complet académie' },
]

export default function Profil() {
  const [nom, setNom]               = useState('')
  const [prenom, setPrenom]         = useState('')
  const [role, setRole]             = useState('')
  const [etablissements, setEtablissements] = useState<Etablissement[]>([])
  const [etablissementId, setEtablissementId] = useState('')
  const [saving, setSaving]         = useState(false)
  const [erreur, setErreur]         = useState('')
  const [profilExistant, setProfilExistant] = useState(false)
  const router  = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }

      // Charger le profil existant
      const { data: profil } = await supabase
        .from('profils')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profil) {
        setNom(profil.nom || '')
        setPrenom(profil.prenom || '')
        setRole(profil.role || '')
        setEtablissementId(profil.etablissement_id || '')
        setProfilExistant(true)
      }

      // Charger les établissements
      const { data: etabs } = await supabase
        .from('etablissements')
        .select('id, nom, type, type_reseau')
        .order('nom')
      setEtablissements(etabs || [])
    })
  }, [])

  async function sauvegarder() {
    if (!nom || !prenom || !role) {
      setErreur('Veuillez remplir tous les champs obligatoires.')
      return
    }
    setSaving(true)
    setErreur('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload: any = {
      id:      user.id,
      nom:     nom.toUpperCase(),
      prenom:  prenom,
      role:    role,
    }

    // Attacher l'établissement selon le rôle
    if (['enseignant','directeur','principal'].includes(role) && etablissementId) {
      payload.etablissement_id = etablissementId
    }

    const { error } = await supabase
      .from('profils')
      .upsert(payload, { onConflict: 'id' })

    if (error) {
      setErreur('Erreur lors de la sauvegarde : ' + error.message)
      setSaving(false)
      return
    }

    router.push('/dashboard')
  }

  const roleNecessiteEtab = ['enseignant','directeur','principal'].includes(role)

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-900 rounded-xl mx-auto mb-4 flex items-center justify-center">
            <span className="text-white text-2xl">👤</span>
          </div>
          <h1 className="text-2xl font-bold text-blue-900">
            {profilExistant ? 'Mon profil' : 'Configurer mon profil'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {profilExistant ? 'Modifier mes informations' : 'Bienvenue ! Configurez votre profil pour commencer.'}
          </p>
        </div>

        {erreur && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">
            {erreur}
          </div>
        )}

        {/* Nom / Prénom */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Prénom *</label>
            <input type="text" value={prenom} onChange={e => setPrenom(e.target.value)}
              placeholder="Charles"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-600 transition"/>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nom *</label>
            <input type="text" value={nom} onChange={e => setNom(e.target.value)}
              placeholder="FEUILLET"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-600 transition"/>
          </div>
        </div>

        {/* Rôle */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-3">Mon rôle *</label>
          <div className="grid grid-cols-2 gap-3">
            {ROLES.map(r => (
              <button key={r.code}
                onClick={() => setRole(r.code)}
                className={`text-left p-4 rounded-xl border-2 transition
                  ${role === r.code
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-slate-200 hover:border-blue-300'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{r.icon}</span>
                  <span className={`font-semibold text-sm ${role === r.code ? 'text-blue-900' : 'text-slate-700'}`}>
                    {r.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{r.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Établissement (si rôle concerné) */}
        {roleNecessiteEtab && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Mon établissement *</label>
            <select
              value={etablissementId}
              onChange={e => setEtablissementId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-600 transition bg-white">
              <option value="">Choisir un établissement...</option>
              {etablissements.map(e => (
                <option key={e.id} value={e.id}>
                  {e.nom} ({e.type} · {e.type_reseau})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Boutons */}
        <div className="flex gap-4">
          {profilExistant && (
            <button onClick={() => router.push('/dashboard')}
              className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl font-semibold text-sm hover:bg-slate-50 transition">
              Annuler
            </button>
          )}
          <button onClick={sauvegarder} disabled={saving}
            className="flex-1 bg-blue-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-800 transition disabled:opacity-50">
            {saving ? 'Enregistrement...' : profilExistant ? '💾 Sauvegarder' : 'Commencer →'}
          </button>
        </div>
      </div>
    </div>
  )
}