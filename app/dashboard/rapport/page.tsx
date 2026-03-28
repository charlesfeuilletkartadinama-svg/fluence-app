'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useProfil } from '@/app/lib/useProfil'
import { useRouter } from 'next/navigation'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import Sidebar from '@/app/components/Sidebar'
import ImpersonationBar from '@/app/components/ImpersonationBar'

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFDownloadLink),
  { ssr: false, loading: () => <span>Préparation...</span> }
)

import { RapportPDF } from './RapportPDF'

type DonneesRapport = {
  classe: string
  niveau: string
  etablissement: string
  periode: string
  periodeComp: string | null
  enseignant: string
  dateGeneration: string
  eleves: {
    nom: string
    prenom: string
    score: number | null
    ne: boolean
    groupe: string
    progression: number | null
    q1: string | null
    q2: string | null
    q3: string | null
    q4: string | null
    q5: string | null
    q6: string | null
  }[]
  stats: {
    moyenne: number | null
    min: number | null
    max: number | null
    nbEvalues: number
    nbNE: number
    total: number
  }
  normes: { seuil_min: number; seuil_attendu: number } | null
  groupesBesoins: {
    nom: string
    couleur: string
    eleves: string[]
    suggestions: string
  }[]
}

type ClasseOption  = { id: string; nom: string; niveau: string; etablissement: { id: string; nom: string } }
type PeriodeOption = { id: string; code: string; label: string }

function RapportContent() {
  const [classes, setClasses]         = useState<ClasseOption[]>([])
  const [periodes, setPeriodes]       = useState<PeriodeOption[]>([])
  const [classeId, setClasseId]       = useState('')
  const [periodeId, setPeriodeId]     = useState('')
  const [periodeCompId, setPeriodeCompId] = useState('')
  const [donnees, setDonnees]         = useState<DonneesRapport | null>(null)
  const [loading, setLoading]         = useState(true)
  const [generating, setGenerating]   = useState(false)
  const { profil } = useProfil()
  const supabase   = createClient()

  useEffect(() => { if (profil) chargerOptions() }, [profil])

  async function chargerOptions() {
    // Classes accessibles selon le rôle
    let classesData: ClasseOption[] = []
    if (profil?.role === 'enseignant') {
      const { data } = await supabase
        .from('enseignant_classes')
        .select('classe:classes(id, nom, niveau, etablissement:etablissements(id, nom))')
        .eq('enseignant_id', profil.id)
      classesData = (data || []).map((r: any) => r.classe).filter(Boolean)
    } else {
      const q = supabase.from('classes').select('id, nom, niveau, etablissement:etablissements(id, nom)').order('nom')
      const { data } = profil?.etablissement_id
        ? await q.eq('etablissement_id', profil.etablissement_id)
        : await q
      classesData = (data as unknown as ClasseOption[]) || []
    }
    setClasses(classesData)
    if (classesData[0]) setClasseId(classesData[0].id)

    // Périodes — filtrées par établissement + déduplication par code
    const etabId = profil?.etablissement_id
      || (classesData[0] as any)?.etablissement?.id
      || null
    let perQuery = supabase.from('periodes').select('id, code, label').eq('actif', true).order('code')
    if (etabId) perQuery = perQuery.eq('etablissement_id', etabId)
    const { data: rawPer } = await perQuery
    const seen = new Set<string>()
    const perDedup: PeriodeOption[] = []
    for (const p of (rawPer || [])) {
      if (!seen.has(p.code)) { seen.add(p.code); perDedup.push(p) }
    }
    setPeriodes(perDedup)
    if (perDedup[0]) setPeriodeId(perDedup[0].id)

    setLoading(false)
  }

  async function genererRapport() {
    if (!classeId || !periodeId) return
    setGenerating(true)

    const { data: classeData } = await supabase
      .from('classes').select('nom, niveau, etablissement:etablissements(nom)').eq('id', classeId).single()
    const { data: periodeData } = await supabase
      .from('periodes').select('code, label').eq('id', periodeId).single()
    const { data: elevesIds } = await supabase
      .from('eleves').select('id').eq('classe_id', classeId)
    const { data: passData } = await supabase
      .from('passations')
      .select('eleve_id, score, non_evalue, groupe_lecture, q1, q2, q3, q4, q5, q6, eleve:eleves(nom, prenom)')
      .eq('periode_id', periodeId)
      .in('eleve_id', (elevesIds || []).map(e => e.id))
    const { data: normesData } = await supabase
      .from('config_normes').select('seuil_min, seuil_attendu')
      .eq('niveau', classeData?.niveau || '').limit(1)
    const { data: groupesConfig } = await supabase
      .from('config_groupes').select('nom, couleur, seuil_bas, seuil_haut, suggestions').order('ordre')

    // Passations de comparaison (période précédente optionnelle)
    let compScores: Record<string, number> = {}
    let periodeCompCode = ''
    if (periodeCompId && periodeCompId !== periodeId) {
      const { data: periodeCompData } = await supabase
        .from('periodes').select('code').eq('id', periodeCompId).single()
      periodeCompCode = periodeCompData?.code || ''
      const { data: compData } = await supabase
        .from('passations').select('eleve_id, score, non_evalue')
        .eq('periode_id', periodeCompId)
        .in('eleve_id', (elevesIds || []).map((e: any) => e.id))
      ;(compData || []).forEach((p: any) => {
        if (!p.non_evalue && p.score) compScores[p.eleve_id] = p.score
      })
    }

    const pass   = passData || []
    const normes = normesData?.[0] || null
    const scores = pass.filter(p => !p.non_evalue && p.score && p.score > 0).map(p => p.score as number)

    const stats = {
      moyenne:   scores.length > 0 ? Math.round(scores.reduce((a,b) => a+b,0)/scores.length) : null,
      min:       scores.length > 0 ? Math.min(...scores) : null,
      max:       scores.length > 0 ? Math.max(...scores) : null,
      nbEvalues: scores.length,
      nbNE:      pass.filter(p => p.non_evalue).length,
      total:     pass.length,
    }

    function getGroupe(score: number | null) {
      if (!score || !normes || !groupesConfig) return null
      for (const g of groupesConfig) {
        const bas  = g.seuil_bas  === 'min'   ? normes.seuil_min
                   : g.seuil_bas  === 'norme' ? normes.seuil_attendu
                   : Number(g.seuil_bas)
        const haut = g.seuil_haut === 'min'   ? normes.seuil_min
                   : g.seuil_haut === 'norme' ? normes.seuil_attendu
                   : g.seuil_haut === '999'   ? 9999
                   : Number(g.seuil_haut)
        if (score >= bas && score < haut) return g
      }
      return null
    }

    const groupesMap: Record<string, any> = {}
    pass.forEach(p => {
      const g = getGroupe(p.score)
      if (!g) return
      if (!groupesMap[g.nom]) groupesMap[g.nom] = { nom: g.nom, couleur: g.couleur, eleves: [], suggestions: g.suggestions || '' }
      groupesMap[g.nom].eleves.push(`${(p.eleve as any)?.nom} ${(p.eleve as any)?.prenom}`)
    })

    setDonnees({
      classe:         classeData?.nom || '',
      niveau:         classeData?.niveau || '',
      etablissement:  (classeData?.etablissement as any)?.nom || '',
      periode:        periodeData?.code || '',
      periodeComp:    periodeCompCode || null,
      enseignant:     `${profil?.prenom} ${profil?.nom}`,
      dateGeneration: new Date().toLocaleDateString('fr-FR'),
      eleves: pass.map(p => {
        const scoreComp  = compScores[(p as any).eleve_id] ?? null
        const progression = p.score != null && scoreComp != null ? p.score - scoreComp : null
        return {
          nom:    (p.eleve as any)?.nom || '',
          prenom: (p.eleve as any)?.prenom || '',
          score:  p.score, ne: p.non_evalue,
          groupe: getGroupe(p.score)?.nom || '—',
          progression,
          q1: p.q1, q2: p.q2, q3: p.q3, q4: p.q4, q5: p.q5, q6: p.q6,
        }
      }).sort((a,b) => (b.score||0) - (a.score||0)),
      stats, normes,
      groupesBesoins: Object.values(groupesMap),
    })
    setGenerating(false)
  }

  return (
    <>
      <Sidebar />
      <ImpersonationBar />
      <div className="ml-[260px] p-8 max-w-2xl min-h-screen bg-slate-50 relative z-0">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-blue-900">Générer un rapport</h2>
          <p className="text-slate-500 mt-1">Rapport PDF par classe et par période</p>
        </div>

        {loading ? <div className="text-slate-400">Chargement...</div> : (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-100">
              <h3 className="font-bold text-blue-900 mb-4">Paramètres</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Classe</label>
                  <select value={classeId} onChange={e => { setClasseId(e.target.value); setDonnees(null) }}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-600 bg-white">
                    {classes.map(c => <option key={c.id} value={c.id}>{c.nom} · {c.niveau}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Période</label>
                  <select value={periodeId} onChange={e => { setPeriodeId(e.target.value); setDonnees(null) }}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-600 bg-white">
                    {periodes.map(p => <option key={p.id} value={p.id}>{p.code} — {p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Comparer avec <span className="text-slate-400 font-normal">(optionnel)</span>
                  </label>
                  <select value={periodeCompId} onChange={e => { setPeriodeCompId(e.target.value); setDonnees(null) }}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-600 bg-white">
                    <option value="">— Aucune comparaison —</option>
                    {periodes.filter(p => p.id !== periodeId).map(p => (
                      <option key={p.id} value={p.id}>{p.code} — {p.label}</option>
                    ))}
                  </select>
                </div>
                <button onClick={genererRapport} disabled={generating}
                  className="w-full bg-blue-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-800 transition disabled:opacity-50">
                  {generating ? '⏳ Génération...' : '📊 Générer le rapport'}
                </button>
              </div>
            </div>

            {donnees && (
              <div className="bg-white rounded-2xl p-6 border border-slate-100">
                <h3 className="font-bold text-blue-900 mb-4">Rapport prêt ✅</h3>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-blue-900">{donnees.stats.moyenne ?? '—'}</p>
                    <p className="text-xs text-slate-500 mt-1">Score moyen</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-blue-900">{donnees.stats.nbEvalues}</p>
                    <p className="text-xs text-slate-500 mt-1">Évalués</p>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-orange-500">{donnees.stats.nbNE}</p>
                    <p className="text-xs text-slate-500 mt-1">Non évalués</p>
                  </div>
                </div>

                <PDFDownloadLink
                  document={<RapportPDF donnees={donnees} />}
                  fileName={`rapport-fluence-${donnees.classe}-${donnees.periode}.pdf`}>
                  {({ loading: pdfLoading }: { loading: boolean }) => (
                    <button className={`w-full py-4 rounded-xl font-bold text-lg transition
                      ${pdfLoading ? 'bg-slate-100 text-slate-400' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                      {pdfLoading ? '⏳ Préparation...' : '⬇️ Télécharger le PDF'}
                    </button>
                  )}
                </PDFDownloadLink>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export default function Rapport() {
  return (
    <Suspense fallback={<div className="ml-64 p-8 text-slate-400">Chargement...</div>}>
      <RapportContent />
    </Suspense>
  )
}