'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useRouter } from 'next/navigation'

type EleveCSV = {
  ine: string
  etablissement: string
  nom: string
  prenom: string
  ddn: string
  sexe: string
  niveau: string
  classe: string
  groupe: string
}

export default function Import() {
  const [etape, setEtape] = useState<'upload' | 'apercu' | 'import' | 'done'>('upload')
  const [eleves, setEleves] = useState<EleveCSV[]>([])
  const [erreur, setErreur] = useState('')
  const [progression, setProgression] = useState(0)
  const [stats, setStats] = useState({ importes: 0, classes: 0, erreurs: 0 })
  const router = useRouter()
  const supabase = createClient()

  function parseCSV(texte: string): EleveCSV[] {
    const lignes = texte.trim().split('\n')
    const entetes = lignes[0].split(';').map(h => h.trim().toLowerCase()
      .replace('é','e').replace('è','e').replace('ê','e').replace('ô','o').replace('î','i').replace('prénom','prenom').replace('établissement','etablissement').replace('date de naissance','ddn'))
    
    return lignes.slice(1).map(ligne => {
      const cols = ligne.split(';').map(c => c.trim().replace(/^"|"$/g, ''))
      const obj: any = {}
      entetes.forEach((h, i) => { obj[h] = cols[i] || '' })
      return {
        ine:           obj['ine'] || '',
        etablissement: obj['etablissement'] || '',
        nom:           obj['nom'] || '',
        prenom:        obj['prenom'] || '',
        ddn:           obj['ddn'] || '',
        sexe:          obj['sexe'] || '',
        niveau:        obj['niveau'] || '',
        classe:        obj['classe'] || '',
        groupe:        obj['groupe'] || '',
      }
    }).filter(e => e.nom && e.prenom)
  }

  function handleFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    if (!fichier) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const texte = ev.target?.result as string
        const data  = parseCSV(texte)
        if (data.length === 0) {
          setErreur('Aucun élève trouvé. Vérifiez le format du fichier (séparateur point-virgule).')
          return
        }
        setEleves(data)
        setErreur('')
        setEtape('apercu')
      } catch(err) {
        setErreur('Erreur lors de la lecture du fichier.')
      }
    }
    reader.readAsText(fichier, 'UTF-8')
  }

  async function lancerImport() {
    setEtape('import')
    setProgression(0)

    let nbImportes = 0
    let nbErreurs  = 0
    const classesCreees = new Set<string>()

    // Récupérer l'établissement
    const { data: etabData } = await supabase
      .from('etablissements')
      .select('id, nom')
      .limit(10)

    if (!etabData || etabData.length === 0) {
      setErreur('Aucun établissement trouvé. Créez-en un d\'abord.')
      setEtape('apercu')
      return
    }

    // Mapper établissement par nom
    const etabMap: Record<string, string> = {}
    etabData.forEach(e => { etabMap[e.nom.toLowerCase()] = e.id })

    // Récupérer les classes existantes
    const { data: classesExist } = await supabase
      .from('classes')
      .select('id, nom, niveau, etablissement_id')

    const classeMap: Record<string, string> = {}
    classesExist?.forEach(c => {
      classeMap[`${c.etablissement_id}|${c.nom}`] = c.id
    })

    // Traiter par batch de 10
    const total = eleves.length

    for (let i = 0; i < eleves.length; i++) {
      const eleve = eleves[i]

      try {
        // Trouver l'établissement
        const etabNom  = eleve.etablissement.toLowerCase()
        let   etabId   = etabMap[etabNom]

        // Si pas trouvé, prendre le premier
        if (!etabId) etabId = etabData[0].id

        // Nom de la classe (groupe si disponible, sinon classe)
        const nomClasse = eleve.groupe && eleve.groupe.trim() !== '' 
          ? eleve.groupe.trim() 
          : eleve.classe.trim()

        // Créer la classe si elle n'existe pas
        const classeKey = `${etabId}|${nomClasse}`
        if (!classeMap[classeKey]) {
          const { data: nouvelleClasse } = await supabase
            .from('classes')
            .insert({
              nom:             nomClasse,
              niveau:          eleve.niveau,
              etablissement_id: etabId,
              annee_scolaire:  '2025-2026'
            })
            .select('id')
            .single()

          if (nouvelleClasse) {
            classeMap[classeKey] = nouvelleClasse.id
            classesCreees.add(nomClasse)
          }
        }

        const classeId = classeMap[classeKey]
        if (!classeId) { nbErreurs++; continue }

        // Insérer l'élève
        const { error } = await supabase
          .from('eleves')
          .upsert({
            ine:       eleve.ine || null,
            nom:       eleve.nom.toUpperCase(),
            prenom:    eleve.prenom,
            classe_id: classeId,
            actif:     true
          }, { onConflict: 'ine', ignoreDuplicates: false })

        if (error) nbErreurs++
        else nbImportes++

      } catch(err) {
        nbErreurs++
      }

      setProgression(Math.round((i + 1) / total * 100))
    }

    setStats({ importes: nbImportes, classes: classesCreees.size, erreurs: nbErreurs })
    setEtape('done')
  }

  // Résumé pour l'aperçu
  const classesUniques = [...new Set(eleves.map(e => e.groupe && e.groupe.trim() !== '' ? e.groupe : e.classe))]
  const niveauxUniques = [...new Set(eleves.map(e => e.niveau))]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-blue-900 text-white p-6">
        <div className="mb-8">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mb-3">
            <span className="text-blue-900 font-bold text-lg">F</span>
          </div>
          <h1 className="font-bold text-lg">Test de Fluence</h1>
          <p className="text-blue-300 text-xs mt-1">Académie de Guyane</p>
        </div>
        <nav className="space-y-1">
          <a href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 text-sm font-medium transition">
            📊 Tableau de bord
          </a>
          <a href="/dashboard/eleves" className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800 text-sm font-medium transition">
            👥 Mes élèves
          </a>
          <a href="/dashboard/import" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-800 text-white text-sm font-medium">
            📥 Importer
          </a>
        </nav>
      </div>

      {/* Main */}
      <div className="ml-64 p-8 max-w-3xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-blue-900">Importer des élèves</h2>
          <p className="text-slate-500 mt-1">Fichier CSV avec séparateur point-virgule</p>
        </div>

        {/* Étapes */}
        <div className="flex items-center gap-3 mb-8">
          {['upload','apercu','import','done'].map((e, i) => (
            <div key={e} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                ${etape === e ? 'bg-blue-900 text-white' : 
                  ['upload','apercu','import','done'].indexOf(etape) > i ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                {['upload','apercu','import','done'].indexOf(etape) > i ? '✓' : i + 1}
              </div>
              <span className={`text-sm font-medium ${etape === e ? 'text-blue-900' : 'text-slate-400'}`}>
                {['Fichier','Aperçu','Import','Terminé'][i]}
              </span>
              {i < 3 && <div className="w-8 h-px bg-slate-200"/>}
            </div>
          ))}
        </div>

        {/* Étape 1 : Upload */}
        {etape === 'upload' && (
          <div className="bg-white rounded-2xl p-8 border-2 border-dashed border-slate-200 text-center">
            <div className="text-5xl mb-4">📄</div>
            <h3 className="font-bold text-blue-900 mb-2">Sélectionnez votre fichier CSV</h3>
            <p className="text-slate-400 text-sm mb-6">
              Colonnes attendues : INE, Etablissement, Nom, Prénom, Date de naissance, Sexe, Niveau, Classe, Groupe
            </p>
            {erreur && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
                {erreur}
              </div>
            )}
            <label className="cursor-pointer bg-blue-900 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-blue-800 transition inline-block">
              Choisir un fichier
              <input type="file" accept=".csv" onChange={handleFichier} className="hidden"/>
            </label>
          </div>
        )}

        {/* Étape 2 : Aperçu */}
        {etape === 'apercu' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-4 border border-slate-100 text-center">
                <p className="text-3xl font-bold text-blue-900">{eleves.length}</p>
                <p className="text-sm text-slate-400 mt-1">Élèves détectés</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-100 text-center">
                <p className="text-3xl font-bold text-blue-900">{classesUniques.length}</p>
                <p className="text-sm text-slate-400 mt-1">Classes</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-100 text-center">
                <p className="text-3xl font-bold text-blue-900">{niveauxUniques.length}</p>
                <p className="text-sm text-slate-400 mt-1">Niveaux</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 font-semibold text-blue-900 text-sm">
                Aperçu (10 premiers élèves)
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">NOM</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">PRÉNOM</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">NIVEAU</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">CLASSE</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">GROUPE</th>
                  </tr>
                </thead>
                <tbody>
                  {eleves.slice(0, 10).map((e, i) => (
                    <tr key={i} className="border-t border-slate-50">
                      <td className="px-4 py-3 font-semibold text-blue-900">{e.nom}</td>
                      <td className="px-4 py-3 text-slate-600">{e.prenom}</td>
                      <td className="px-4 py-3 text-slate-500">{e.niveau}</td>
                      <td className="px-4 py-3 text-slate-500">{e.classe}</td>
                      <td className="px-4 py-3 text-slate-400">{e.groupe || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setEtape('upload')}
                className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl font-semibold text-sm hover:bg-slate-50 transition">
                ← Recommencer
              </button>
              <button onClick={lancerImport}
                className="flex-1 bg-blue-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-800 transition">
                Importer {eleves.length} élèves →
              </button>
            </div>
          </div>
        )}

        {/* Étape 3 : Import en cours */}
        {etape === 'import' && (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
            <div className="text-4xl mb-4">⏳</div>
            <h3 className="font-bold text-blue-900 mb-2">Import en cours...</h3>
            <p className="text-slate-400 text-sm mb-6">{progression}% — Ne fermez pas cette page</p>
            <div className="w-full bg-slate-100 rounded-full h-3">
              <div className="bg-blue-900 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progression}%` }}/>
            </div>
          </div>
        )}

        {/* Étape 4 : Terminé */}
        {etape === 'done' && (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="font-bold text-blue-900 text-xl mb-6">Import terminé !</h3>
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-3xl font-bold text-green-700">{stats.importes}</p>
                <p className="text-sm text-green-600 mt-1">Élèves importés</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-3xl font-bold text-blue-700">{stats.classes}</p>
                <p className="text-sm text-blue-600 mt-1">Classes créées</p>
              </div>
              <div className={`${stats.erreurs > 0 ? 'bg-red-50' : 'bg-slate-50'} rounded-xl p-4`}>
                <p className={`text-3xl font-bold ${stats.erreurs > 0 ? 'text-red-700' : 'text-slate-400'}`}>{stats.erreurs}</p>
                <p className={`text-sm mt-1 ${stats.erreurs > 0 ? 'text-red-600' : 'text-slate-400'}`}>Erreurs</p>
              </div>
            </div>
            <button onClick={() => router.push('/dashboard/eleves')}
              className="bg-blue-900 text-white px-8 py-3 rounded-xl font-semibold text-sm hover:bg-blue-800 transition">
              Voir mes élèves →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}