'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'
import type { Periode } from '@/app/lib/types'

type EleveStatut = 'evalue' | 'ne' | 'absent' | 'non_renseigne'

type EleveRow = {
  id: string
  nom: string
  prenom: string
  statut: EleveStatut
  score: number | null
}

type ClasseGroup = {
  id: string
  nom: string
  niveau: string
  eleves: EleveRow[]
}

export default function MesEleves() {
  const [classes, setClasses]     = useState<ClasseGroup[]>([])
  const [periodes, setPeriodes]   = useState<Periode[]>([])
  const [periodeCode, setPeriodeCode] = useState<string>('')
  const [loading, setLoading]     = useState(true)
  const { profil } = useProfil()
  const supabase = createClient()

  useEffect(() => {
    if (profil) charger()
  }, [profil])

  useEffect(() => {
    if (profil && periodeCode) chargerPassations()
  }, [periodeCode])

  async function charger() {
    if (!profil) return

    // Classes de l'enseignant
    const { data: assignees } = await supabase
      .from('enseignant_classes')
      .select('classe_id, classe:classes(id, nom, niveau, etablissement_id)')
      .eq('enseignant_id', profil.id)

    const classesList = (assignees || []).map((a: any) => a.classe).filter(Boolean)
    if (classesList.length === 0) { setLoading(false); return }

    // Élèves de toutes ces classes
    const classeIds = classesList.map((c: any) => c.id)
    const { data: elevesData } = await supabase
      .from('eleves')
      .select('id, nom, prenom, classe_id')
      .in('classe_id', classeIds)
      .eq('actif', true)
      .order('nom')

    // Périodes (depuis le premier établissement)
    const etabId = classesList[0]?.etablissement_id
    if (etabId) {
      const { data: rawPer } = await supabase
        .from('periodes').select('id, code, label')
        .eq('etablissement_id', etabId).eq('actif', true).order('code')
      const seen = new Set<string>()
      const perDedup: Periode[] = []
      for (const p of (rawPer || [])) {
        if (!seen.has(p.code)) { seen.add(p.code); perDedup.push(p) }
      }
      setPeriodes(perDedup)
      if (perDedup[0]) setPeriodeCode(perDedup[0].code)
    }

    // Construire les groupes par classe (sans passations pour l'instant)
    const groupes: ClasseGroup[] = classesList.map((c: any) => ({
      id: c.id, nom: c.nom, niveau: c.niveau,
      eleves: (elevesData || [])
        .filter((e: any) => e.classe_id === c.id)
        .map((e: any) => ({ id: e.id, nom: e.nom, prenom: e.prenom, statut: 'non_renseigne' as EleveStatut, score: null }))
    }))
    setClasses(groupes)
    setLoading(false)
  }

  async function chargerPassations() {
    if (!profil || classes.length === 0) return
    const tousEleves = classes.flatMap(c => c.eleves)
    if (tousEleves.length === 0) return

    const { data: passData } = await supabase
      .from('passations')
      .select('eleve_id, score, non_evalue, absent, periode:periodes(code)')
      .in('eleve_id', tousEleves.map(e => e.id))

    const passMap: Record<string, { score: number | null; non_evalue: boolean; absent: boolean }> = {}
    ;(passData || []).forEach((p: any) => {
      if (p.periode?.code === periodeCode) {
        passMap[p.eleve_id] = { score: p.score, non_evalue: p.non_evalue, absent: p.absent }
      }
    })

    setClasses(prev => prev.map(c => ({
      ...c,
      eleves: c.eleves.map(e => {
        const p = passMap[e.id]
        if (!p) return { ...e, statut: 'non_renseigne', score: null }
        if (p.absent) return { ...e, statut: 'absent', score: null }
        if (p.non_evalue) return { ...e, statut: 'ne', score: null }
        return { ...e, statut: 'evalue', score: p.score }
      })
    })))
  }

  const statutConfig: Record<EleveStatut, { label: string; bg: string; color: string }> = {
    evalue:        { label: '',      bg: '#f0fdf4', color: '#16a34a' },
    ne:            { label: 'N.É.',  bg: '#fff7ed', color: '#c2410c' },
    absent:        { label: 'Abs.',  bg: '#fef2f2', color: '#dc2626' },
    non_renseigne: { label: '—',     bg: 'var(--bg-gray)', color: 'var(--text-tertiary)' },
  }

  if (loading) return (
    <>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar-width)', padding: 48, color: 'var(--text-tertiary)', fontSize: 14 }}>Chargement...</div>
    </>
  )

  const totalEleves  = classes.reduce((n, c) => n + c.eleves.length, 0)
  const totalEvalues = classes.reduce((n, c) => n + c.eleves.filter(e => e.statut === 'evalue').length, 0)

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <ImpersonationBar />
      <main style={{ marginLeft: 'var(--sidebar-width)', flex: 1, padding: 48, background: 'var(--bg-gray)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)', margin: 0 }}>Mes élèves</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 15, fontFamily: 'var(--font-sans)' }}>
              {totalEvalues} / {totalEleves} élèves évalués
              {periodeCode ? ` · ${periodeCode}` : ''}
            </p>
          </div>

          {/* Sélecteur période */}
          {periodes.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              {periodes.map(p => (
                <button key={p.code} onClick={() => setPeriodeCode(p.code)}
                  style={{
                    padding: '8px 18px', borderRadius: 10, fontWeight: 700, fontSize: 14,
                    fontFamily: 'var(--font-sans)', cursor: 'pointer', transition: 'all 0.15s',
                    background: periodeCode === p.code ? 'var(--primary-dark)' : 'white',
                    color: periodeCode === p.code ? 'white' : 'var(--text-secondary)',
                    border: periodeCode === p.code ? '1.5px solid var(--primary-dark)' : '1.5px solid var(--border-light)',
                  }}>
                  {p.code}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Classes */}
        {classes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>
            Aucune classe assignée
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {classes.map(classe => {
              const nbEval    = classe.eleves.filter(e => e.statut === 'evalue').length
              const nbNE      = classe.eleves.filter(e => e.statut === 'ne').length
              const nbAbsent  = classe.eleves.filter(e => e.statut === 'absent').length
              const nbNR      = classe.eleves.filter(e => e.statut === 'non_renseigne').length
              const pctEval   = classe.eleves.length > 0 ? Math.round(nbEval / classe.eleves.length * 100) : 0

              return (
                <div key={classe.id} style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--border-light)', overflow: 'hidden' }}>
                  {/* En-tête classe */}
                  <div style={{ padding: '16px 24px', borderBottom: '1.5px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: 17, color: 'var(--primary-dark)', fontFamily: 'var(--font-sans)' }}>{classe.nom}</span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 13, marginLeft: 10, fontFamily: 'var(--font-sans)' }}>{classe.niveau}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                      <span style={{ color: '#16a34a', fontWeight: 700 }}>{nbEval} éval.</span>
                      {nbNE > 0 && <span style={{ color: '#c2410c', fontWeight: 700 }}>{nbNE} N.É.</span>}
                      {nbAbsent > 0 && <span style={{ color: '#dc2626', fontWeight: 700 }}>{nbAbsent} abs.</span>}
                      {nbNR > 0 && <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>{nbNR} en attente</span>}
                      <span style={{ color: 'var(--text-tertiary)', background: 'var(--bg-gray)', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>{pctEval}%</span>
                    </div>
                  </div>

                  {/* Barre de progression */}
                  <div style={{ height: 4, background: 'var(--border-light)' }}>
                    <div style={{ height: 4, background: '#16a34a', width: `${pctEval}%`, transition: 'width 0.3s' }} />
                  </div>

                  {/* Liste élèves */}
                  <div style={{ padding: '8px 0' }}>
                    {classe.eleves.map((eleve, i) => {
                      const cfg = statutConfig[eleve.statut]
                      return (
                        <div key={eleve.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 24px',
                          borderBottom: i < classe.eleves.length - 1 ? '1px solid var(--border-light)' : 'none',
                          background: eleve.statut === 'evalue' ? 'transparent' : cfg.bg,
                        }}>
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--primary-dark)' }}>
                            <strong>{eleve.nom}</strong> {eleve.prenom}
                          </span>
                          <span style={{
                            fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700,
                            color: cfg.color, minWidth: 80, textAlign: 'right',
                          }}>
                            {eleve.statut === 'evalue'
                              ? `${eleve.score} m/min`
                              : cfg.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
