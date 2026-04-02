// Stockage hors-ligne CHIFFRÉ pour passations (AES-GCM 256 bits)
// Clé dérivée de l'user ID via PBKDF2 — pas de dépendance externe

const OFFLINE_KEY = 'fluence-offline-passations'
const SALT = 'fluence-offline-salt-v1'

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

// ── Crypto (SubtleCrypto natif) ───────────────────────────────────────

const canEncrypt = typeof window !== 'undefined' && !!window.crypto?.subtle

async function deriveKey(userId: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const material = await crypto.subtle.importKey('raw', enc.encode(userId), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(SALT), iterations: 100000, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  )
}

async function encrypt(data: string, userId: string): Promise<string> {
  const key = await deriveKey(userId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(data))
  const buf = new Uint8Array(iv.length + new Uint8Array(ct).length)
  buf.set(iv); buf.set(new Uint8Array(ct), iv.length)
  return btoa(String.fromCharCode(...buf))
}

async function decrypt(encoded: string, userId: string): Promise<string> {
  const key = await deriveKey(userId)
  const buf = Uint8Array.from(atob(encoded), c => c.charCodeAt(0))
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12))
  return new TextDecoder().decode(pt)
}

// ── User ID ───────────────────────────────────────────────────────────

let _userId: string | null = null
export function setOfflineUserId(id: string) { _userId = id }
function uid(): string { return _userId || 'fluence-fallback' }

// ── API publique ──────────────────────────────────────────────────────

export async function saveOffline(passation: OfflinePassation) {
  try {
    const existing = await getOfflinePassations()
    const filtered = existing.filter(p =>
      !(p.eleve_id === passation.eleve_id && p.periode_id === passation.periode_id)
    )
    filtered.push(passation)
    const json = JSON.stringify(filtered)
    if (canEncrypt) {
      localStorage.setItem(OFFLINE_KEY, await encrypt(json, uid()))
    } else {
      console.warn('[offline] SubtleCrypto indisponible — stockage en clair')
      localStorage.setItem(OFFLINE_KEY, json)
    }
  } catch { /* quota dépassé */ }
}

export async function getOfflinePassations(): Promise<OfflinePassation[]> {
  try {
    const raw = localStorage.getItem(OFFLINE_KEY)
    if (!raw) return []
    if (canEncrypt) {
      try { return JSON.parse(await decrypt(raw, uid())) }
      catch { try { return JSON.parse(raw) } catch { return [] } } // fallback données non chiffrées
    }
    return JSON.parse(raw)
  } catch { return [] }
}

export function clearOfflinePassations() {
  localStorage.removeItem(OFFLINE_KEY)
}

export async function hasOfflineData(): Promise<boolean> {
  return (await getOfflinePassations()).length > 0
}

export async function syncOfflinePassations(supabase: any): Promise<{ synced: number; errors: number }> {
  const passations = await getOfflinePassations()
  if (passations.length === 0) return { synced: 0, errors: 0 }
  let synced = 0, errors = 0
  for (const p of passations) {
    const { saved_at, ...data } = p
    const { error } = await supabase.from('passations').upsert(data, { onConflict: 'eleve_id,periode_id,hors_periode' })
    if (error) errors++; else synced++
  }
  if (errors === 0) clearOfflinePassations()
  return { synced, errors }
}
