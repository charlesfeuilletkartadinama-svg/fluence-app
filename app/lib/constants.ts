export const ROLE = {
  ENSEIGNANT:  'enseignant',
  DIRECTEUR:   'directeur',
  PRINCIPAL:   'principal',
  COORDO_REP:  'coordo_rep',
  IEN:         'ien',
  IA_DASEN:    'ia_dasen',
  RECTEUR:     'recteur',
  ADMIN:       'admin',
} as const

export type RoleValue = typeof ROLE[keyof typeof ROLE]

export const ROLES_DIRECTION    = [ROLE.DIRECTEUR, ROLE.PRINCIPAL] as const
export const ROLES_RESEAU       = [ROLE.COORDO_REP, ROLE.IEN] as const
export const ROLES_GLOBAL       = [ROLE.IA_DASEN, ROLE.RECTEUR] as const
export const ROLES_SUPRAETAB    = [...ROLES_RESEAU, ...ROLES_GLOBAL] as const
export const ROLES_ADMIN_ACCESS = [ROLE.ADMIN, ROLE.IA_DASEN, ROLE.RECTEUR, ROLE.COORDO_REP, ROLE.IEN] as const
export const ROLES_AVEC_IMPORT  = [ROLE.DIRECTEUR, ROLE.PRINCIPAL, ROLE.COORDO_REP, ROLE.IEN] as const
export const ROLES_AVEC_RECHERCHE = [ROLE.DIRECTEUR, ROLE.PRINCIPAL, ROLE.IA_DASEN, ROLE.RECTEUR] as const

export const ROLE_LABELS: Record<string, string> = {
  enseignant: 'Enseignant',
  directeur:  'Directeur',
  principal:  'Principal',
  coordo_rep: 'Coordo REP+',
  ien:        'IEN',
  ia_dasen:   'IA-DASEN',
  recteur:    'Recteur',
  admin:      'Administrateur',
}
