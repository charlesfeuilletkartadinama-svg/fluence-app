// Stockage hors-ligne pour passations — synchronisation quand connexion revient

const OFFLINE_KEY = 'fluence-offline-passations'

type OfflinePassation = {
  eleve_id: string
  periode_id: string
  hors_periode: boolean
  score: number | null
  non_evalue: boolean
  absent: boolean
  mode: string
  enseignant_id: string
  q1: string | null; q2: string | null; q3: string | null
  q4: string | null; q5: string | null; q6: string | null
  saved_at: string
}

export function saveOffline(passation: OfflinePassation) {
  try {
    const existing = getOfflinePassations()
    // Remplacer si même élève+période
    const filtered = existing.filter(p =>
      !(p.eleve_id === passation.eleve_id && p.periode_id === passation.periode_id)
    )
    filtered.push(passation)
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(filtered))
  } catch { /* quota dépassé — ignorer */ }
}

export function getOfflinePassations(): OfflinePassation[] {
  try {
    const data = localStorage.getItem(OFFLINE_KEY)
    return data ? JSON.parse(data) : []
  } catch { return [] }
}

export function clearOfflinePassations() {
  localStorage.removeItem(OFFLINE_KEY)
}

export function hasOfflineData(): boolean {
  return getOfflinePassations().length > 0
}

export async function syncOfflinePassations(supabase: any): Promise<{ synced: number; errors: number }> {
  const passations = getOfflinePassations()
  if (passations.length === 0) return { synced: 0, errors: 0 }

  let synced = 0, errors = 0
  for (const p of passations) {
    const { saved_at, ...data } = p
    const { error } = await supabase.from('passations').upsert(data, {
      onConflict: 'eleve_id,periode_id,hors_periode',
    })
    if (error) errors++
    else synced++
  }

  if (errors === 0) clearOfflinePassations()
  return { synced, errors }
}
