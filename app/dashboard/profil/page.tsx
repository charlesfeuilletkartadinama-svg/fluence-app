'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'

type Classe = {
  id: string
  nom: string
  niveau: string
  groupes: string[] // groupes de lecture disponibles dans cette classe
}

type ClasseSelection = {
  classeId: string
  groupe: string | null // null = classe entière
}

export default function Profil() {
  const [nom, setNom]                     = useState('')
  const [prenom, setPrenom]               = useState('')
  const [classes, setClasses]             = useState<Classe[]>([])
  const [selections, setSelections]       = useState<ClasseSelection[]>([])
  const [saving, setSaving]               = useState(false)
  const [erreur, setErreur]               = useState('')
  const [succes, setSucces]               = useState(false)
  const { profil, profilReel }            = useProfil()
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (profil) chargerDonnees()
  }, [profil])

  async function chargerDonnees() {
    // Infos de base
    if (profil) {
      setNom(profil.nom || '')
      setPrenom(profil.prenom || '')
    }

    if (!profil?.etablissement_id) return

    // Charger les classes de l'établissement
    const { data: classesData } = await supabase
      .from('classes')
      .select('id, nom, niveau')
      .eq('etablissement_id', profil.etablissement_id)
      .order('niveau')

    // Charger les groupes de lecture disponibles par classe
    const { data: groupesData } = await supabase
      .from('passations')
      .select('groupe_lecture, eleve:eleves(classe_id)')
      .not('groupe_lecture', 'is', null)

    const groupesParClasse: Record<string, Set<string>> = {}
    ;(groupesData || []).forEach((p: any) => {
      const cid = p.eleve?.classe_id
      if (cid && p.groupe_lecture) {
        if (!groupesParClasse[cid]) groupesParClasse[cid] = new Set()
        groupesParClasse[cid].add(p.groupe_lecture)
      }
    })

    setClasses((classesData || []).map(c => ({
      ...c,
      groupes: groupesParClasse[c.id] ? Array.from(groupesParClasse[c.id]) : []
    })))

    // Charger les sélections existantes
    if (!profil?.id) return
    const { data: selData } = await supabase
      .from('enseignant_classes')
      .select('classe_id, groupe_lecture')
      .eq('enseignant_id', profil.id)

    setSelections((selData || []).map(s => ({
      classeId: s.classe_id,
      groupe:   s.groupe_lecture
    })))
  }

  function toggleClasse(classeId: string, groupe: string | null) {
    const key = classeId + '|' + (groupe || '')
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

  async function sauvegarder() {
    if (!nom || !prenom) { setErreur('Veuillez remplir votre nom et prénom.'); return }
    setSaving(true); setErreur('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Sauvegarder le profil
    const { error } = await supabase
      .from('profils')
      .upsert({ id: user.id, nom: nom.toUpperCase(), prenom }, { onConflict: 'id' })

    if (error) { setErreur('Erreur : ' + error.message); setSaving(false); return }

    // Sauvegarder les classes (si enseignant)
    if (profil?.role === 'enseignant') {
      // Supprimer les anciennes
      await supabase.from('enseignant_classes').delete().eq('enseignant_id', user.id)

      // Insérer les nouvelles
      if (selections.length > 0) {
        await supabase.from('enseignant_classes').insert(
          selections.map(s => ({
            enseignant_id:  user.id,
            classe_id:      s.classeId,
            groupe_lecture: s.groupe,
          }))
        )
      }
    }

    setSaving(false)
    setSucces(true)
    setTimeout(() => router.push('/dashboard'), 1200)
  }

  const isEnseignant = profil?.role === 'enseignant'

  // Grouper les classes par niveau
  const classesByNiveau: Record<string, Classe[]> = {}
  classes.forEach(c => {
    if (!classesByNiveau[c.niveau || 'Autre']) classesByNiveau[c.niveau || 'Autre'] = []
    classesByNiveau[c.niveau || 'Autre'].push(c)
  })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
        body { background: #F4F2ED; font-family: 'DM Sans', sans-serif; }

        .profil-page { display: flex; min-height: 100vh; }

        .profil-main {
          margin-left: 260px; flex: 1;
          padding: 48px; max-width: 760px;
        }

        .profil-title {
          font-family: 'DM Serif Display', serif;
          font-size: 32px; color: #001845;
          margin-bottom: 6px;
        }

        .profil-sub { font-size: 14px; color: #8A8680; margin-bottom: 40px; }

        .profil-section {
          background: #fff; border-radius: 16px;
          padding: 28px; border: 1px solid rgba(0,0,0,0.06);
          margin-bottom: 20px;
        }

        .section-label {
          font-size: 11px; font-weight: 600;
          color: #A8A49D; text-transform: uppercase;
          letter-spacing: 0.1em; margin-bottom: 20px;
        }

        .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

        .field { margin-bottom: 16px; }
        .field label {
          display: block; font-size: 11px; font-weight: 600;
          color: #8A8680; text-transform: uppercase;
          letter-spacing: 0.08em; margin-bottom: 8px;
        }
        .field input {
          width: 100%; background: #F9F7F4;
          border: 1.5px solid #E4E1DA; border-radius: 10px;
          padding: 12px 16px; font-family: 'DM Sans', sans-serif;
          font-size: 14px; color: #001845; outline: none;
          transition: border-color 0.2s;
        }
        .field input:focus { border-color: #C9A84C; background: #fff; }

        /* Classes sélection */
        .niveau-group { margin-bottom: 20px; }

        .niveau-label {
          font-size: 12px; font-weight: 600;
          color: #001845; text-transform: uppercase;
          letter-spacing: 0.08em; margin-bottom: 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }

        .classes-grid {
          display: flex; flex-wrap: wrap; gap: 8px;
        }

        .classe-chip {
          display: flex; flex-direction: column; gap: 4px;
        }

        .chip-btn {
          padding: 8px 14px; border-radius: 10px;
          border: 1.5px solid #E4E1DA;
          background: #F9F7F4;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; font-weight: 500;
          color: #4A4540; cursor: pointer;
          transition: all 0.15s;
        }

        .chip-btn:hover { border-color: #C9A84C; background: #FFFDF5; }

        .chip-btn.selected {
          border-color: #001845;
          background: #001845; color: #fff;
        }

        .chip-btn.selected-groupe {
          border-color: #C9A84C;
          background: rgba(201,168,76,0.12);
          color: #7A6010;
        }

        .chip-groupes {
          display: flex; flex-wrap: wrap; gap: 4px;
          padding-left: 4px;
        }

        .chip-groupe-btn {
          padding: 4px 10px; border-radius: 6px;
          border: 1px solid #E4E1DA;
          background: #F9F7F4;
          font-family: 'DM Sans', sans-serif;
          font-size: 11px; font-weight: 500;
          color: #8A8680; cursor: pointer;
          transition: all 0.15s;
        }

        .chip-groupe-btn:hover { border-color: #C9A84C; }

        .chip-groupe-btn.selected {
          border-color: #C9A84C;
          background: rgba(201,168,76,0.15);
          color: #7A6010; font-weight: 600;
        }

        /* Info rôle */
        .role-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(0,24,69,0.06);
          border-radius: 8px; padding: 8px 14px;
          font-size: 13px; font-weight: 500; color: #001845;
        }

        /* Succès */
        .succes-bar {
          background: #F0FDF4; border: 1.5px solid #86EFAC;
          border-radius: 12px; padding: 14px 20px;
          font-size: 14px; color: #16A34A; font-weight: 500;
          margin-bottom: 20px; display: flex; align-items: center; gap: 8px;
        }

        .erreur-bar {
          background: #FEF2F2; border: 1.5px solid #FCA5A5;
          border-radius: 12px; padding: 14px 20px;
          font-size: 14px; color: #DC2626;
          margin-bottom: 20px;
        }

        .btn-save {
          background: #001845; color: #fff;
          border: none; border-radius: 12px;
          padding: 14px 32px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 600;
          cursor: pointer; transition: all 0.2s;
        }
        .btn-save:hover { background: #002D72; transform: translateY(-1px); }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .selection-count {
          font-size: 12px; color: #8A8680; margin-bottom: 16px;
        }
        .selection-count strong { color: #001845; }
      `}</style>

      <div className="profil-page">
        <Sidebar />

        <main className="profil-main">
          <h1 className="profil-title">Mon profil</h1>
          <p className="profil-sub">Gérez vos informations et vos classes</p>

          {succes && (
            <div className="succes-bar">✅ Profil sauvegardé — redirection...</div>
          )}
          {erreur && <div className="erreur-bar">⚠️ {erreur}</div>}

          {/* Infos de base */}
          <div className="profil-section">
            <div className="section-label">Informations personnelles</div>
            <div className="field-row">
              <div className="field">
                <label>Prénom</label>
                <input type="text" value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Marie"/>
              </div>
              <div className="field">
                <label>Nom</label>
                <input type="text" value={nom} onChange={e => setNom(e.target.value)} placeholder="DUPONT"/>
              </div>
            </div>
            <div className="field">
              <label>Rôle</label>
              <div className="role-badge">
                {profil?.role === 'enseignant'  && '👨‍🏫'}
                {profil?.role === 'principal'   && '🏛️'}
                {profil?.role === 'directeur'   && '🏫'}
                {profil?.role === 'coordo_rep'  && '🎯'}
                {profil?.role === 'ien'         && '📋'}
                {profil?.role === 'ia_dasen'    && '🏢'}
                {profil?.role === 'admin'       && '⚙️'}
                {' '}{profil?.role || '—'}
              </div>
            </div>
          </div>

          {/* Sélection des classes (enseignants uniquement) */}
          {isEnseignant && (
            <div className="profil-section">
              <div className="section-label">Mes classes et groupes</div>
              <p className="selection-count">
                <strong>{selections.length}</strong> classe{selections.length > 1 ? 's' : ''} ou groupe{selections.length > 1 ? 's' : ''} sélectionné{selections.length > 1 ? 's' : ''}
              </p>

              {classes.length === 0 ? (
                <p style={{ color: '#A8A49D', fontSize: 14 }}>
                  Aucune classe disponible dans votre établissement.
                </p>
              ) : (
                Object.entries(classesByNiveau).map(([niveau, cls]) => (
                  <div key={niveau} className="niveau-group">
                    <div className="niveau-label">{niveau}</div>
                    <div className="classes-grid">
                      {cls.map(c => (
                        <div key={c.id} className="classe-chip">
                          {/* Bouton classe entière */}
                          <button
                            className={`chip-btn ${isSelected(c.id, null) ? 'selected' : ''}`}
                            onClick={() => toggleClasse(c.id, null)}>
                            {c.nom}
                          </button>
                          {/* Boutons groupes si disponibles */}
                          {c.groupes.length > 0 && (
                            <div className="chip-groupes">
                              {c.groupes.map(g => (
                                <button key={g}
                                  className={`chip-groupe-btn ${isSelected(c.id, g) ? 'selected' : ''}`}
                                  onClick={() => toggleClasse(c.id, g)}>
                                  {g}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <button className="btn-save" onClick={sauvegarder} disabled={saving}>
            {saving ? 'Enregistrement...' : '💾 Sauvegarder'}
          </button>
        </main>
      </div>
    </>
  )
}