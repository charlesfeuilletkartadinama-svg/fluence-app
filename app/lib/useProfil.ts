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
    // getSession() lit depuis le cache local — pas de Web Lock, pas de réseau
    // évite les conflits AbortError quand plusieurs composants montent en même temps
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/'); return }

      const { data, error } = await supabase
        .from('profils').select('id, nom, prenom, role, etablissement_id, circonscription_id, academie_id').eq('id', session.user.id).single()

      if (error || !data) { router.push('/dashboard/profil'); return }

      setProfilReel(data)
      setLoading(false)
    }).catch(() => {
      router.push('/')
    })

    // onAuthStateChange gère les déconnexions et refreshs de token
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.push('/')
    })
    return () => subscription.unsubscribe()
  }, [])

  // Si impersonation active ET que le vrai rôle le permet, retourner le profil simulé
  const canImpersonate = ['admin', 'ia_dasen', 'recteur'].includes(profilReel?.role || '')
  const profil: Profil | null = profilReel && roleImpersonne && canImpersonate
    ? {
        ...profilReel,
        id:                roleImpersonne.id ?? profilReel.id,
        role:              roleImpersonne.role,
        etablissement_id:  roleImpersonne.etablissement_id ?? profilReel.etablissement_id,
        circonscription_id: roleImpersonne.circonscription_id ?? profilReel.circonscription_id,
      }
    : profilReel

  // Le vrai rôle (pas simulé) — pour savoir si on est admin
  const roleReel = profilReel?.role || null

  return { profil, profilReel, roleReel, loading }
}