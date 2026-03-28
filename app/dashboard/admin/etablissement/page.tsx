'use client'

import { useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'

const TYPES_ETABLISSEMENT = ['école', 'collège', 'lycée']
const TYPES_RESEAU = ['Hors REP', 'REP', 'REP+']

const GEO_DATA: Record<string, Record<string, string[]>> = {
  'Guyane (973)': {
    'Cayenne 1': ['Cayenne'],
    'Cayenne 2': ['Rémire-Montjoly', 'Matoury', 'Montsinéry-Tonnégrande'],
    'Kourou': ['Kourou', 'Macouria', 'Sinnamary', 'Iracoubo'],
    'Saint-Laurent-du-Maroni': ['Saint-Laurent-du-Maroni', 'Mana', 'Awala-Yalimapo'],
    'Haut-Maroni': ['Maripasoula', 'Grand-Santi', 'Papaichton', 'Apatou'],
    'Oyapock': ["Saint-Georges-de-l'Oyapock", 'Camopi', 'Ouanary', 'Régina'],
    'Roura': ['Roura', 'Cacao', 'Saint-Élie'],
  },
}

export default function NouvelEtablissement() {
  const [nom, setNom]                   = useState('')
  const [type, setType]                 = useState('école')
  const [typeReseau, setTypeReseau]     = useState('Hors REP')
  const [dept, setDept]                 = useState('')
  const [circo, setCirco]               = useState('')
  const [ville, setVille]               = useState('')
  const [saving, setSaving]             = useState(false)
  const [erreur, setErreur]             = useState('')
  const router   = useRouter()
  const supabase = createClient()

  const depts  = Object.keys(GEO_DATA)
  const circos = dept ? Object.keys(GEO_DATA[dept] || {}) : []
  const villes = dept && circo ? (GEO_DATA[dept]?.[circo] || []) : []

  function onDeptChange(val: string) { setDept(val); setCirco(''); setVille('') }
  function onCircoChange(val: string) { setCirco(val); setVille('') }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim()) { setErreur('Le nom est obligatoire.'); return }
    setSaving(true); setErreur('')
    const { error } = await supabase.from('etablissements').insert({
      nom:             nom.trim(),
      type,
      type_reseau:     typeReseau,
      departement:     dept     || null,
      circonscription: circo    || null,
      ville:           ville    || null,
    })
    setSaving(false)
    if (error) { setErreur(`Erreur : ${error.message}`) }
    else { router.push('/dashboard/admin') }
  }

  const F: React.CSSProperties = {
    width: '100%', padding: '11px 14px',
    border: '1.5px solid var(--border-main)', borderRadius: 10,
    fontFamily: 'var(--font-sans)', fontSize: 14,
    background: 'white', color: 'var(--primary-dark)', outline: 'none',
    boxSizing: 'border-box',
  }
  const L: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: 'var(--text-tertiary)', letterSpacing: 1.2,
    textTransform: 'uppercase', fontFamily: 'var(--font-sans)', marginBottom: 6,
  }
  const divider: React.CSSProperties = { borderTop: '1.5px solid var(--border-light)', margin: '28px 0' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-light)' }}>
      <Sidebar />
      <ImpersonationBar />
      <main style={{ marginLeft: 'var(--sidebar-width)', padding: '40px 48px', maxWidth: 680 }}>

        <button onClick={() => router.back()} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)', fontSize: 13,
          fontFamily: 'var(--font-sans)', marginBottom: 16, display: 'block', padding: 0,
        }}>
          ← Retour à l'administration
        </button>

        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: '0 0 6px 0' }}>
          Nouvel établissement
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: 32 }}>
          Renseignez les informations de l'établissement scolaire
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, border: '1.5px solid var(--border-light)' }}>

            {erreur && (
              <div style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#dc2626', fontFamily: 'var(--font-sans)', marginBottom: 24 }}>
                {erreur}
              </div>
            )}

            {/* ── Localisation ── */}
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'var(--font-sans)', margin: '0 0 20px 0' }}>
              Localisation
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={L}>Département</label>
              <select value={dept} onChange={e => onDeptChange(e.target.value)} style={{ ...F, cursor: 'pointer' }}>
                <option value="">— Choisir un département —</option>
                {depts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={L}>Circonscription</label>
                <select value={circo} onChange={e => onCircoChange(e.target.value)}
                  style={{ ...F, cursor: dept ? 'pointer' : 'default', opacity: dept ? 1 : 0.5 }} disabled={!dept}>
                  <option value="">— Choisir —</option>
                  {circos.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {!dept && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)', marginTop: 4 }}>Choisissez d'abord un département</p>}
              </div>
              <div>
                <label style={L}>Ville / Commune</label>
                <select value={ville} onChange={e => setVille(e.target.value)}
                  style={{ ...F, cursor: circo ? 'pointer' : 'default', opacity: circo ? 1 : 0.5 }} disabled={!circo}>
                  <option value="">— Choisir —</option>
                  {villes.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                {!circo && dept && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)', marginTop: 4 }}>Choisissez d'abord une circonscription</p>}
              </div>
            </div>

            <div style={divider} />

            {/* ── Identité ── */}
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'var(--font-sans)', margin: '0 0 20px 0' }}>
              Identité
            </p>

            <div style={{ marginBottom: 20 }}>
              <label style={L}>Nom de l'établissement *</label>
              <input type="text" value={nom} onChange={e => setNom(e.target.value)}
                placeholder="Ex : École primaire Jules Verne" style={F} autoFocus required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
              <div>
                <label style={L}>Type</label>
                <select value={type} onChange={e => setType(e.target.value)} style={{ ...F, cursor: 'pointer' }}>
                  {TYPES_ETABLISSEMENT.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={L}>Réseau d'éducation prioritaire</label>
                <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
                  {TYPES_RESEAU.map(r => (
                    <button key={r} type="button" onClick={() => setTypeReseau(r)} style={{
                      flex: 1, padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                      fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
                      border: typeReseau === r ? '2px solid var(--primary-dark)' : '1.5px solid var(--border-main)',
                      background: typeReseau === r ? 'var(--primary-dark)' : 'white',
                      color: typeReseau === r ? 'white' : 'var(--text-secondary)',
                    }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Actions ── */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" onClick={() => router.back()} style={{
                flex: 1, padding: '13px 0', borderRadius: 12,
                border: '1.5px solid var(--border-main)', background: 'transparent',
                fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600,
                color: 'var(--text-secondary)', cursor: 'pointer',
              }}>
                Annuler
              </button>
              <button type="submit" disabled={saving} style={{
                flex: 2, padding: '13px 0', borderRadius: 12, border: 'none',
                background: saving ? 'var(--text-tertiary)' : 'var(--primary-dark)',
                fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700,
                color: 'white', cursor: saving ? 'not-allowed' : 'pointer', transition: 'background 0.15s',
              }}>
                {saving ? 'Enregistrement...' : "Créer l'établissement →"}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}
