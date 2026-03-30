'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'
import type { TestSession, Periode, Classe } from '@/app/lib/types'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function genererCode(): string {
  let code = 'FLU-'
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return code
}

export default function SessionsPage() {
  const { profil, loading: profilLoading } = useProfil()
  const router = useRouter()
  const supabase = createClient()
  const [sessions, setSessions] = useState<(TestSession & { classe?: Classe; periode?: Periode })[]>([])
  const [classes, setClasses] = useState<Classe[]>([])
  const [periodes, setPeriodes] = useState<Periode[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selectedClasseId, setSelectedClasseId] = useState('')
  const [selectedPeriodeId, setSelectedPeriodeId] = useState('')
  const [erreur, setErreur] = useState('')
  const [copiedCode, setCopiedCode] = useState('')

  useEffect(() => {
    if (profilLoading || !profil) return
    const ALLOWED_ROLES = ['enseignant', 'directeur', 'principal', 'admin', 'coordo_rep']
    if (!ALLOWED_ROLES.includes(profil.role)) { router.push('/dashboard'); return }
    charger()
  }, [profil, profilLoading])

  async function charger() {
    setLoading(true)
    const isDirection = ['directeur', 'principal', 'admin', 'coordo_rep'].includes(profil!.role)

    // Charger les classes
    let classesData: Classe[] = []
    if (profil!.role === 'enseignant') {
      const { data: ec } = await supabase
        .from('enseignant_classes')
        .select('classe:classes(id, nom, niveau, etablissement_id)')
        .eq('enseignant_id', profil!.id)
      classesData = (ec || []).map((e: any) => e.classe).filter(Boolean)
    } else if (profil!.etablissement_id) {
      const { data } = await supabase
        .from('classes')
        .select('id, nom, niveau, etablissement_id')
        .eq('etablissement_id', profil!.etablissement_id)
        .order('nom')
      classesData = data || []
    } else if (isDirection) {
      const { data } = await supabase
        .from('classes')
        .select('id, nom, niveau, etablissement_id')
        .order('nom')
      classesData = data || []
    }
    setClasses(classesData)

    // Charger les périodes
    const { data: periData } = await supabase
      .from('periodes')
      .select('id, code, label, actif, type')
      .eq('actif', true)
      .order('code')
    setPeriodes(periData || [])

    // Charger les sessions (limité aux 100 plus récentes)
    const { data: sessData } = await supabase
      .from('test_sessions')
      .select('*, classe:classes(id, nom, niveau), periode:periodes(id, code, label)')
      .order('created_at', { ascending: false })
      .limit(100)
    setSessions((sessData || []) as any)
    setLoading(false)
  }

  async function creerSession() {
    if (!selectedClasseId || !selectedPeriodeId) {
      setErreur('Sélectionnez une classe et une période.')
      return
    }
    setErreur('')
    setCreating(true)

    // Générer un code unique (retry si collision)
    let code = genererCode()
    let attempts = 0
    while (attempts < 5) {
      const { error } = await supabase.from('test_sessions').insert({
        code,
        classe_id: selectedClasseId,
        periode_id: selectedPeriodeId,
        enseignant_id: profil!.id,
      })
      if (!error) break
      if (error.code === '23505') { // unique violation
        code = genererCode()
        attempts++
      } else {
        setErreur(error.message)
        setCreating(false)
        return
      }
    }

    setSelectedClasseId('')
    setSelectedPeriodeId('')
    setCreating(false)
    await charger()
  }

  async function desactiverSession(id: string) {
    await supabase.from('test_sessions').update({ active: false }).eq('id', id)
    setSessions(prev => prev.map(s => s.id === id ? { ...s, active: false } : s))
  }

  function copierCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(''), 2000)
  }

  function estExpire(session: TestSession) {
    return new Date(session.expires_at) < new Date()
  }

  function statut(session: TestSession) {
    if (!session.active) return { label: 'Désactivée', color: '#6b7280', bg: '#f3f4f6' }
    if (estExpire(session)) return { label: 'Expirée', color: '#d97706', bg: '#fffbeb' }
    return { label: 'Active', color: '#16a34a', bg: '#f0fdf4' }
  }

  if (profilLoading || loading) {
    return (
      <>
        <Sidebar />
        <div style={{ marginLeft: 'var(--sidebar-width)', padding: 32, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Chargement...</div>
      </>
    )
  }

  const S = {
    card:       { background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', overflow: 'hidden' as const },
    th:         { padding: '12px 20px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.5, textTransform: 'uppercase' as const, background: 'var(--bg-gray)', fontFamily: 'var(--font-sans)', borderBottom: '1.5px solid var(--border-light)' },
    thC:        { padding: '12px 20px', textAlign: 'center' as const, fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.5, textTransform: 'uppercase' as const, background: 'var(--bg-gray)', fontFamily: 'var(--font-sans)', borderBottom: '1.5px solid var(--border-light)' },
    td:         { padding: '14px 20px', fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', borderBottom: '1px solid var(--border-light)' },
    tdBold:     { padding: '14px 20px', fontSize: 14, fontWeight: 700, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', borderBottom: '1px solid var(--border-light)' },
    tdC:        { padding: '14px 20px', fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', textAlign: 'center' as const, borderBottom: '1px solid var(--border-light)' },
    btnPrimary: { background: 'var(--primary-dark)', color: 'white', border: 'none', padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' as const },
    btnGhost:   { background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border-light)', padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' as const },
    btnDanger:  { background: 'transparent', color: '#dc2626', border: '1.5px solid #fca5a5', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer' as const },
    input:      { border: '1.5px solid var(--border-main)', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' as const, background: 'white' },
    select:     { border: '1.5px solid var(--border-main)', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' as const, background: 'white' },
    label:      { fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.2, textTransform: 'uppercase' as const, fontFamily: 'var(--font-sans)', display: 'block' as const, marginBottom: 6 },
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-light)' }}>
      <Sidebar />
      <ImpersonationBar />

      <div style={{ marginLeft: 'var(--sidebar-width)', padding: 32, maxWidth: 1000 }}>
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>
            Sessions QCM
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 15, fontFamily: 'var(--font-sans)' }}>
            Créez une session pour permettre aux élèves de passer le test de compréhension sur tablette.
          </p>
        </div>

        {/* Créer une session */}
        <div style={{ ...S.card, padding: 24, marginBottom: 28 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: '0 0 16px 0' }}>
            Nouvelle session
          </h3>

          {erreur && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#dc2626', fontFamily: 'var(--font-sans)' }}>{erreur}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 16, alignItems: 'end' }}>
            <div>
              <label style={S.label}>Classe</label>
              <select value={selectedClasseId} onChange={e => setSelectedClasseId(e.target.value)} style={{ ...S.select, width: '100%' }}>
                <option value="">— Choisir une classe —</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={S.label}>Période</label>
              <select value={selectedPeriodeId} onChange={e => setSelectedPeriodeId(e.target.value)} style={{ ...S.select, width: '100%' }}>
                <option value="">— Choisir une période —</option>
                {periodes.map(p => (
                  <option key={p.id} value={p.id}>{p.code} — {p.label}</option>
                ))}
              </select>
            </div>
            <button onClick={creerSession} disabled={creating} style={{ ...S.btnPrimary, opacity: creating ? 0.6 : 1, whiteSpace: 'nowrap' as const }}>
              {creating ? 'Création…' : 'Créer la session'}
            </button>
          </div>

          <div style={{ marginTop: 14, padding: '10px 16px', background: 'var(--bg-gray)', borderRadius: 10, fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>
            Les élèves vont sur <strong>/test</strong> et saisissent le code de session. La session expire automatiquement après 2 heures.
          </div>
        </div>

        {/* Liste des sessions */}
        {sessions.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', padding: 40, textAlign: 'center' as const, fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
            Aucune session créée.
          </div>
        ) : (
          <div style={S.card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={S.th}>Code</th>
                <th style={S.th}>Classe</th>
                <th style={S.th}>Période</th>
                <th style={S.thC}>Statut</th>
                <th style={S.th}>Expire à</th>
                <th style={S.thC}>Actions</th>
              </tr></thead>
              <tbody>
                {sessions.map(s => {
                  const st = statut(s)
                  return (
                    <tr key={s.id}>
                      <td style={S.tdBold}>
                        <span style={{ fontFamily: 'monospace', fontSize: 16, letterSpacing: 2 }}>{s.code}</span>
                      </td>
                      <td style={S.td}>{(s as any).classe?.nom || '—'}</td>
                      <td style={S.td}>{(s as any).periode ? `${(s as any).periode.code} — ${(s as any).periode.label}` : '—'}</td>
                      <td style={S.tdC}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: st.bg, color: st.color, fontFamily: 'var(--font-sans)' }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={S.td}>
                        {new Date(s.expires_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={S.tdC}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                          <button onClick={() => copierCode(s.code)} style={S.btnGhost}>
                            {copiedCode === s.code ? 'Copié !' : 'Copier'}
                          </button>
                          {s.active && !estExpire(s) && (
                            <button onClick={() => desactiverSession(s.id)} style={S.btnDanger}>Désactiver</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
