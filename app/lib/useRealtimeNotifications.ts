'use client'

import { useEffect } from 'react'
import { createClient } from './supabase'
import { useNotifications } from './useNotifications'
import { useProfil } from './useProfil'

export function useRealtimeNotifications() {
  const { addNotification } = useNotifications()
  const { profil } = useProfil()

  useEffect(() => {
    if (!profil) return

    const supabase = createClient()
    const isDirection = ['directeur', 'principal'].includes(profil.role)
    const isEnseignant = profil.role === 'enseignant'

    // Écouter les nouvelles passations (pour direction : quand un enseignant saisit)
    if (isDirection || profil.role === 'admin') {
      const channel = supabase
        .channel('passations-realtime')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'passations',
        }, (payload) => {
          addNotification({
            type: 'info',
            title: 'Nouvelle saisie',
            message: 'Un score vient d\'être enregistré.',
            duration: 4000,
          })
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }

    // Écouter les réponses QCM (pour enseignant : quand un élève termine le QCM sur tablette)
    if (isEnseignant) {
      const channel = supabase
        .channel('qcm-realtime')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'passations',
          filter: 'mode=eq.qcm_eleve',
        }, () => {
          addNotification({
            type: 'success',
            title: 'QCM terminé',
            message: 'Un élève vient de terminer son test de compréhension.',
            duration: 5000,
          })
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }
  }, [profil?.id])
}
