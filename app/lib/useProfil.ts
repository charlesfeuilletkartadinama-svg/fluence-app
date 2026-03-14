import { useEffect, useState } from 'react'
import { createClient } from './supabase'
import { useRouter } from 'next/navigation'

export type Profil = {
  id: string
  nom: string
  prenom: string
  role: string
  etablissement_id: string | null
  circonscription_id: string | null
  academie_id: string | null
}

export function useProfil() {
  const [profil, setProfil]   = useState<Profil | null>(null)
  const [loading, setLoading] = useState(true)
  const router  = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }

      const { data } = await supabase
        .from('profils')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!data) {
        // Pas de profil configuré → rediriger
        router.push('/dashboard/profil')
        return
      }

      setProfil(data)
      setLoading(false)
    })
  }, [])

  // Périmètre de visibilité selon le rôle
  function getPerimintre() {
    if (!profil) return null
    switch (profil.role) {
      case 'enseignant':
      case 'directeur':
      case 'principal':
        return { type: 'etablissement', id: profil.etablissement_id }
      case 'coordo_rep':
        return { type: 'reseau', id: null } // à implémenter Phase 3
      case 'ien':
        return { type: 'circonscription', id: profil.circonscription_id }
      case 'ia_dasen':
      case 'recteur':
      case 'admin':
        return { type: 'academie', id: null } // accès total
      default:
        return null
    }
  }

  return { profil, loading, getPerimintre }
}