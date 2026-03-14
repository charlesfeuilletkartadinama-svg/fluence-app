import { useEffect, useState } from 'react'
import { createClient } from './supabase'
import { useRouter } from 'next/navigation'
import { useImpersonation } from './useImpersonation'

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
  const [profilReel, setProfilReel] = useState<Profil | null>(null)
  const [loading, setLoading]       = useState(true)
  const router   = useRouter()
  const supabase = createClient()
  const { roleImpersonne } = useImpersonation()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }

      const { data } = await supabase
        .from('profils').select('*').eq('id', user.id).single()

      if (!data) { router.push('/dashboard/profil'); return }

      setProfilReel(data)
      setLoading(false)
    })
  }, [])

  // Si impersonation active, retourner le profil simulé
  const profil: Profil | null = profilReel && roleImpersonne
    ? {
        ...profilReel,
        role:              roleImpersonne.role,
        etablissement_id:  roleImpersonne.etablissement_id ?? profilReel.etablissement_id,
        circonscription_id: roleImpersonne.circonscription_id ?? profilReel.circonscription_id,
      }
    : profilReel

  // Le vrai rôle (pas simulé) — pour savoir si on est admin
  const roleReel = profilReel?.role || null

  return { profil, profilReel, roleReel, loading }
}