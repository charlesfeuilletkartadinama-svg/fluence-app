'use server'

import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const email    = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.error('Login error:', error.message)
    redirect('/?error=1')
  }

  redirect('/dashboard')
}