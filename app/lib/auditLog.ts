import { createClient } from './supabase'

export async function logAction(action: string, details: Record<string, any> = {}) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('audit_logs').insert({
      user_id: session?.user?.id || null,
      action,
      details,
    })
  } catch {
    // Ne pas bloquer l'action si le log échoue
  }
}
