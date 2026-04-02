#!/usr/bin/env node
/**
 * Générateur de seed SQL pour FluenceApp
 * Produit ~600 élèves, ~4000 passations, 7 établissements, 3 années
 * Usage: node generate_seed.js > all_seeds.sql
 */

const crypto = require('crypto')
const uuid = () => crypto.randomUUID()

// ══════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════

const ANNEES = ['2023-2024', '2024-2025', '2025-2026']
const PERIODES_CODES = ['T1', 'T2', 'T3']
const NIVEAUX_PRIMAIRE = ['CP', 'CE1', 'CE2', 'CM1', 'CM2']
const NIVEAUX_COLLEGE = ['6eme', '5eme']

const NORMES = {
  CP:   { T1: {min:10,att:25},  T2: {min:25,att:50},  T3: {min:40,att:70} },
  CE1:  { T1: {min:40,att:65},  T2: {min:55,att:80},  T3: {min:70,att:95} },
  CE2:  { T1: {min:65,att:90},  T2: {min:75,att:100}, T3: {min:85,att:110} },
  CM1:  { T1: {min:80,att:105}, T2: {min:90,att:115}, T3: {min:95,att:120} },
  CM2:  { T1: {min:90,att:115}, T2: {min:100,att:125},T3: {min:105,att:130} },
  '6eme':{ T1: {min:100,att:125},T2: {min:110,att:135},T3: {min:115,att:140} },
  '5eme':{ T1: {min:110,att:135},T2: {min:115,att:140},T3: {min:120,att:145} },
}

// Noms guyanais
const NOMS = ['Apatou','Bambou','Lèse','Kalbou','Tauman','Apiku','Bosai','Fonsey','Fansi','Kaana','Potopu','Pulvar','Nébor','Chérubin','Eloi','Martin','Dubois','Bernard','Thomas','Petit','Robert','Richard','Durand','Moreau','Simon','Laurent','Michel','Lefebvre','Leroy','Roux','David','Bertrand','Morel','Fournier','Girard','Bonnet','Lambert','Fontaine','Rousseau','Vincent','Müller','Legrand','Garnier','Faure','Andre','Mercier','Blanc','Guyane','Cayenne','Isnard','Bossard','Diallo','Yanawale','Timon','Abati','Engolo','Peltan','Singa','Laville','Sambussy','Poty','Kouakou','Grenand','Baly','Kawak','Pelage']
const PRENOMS = ['Kévin','Loïc','Stevenson','Windys','Maëlys','Christelle','Dieudonnée','Fortuné','Grâce','Junior','Marie-Anne','Jean-Pierre','Sylvie','Patrick','Éric','Nathalie','David','Sophie','Laurent','Hélène','Pierre','Fatou','Anne-Marie','Claude','Jean-Paul','Monique','Roger','Valérie','Nadia','François','Marc','Isabelle','Carole','Sandrine','Thomas','Michel','Céline','René','Marie','André','Christine','Samuel','Thierry','Julie','Paul','Michèle','Bernard']

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = arr => arr[Math.floor(Math.random() * arr.length)]
const esc = s => s.replace(/'/g, "''")

// ══════════════════════════════════════════════════════════════
// ÉTABLISSEMENTS
// ══════════════════════════════════════════════════════════════

const etabs = [
  { id: uuid(), nom: 'École primaire Franck Lavinal', ville: 'Grand-Santi', type: 'école', circo: 'Maroni', niveaux: NIVEAUX_PRIMAIRE, classesParAn: 5, elevesParClasse: 23 },
  { id: uuid(), nom: 'École primaire Paul Isnard', ville: 'Grand-Santi', type: 'école', circo: 'Maroni', niveaux: NIVEAUX_PRIMAIRE, classesParAn: 4, elevesParClasse: 20 },
  { id: uuid(), nom: 'École primaire Prospérité', ville: 'Apatou', type: 'école', circo: 'Maroni', niveaux: NIVEAUX_PRIMAIRE, classesParAn: 3, elevesParClasse: 18 },
  { id: uuid(), nom: 'École primaire Abatoir', ville: 'Apatou', type: 'école', circo: 'Maroni', niveaux: ['CP','CE1','CE2'], classesParAn: 3, elevesParClasse: 15 },
  { id: uuid(), nom: 'École primaire Centre Bourg', ville: 'Saint-Laurent-du-Maroni', type: 'école', circo: 'Saint-Laurent', niveaux: NIVEAUX_PRIMAIRE, classesParAn: 4, elevesParClasse: 22 },
  { id: uuid(), nom: 'École primaire Balaté', ville: 'Saint-Laurent-du-Maroni', type: 'école', circo: 'Saint-Laurent', niveaux: NIVEAUX_PRIMAIRE, classesParAn: 4, elevesParClasse: 20 },
  { id: uuid(), nom: 'Collège Bertène Juminer', ville: 'Saint-Laurent-du-Maroni', type: 'collège', circo: 'Saint-Laurent', niveaux: NIVEAUX_COLLEGE,
    classesConfig: { '2023-2024': [{n:'6A',niv:'6eme'},{n:'6B',niv:'6eme'},{n:'6C',niv:'6eme'},{n:'5A',niv:'5eme'},{n:'5B',niv:'5eme'}],
                     '2024-2025': [{n:'6A',niv:'6eme'},{n:'6B',niv:'6eme'},{n:'6C',niv:'6eme'},{n:'5A',niv:'5eme'},{n:'5B',niv:'5eme'},{n:'5C',niv:'5eme'}],
                     '2025-2026': [{n:'6A',niv:'6eme'},{n:'6B',niv:'6eme'},{n:'6C',niv:'6eme'},{n:'6D',niv:'6eme'},{n:'5A',niv:'5eme'},{n:'5B',niv:'5eme'},{n:'5C',niv:'5eme'}] },
    elevesParClasse: 25 },
]

// ══════════════════════════════════════════════════════════════
// ENSEIGNANTS
// ══════════════════════════════════════════════════════════════

const enseignants = [
  // Franck Lavinal
  {id:uuid(),nom:'APATOU',prenom:'Marie',etabIdx:0},{id:uuid(),nom:'DEGRAD',prenom:'Sylvie',etabIdx:0},{id:uuid(),nom:'LALEYE',prenom:'Patrick',etabIdx:0},{id:uuid(),nom:'NOUTAI',prenom:'Carole',etabIdx:0},{id:uuid(),nom:'YAMAHA',prenom:'Éric',etabIdx:0},
  // Paul Isnard
  {id:uuid(),nom:'KAWAK',prenom:'Sandrine',etabIdx:1},{id:uuid(),nom:'PELAGE',prenom:'Thomas',etabIdx:1},{id:uuid(),nom:'FONTAN',prenom:'Isabelle',etabIdx:1},{id:uuid(),nom:'BRINGOLD',prenom:'René',etabIdx:1},
  // Prospérité
  {id:uuid(),nom:'ASSOUMOU',prenom:'Céline',etabIdx:2},{id:uuid(),nom:'PAPAI',prenom:'Michel',etabIdx:2},{id:uuid(),nom:'EDOUARD',prenom:'Nathalie',etabIdx:2},{id:uuid(),nom:'PONGREKUN',prenom:'David',etabIdx:2},
  // Abatoir
  {id:uuid(),nom:'BAYMAN',prenom:'Sophie',etabIdx:3},{id:uuid(),nom:'RIMBOTO',prenom:'Laurent',etabIdx:3},{id:uuid(),nom:'VALÈRE',prenom:'Hélène',etabIdx:3},
  // Centre Bourg
  {id:uuid(),nom:'YANAWALE',prenom:'Pierre',etabIdx:4},{id:uuid(),nom:'DIALLO',prenom:'Fatou',etabIdx:4},{id:uuid(),nom:'BOSSARD',prenom:'Anne-Marie',etabIdx:4},{id:uuid(),nom:'TIMON',prenom:'Claude',etabIdx:4},
  // Balaté
  {id:uuid(),nom:'ABATI',prenom:'Jean-Paul',etabIdx:5},{id:uuid(),nom:'ENGOLO',prenom:'Monique',etabIdx:5},{id:uuid(),nom:'PELTAN',prenom:'Roger',etabIdx:5},{id:uuid(),nom:'SINGA',prenom:'Valérie',etabIdx:5},
  // Collège
  {id:uuid(),nom:'LAVILLE',prenom:'Nadia',etabIdx:6},{id:uuid(),nom:'DEULET',prenom:'François',etabIdx:6},{id:uuid(),nom:'ENET',prenom:'Carole',etabIdx:6},{id:uuid(),nom:'SAMBUSSY',prenom:'Marc',etabIdx:6},
  {id:uuid(),nom:'POTY',prenom:'Sylvie',etabIdx:6},{id:uuid(),nom:'KOUAKOU',prenom:'Éric',etabIdx:6},{id:uuid(),nom:'GRENAND',prenom:'Isabelle',etabIdx:6},{id:uuid(),nom:'BALY',prenom:'Patrick',etabIdx:6},
]

// Direction
const directeurs = [
  {id:uuid(),nom:'PETITJEAN',prenom:'Julie',role:'directeur',etabIdx:0},
  {id:uuid(),nom:'BÉCOT',prenom:'André',role:'directeur',etabIdx:1},
  {id:uuid(),nom:'ALAMA',prenom:'Christine',role:'directeur',etabIdx:2},
  {id:uuid(),nom:'BOYOT',prenom:'Samuel',role:'directeur',etabIdx:3},
  {id:uuid(),nom:'SADI',prenom:'Marie-France',role:'directeur',etabIdx:4},
  {id:uuid(),nom:'DUPOUX',prenom:'Thierry',role:'directeur',etabIdx:5},
  {id:uuid(),nom:'LESPINASSE',prenom:'François',role:'principal',etabIdx:6},
]

// Réseau
const reseau = [
  {id:uuid(),nom:'AMÉRALI',prenom:'Paul',role:'coordo_rep'},
  {id:uuid(),nom:'DELMAS',prenom:'Michèle',role:'ien'},
  {id:uuid(),nom:'CROC',prenom:'Bernard',role:'ia_dasen'},
]

// ══════════════════════════════════════════════════════════════
// GÉNÉRATION DES CLASSES
// ══════════════════════════════════════════════════════════════

const allClasses = [] // { id, etabIdx, nom, niveau, annee }
const allPeriodes = [] // { id, code, etabIdx, annee, actif }

for (const etab of etabs) {
  for (const annee of ANNEES) {
    const actif = annee === '2025-2026'

    // Périodes
    for (const code of PERIODES_CODES) {
      allPeriodes.push({ id: uuid(), code, label: `Trimestre ${code[1]}`, etabIdx: etabs.indexOf(etab), annee, actif })
    }

    // Classes
    if (etab.classesConfig) {
      for (const c of etab.classesConfig[annee]) {
        allClasses.push({ id: uuid(), etabIdx: etabs.indexOf(etab), nom: c.n, niveau: c.niv, annee })
      }
    } else {
      const niveauxUtilises = etab.niveaux.slice(0, etab.classesParAn)
      const letters = 'ABCDE'
      for (let i = 0; i < etab.classesParAn; i++) {
        const niv = niveauxUtilises[i % niveauxUtilises.length]
        const letter = letters[Math.floor(i / niveauxUtilises.length)] || 'A'
        allClasses.push({ id: uuid(), etabIdx: etabs.indexOf(etab), nom: `${niv}-${letter}`, niveau: niv, annee })
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════
// GÉNÉRATION DES ÉLÈVES
// ══════════════════════════════════════════════════════════════

const allEleves = [] // { id, nom, prenom, ine, sexe }
const allAffectations = [] // { id, eleveId, classeId, annee, actif }
let ineCounter = 1000000

function genINE() {
  ineCounter++
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  return `${ineCounter}${letters[rand(0,25)]}${letters[rand(0,25)]}`
}

// Cas de test obligatoires
const casTests = [
  { nom: 'APIKU', prenom: 'Stevenson', ine: '1234567AA', scenario: 'progression' },
  { nom: 'BAMBOU', prenom: 'Windys', ine: '2345678BB', scenario: 'redouble' },
  { nom: 'FONSEY', prenom: 'Grâce', ine: '3456789CC', scenario: 'transition' },
  { nom: 'DUBOIS', prenom: 'Marie-Anne', ine: '4567890DD', scenario: 'changement_nom' },
  { nom: 'BOSAI', prenom: 'Junior', ine: '5678901EE', scenario: 'grande_difficulte' },
  { nom: 'MARTIN', prenom: 'Maëlys', ine: '6789012FF', scenario: 'excellent' },
]

// Générer élèves par établissement
for (const etab of etabs) {
  const eIdx = etabs.indexOf(etab)

  for (const annee of ANNEES) {
    const classesAnnee = allClasses.filter(c => c.etabIdx === eIdx && c.annee === annee)

    for (const classe of classesAnnee) {
      const nbEleves = etab.elevesParClasse + rand(-3, 3)

      for (let i = 0; i < nbEleves; i++) {
        // Vérifier si c'est un élève existant qui continue ou un nouveau
        let eleve = null

        if (annee !== '2023-2024' && Math.random() < 0.85) {
          // Chercher un élève de l'année précédente de cet établissement sans affectation cette année
          const prevAnnee = annee === '2024-2025' ? '2023-2024' : '2024-2025'
          const available = allEleves.filter(e => {
            const hasPrev = allAffectations.some(a => a.eleveId === e.id && a.annee === prevAnnee && allClasses.find(c => c.id === a.classeId)?.etabIdx === eIdx)
            const hasCurrent = allAffectations.some(a => a.eleveId === e.id && a.annee === annee)
            return hasPrev && !hasCurrent
          })
          if (available.length > 0) eleve = pick(available)
        }

        if (!eleve) {
          // Nouveau
          eleve = { id: uuid(), nom: pick(NOMS).toUpperCase(), prenom: pick(PRENOMS), ine: genINE(), sexe: Math.random() < 0.5 ? 'M' : 'F' }
          allEleves.push(eleve)
        }

        allAffectations.push({ id: uuid(), eleveId: eleve.id, classeId: classe.id, annee, actif: true })
      }
    }
  }
}

// Ajouter les cas de test
for (const ct of casTests) {
  let el = allEleves.find(e => e.ine === ct.ine)
  if (!el) {
    el = { id: uuid(), nom: ct.nom, prenom: ct.prenom, ine: ct.ine, sexe: 'M' }
    allEleves.push(el)
  } else {
    el.nom = ct.nom; el.prenom = ct.prenom
  }

  // Supprimer les affectations existantes pour cet élève
  const existIdx = allAffectations.findIndex(a => a.eleveId === el.id)
  while (allAffectations.findIndex(a => a.eleveId === el.id) >= 0) {
    allAffectations.splice(allAffectations.findIndex(a => a.eleveId === el.id), 1)
  }

  if (ct.scenario === 'progression') {
    // Stevenson : CP → CE1 → CE2 à Franck Lavinal
    for (let y = 0; y < 3; y++) {
      const niv = ['CP','CE1','CE2'][y]
      const cls = allClasses.find(c => c.etabIdx === 0 && c.annee === ANNEES[y] && c.niveau === niv)
      if (cls) allAffectations.push({ id: uuid(), eleveId: el.id, classeId: cls.id, annee: ANNEES[y], actif: true })
    }
  } else if (ct.scenario === 'redouble') {
    // Windys : CP → CP → CE1 à Paul Isnard
    const nivs = ['CP','CP','CE1']
    for (let y = 0; y < 3; y++) {
      const cls = allClasses.find(c => c.etabIdx === 1 && c.annee === ANNEES[y] && c.niveau === nivs[y])
      if (cls) allAffectations.push({ id: uuid(), eleveId: el.id, classeId: cls.id, annee: ANNEES[y], actif: true })
    }
  } else if (ct.scenario === 'transition') {
    // Grâce : CM2 Centre Bourg → 6ème Collège
    const cm2 = allClasses.find(c => c.etabIdx === 4 && c.annee === '2024-2025' && c.niveau === 'CM2')
    const sixieme = allClasses.find(c => c.etabIdx === 6 && c.annee === '2025-2026' && c.niveau === '6eme')
    if (cm2) allAffectations.push({ id: uuid(), eleveId: el.id, classeId: cm2.id, annee: '2024-2025', actif: true })
    if (sixieme) allAffectations.push({ id: uuid(), eleveId: el.id, classeId: sixieme.id, annee: '2025-2026', actif: true })
  } else if (ct.scenario === 'changement_nom') {
    // Marie-Anne : même élève, nom change en 2025-2026
    const cls24 = allClasses.find(c => c.etabIdx === 4 && c.annee === '2024-2025' && c.niveau === 'CE2')
    const cls25 = allClasses.find(c => c.etabIdx === 4 && c.annee === '2025-2026' && c.niveau === 'CM1')
    if (cls24) allAffectations.push({ id: uuid(), eleveId: el.id, classeId: cls24.id, annee: '2024-2025', actif: true })
    if (cls25) allAffectations.push({ id: uuid(), eleveId: el.id, classeId: cls25.id, annee: '2025-2026', actif: true })
  } else {
    // Junior & Maëlys : CP → CE1 → CE2 à Balaté
    for (let y = 0; y < 3; y++) {
      const niv = ['CP','CE1','CE2'][y]
      const cls = allClasses.find(c => c.etabIdx === 5 && c.annee === ANNEES[y] && c.niveau === niv)
      if (cls) allAffectations.push({ id: uuid(), eleveId: el.id, classeId: cls.id, annee: ANNEES[y], actif: true })
    }
  }
}

// ══════════════════════════════════════════════════════════════
// GÉNÉRATION DES PASSATIONS
// ══════════════════════════════════════════════════════════════

const allPassations = []

for (const aff of allAffectations) {
  const classe = allClasses.find(c => c.id === aff.classeId)
  if (!classe) continue
  const etab = etabs[classe.etabIdx]
  const niveau = classe.niveau
  const annee = aff.annee
  const normesNiveau = NORMES[niveau]
  if (!normesNiveau) continue

  // Pour chaque période de cette année/étab
  const periodes = allPeriodes.filter(p => p.etabIdx === classe.etabIdx && p.annee === annee)

  let prevScore = null
  for (const per of periodes) {
    const n = normesNiveau[per.code]
    if (!n) continue

    // 5% absent, 3% non évalué
    const r = Math.random()
    if (r < 0.05) {
      allPassations.push({ id: uuid(), eleveId: aff.eleveId, periodeId: per.id, classeId: classe.id, score: null, ne: false, absent: true, mode: 'saisie', q1:null,q2:null,q3:null,q4:null,q5:null,q6:null })
      continue
    }
    if (r < 0.08) {
      allPassations.push({ id: uuid(), eleveId: aff.eleveId, periodeId: per.id, classeId: classe.id, score: null, ne: true, absent: false, mode: 'saisie', q1:null,q2:null,q3:null,q4:null,q5:null,q6:null })
      continue
    }

    // Score basé sur distribution
    let score
    const eleve = allEleves.find(e => e.id === aff.eleveId)
    const isBosai = eleve?.ine === '5678901EE'
    const isMaelys = eleve?.ine === '6789012FF'

    if (isBosai) {
      score = rand(Math.round(n.min * 0.3), Math.round(n.min * 0.8))
    } else if (isMaelys) {
      score = rand(Math.round(n.att * 1.1), Math.round(n.att * 1.4))
    } else {
      const bucket = Math.random()
      if (bucket < 0.20) score = rand(Math.round(n.min * 0.3), n.min)
      else if (bucket < 0.50) score = rand(n.min, Math.round(n.att * 0.75))
      else if (bucket < 0.85) score = rand(Math.round(n.att * 0.75), Math.round(n.att * 1.2))
      else score = rand(Math.round(n.att * 1.2), Math.round(n.att * 1.5))
    }

    // Progression par rapport au T précédent
    if (prevScore != null && !isBosai) {
      const prog = rand(3, 15)
      if (Math.random() < 0.05) score = prevScore - rand(2, 8) // 5% régression
      else score = Math.max(score, prevScore + prog)
    }
    score = Math.max(1, score)
    prevScore = score

    // QCM (CE2+)
    let q1=null,q2=null,q3=null,q4=null,q5=null,q6=null
    if (['CE2','CM1','CM2','6eme','5eme'].includes(niveau)) {
      const pctCorrect = score >= n.att ? rand(70,100) : score >= n.min ? rand(30,70) : rand(0,40)
      const makeQ = () => Math.random() * 100 < pctCorrect ? 'Correct' : 'Incorrect'
      q1=makeQ();q2=makeQ();q3=makeQ();q4=makeQ();q5=makeQ();q6=makeQ()
    }

    const mode = Math.random() < 0.6 ? 'saisie' : 'passation'
    allPassations.push({ id: uuid(), eleveId: aff.eleveId, periodeId: per.id, classeId: classe.id, score, ne: false, absent: false, mode, q1,q2,q3,q4,q5,q6 })
  }
}

// ══════════════════════════════════════════════════════════════
// SORTIE SQL
// ══════════════════════════════════════════════════════════════

const out = []
out.push('-- ══════════════════════════════════════════════════════════════')
out.push('-- SEED COMPLET FluenceApp — généré automatiquement')
out.push(`-- ${allEleves.length} élèves, ${allAffectations.length} affectations, ${allPassations.length} passations`)
out.push(`-- ${allClasses.length} classes, ${allPeriodes.length} périodes, ${etabs.length} établissements`)
out.push('-- ══════════════════════════════════════════════════════════════')
out.push('')

// Établissements
out.push('-- ── ÉTABLISSEMENTS ──')
for (const e of etabs) {
  out.push(`INSERT INTO etablissements (id, nom, type, ville, circonscription) VALUES ('${e.id}', '${esc(e.nom)}', '${e.type}', '${esc(e.ville)}', '${esc(e.circo)}') ON CONFLICT DO NOTHING;`)
}
out.push('')

// Profils enseignants
out.push('-- ── PROFILS ENSEIGNANTS ──')
for (const e of enseignants) {
  out.push(`INSERT INTO profils (id, nom, prenom, role, etablissement_id, onboarding_done) VALUES ('${e.id}', '${esc(e.nom)}', '${esc(e.prenom)}', 'enseignant', '${etabs[e.etabIdx].id}', true) ON CONFLICT DO NOTHING;`)
}
out.push('')

// Direction
out.push('-- ── PROFILS DIRECTION ──')
for (const d of directeurs) {
  out.push(`INSERT INTO profils (id, nom, prenom, role, etablissement_id, onboarding_done) VALUES ('${d.id}', '${esc(d.nom)}', '${esc(d.prenom)}', '${d.role}', '${etabs[d.etabIdx].id}', true) ON CONFLICT DO NOTHING;`)
}
out.push('')

// Réseau
out.push('-- ── PROFILS RÉSEAU ──')
for (const r of reseau) {
  out.push(`INSERT INTO profils (id, nom, prenom, role, onboarding_done) VALUES ('${r.id}', '${esc(r.nom)}', '${esc(r.prenom)}', '${r.role}', true) ON CONFLICT DO NOTHING;`)
}
out.push('')

// Coordo/IEN affectations
out.push(`INSERT INTO coordo_etablissements (coordo_id, etablissement_id) SELECT '${reseau[0].id}', id FROM etablissements ON CONFLICT DO NOTHING;`)
out.push(`INSERT INTO ien_etablissements (ien_id, etablissement_id) SELECT '${reseau[1].id}', id FROM etablissements ON CONFLICT DO NOTHING;`)
out.push('')

// Périodes
out.push('-- ── PÉRIODES ──')
for (const p of allPeriodes) {
  out.push(`INSERT INTO periodes (id, code, label, etablissement_id, annee_scolaire, actif, saisie_ouverte, type) VALUES ('${p.id}', '${p.code}', '${esc(p.label)}', '${etabs[p.etabIdx].id}', '${p.annee}', ${p.actif}, ${p.actif}, 'regular') ON CONFLICT DO NOTHING;`)
}
out.push('')

// Classes
out.push('-- ── CLASSES ──')
for (const c of allClasses) {
  out.push(`INSERT INTO classes (id, nom, niveau, etablissement_id, annee_scolaire) VALUES ('${c.id}', '${esc(c.nom)}', '${c.niveau}', '${etabs[c.etabIdx].id}', '${c.annee}') ON CONFLICT DO NOTHING;`)
}
out.push('')

// Enseignant-Classes (assigner enseignants aux classes)
out.push('-- ── ENSEIGNANT_CLASSES ──')
for (const etab of etabs) {
  const eIdx = etabs.indexOf(etab)
  const ensEtab = enseignants.filter(e => e.etabIdx === eIdx)
  for (const annee of ANNEES) {
    const classesAnnee = allClasses.filter(c => c.etabIdx === eIdx && c.annee === annee)
    for (let i = 0; i < classesAnnee.length; i++) {
      const ens = ensEtab[i % ensEtab.length]
      out.push(`INSERT INTO enseignant_classes (enseignant_id, classe_id) VALUES ('${ens.id}', '${classesAnnee[i].id}') ON CONFLICT DO NOTHING;`)
    }
  }
}
out.push('')

// Élèves
out.push('-- ── ÉLÈVES ──')
// classe_id = dernière affectation active
for (const e of allEleves) {
  const lastAff = allAffectations.filter(a => a.eleveId === e.id).sort((a,b) => a.annee.localeCompare(b.annee)).pop()
  const classeId = lastAff ? lastAff.classeId : allClasses[0].id
  const nom = e.ine === '4567890DD' ? 'DUBOIS-KALBOU' : e.nom
  out.push(`INSERT INTO eleves (id, nom, prenom, numero_ine, sexe, classe_id, actif) VALUES ('${e.id}', '${esc(nom)}', '${esc(e.prenom)}', '${e.ine}', '${e.sexe}', '${classeId}', true) ON CONFLICT DO NOTHING;`)
}
out.push('')

// Affectations
out.push('-- ── AFFECTATIONS ──')
for (const a of allAffectations) {
  out.push(`INSERT INTO affectations (id, eleve_id, classe_id, annee_scolaire, actif) VALUES ('${a.id}', '${a.eleveId}', '${a.classeId}', '${a.annee}', ${a.actif}) ON CONFLICT DO NOTHING;`)
}
out.push('')

// Config normes
out.push('-- ── NORMES ──')
for (const [niveau, periodeNormes] of Object.entries(NORMES)) {
  for (const [code, seuils] of Object.entries(periodeNormes)) {
    // Pour chaque établissement × année
    for (const per of allPeriodes.filter(p => p.code === code)) {
      out.push(`INSERT INTO config_normes (niveau, periode_id, seuil_min, seuil_attendu) VALUES ('${niveau}', '${per.id}', ${seuils.min}, ${seuils.att}) ON CONFLICT DO NOTHING;`)
    }
  }
}
out.push('')

// Passations
out.push('-- ── PASSATIONS ──')
for (const p of allPassations) {
  const qStr = [p.q1,p.q2,p.q3,p.q4,p.q5,p.q6].map(q => q ? `'${q}'` : 'NULL').join(', ')
  out.push(`INSERT INTO passations (id, eleve_id, periode_id, classe_id, score, non_evalue, absent, mode, hors_periode, q1, q2, q3, q4, q5, q6) VALUES ('${p.id}', '${p.eleveId}', '${p.periodeId}', '${p.classeId}', ${p.score ?? 'NULL'}, ${p.ne}, ${p.absent}, '${p.mode}', false, ${qStr}) ON CONFLICT DO NOTHING;`)
}
out.push('')

// Invitations
out.push('-- ── INVITATIONS ──')
for (const etab of etabs) {
  const code1 = 'ENS' + etab.nom.substring(0,3).toUpperCase().replace(/[^A-Z]/g,'') + '26'
  const code2 = 'DIR' + etab.nom.substring(0,3).toUpperCase().replace(/[^A-Z]/g,'') + '26'
  out.push(`INSERT INTO invitations (code, etablissement_id, role, actif) VALUES ('${code1}', '${etab.id}', 'enseignant', true) ON CONFLICT DO NOTHING;`)
  out.push(`INSERT INTO invitations (code, etablissement_id, role, actif) VALUES ('${code2}', '${etab.id}', 'directeur', true) ON CONFLICT DO NOTHING;`)
}
out.push(`INSERT INTO invitations (code, role, actif) VALUES ('COORDO2026', 'coordo_rep', true) ON CONFLICT DO NOTHING;`)
out.push(`INSERT INTO invitations (code, role, actif) VALUES ('WESTHAM2026', 'admin', true) ON CONFLICT DO NOTHING;`)
out.push('')

// Stats
out.push(`-- ══════════════════════════════════════════════════════════════`)
out.push(`-- STATS: ${allEleves.length} élèves, ${allAffectations.length} affectations, ${allPassations.length} passations`)
out.push(`-- ${allClasses.length} classes, ${allPeriodes.length} périodes, ${etabs.length} établissements`)
out.push(`-- ══════════════════════════════════════════════════════════════`)

console.log(out.join('\n'))
