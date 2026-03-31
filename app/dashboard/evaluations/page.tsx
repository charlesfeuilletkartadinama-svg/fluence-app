'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'

export default function Evaluations() {
  const { profil, loading: profilLoading } = useProfil()
  const router = useRouter()
  const supabase = createClient()
  const [periodeOuverte, setPeriodeOuverte] = useState<{ id: string; code: string; label: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profilLoading || !profil) return
    // Vérifier s'il y a une période active de passation
    async function check() {
      let etabId = profil!.etablissement_id
      if (!etabId && profil!.role === 'enseignant') {
        const { data } = await supabase.from('enseignant_classes')
          .select('classe:classes(etablissement_id)').eq('enseignant_id', profil!.id).limit(1)
        etabId = (data as any)?.[0]?.classe?.etablissement_id || null
      }
      if (etabId) {
        const { data: perData } = await supabase.from('periodes')
          .select('id, code, label').eq('etablissement_id', etabId).eq('actif', true)
          .order('annee_scolaire', { ascending: false }).order('code')
        const tPeriodes = (perData || []).filter((p: any) => /^T\d/.test(p.code))
        if (tPeriodes.length > 0) setPeriodeOuverte(tPeriodes[tPeriodes.length - 1])
      }
      setLoading(false)
    }
    check()
  }, [profil, profilLoading])

  if (loading || profilLoading) return (
    <><Sidebar /><div style={{ marginLeft: 'var(--sidebar-width)', padding: 48, color: 'var(--text-tertiary)', fontSize: 14 }}>Chargement...</div></>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <ImpersonationBar />
      <main style={{ marginLeft: 'var(--sidebar-width)', flex: 1, padding: '48px 40px', background: 'var(--bg-gray)', fontFamily: 'var(--font-sans)' }}>

        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary-dark)', margin: '0 0 8px 0' }}>Évaluations</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 32 }}>
          Choisissez le type d'évaluation à réaliser
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 700 }}>
          {/* Saisir des résultats */}
          <button onClick={() => router.push('/dashboard/saisie')} style={{
            background: 'white', borderRadius: 20, border: '1.5px solid var(--border-light)', padding: '36px 28px',
            cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-dark)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.boxShadow = 'none' }}
          >
            <div style={{ fontSize: 40, marginBottom: 16 }}>📝</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-dark)', marginBottom: 8 }}>Saisir des résultats</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Entrez les scores de fluence et les résultats de compréhension pour des tests déjà passés (sur papier ou avec un autre outil).
            </p>
            <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
              Toutes les périodes disponibles
            </div>
          </button>

          {/* Faire passer un test */}
          <div style={{
            background: periodeOuverte ? 'white' : '#f8fafc', borderRadius: 20,
            border: `1.5px solid ${periodeOuverte ? 'var(--border-light)' : '#e2e8f0'}`,
            padding: '36px 28px', position: 'relative',
            opacity: periodeOuverte ? 1 : 0.7,
          }}>
            {periodeOuverte ? (
              <button onClick={() => router.push('/dashboard/passation')} style={{
                background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                padding: 0, width: '100%',
              }}
                onMouseEnter={e => { const p = e.currentTarget.parentElement; if (p) { p.style.borderColor = '#2563EB'; p.style.boxShadow = '0 6px 24px rgba(37,99,235,0.1)' } }}
                onMouseLeave={e => { const p = e.currentTarget.parentElement; if (p) { p.style.borderColor = 'var(--border-light)'; p.style.boxShadow = 'none' } }}
              >
                <div style={{ fontSize: 40, marginBottom: 16 }}>⏱️</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-dark)', marginBottom: 8 }}>Faire passer un test</div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  Lancez un test de fluence en direct (chronomètre 60s) ou une session de compréhension QCM sur tablette.
                </p>
                <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', padding: '4px 10px', borderRadius: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} />
                  Période ouverte : {periodeOuverte.code}
                </div>
              </button>
            ) : (
              <>
                <div style={{ fontSize: 40, marginBottom: 16 }}>⏱️</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#94a3b8', marginBottom: 8 }}>Faire passer un test</div>
                <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                  Lancez un test de fluence en direct ou une session QCM sur tablette.
                </p>
                <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '6px 12px', borderRadius: 8 }}>
                  Aucune période de test n'est ouverte
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
