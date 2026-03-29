'use client'

import { useEffect, useRef, useState } from 'react'
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
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm]     = useState('')
  const [deleting, setDeleting]               = useState(false)
  const [exportLoading, setExportLoading]     = useState(false)
  const { profil, profilReel }            = useProfil()
  const router      = useRouter()
  const supabase    = createClient()
  const timeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [])

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

  async function exporterDonnees() {
    if (!profil) return
    setExportLoading(true)
    const [profilRes, classesRes, passRes] = await Promise.all([
      supabase.from('profils').select('id, nom, prenom, role, etablissement_id').eq('id', profil.id).maybeSingle(),
      supabase.from('enseignant_classes').select('classe_id, groupe_lecture').eq('enseignant_id', profil.id),
      supabase.from('passations').select('id, eleve_id, periode_id, score, non_evalue, mode, created_at').eq('enseignant_id', profil.id),
    ])
    const export_data = {
      exported_at: new Date().toISOString(),
      profil:      profilRes.data,
      classes:     classesRes.data || [],
      passations:  passRes.data    || [],
    }
    const blob = new Blob([JSON.stringify(export_data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `fluence-mes-donnees-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)

    // Audit log
    await supabase.from('audit_logs').insert({ action: 'export_donnees', utilisateur_id: profil.id })
    setExportLoading(false)
  }

  async function supprimerCompte() {
    setDeleting(true)
    // Audit log avant suppression (après, l'ID n'existera plus)
    if (profil?.id) {
      await supabase.from('audit_logs').insert({ action: 'delete_account', utilisateur_id: profil.id })
    }
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      setDeleting(false)
      setShowDeleteModal(false)
      setErreur('Erreur lors de la suppression : ' + error.message)
      return
    }
    await supabase.auth.signOut()
    router.push('/')
  }

  async function sauvegarder() {
    if (!nom || !prenom) { setErreur('Veuillez remplir votre nom et prénom.'); return }
    setSaving(true); setErreur('')

    const uid = profil?.id || profilReel?.id
    if (!uid) { setSaving(false); return }

    // Sauvegarder le profil
    const { error } = await supabase
      .from('profils')
      .upsert({ id: uid, nom: nom.toUpperCase(), prenom }, { onConflict: 'id' })

    if (error) { setErreur('Erreur : ' + error.message); setSaving(false); return }

    // Sauvegarder les classes (si enseignant)
    if (profil?.role === 'enseignant') {
      // Supprimer les anciennes
      await supabase.from('enseignant_classes').delete().eq('enseignant_id', uid)

      // Insérer les nouvelles
      if (selections.length > 0) {
        await supabase.from('enseignant_classes').insert(
          selections.map(s => ({
            enseignant_id:  uid,
            classe_id:      s.classeId,
            groupe_lecture: s.groupe,
          }))
        )
      }
    }

    setSaving(false)
    setSucces(true)
    timeoutRef.current = setTimeout(() => router.push('/dashboard'), 1200)
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

        .btn-secondary {
          background: transparent; color: #4A4540;
          border: 1.5px solid #E4E1DA; border-radius: 12px;
          padding: 12px 24px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 600;
          cursor: pointer; transition: all 0.15s;
        }
        .btn-secondary:hover { border-color: #001845; color: #001845; }

        .btn-danger {
          background: transparent; color: #DC2626;
          border: 1.5px solid #FCA5A5; border-radius: 12px;
          padding: 12px 24px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 600;
          cursor: pointer; transition: all 0.15s;
        }
        .btn-danger:hover { background: #FEF2F2; }
        .btn-danger-full {
          background: #DC2626; color: white;
          border: none; border-radius: 12px;
          padding: 13px 24px; width: 100%;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 700;
          cursor: pointer; transition: all 0.15s;
          margin-top: 12px;
        }
        .btn-danger-full:disabled { opacity: 0.5; cursor: not-allowed; }

        .modal-backdrop {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.5); z-index: 1000;
          display: flex; align-items: center; justify-content: center;
        }
        .modal-box {
          background: white; border-radius: 20px;
          padding: 36px; max-width: 440px; width: 90%;
        }
        .modal-title { font-size: 18px; font-weight: 800; color: #001845; margin-bottom: 10px; }
        .modal-sub   { font-size: 13px; color: #8A8680; line-height: 1.6; margin-bottom: 20px; }
        .modal-input {
          width: 100%; background: #F9F7F4;
          border: 1.5px solid #E4E1DA; border-radius: 10px;
          padding: 12px 16px; font-family: 'DM Sans', sans-serif;
          font-size: 14px; color: #001845; outline: none;
          box-sizing: border-box;
        }
        .modal-input:focus { border-color: #DC2626; }
        .modal-actions { display: flex; gap: 10px; margin-top: 20px; }
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

          {/* ── Section RGPD ── */}
          <div className="profil-section" style={{ marginTop: 32, borderColor: 'rgba(0,0,0,0.06)' }}>
            <div className="section-label">Mes données personnelles</div>
            <p style={{ fontSize: 13, color: '#8A8680', lineHeight: 1.7, marginBottom: 20 }}>
              Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et d'effacement de vos données.{' '}
              <a href="/legal" style={{ color: '#001845', textDecoration: 'underline' }}>Mentions légales & politique de confidentialité →</a>
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn-secondary" onClick={exporterDonnees} disabled={exportLoading}>
                {exportLoading ? 'Préparation...' : '⬇ Télécharger mes données'}
              </button>
              <button className="btn-danger" onClick={() => { setShowDeleteModal(true); setDeleteConfirm('') }}>
                🗑 Supprimer mon compte
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* ── Modale confirmation suppression ── */}
      {showDeleteModal && (
        <div className="modal-backdrop" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">⚠️ Supprimer mon compte</div>
            <p className="modal-sub">
              Cette action est <strong>irréversible</strong>. Votre profil sera supprimé définitivement.
              Les scores de vos élèves seront conservés (données pédagogiques de l'établissement).
              <br /><br />
              Tapez <strong>SUPPRIMER</strong> pour confirmer.
            </p>
            <input
              className="modal-input"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="SUPPRIMER"
              autoFocus
            />
            <button
              className="btn-danger-full"
              disabled={deleteConfirm !== 'SUPPRIMER' || deleting}
              onClick={supprimerCompte}>
              {deleting ? 'Suppression...' : 'Confirmer la suppression définitive'}
            </button>
            <div className="modal-actions">
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowDeleteModal(false)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}