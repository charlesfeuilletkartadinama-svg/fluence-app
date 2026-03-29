import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET() {
  const start = Date.now()

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Ping léger : count sur une table publique sans RLS bloquante
    const { error } = await supabase
      .from('etablissements')
      .select('id', { count: 'exact', head: true })
      .limit(1)

    if (error) throw error

    return NextResponse.json({
      status: 'ok',
      db: 'connected',
      latency_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({
      status: 'error',
      db: 'unreachable',
      error: err instanceof Error ? err.message : 'unknown',
      timestamp: new Date().toISOString(),
    }, { status: 503 })
  }
}
