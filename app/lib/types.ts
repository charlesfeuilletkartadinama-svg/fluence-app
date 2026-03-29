// ── Types partagés Fluence+ ─────────────────────────────────────────────────
// Source unique de vérité pour les types DB utilisés dans plusieurs pages.
// Les types spécifiques à une seule page restent locaux dans cette page.

// ── Géographie / organisation ───────────────────────────────────────────────

export type Departement     = { id: string; nom: string }
export type Circonscription = { id: string; nom: string; departement_id: string }
export type Ville           = { id: string; nom: string; circonscription_id: string }

export type Etablissement = {
  id: string
  nom: string
  type: string
  type_reseau: string
  ville: string | null
  departement: string | null
  circonscription: string | null
}

// ── Entités pédagogiques ────────────────────────────────────────────────────

/** Forme minimale utilisée dans saisie, passation, groupes, statistiques */
export type Classe = {
  id: string
  nom: string
  niveau: string
  etablissement_id?: string
}

/** Forme minimale utilisée dans saisie, passation, groupes, mes-eleves */
export type Periode = {
  id: string
  code: string
  label: string
  date_fin?: string | null
  type?: string | null
  actif?: boolean
  etablissement_id?: string
  date_debut?: string | null
  saisie_ouverte?: boolean
}

/** Seuils de fluence par niveau — utilisé dans admin, statistiques, groupes, eleve/[id] */
export type Norme = {
  id?: string
  niveau: string
  seuil_min: number
  seuil_attendu: number
  periode_id?: string | null
}

// ── Utilisateurs / accès ────────────────────────────────────────────────────

export type ProfilOption = { id: string; nom: string; prenom: string; role: string }

export type UserRow = {
  id: string
  nom: string
  prenom: string
  role: string
  etablissement_id: string | null
}

export type Invitation = {
  id: string
  code: string
  role: string
  etablissement_id: string | null
  actif: boolean
}

// ── Relations multi-établissements ──────────────────────────────────────────

export type CoorDoEtab = {
  id: string
  coordo_id: string
  etablissement_id: string
  coordo: { nom: string; prenom: string } | null
  etablissement: { nom: string } | null
}

export type IenEtab = {
  id: string
  ien_id: string
  etablissement_id: string
  ien: { nom: string; prenom: string } | null
  etablissement: { nom: string } | null
}

// ── Constantes partagées ────────────────────────────────────────────────────

export const ROLE_LABELS: Record<string, string> = {
  enseignant:  'Enseignant',
  directeur:   'Directeur',
  principal:   'Principal',
  coordo_rep:  'Coordo REP+',
  ien:         'IEN',
  ia_dasen:    'IA-DASEN',
  recteur:     'Recteur',
  admin:       'Admin',
}

export const GROUPES_CONFIG = [
  { id: 1 as const, label: 'Très fragile',     color: '#DC2626', bg: 'rgba(220,38,38,0.08)'  },
  { id: 2 as const, label: 'Fragile',           color: '#D97706', bg: 'rgba(217,119,6,0.08)'  },
  { id: 3 as const, label: "En cours d'acq.",  color: '#2563EB', bg: 'rgba(37,99,235,0.08)'  },
  { id: 4 as const, label: 'Attendu',           color: '#16A34A', bg: 'rgba(22,163,74,0.08)'  },
]
