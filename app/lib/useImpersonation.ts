import { create } from 'zustand'
import { logAction } from './auditLog'

type RoleImpersonne = {
  role: string
  label: string
  id?: string | null
  etablissement_id?: string | null
  circonscription_id?: string | null
} | null

type StoredImpersonation = {
  role: string
  label: string
  id?: string | null
  etablissement_id?: string | null
  circonscription_id?: string | null
  expiresAt: number
}

type ImpersonationStore = {
  roleImpersonne: RoleImpersonne
  setRoleImpersonne: (r: RoleImpersonne) => void
  clearImpersonation: () => void
  hydrate: () => void
}

const STORAGE_KEY = 'fluence-impersonation'
const EXPIRY_MS   = 30 * 60 * 1000  // 30 minutes

export const useImpersonation = create<ImpersonationStore>((set) => ({
  roleImpersonne: null,

  setRoleImpersonne: (r) => {
    set({ roleImpersonne: r })
    if (typeof window !== 'undefined') {
      if (r) {
        const toStore: StoredImpersonation = { ...r, expiresAt: Date.now() + EXPIRY_MS }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
        logAction('impersonation_start', { role: r.role, label: r.label, etablissement_id: r.etablissement_id })
      } else {
        localStorage.removeItem(STORAGE_KEY)
        logAction('impersonation_stop', {})
      }
    }
  },

  clearImpersonation: () => {
    set({ roleImpersonne: null })
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  },

  hydrate: () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          const parsed: StoredImpersonation = JSON.parse(stored)
          // Vérifier l'expiration
          if (!parsed.expiresAt || Date.now() > parsed.expiresAt) {
            localStorage.removeItem(STORAGE_KEY)
            return
          }
          const { expiresAt, ...role } = parsed
          set({ roleImpersonne: role })
        } catch {
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    }
  },
}))
