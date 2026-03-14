'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'

type Classe = {
  id: string
  nom: string
  niveau: string
  groupe_lecture: string | null
  etablissement: { nom: string }
  nbEleves: number
}

type ClasseDisponible = {
  id: string
  nom: string
  niveau: string
  groupes: string[]
}

export default function MesClasses() {
  const [classes, setClasses]           = useState<Classe[]>([])
  const [classesDisponibles, setClassesDisponibles] = useState<ClasseDisponible[]>([])
  const [mode, setMode]                 = useState<'liste' | 'selection'>('liste')
  const [selections, setSelections]     = useState<{classeId: string, groupe: string | null}[]>([])
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const { profil } = useProfil()
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (profil) chargerDonnees()
  }, [profil])

  async function chargerDonnees() {
    if (!profil) return
    const isEnseignant = profil.role === 'enseignant'

    if (isEnseignant) {
      // Charger les classes assignées à cet enseignant
      const { data: assignees } = await supabase
        .from('enseignant_classes')
        .select('classe_id, groupe_lecture, classe:classes(id, nom, niveau, etablissement:etablissements(nom))')
        .eq('enseignant_id', profil.id)

      if (!assignees || assignees.length === 0) {
        // Pas encore de classes → mode sélection
        await chargerClassesDisponibles()
        setMode('selection')
        setLoading(false)
        return
      }

      // Compter les élèves par classe
      const classesAvecNb: Classe[] = await Promise.all(
        (assignees || []).map(async (a: any) => {
          let query = supabase.from('eleves')
            .select('*', { count: 'exact', head: true })
            .eq('classe_id', a.classe_id).eq('actif', true)

          const { count } = await query
          return {
            id:             a.classe_id,
            nom:            a.classe?.nom || '',
            niveau:         a.classe?.niveau || '',
            groupe_lecture: a.groupe_lecture,
            etablissement:  a.classe?.etablissement || { nom: '' },
            nbEleves:       count || 0,
          }
        })
      )
      setClasses(classesAvecNb)
      setSelections(assignees.map((a: any) => ({
        classeId: a.classe_id, groupe: a.groupe_lecture
      })))

    } else {
      // Directeur / Principal → toutes les classes de l'établissement
      let query = supabase
        .from('classes')
        .select('id, nom, niveau, etablissement:etablissements(nom)')
        .order('niveau')

      if (profil.etablissement_id) {
        query = query.eq('etablissement_id', profil.etablissement_id)
      }

      const { data } = await query
      const classesAvecNb: Classe[] = await Promise.all(
        (data || []).map(async (c: any) => {
          const { count } = await supabase
            .from('eleves').select('*', { count: 'exact', head: true })
            .eq('classe_id', c.id).eq('actif', true)
          return { ...c, groupe_lecture: null, nbEleves: count || 0 }
        })
      )
      setClasses(classesAvecNb)
    }

    setLoading(false)
  }

  async function chargerClassesDisponibles() {
    if (!profil?.etablissement_id) return
    const { data } = await supabase
      .from('classes')
      .select('id, nom, niveau')
      .eq('etablissement_id', profil.etablissement_id)
      .order('niveau')

    // Groupes de lecture disponibles
    const { data: groupesData } = await supabase
      .from('eleves')
      .select('classe_id')
      .not('classe_id', 'is', null)

    const classesAvecGroupes: ClasseDisponible[] = (data || []).map((c: any) => ({
      ...c, groupes: []
    }))

    setClassesDisponibles(classesAvecGroupes)
  }

  function toggleSelection(classeId: string, groupe: string | null) {
    const exists = selections.some(s => s.classeId === classeId && s.groupe === groupe)
    if (exists) {
      setSelections(prev => prev.filter(s => !(s.classeId === classeId && s.groupe === groupe)))
    } else {
      setSelections(prev => [...prev, { classeId, groupe }])
    }
  }

  function isSelected(classeId: string, groupe: string | null) {
    return selections.some(s => s.classeId === classeId && s.groupe === groupe)
  }

  async function sauvegarderSelections() {
    if (!profil?.id || selections.length === 0) return
    setSaving(true)

    await supabase.from('enseignant_classes').delete().eq('enseignant_id', profil.id)
    await supabase.from('enseignant_classes').insert(
      selections.map(s => ({
        enseignant_id:  profil.id,
        classe_id:      s.classeId,
        groupe_lecture: s.groupe,
      }))
    )

    setSaving(false)
    setMode('liste')
    chargerDonnees()
  }

  // Grouper par niveau pour l'affichage
  const classesByNiveau: Record<string, Classe[]> = {}
  classes.forEach(c => {
    const key = c.niveau || 'Autre'
    if (!classesByNiveau[key]) classesByNiveau[key] = []
    classesByNiveau[key].push(c)
  })

  const disponiblesByNiveau: Record<string, ClasseDisponible[]> = {}
  classesDisponibles.forEach(c => {
    const key = c.niveau || 'Autre'
    if (!disponiblesByNiveau[key]) disponiblesByNiveau[key] = []
    disponiblesByNiveau[key].push(c)
  })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
        body { background: #F4F2ED; font-family: 'DM Sans', sans-serif; }
        .page { display: flex; min-height: 100vh; }
        .main { margin-left: 260px; flex: 1; padding: 48px; background: #F4F2ED; }

        .page-title { font-family: 'DM Serif Display', serif; font-size: 32px; color: #001845; margin-bottom: 6px; }
        .page-sub { font-size: 14px; color: #8A8680; margin-bottom: 40px; }

        .topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; }

        /* Grille classes */
        .classes-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

        .classe-card {
          background: #fff; border-radius: 16px; padding: 24px;
          border: 1px solid rgba(0,0,0,0.06);
          transition: all 0.15s; cursor: pointer;
        }
        .classe-card:hover { border-color: #C9A84C; box-shadow: 0 4px 16px rgba(201,168,76,0.12); transform: translateY(-2px); }

        .classe-card-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
        .classe-nom { font-family: 'DM Serif Display', serif; font-size: 24px; color: #001845; }
        .classe-niveau { font-size: 12px; color: #8A8680; margin-top: 2px; }
        .classe-nb {
          background: rgba(0,24,69,0.06); color: #001845;
          font-size: 12px; font-weight: 600;
          padding: 4px 10px; border-radius: 8px;
        }
        .classe-groupe {
          display: inline-block;
          background: rgba(201,168,76,0.12); color: #7A6010;
          font-size: 11px; font-weight: 600;
          padding: 3px 8px; border-radius: 6px;
          margin-bottom: 12px;
        }
        .classe-etab { font-size: 12px; color: #A8A49D; margin-bottom: 16px; }

        .classe-btns { display: flex; gap: 8px; }
        .btn-saisie {
          flex: 1; padding: 8px; border-radius: 8px;
          border: none; background: #001845; color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all 0.15s;
        }
        .btn-saisie:hover { background: #002D72; }
        .btn-passation {
          flex: 1; padding: 8px; border-radius: 8px;
          border: 1.5px solid #E4E1DA; background: transparent;
          font-family: 'DM Sans', sans-serif;
          font-size: 12px; font-weight: 600; color: #4A4540;
          cursor: pointer; transition: all 0.15s;
        }
        .btn-passation:hover { border-color: #C9A84C; color: #001845; }

        /* Mode sélection */
        .selection-intro {
          background: #fff; border-radius: 16px; padding: 32px;
          border: 1px solid rgba(0,0,0,0.06); margin-bottom: 24px;
          text-align: center;
        }
        .selection-intro h3 { font-family: 'DM Serif Display', serif; font-size: 24px; color: #001845; margin-bottom: 8px; }
        .selection-intro p { font-size: 14px; color: #8A8680; }

        .niveau-section { margin-bottom: 28px; }
        .niveau-title {
          font-size: 11px; font-weight: 700; color: #A8A49D;
          text-transform: uppercase; letter-spacing: 0.1em;
          margin-bottom: 12px;
        }
        .chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .chip {
          padding: 10px 18px; border-radius: 10px;
          border: 1.5px solid #E4E1DA; background: #F9F7F4;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; font-weight: 500; color: #4A4540;
          cursor: pointer; transition: all 0.15s;
        }
        .chip:hover { border-color: #C9A84C; }
        .chip.selected { border-color: #001845; background: #001845; color: #fff; }

        /* Boutons */
        .btn-primary {
          background: #001845; color: #fff; border: none;
          border-radius: 12px; padding: 13px 28px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 600;
          cursor: pointer; transition: all 0.2s;
        }
        .btn-primary:hover { background: #002D72; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .btn-outline {
          background: transparent; color: #4A4540;
          border: 1.5px solid #E4E1DA; border-radius: 12px;
          padding: 12px 24px; font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 500; cursor: pointer;
          transition: all 0.15s;
        }
        .btn-outline:hover { border-color: #001845; color: #001845; }

        .btn-modifier {
          font-size: 13px; color: #C9A84C; font-weight: 500;
          background: none; border: none; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          text-decoration: underline;
        }

        .empty-state { text-align: center; padding: 60px; color: #A8A49D; }
        .empty-icon { font-size: 48px; margin-bottom: 16px; }
        .empty-title { font-family: 'DM Serif Display', serif; font-size: 22px; color: #001845; margin-bottom: 8px; }

        .selection-bar {
          display: flex; align-items: center; justify-content: space-between;
          background: #fff; border-radius: 12px; padding: 16px 20px;
          border: 1px solid rgba(0,0,0,0.06); margin-bottom: 24px;
        }
        .selection-count { font-size: 14px; color: #4A4540; }
        .selection-count strong { color: #001845; font-weight: 600; }

        @media (max-width: 768px) {
          .main { margin-left: 0; padding: 24px 20px; }
          .classes-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="page">
        <Sidebar />
        <ImpersonationBar />

        <main className="main">

          {/* ── Mode liste ── */}
          {mode === 'liste' && (
            <>
              <div className="topbar">
                <div>
                  <h1 className="page-title">Mes classes</h1>
                  <p className="page-sub">
                    {classes.length} classe{classes.length > 1 ? 's' : ''} assignée{classes.length > 1 ? 's' : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {profil?.role === 'enseignant' && (
                    <button className="btn-modifier" onClick={async () => {
                      await chargerClassesDisponibles()
                      setMode('selection')
                    }}>
                      ✎ Modifier mes classes
                    </button>
                  )}
                  {['directeur','principal','admin'].includes(profil?.role || '') && (
                    <button className="btn-primary" onClick={() => router.push('/dashboard/import')}>
                      + Importer des élèves
                    </button>
                  )}
                </div>
              </div>

              {loading ? (
                <div style={{ color: '#A8A49D', fontSize: 14 }}>Chargement...</div>
              ) : classes.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📚</div>
                  <div className="empty-title">Aucune classe assignée</div>
                  <p style={{ fontSize: 14, marginBottom: 24 }}>
                    Sélectionnez vos classes pour commencer
                  </p>
                  <button className="btn-primary" onClick={async () => {
                    await chargerClassesDisponibles()
                    setMode('selection')
                  }}>
                    Choisir mes classes →
                  </button>
                </div>
              ) : (
                Object.entries(classesByNiveau).map(([niveau, cls]) => (
                  <div key={niveau} className="niveau-section">
                    <div className="niveau-title">{niveau}</div>
                    <div className="classes-grid">
                      {cls.map(c => (
                        <div key={c.id + (c.groupe_lecture || '')} className="classe-card"
                          onClick={() => router.push(`/dashboard/eleves/${c.id}`)}>
                          <div className="classe-card-top">
                            <div>
                              <div className="classe-nom">{c.nom}</div>
                              <div className="classe-niveau">{c.niveau}</div>
                            </div>
                            <div className="classe-nb">{c.nbEleves} élèves</div>
                          </div>
                          {c.groupe_lecture && (
                            <div className="classe-groupe">Groupe : {c.groupe_lecture}</div>
                          )}
                          <div className="classe-etab">{c.etablissement?.nom}</div>
                          <div className="classe-btns" onClick={e => e.stopPropagation()}>
                            <button className="btn-saisie"
                              onClick={() => router.push(`/dashboard/saisie?classe=${c.id}`)}>
                              ✏️ Saisie
                            </button>
                            <button className="btn-passation"
                              onClick={() => router.push(`/dashboard/passation?classe=${c.id}`)}>
                              ⏱️ Passation
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* ── Mode sélection ── */}
          {mode === 'selection' && (
            <>
              <div className="topbar">
                <div>
                  <h1 className="page-title">Choisir mes classes</h1>
                  <p className="page-sub">Sélectionnez vos classes et groupes de lecture</p>
                </div>
              </div>

              <div className="selection-bar">
                <span className="selection-count">
                  <strong>{selections.length}</strong> sélection{selections.length > 1 ? 's' : ''}
                </span>
                <div style={{ display: 'flex', gap: 10 }}>
                  {classes.length > 0 && (
                    <button className="btn-outline" onClick={() => setMode('liste')}>
                      Annuler
                    </button>
                  )}
                  <button className="btn-primary"
                    disabled={saving || selections.length === 0}
                    onClick={sauvegarderSelections}>
                    {saving ? 'Enregistrement...' : 'Confirmer mes classes →'}
                  </button>
                </div>
              </div>

              {Object.entries(disponiblesByNiveau).map(([niveau, cls]) => (
                <div key={niveau} className="niveau-section">
                  <div className="niveau-title">{niveau}</div>
                  <div className="chips">
                    {cls.map(c => (
                      <button key={c.id}
                        className={`chip ${isSelected(c.id, null) ? 'selected' : ''}`}
                        onClick={() => toggleSelection(c.id, null)}>
                        {c.nom}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </main>
      </div>
    </>
  )
}