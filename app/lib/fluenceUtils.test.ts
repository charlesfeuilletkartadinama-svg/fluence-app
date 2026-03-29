import { classerEleve, periodeVerrouillee, calculerScore, calculerScoreComprehension } from './fluenceUtils'

// ── classerEleve ──────────────────────────────────────────────────────────

describe('classerEleve', () => {
  const norme = { seuil_min: 50, seuil_attendu: 80 }
  // seuil très fragile = round(50 * 0.70) = 35

  it('groupe 1 — score < 70% du seuil_min', () => {
    expect(classerEleve(0,  norme)).toBe(1)
    expect(classerEleve(20, norme)).toBe(1)
    expect(classerEleve(34, norme)).toBe(1)
  })

  it('groupe 2 — score entre 70% seuil_min et seuil_min', () => {
    expect(classerEleve(35, norme)).toBe(2)
    expect(classerEleve(40, norme)).toBe(2)
    expect(classerEleve(49, norme)).toBe(2)
  })

  it('groupe 3 — score entre seuil_min et seuil_attendu', () => {
    expect(classerEleve(50, norme)).toBe(3)
    expect(classerEleve(65, norme)).toBe(3)
    expect(classerEleve(79, norme)).toBe(3)
  })

  it('groupe 4 — score >= seuil_attendu', () => {
    expect(classerEleve(80,  norme)).toBe(4)
    expect(classerEleve(100, norme)).toBe(4)
    expect(classerEleve(150, norme)).toBe(4)
  })

  it('gère seuil_min = 0 sans division par zéro', () => {
    const normeZero = { seuil_min: 0, seuil_attendu: 40 }
    expect(classerEleve(0,  normeZero)).toBe(3)
    expect(classerEleve(40, normeZero)).toBe(4)
  })
})

// ── periodeVerrouillee ────────────────────────────────────────────────────

describe('periodeVerrouillee', () => {
  it('retourne false si dateFin est null ou undefined', () => {
    expect(periodeVerrouillee(null)).toBe(false)
    expect(periodeVerrouillee(undefined)).toBe(false)
  })

  it('retourne true pour une date dans le passé', () => {
    expect(periodeVerrouillee('2020-01-01')).toBe(true)
    expect(periodeVerrouillee('2025-12-31')).toBe(true)
  })

  it('retourne false pour une date dans le futur', () => {
    expect(periodeVerrouillee('2099-12-31')).toBe(false)
  })
})

// ── calculerScore ─────────────────────────────────────────────────────────

describe('calculerScore', () => {
  it('calcule correctement le score (dernierMot - erreurs) / temps * 60', () => {
    // 90 mots, 5 erreurs, 60s → (85/60)*60 = 85
    expect(calculerScore(90, 5, 60)).toBe(85)
    // 60 mots, 0 erreur, 30s → (60/30)*60 = 120
    expect(calculerScore(60, 0, 30)).toBe(120)
  })

  it('retourne 0 si tempsEcoule est 0', () => {
    expect(calculerScore(50, 5, 0)).toBe(0)
  })

  it('arrondit le résultat à l\'entier le plus proche', () => {
    // (50 - 3) / 45 * 60 = 47/45*60 = 62.666... → 63
    expect(calculerScore(50, 3, 45)).toBe(63)
  })
})

// ── calculerScoreComprehension ────────────────────────────────────────────

describe('calculerScoreComprehension', () => {
  it('retourne -1 si aucune question n\'est renseignée', () => {
    expect(calculerScoreComprehension([null, null, null])).toBe(-1)
    expect(calculerScoreComprehension([])).toBe(-1)
  })

  it('calcule le pourcentage de bonnes réponses', () => {
    expect(calculerScoreComprehension([true, true, false, false])).toBe(50)
    expect(calculerScoreComprehension([true, true, true, true])).toBe(100)
    expect(calculerScoreComprehension([false, false])).toBe(0)
  })

  it('ignore les questions null (non renseignées)', () => {
    // 2 bonnes sur 3 renseignées = 67%
    expect(calculerScoreComprehension([true, true, false, null, null])).toBe(67)
  })
})
