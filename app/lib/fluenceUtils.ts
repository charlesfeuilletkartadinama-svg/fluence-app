import type { Norme } from '@/app/lib/types'

// ── Classification des élèves ──────────────────────────────────────────────
// Groupe 1 : < 70% du seuil_min      → Très fragile
// Groupe 2 : < seuil_min             → Fragile
// Groupe 3 : < seuil_attendu         → En cours d'acquisition
// Groupe 4 : >= seuil_attendu        → Attendu

export function classerEleve(score: number, norme: Pick<Norme, 'seuil_min' | 'seuil_attendu'>): 1 | 2 | 3 | 4 {
  const seuilTresFrag = Math.round(norme.seuil_min * 0.70)
  if (score < seuilTresFrag)       return 1
  if (score < norme.seuil_min)     return 2
  if (score < norme.seuil_attendu) return 3
  return 4
}

// ── Verrouillage de période ────────────────────────────────────────────────
// Une période est verrouillée si sa date_fin est passée (comparaison ISO)

export function periodeVerrouillee(dateFin: string | null | undefined): boolean {
  if (!dateFin) return false
  return dateFin < new Date().toISOString().split('T')[0]
}

// ── Calcul du score de fluence ─────────────────────────────────────────────
// score = (dernierMot - nbErreurs) / tempsEcoule * 60
// tempsEcoule en secondes, résultat arrondi à l'entier

export function calculerScore(dernierMot: number, nbErreurs: number, tempsEcouleSec: number): number {
  if (tempsEcouleSec <= 0) return 0
  return Math.round((dernierMot - nbErreurs) / tempsEcouleSec * 60)
}

// ── Score de compréhension ─────────────────────────────────────────────────
// Retourne le pourcentage de bonnes réponses parmi les Q renseignées (non null)

export function calculerScoreComprehension(qs: (boolean | null)[]): number {
  const renseignees = qs.filter(q => q !== null)
  if (renseignees.length === 0) return -1
  const bonnes = renseignees.filter(q => q === true).length
  return Math.round((bonnes / renseignees.length) * 100)
}
