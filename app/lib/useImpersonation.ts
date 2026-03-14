import { create } from 'zustand'

type RoleImpersonne = {
  role: string
  label: string
  etablissement_id?: string | null
  circonscription_id?: string | null
} | null

type ImpersonationStore = {
  roleImpersonne: RoleImpersonne
  setRoleImpersonne: (r: RoleImpersonne) => void
  clearImpersonation: () => void
}

export const useImpersonation = create<ImpersonationStore>(set => ({
  roleImpersonne: null,
  setRoleImpersonne: (r) => set({ roleImpersonne: r }),
  clearImpersonation: () => set({ roleImpersonne: null }),
}))