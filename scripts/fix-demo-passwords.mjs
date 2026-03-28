// ============================================================
// Fix Demo Passwords — FluenceApp
// Usage : node scripts/fix-demo-passwords.mjs <SERVICE_ROLE_KEY>
// ============================================================
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)
if (!urlMatch) { console.error('NEXT_PUBLIC_SUPABASE_URL introuvable dans .env.local'); process.exit(1) }
const SUPABASE_URL = urlMatch[1].trim()

const SERVICE_ROLE_KEY = process.argv[2]
if (!SERVICE_ROLE_KEY) {
  console.error('Usage : node scripts/fix-demo-passwords.mjs <SERVICE_ROLE_KEY>')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

console.log(`URL : ${SUPABASE_URL}\n`)

// Récupérer les IDs depuis profils
const { data: profils, error: profilsError } = await supabase
  .from('profils')
  .select('id, prenom, role')
  .eq('nom', '[DEMO]')

if (profilsError) { console.error('Erreur lecture profils:', profilsError.message); process.exit(1) }
if (!profils?.length) { console.error('Aucun profil [DEMO] trouvé'); process.exit(1) }

console.log(`${profils.length} comptes démo trouvés\n`)

// Utiliser l'API REST auth directement
for (const profil of profils) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${profil.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ password: 'Demo1234!', email_confirm: true }),
  })

  const json = await res.json()
  if (!res.ok) console.error(`❌ ${profil.prenom} (${profil.role}) — ${json.msg || json.message || res.status}`)
  else         console.log(`✅ ${profil.prenom} (${profil.role})`)
}

console.log('\nTerminé. Mot de passe : Demo1234!')
