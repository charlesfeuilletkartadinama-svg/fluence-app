'use client'

import { useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'

const TYPES_ETABLISSEMENT = ['école', 'collège', 'lycée']
const TYPES_RESEAU = ['Hors REP', 'REP', 'REP+']

export default function NouvelEtablissement() {
  const [nom, setNom]               = useState('')
  const [type, setType]             = useState('école')
  const [typeReseau, setTypeReseau] = useState('Hors REP')
  const [saving, setSaving]         = useState(false)
  const [erreur, setErreur]         = useState('')
  const router   = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim()) { setErreur('Le nom est obligatoire.'); return }

    setSaving(true)
    setErreur('')

    const { error } = await supabase.from('etablissements').insert({
      nom:         nom.trim(),
      type:        type,
      type_reseau: typeReseau,
    })

    setSaving(false)

    if (error) {
      setErreur(`Erreur : ${error.message}`)
    } else {
      router.push('/dashboard/admin')
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    border: '1.5px solid var(--border-main)',
    borderRadius: 10,
    fontFamily: 'var(--font-sans)',
    fontSize: 14,
    background: 'white',
    color: 'var(--text-primary)',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--primary-dark)',
    marginBottom: 8,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-gray)' }}>
      <Sidebar />
      <ImpersonationBar />

      <main style={{ marginLeft: 'var(--sidebar-width)', padding: '48px', flex: 1 }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <button
            onClick={() => router.back()}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', fontSize: 13,
              fontFamily: 'var(--font-sans)', marginBottom: 12,
              display: 'block', padding: 0,
            }}>
            ← Retour à l'administration
          </button>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--primary-dark)', marginBottom: 6 }}>
            Nouvel établissement
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Ajoutez un établissement scolaire à l'application
          </p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} style={{ maxWidth: 520 }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 32,
            border: '1px solid var(--border-main)',
          }}>

            {erreur && (
              <div style={{
                background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)',
                color: 'var(--error)', borderRadius: 10, padding: '12px 16px',
                fontSize: 13, marginBottom: 24,
              }}>
                {erreur}
              </div>
            )}

            {/* Nom */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Nom de l'établissement *</label>
              <input
                type="text"
                value={nom}
                onChange={e => setNom(e.target.value)}
                placeholder="Ex : École primaire Jules Verne"
                style={fieldStyle}
                autoFocus
              />
            </div>

            {/* Type */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                style={{ ...fieldStyle, cursor: 'pointer' }}>
                {TYPES_ETABLISSEMENT.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Réseau */}
            <div style={{ marginBottom: 32 }}>
              <label style={labelStyle}>Réseau d'éducation prioritaire</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {TYPES_RESEAU.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setTypeReseau(r)}
                    style={{
                      flex: 1, padding: '10px 8px', borderRadius: 10,
                      border: typeReseau === r
                        ? '2px solid var(--primary-dark)'
                        : '1.5px solid var(--border-main)',
                      background: typeReseau === r ? 'var(--primary-dark)' : 'white',
                      color: typeReseau === r ? 'white' : 'var(--text-secondary)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => router.back()}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 12,
                  border: '1.5px solid var(--border-main)', background: 'transparent',
                  fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500,
                  color: '#4A4540', cursor: 'pointer',
                }}>
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 12,
                  border: 'none', background: saving ? '#A8B8D8' : 'var(--primary-dark)',
                  fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600,
                  color: 'white', cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}>
                {saving ? 'Enregistrement...' : 'Créer l\'établissement'}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}
