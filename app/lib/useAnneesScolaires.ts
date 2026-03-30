import { useEffect, useState } from 'react'
import { createClient } from './supabase'

export function useAnneesScolaires() {
  const [annees, setAnnees] = useState<string[]>(['2025-2026'])

  useEffect(() => {
    createClient()
      .from('periodes')
      .select('annee_scolaire')
      .not('annee_scolaire', 'is', null)
      .then(({ data }) => {
        const unique = [...new Set((data || []).map((p: any) => p.annee_scolaire).filter(Boolean))].sort().reverse()
        if (unique.length > 0) setAnnees(unique)
      })
  }, [])

  return annees
}
