'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'

type Classe = { id: string; nom: string; niveau: string }
type Invitation = { id: string; code: string; role: string; actif: boolean; classe_id: string | null }

export default function Onboarding() {
  const [etape, setEtape] = useState(1)
  const [classes, setClasses] = useState<Classe[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [codeGenere, setCodeGenere] = useState('')
  const { profil } = useProfil()
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => { if (profil) charger() }, [profil])

  async function charger() {
    if (!profil?.etablissement_id) { setLoading(false); return }
    const { data: cls } = await supabase.from('classes').select('id, nom, niveau')
      .eq('etablissement_id', profil.etablissement_id).order('niveau')
    setClasses(cls || [])
    const { data: inv } = await supabase.from('invitations').select('id, code, role, actif, classe_id')
      .eq('etablissement_id', profil.etablissement_id)
    setInvitations(inv || [])
    setLoading(false)
  }

  async function genererCode() {
    if (!profil?.etablissement_id) return
    const code = 'ENS-' + Math.random().toString(36).substring(2, 8).toUpperCase()
    const { error } = await supabase.from('invitations').insert({
      code, role: 'enseignant', etablissement_id: profil.etablissement_id, actif: true,
    })
    if (!error) { setCodeGenere(code); await charger() }
  }

  async function desactiverCode(id: string) {
    await supabase.from('invitations').update({ actif: false }).eq('id', id)
    await charger()
  }

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ marginLeft: 'var(--sidebar-width)', padding: 48 }}>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Chargement...</p>
      </main>
    </div>
  )

  const steps = [
    { n: 1, label: 'Structure' },
    { n: 2, label: 'Élèves' },
    { n: 3, label: 'Enseignants' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-gray)' }}>
      <Sidebar />
      <main style={{ marginLeft: 'var(--sidebar-width)', padding: 48, flex: 1, maxWidth: 860 }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--primary-dark)', marginBottom: 6 }}>
            Configuration de l'établissement
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Paramétrez votre école en 3 étapes
          </p>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 40 }}>
          {steps.map((s, i) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
              <button onClick={() => setEtape(s.n)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
                borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                background: etape === s.n ? 'var(--primary-dark)' : etape > s.n ? 'rgba(22,163,74,0.1)' : 'white',
                color: etape === s.n ? 'white' : etape > s.n ? '#16A34A' : 'var(--text-secondary)',
                fontWeight: 700, fontSize: 14, transition: 'all 0.15s',
                boxShadow: etape === s.n ? '0 2px 8px rgba(0,24,69,0.15)' : 'none',
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: etape === s.n ? 'rgba(255,255,255,0.2)' : etape > s.n ? '#16A34A' : 'var(--bg-gray)',
                  color: etape === s.n ? 'white' : etape > s.n ? 'white' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 800,
                }}>
                  {etape > s.n ? '✓' : s.n}
                </div>
                {s.label}
              </button>
              {i < steps.length - 1 && (
                <div style={{ width: 32, height: 2, background: etape > s.n ? '#16A34A' : 'var(--border-light)' }} />
              )}
            </div>
          ))}
        </div>

        {/* Étape 1 — Structure */}
        {etape === 1 && (
          <div>
            <div style={{ background: 'white', borderRadius: 16, padding: 28, border: '1.5px solid var(--border-light)', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>
                    Classes de l'établissement
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                    {classes.length} classe{classes.length > 1 ? 's' : ''} configurée{classes.length > 1 ? 's' : ''}
                  </p>
                </div>
                <a href="/dashboard/import" style={{
                  background: 'var(--primary-dark)', color: 'white', padding: '10px 18px',
                  borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: 'var(--font-sans)',
                }}>
                  + Importer des élèves
                </a>
              </div>
              {classes.length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
                  Aucune classe. Utilisez l'importation pour créer les classes et les élèves.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {classes.map(c => (
                    <div key={c.id} style={{
                      background: 'var(--bg-gray)', borderRadius: 12, padding: '14px 18px',
                      border: '1.5px solid var(--border-light)',
                    }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)' }}>{c.nom}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>{c.niveau}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setEtape(2)} style={{
              background: 'var(--primary-dark)', color: 'white', border: 'none', borderRadius: 12,
              padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}>
              Étape suivante → Importer les élèves
            </button>
          </div>
        )}

        {/* Étape 2 — Élèves */}
        {etape === 2 && (
          <div>
            <div style={{ background: 'white', borderRadius: 16, padding: 28, border: '1.5px solid var(--border-light)', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: '0 0 12px' }}>
                Importer les élèves
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
                Importez vos listes d'élèves par classe au format CSV. Chaque ligne doit contenir : <strong>nom, prénom, classe</strong>.
              </p>
              <a href="/dashboard/import" style={{
                display: 'inline-block', background: 'var(--accent-gold)', color: 'white',
                padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700,
                textDecoration: 'none', fontFamily: 'var(--font-sans)',
              }}>
                Aller à l'importation
              </a>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setEtape(1)} style={{
                background: 'white', color: 'var(--text-secondary)', border: '1.5px solid var(--border-light)',
                borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}>
                ← Retour
              </button>
              <button onClick={() => setEtape(3)} style={{
                background: 'var(--primary-dark)', color: 'white', border: 'none', borderRadius: 12,
                padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}>
                Étape suivante → Inviter les enseignants
              </button>
            </div>
          </div>
        )}

        {/* Étape 3 — Enseignants */}
        {etape === 3 && (
          <div>
            <div style={{ background: 'white', borderRadius: 16, padding: 28, border: '1.5px solid var(--border-light)', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>
                    Codes d'invitation enseignants
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                    Partagez ces codes avec vos enseignants pour qu'ils créent leur compte
                  </p>
                </div>
                <button onClick={genererCode} style={{
                  background: 'var(--accent-gold)', color: 'white', border: 'none', borderRadius: 10,
                  padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}>
                  + Générer un code
                </button>
              </div>

              {codeGenere && (
                <div style={{
                  background: 'rgba(22,163,74,0.08)', border: '1.5px solid #86efac',
                  borderRadius: 12, padding: '14px 20px', marginBottom: 20,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <span style={{ fontSize: 20 }}>✅</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#16A34A', fontSize: 14 }}>Code généré</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 800, color: 'var(--primary-dark)', letterSpacing: 2 }}>{codeGenere}</div>
                  </div>
                </div>
              )}

              {invitations.filter(i => i.role === 'enseignant').length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
                  Aucun code généré pour l'instant.
                </p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-gray)' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>Code</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>Statut</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.filter(i => i.role === 'enseignant').map(inv => (
                      <tr key={inv.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-dark)', fontSize: 15, letterSpacing: 1 }}>{inv.code}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {inv.actif
                            ? <span style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A', fontWeight: 700, fontSize: 12, padding: '3px 10px', borderRadius: 6 }}>Actif</span>
                            : <span style={{ background: 'var(--bg-gray)', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 12, padding: '3px 10px', borderRadius: 6 }}>Désactivé</span>}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {inv.actif && (
                            <button onClick={() => desactiverCode(inv.id)} style={{
                              background: 'none', border: '1.5px solid var(--border-light)', borderRadius: 8,
                              padding: '5px 12px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                            }}>
                              Désactiver
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button onClick={() => setEtape(2)} style={{
                background: 'white', color: 'var(--text-secondary)', border: '1.5px solid var(--border-light)',
                borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}>
                ← Retour
              </button>
              <button onClick={() => router.push('/dashboard')} style={{
                background: '#16A34A', color: 'white', border: 'none', borderRadius: 12,
                padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}>
                ✓ Terminer la configuration
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
