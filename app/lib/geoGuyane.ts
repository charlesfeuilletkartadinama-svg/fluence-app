// Référence archivée — données géographiques Académie de Guyane
// La géographie est désormais gérée dynamiquement via Supabase (tables departements / circonscriptions / villes)
// Ce fichier n'est plus importé dans l'application.

const _GEO_DATA_ARCHIVE: Record<string, Record<string, string[]>> = {
  'Guyane (973)': {
    'Cayenne 1 – Saül':                                    ['Cayenne', 'Saül'],
    'Cayenne 2 – Roura – Cacao':                           ['Roura', 'Cacao'],
    'Rémire-Montjoly – Matoury (partie)':                  ['Rémire-Montjoly'],
    'Matoury – Régina – Oyapock':                          ['Matoury', 'Régina', "Saint-Georges-de-l'Oyapock", 'Ouanary', 'Camopi'],
    'Macouria – Montsinéry-Tonnégrande':                   ['Macouria', 'Montsinéry-Tonnégrande'],
    'Kourou 1':                                            ['Kourou'],
    'Kourou 2 – Sinnamary – Iracoubo':                     ['Sinnamary', 'Iracoubo'],
    'Maroni (Haut-Maroni)':                                ['Grand-Santi', 'Papaichton', 'Maripasoula'],
    'Saint-Laurent-du-Maroni 1':                           ['Saint-Laurent-du-Maroni'],
    'Saint-Laurent-du-Maroni 2 – Apatou':                  ['Apatou'],
    'Saint-Laurent-du-Maroni 3 – Mana – Awala-Yalimapo':   ['Mana', 'Awala-Yalimapo'],
  },
}

type EtablissementSeed = {
  nom: string
  type: 'école' | 'collège'
  ville: string
  circonscription: string
  departement: string
}

const _ETABLISSEMENTS_ARCHIVE: EtablissementSeed[] = [

  // ── Circonscription 1 : Cayenne 1 – Saül ──────────────────────────────────
  // Cayenne — élémentaires pub
  { nom: 'Élémentaire Etienne Ribal',                     type: 'école',   ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: 'Élémentaire Eliette Danglades',                 type: 'école',   ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: "Élémentaire Stéphan Phinera-Horth",             type: 'école',   ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: 'Élémentaire Marie Lucette Boris',               type: 'école',   ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: 'Élémentaire Maximilien Saba',                   type: 'école',   ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: 'Élémentaire Henri Agarande',                    type: 'école',   ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: "Élémentaire d'application Just Hyasine",        type: 'école',   ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: 'Élémentaire Edmard Malacarnet',                 type: 'école',   ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: "Élémentaire d'application Jean Macé",           type: 'école',   ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: 'Élémentaire Gaëtan Hermine',                    type: 'école',   ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: 'Élémentaire Mariette Bernude',                  type: 'école',   ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: 'Élémentaire Léopold Héder',                     type: 'école',   ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: 'Groupe Scolaire Mortin',                        type: 'école',   ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: 'Élémentaire René Barthélemi',                   type: 'école',   ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: 'Élémentaire Samuel Chambaud',                   type: 'école',   ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: 'Élémentaire Alexandrine Stanislas',             type: 'école',   ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: 'Élémentaire Mont-Lucas',                        type: 'école',   ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: 'Élémentaire Vendôme',                           type: 'école',   ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  // Cayenne — collèges pub
  { nom: 'Collège Paul Kapel',                            type: 'collège', ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: 'Collège Gérard Holder',                         type: 'collège', ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: 'Collège Justin Catayée (Cayenne V)',            type: 'collège', ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: 'Collège Eugène Nonnon',                         type: 'collège', ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: 'Collège Auxence Contout',                       type: 'collège', ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  // Cayenne — privé
  { nom: 'Élémentaire Adventiste La Persévérance',        type: 'école',   ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: 'Élémentaire Externat Saint Joseph',             type: 'école',   ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: 'Élémentaire Anne-Marie Javouhey',               type: 'école',   ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  { nom: 'Collège Externat Saint-Joseph de Cluny',        type: 'collège', ville: 'Cayenne',               circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },
  // Saül
  { nom: 'Élémentaire de Saül',                           type: 'école',   ville: 'Saül',                  circonscription: 'Cayenne 1 – Saül',                                    departement: 'Guyane (973)' },

  // ── Circonscription 2 : Cayenne 2 – Roura – Cacao ─────────────────────────
  { nom: 'Élémentaire Augustine Duchange',                type: 'école',   ville: 'Roura',                 circonscription: 'Cayenne 2 – Roura – Cacao',                            departement: 'Guyane (973)' },
  { nom: 'Élémentaire Saint Paul',                        type: 'école',   ville: 'Roura',                 circonscription: 'Cayenne 2 – Roura – Cacao',                            departement: 'Guyane (973)' },
  { nom: 'Collège Saint-Paul',                            type: 'collège', ville: 'Roura',                 circonscription: 'Cayenne 2 – Roura – Cacao',                            departement: 'Guyane (973)' },
  { nom: 'Élémentaire de Cacao',                          type: 'école',   ville: 'Cacao',                 circonscription: 'Cayenne 2 – Roura – Cacao',                            departement: 'Guyane (973)' },

  // ── Circonscription 3 : Rémire-Montjoly – Matoury (partie) ────────────────
  { nom: 'Élémentaire Parc Lindor',                       type: 'école',   ville: 'Rémire-Montjoly',       circonscription: 'Rémire-Montjoly – Matoury (partie)',                   departement: 'Guyane (973)' },
  { nom: 'Élémentaire Eugène Honorien',                   type: 'école',   ville: 'Rémire-Montjoly',       circonscription: 'Rémire-Montjoly – Matoury (partie)',                   departement: 'Guyane (973)' },
  { nom: 'Élémentaire Jules Minidoque',                   type: 'école',   ville: 'Rémire-Montjoly',       circonscription: 'Rémire-Montjoly – Matoury (partie)',                   departement: 'Guyane (973)' },
  { nom: 'Élémentaire Elvina Lixef',                      type: 'école',   ville: 'Rémire-Montjoly',       circonscription: 'Rémire-Montjoly – Matoury (partie)',                   departement: 'Guyane (973)' },
  { nom: 'Élémentaire Jacques Lony',                      type: 'école',   ville: 'Rémire-Montjoly',       circonscription: 'Rémire-Montjoly – Matoury (partie)',                   departement: 'Guyane (973)' },
  { nom: 'Élémentaire Moulin à vent',                     type: 'école',   ville: 'Rémire-Montjoly',       circonscription: 'Rémire-Montjoly – Matoury (partie)',                   departement: 'Guyane (973)' },
  { nom: 'Élémentaire Edgard Galliot',                    type: 'école',   ville: 'Rémire-Montjoly',       circonscription: 'Rémire-Montjoly – Matoury (partie)',                   departement: 'Guyane (973)' },
  { nom: 'Collège Auguste Dédé',                          type: 'collège', ville: 'Rémire-Montjoly',       circonscription: 'Rémire-Montjoly – Matoury (partie)',                   departement: 'Guyane (973)' },
  { nom: 'Collège Réeberg Néron',                         type: 'collège', ville: 'Rémire-Montjoly',       circonscription: 'Rémire-Montjoly – Matoury (partie)',                   departement: 'Guyane (973)' },
  { nom: 'Élémentaire Sainte Thérèse',                    type: 'école',   ville: 'Rémire-Montjoly',       circonscription: 'Rémire-Montjoly – Matoury (partie)',                   departement: 'Guyane (973)' },
  { nom: 'Collège Sainte-Thérèse',                        type: 'collège', ville: 'Rémire-Montjoly',       circonscription: 'Rémire-Montjoly – Matoury (partie)',                   departement: 'Guyane (973)' },

  // ── Circonscription 4 : Matoury – Régina – Oyapock ────────────────────────
  // Matoury — élémentaires pub
  { nom: 'Élémentaire Abriba',                            type: 'école',   ville: 'Matoury',               circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  { nom: 'Élémentaire Guimanmin',                         type: 'école',   ville: 'Matoury',               circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  { nom: 'Élémentaire La Rhumerie',                       type: 'école',   ville: 'Matoury',               circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  { nom: 'Élémentaire Balata',                            type: 'école',   ville: 'Matoury',               circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  { nom: 'Élémentaire Stoupan',                           type: 'école',   ville: 'Matoury',               circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  { nom: 'Élémentaire de Rochambeau',                     type: 'école',   ville: 'Matoury',               circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  { nom: 'Groupe Scolaire Maurice Bellony',               type: 'école',   ville: 'Matoury',               circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  { nom: 'Élémentaire Jacques Lony',                      type: 'école',   ville: 'Matoury',               circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  { nom: 'Élémentaire La Barbadine',                      type: 'école',   ville: 'Matoury',               circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  { nom: 'Élémentaire Saint-Michel',                      type: 'école',   ville: 'Matoury',               circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  { nom: 'Élémentaire du Bourg',                          type: 'école',   ville: 'Matoury',               circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  { nom: 'Élémentaire Le Larivot',                        type: 'école',   ville: 'Matoury',               circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  { nom: 'Collège Concorde-Maurice Dumesnil',             type: 'collège', ville: 'Matoury',               circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  { nom: 'Collège Lise Ophion (Matoury II)',              type: 'collège', ville: 'Matoury',               circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  { nom: 'Collège La Canopée (Matoury I)',                type: 'collège', ville: 'Matoury',               circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  { nom: 'Élémentaire Saint Pierre',                      type: 'école',   ville: 'Matoury',               circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  // Régina
  { nom: 'Élémentaire de Kaw',                            type: 'école',   ville: 'Régina',                circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  { nom: 'Élémentaire Maurice Léanville',                 type: 'école',   ville: 'Régina',                circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  { nom: 'Annexe Pierre Ardinet (Collège Chlore Constant)', type: 'collège', ville: 'Régina',              circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  // Saint-Georges-de-l'Oyapock
  { nom: "Élémentaire les Trois Palétuviers",             type: 'école',   ville: "Saint-Georges-de-l'Oyapock", circonscription: 'Matoury – Régina – Oyapock',                     departement: 'Guyane (973)' },
  { nom: 'Élémentaire Gabin',                             type: 'école',   ville: "Saint-Georges-de-l'Oyapock", circonscription: 'Matoury – Régina – Oyapock',                     departement: 'Guyane (973)' },
  { nom: 'Élémentaire Pascal Joinville',                  type: 'école',   ville: "Saint-Georges-de-l'Oyapock", circonscription: 'Matoury – Régina – Oyapock',                     departement: 'Guyane (973)' },
  { nom: 'Collège Chlore Constant',                       type: 'collège', ville: "Saint-Georges-de-l'Oyapock", circonscription: 'Matoury – Régina – Oyapock',                     departement: 'Guyane (973)' },
  // Ouanary
  { nom: 'Élémentaire de Ouanary',                        type: 'école',   ville: 'Ouanary',               circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  // Camopi
  { nom: 'Élémentaire Yawapa-Pina',                       type: 'école',   ville: 'Camopi',                circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  { nom: 'Élémentaire de Camopi',                         type: 'école',   ville: 'Camopi',                circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  { nom: 'Élémentaire Zidock',                            type: 'école',   ville: 'Camopi',                circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  { nom: 'Élémentaire Roger',                             type: 'école',   ville: 'Camopi',                circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },
  { nom: 'Collège Paul Suitman',                          type: 'collège', ville: 'Camopi',                circonscription: 'Matoury – Régina – Oyapock',                           departement: 'Guyane (973)' },

  // ── Circonscription 5 : Macouria – Montsinéry-Tonnégrande ─────────────────
  { nom: 'Groupe Scolaire Maud Nadiré',                   type: 'école',   ville: 'Macouria',              circonscription: 'Macouria – Montsinéry-Tonnégrande',                    departement: 'Guyane (973)' },
  { nom: 'Groupe Scolaire Serge Adelson',                 type: 'école',   ville: 'Macouria',              circonscription: 'Macouria – Montsinéry-Tonnégrande',                    departement: 'Guyane (973)' },
  { nom: 'École primaire Zac de Soula 1',                 type: 'école',   ville: 'Macouria',              circonscription: 'Macouria – Montsinéry-Tonnégrande',                    departement: 'Guyane (973)' },
  { nom: 'Élémentaire Ponet',                             type: 'école',   ville: 'Macouria',              circonscription: 'Macouria – Montsinéry-Tonnégrande',                    departement: 'Guyane (973)' },
  { nom: 'Élémentaire Edmé Courat',                       type: 'école',   ville: 'Macouria',              circonscription: 'Macouria – Montsinéry-Tonnégrande',                    departement: 'Guyane (973)' },
  { nom: 'Groupe Scolaire Sainte Agathe',                 type: 'école',   ville: 'Macouria',              circonscription: 'Macouria – Montsinéry-Tonnégrande',                    departement: 'Guyane (973)' },
  { nom: 'Collège Antoine Sylvère Felix',                 type: 'collège', ville: 'Macouria',              circonscription: 'Macouria – Montsinéry-Tonnégrande',                    departement: 'Guyane (973)' },
  { nom: 'Collège Just Hyasine',                          type: 'collège', ville: 'Macouria',              circonscription: 'Macouria – Montsinéry-Tonnégrande',                    departement: 'Guyane (973)' },
  { nom: 'Élémentaire Léopold Héder',                     type: 'école',   ville: 'Montsinéry-Tonnégrande', circonscription: 'Macouria – Montsinéry-Tonnégrande',                  departement: 'Guyane (973)' },
  { nom: 'Élémentaire Tonnegrande',                       type: 'école',   ville: 'Montsinéry-Tonnégrande', circonscription: 'Macouria – Montsinéry-Tonnégrande',                  departement: 'Guyane (973)' },

  // ── Circonscription 6 : Kourou 1 ──────────────────────────────────────────
  { nom: 'Élémentaire Internationale Kourou',             type: 'école',   ville: 'Kourou',                circonscription: 'Kourou 1',                                             departement: 'Guyane (973)' },
  { nom: 'Élémentaire Solange Patient',                   type: 'école',   ville: 'Kourou',                circonscription: 'Kourou 1',                                             departement: 'Guyane (973)' },
  { nom: 'Élémentaire Maximilien Saba',                   type: 'école',   ville: 'Kourou',                circonscription: 'Kourou 1',                                             departement: 'Guyane (973)' },
  { nom: 'Élémentaire Michel Lohier',                     type: 'école',   ville: 'Kourou',                circonscription: 'Kourou 1',                                             departement: 'Guyane (973)' },
  { nom: 'Élémentaire Eustase Rimane',                    type: 'école',   ville: 'Kourou',                circonscription: 'Kourou 1',                                             departement: 'Guyane (973)' },
  { nom: 'Élémentaire Olive Palmot',                      type: 'école',   ville: 'Kourou',                circonscription: 'Kourou 1',                                             departement: 'Guyane (973)' },
  { nom: 'Élémentaire Emile Nézes',                       type: 'école',   ville: 'Kourou',                circonscription: 'Kourou 1',                                             departement: 'Guyane (973)' },
  { nom: 'Élémentaire Olivier Compas',                    type: 'école',   ville: 'Kourou',                circonscription: 'Kourou 1',                                             departement: 'Guyane (973)' },
  { nom: 'Élémentaire Savane',                            type: 'école',   ville: 'Kourou',                circonscription: 'Kourou 1',                                             departement: 'Guyane (973)' },
  { nom: 'Élémentaire Raymond Cresson',                   type: 'école',   ville: 'Kourou',                circonscription: 'Kourou 1',                                             departement: 'Guyane (973)' },
  { nom: 'Élémentaire Roland Lucile',                     type: 'école',   ville: 'Kourou',                circonscription: 'Kourou 1',                                             departement: 'Guyane (973)' },
  { nom: 'Collège Henri Agarande (Kourou I)',             type: 'collège', ville: 'Kourou',                circonscription: 'Kourou 1',                                             departement: 'Guyane (973)' },
  { nom: 'Collège Victor Schoelcher (Kourou II)',         type: 'collège', ville: 'Kourou',                circonscription: 'Kourou 1',                                             departement: 'Guyane (973)' },
  { nom: 'Collège Omeba Tobo (Kourou III)',               type: 'collège', ville: 'Kourou',                circonscription: 'Kourou 1',                                             departement: 'Guyane (973)' },
  { nom: 'Collège Joseph Ho Ten You',                     type: 'collège', ville: 'Kourou',                circonscription: 'Kourou 1',                                             departement: 'Guyane (973)' },

  // ── Circonscription 7 : Kourou 2 – Sinnamary – Iracoubo ───────────────────
  { nom: 'Élémentaire Athis Latidine',                    type: 'école',   ville: 'Sinnamary',             circonscription: 'Kourou 2 – Sinnamary – Iracoubo',                      departement: 'Guyane (973)' },
  { nom: 'Élémentaire Ulrich Sophie',                     type: 'école',   ville: 'Sinnamary',             circonscription: 'Kourou 2 – Sinnamary – Iracoubo',                      departement: 'Guyane (973)' },
  { nom: 'Collège Elie Castor',                           type: 'collège', ville: 'Sinnamary',             circonscription: 'Kourou 2 – Sinnamary – Iracoubo',                      departement: 'Guyane (973)' },
  { nom: "Élémentaire d'Iracoubo",                        type: 'école',   ville: 'Iracoubo',              circonscription: 'Kourou 2 – Sinnamary – Iracoubo',                      departement: 'Guyane (973)' },
  { nom: 'Collège Ferdinand Madeleine',                   type: 'collège', ville: 'Iracoubo',              circonscription: 'Kourou 2 – Sinnamary – Iracoubo',                      departement: 'Guyane (973)' },

  // ── Circonscription 8 : Maroni (Haut-Maroni) ──────────────────────────────
  // Grand-Santi
  { nom: 'Élémentaire Elie Castor',                       type: 'école',   ville: 'Grand-Santi',           circonscription: 'Maroni (Haut-Maroni)',                                 departement: 'Guyane (973)' },
  { nom: 'Élémentaire Monfina',                           type: 'école',   ville: 'Grand-Santi',           circonscription: 'Maroni (Haut-Maroni)',                                 departement: 'Guyane (973)' },
  { nom: 'Élémentaire Fanko Atjali a Mi',                 type: 'école',   ville: 'Grand-Santi',           circonscription: 'Maroni (Haut-Maroni)',                                 departement: 'Guyane (973)' },
  { nom: 'Élémentaire Apaguy',                            type: 'école',   ville: 'Grand-Santi',           circonscription: 'Maroni (Haut-Maroni)',                                 departement: 'Guyane (973)' },
  { nom: 'Collège Achmat Kartadinama',                    type: 'collège', ville: 'Grand-Santi',           circonscription: 'Maroni (Haut-Maroni)',                                 departement: 'Guyane (973)' },
  // Papaichton
  { nom: 'Élémentaire Gran Man Tolinga',                  type: 'école',   ville: 'Papaichton',            circonscription: 'Maroni (Haut-Maroni)',                                 departement: 'Guyane (973)' },
  { nom: 'Élémentaire Capitaine Louis Fofi',              type: 'école',   ville: 'Papaichton',            circonscription: 'Maroni (Haut-Maroni)',                                 departement: 'Guyane (973)' },
  { nom: 'Collège Capitaine Charles Tafanier',            type: 'collège', ville: 'Papaichton',            circonscription: 'Maroni (Haut-Maroni)',                                 departement: 'Guyane (973)' },
  // Maripasoula
  { nom: 'Élémentaire Antécum Pata',                      type: 'école',   ville: 'Maripasoula',           circonscription: 'Maroni (Haut-Maroni)',                                 departement: 'Guyane (973)' },
  { nom: 'Élémentaire Twenké-Taluwen',                    type: 'école',   ville: 'Maripasoula',           circonscription: 'Maroni (Haut-Maroni)',                                 departement: 'Guyane (973)' },
  { nom: "Élémentaire d'Elahé",                           type: 'école',   ville: 'Maripasoula',           circonscription: 'Maroni (Haut-Maroni)',                                 departement: 'Guyane (973)' },
  { nom: 'Élémentaire Pilima',                            type: 'école',   ville: 'Maripasoula',           circonscription: 'Maroni (Haut-Maroni)',                                 departement: 'Guyane (973)' },
  { nom: 'Élémentaire Cayodé',                            type: 'école',   ville: 'Maripasoula',           circonscription: 'Maroni (Haut-Maroni)',                                 departement: 'Guyane (973)' },
  { nom: 'Élémentaire Alexis Jonas',                      type: 'école',   ville: 'Maripasoula',           circonscription: 'Maroni (Haut-Maroni)',                                 departement: 'Guyane (973)' },
  { nom: 'Élémentaire Nouveau Wacapou',                   type: 'école',   ville: 'Maripasoula',           circonscription: 'Maroni (Haut-Maroni)',                                 departement: 'Guyane (973)' },
  { nom: 'Élémentaire Robert Vignon',                     type: 'école',   ville: 'Maripasoula',           circonscription: 'Maroni (Haut-Maroni)',                                 departement: 'Guyane (973)' },
  { nom: 'Groupe Scolaire Abdallah',                      type: 'école',   ville: 'Maripasoula',           circonscription: 'Maroni (Haut-Maroni)',                                 departement: 'Guyane (973)' },
  { nom: 'Collège Gran Man Difou',                        type: 'collège', ville: 'Maripasoula',           circonscription: 'Maroni (Haut-Maroni)',                                 departement: 'Guyane (973)' },

  // ── Circonscription 9 : Saint-Laurent-du-Maroni 1 ─────────────────────────
  { nom: 'Élémentaire Elise Giffard',                     type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Paul Castaing',                     type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Paul Isnard 1',                     type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Paul Isnard 2',                     type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Rosa Parks',                        type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Edgard Milien',                     type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Toussaint Louverture',              type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Armide Euzet',                      type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Prospérité',                        type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Nicole Othily',                     type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Edouard Caman',                     type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Doctrovée Solange Hulic',           type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Cojande St-Auguste',                type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Rudolph Biswane',                   type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Velme Tapoka',                      type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Alexander Mac Instosch',            type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Ocatvien Hodebar',                  type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Léopold Héder',                     type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Raymond Rechou',                    type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Joseph Zymphorien',                 type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Jacques Voyer',                     type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Alain Mouty',                       type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: "Collège Arsène Bouyer D'Angoma (SLM V)",        type: 'collège', ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Collège Albert Londres (SLM II)',               type: 'collège', ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Collège Leodate Volmar',                        type: 'collège', ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Collège Eugénie Tell-Eboué (SLM I)',            type: 'collège', ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Collège Paul Jean Louis',                       type: 'collège', ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire Saint Jean Baptiste de la Salle',   type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },
  { nom: 'Élémentaire La Persévérance',                   type: 'école',   ville: 'Saint-Laurent-du-Maroni', circonscription: 'Saint-Laurent-du-Maroni 1',                         departement: 'Guyane (973)' },

  // ── Circonscription 10 : Saint-Laurent-du-Maroni 2 – Apatou ───────────────
  { nom: 'Élémentaire Lambert Amayota',                   type: 'école',   ville: 'Apatou',                circonscription: 'Saint-Laurent-du-Maroni 2 – Apatou',                   departement: 'Guyane (973)' },
  { nom: 'Élémentaire Edgard Moussa',                     type: 'école',   ville: 'Apatou',                circonscription: 'Saint-Laurent-du-Maroni 2 – Apatou',                   departement: 'Guyane (973)' },
  { nom: 'Élémentaire Moutende',                          type: 'école',   ville: 'Apatou',                circonscription: 'Saint-Laurent-du-Maroni 2 – Apatou',                   departement: 'Guyane (973)' },
  { nom: 'Collège Ma Aiye',                               type: 'collège', ville: 'Apatou',                circonscription: 'Saint-Laurent-du-Maroni 2 – Apatou',                   departement: 'Guyane (973)' },
  { nom: 'École primaire Providence',                      type: 'école',   ville: 'Apatou',                circonscription: 'Saint-Laurent-du-Maroni 2 – Apatou',                   departement: 'Guyane (973)' },

  // ── Circonscription 11 : Saint-Laurent-du-Maroni 3 – Mana – Awala-Yalimapo
  { nom: 'Élémentaire Tchi Tsou',                         type: 'école',   ville: 'Mana',                  circonscription: 'Saint-Laurent-du-Maroni 3 – Mana – Awala-Yalimapo',    departement: 'Guyane (973)' },
  { nom: 'Élémentaire Emmanuel Bellony',                  type: 'école',   ville: 'Mana',                  circonscription: 'Saint-Laurent-du-Maroni 3 – Mana – Awala-Yalimapo',    departement: 'Guyane (973)' },
  { nom: 'Groupe Scolaire Anne-Marie Marchadour',         type: 'école',   ville: 'Mana',                  circonscription: 'Saint-Laurent-du-Maroni 3 – Mana – Awala-Yalimapo',    departement: 'Guyane (973)' },
  { nom: 'Élémentaire Cécilien Robinson',                 type: 'école',   ville: 'Mana',                  circonscription: 'Saint-Laurent-du-Maroni 3 – Mana – Awala-Yalimapo',    departement: 'Guyane (973)' },
  { nom: 'Collège Paule Berthelot',                       type: 'collège', ville: 'Mana',                  circonscription: 'Saint-Laurent-du-Maroni 3 – Mana – Awala-Yalimapo',    departement: 'Guyane (973)' },
  { nom: 'Collège Léo Othily',                            type: 'collège', ville: 'Mana',                  circonscription: 'Saint-Laurent-du-Maroni 3 – Mana – Awala-Yalimapo',    departement: 'Guyane (973)' },
  { nom: 'Élémentaire Saint Joseph',                      type: 'école',   ville: 'Mana',                  circonscription: 'Saint-Laurent-du-Maroni 3 – Mana – Awala-Yalimapo',    departement: 'Guyane (973)' },
  { nom: 'Élémentaire Yamanalé',                          type: 'école',   ville: 'Awala-Yalimapo',        circonscription: 'Saint-Laurent-du-Maroni 3 – Mana – Awala-Yalimapo',    departement: 'Guyane (973)' },
]
