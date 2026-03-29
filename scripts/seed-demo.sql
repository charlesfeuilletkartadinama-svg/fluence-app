-- ============================================================
-- SEED SIMULATION — FluenceApp
-- Crée : 7 comptes démo + 20 écoles primaires + 4 collèges
--        Données identifiées par nom LIKE '[DEMO]%'
--        Mots de passe : Demo1234!
--
-- ⚠️  À EXÉCUTER dans Supabase > SQL Editor
-- ⚠️  Idempotent : supprime et recrée toutes les données [DEMO]
-- ============================================================

-- ── 0. Créer les tables réseau si elles n'existent pas ──────
CREATE TABLE IF NOT EXISTS coordo_etablissements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordo_id        UUID NOT NULL REFERENCES profils(id) ON DELETE CASCADE,
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coordo_id, etablissement_id)
);

CREATE TABLE IF NOT EXISTS ien_etablissements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ien_id           UUID NOT NULL REFERENCES profils(id) ON DELETE CASCADE,
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ien_id, etablissement_id)
);

-- ── 1. Nettoyage ──────────────────────────────────────────────
DELETE FROM passations
WHERE eleve_id IN (
  SELECT e.id FROM eleves e
  JOIN classes c ON c.id = e.classe_id
  JOIN etablissements et ON et.id = c.etablissement_id
  WHERE et.nom LIKE '[DEMO]%'
);
DELETE FROM eleves
WHERE classe_id IN (
  SELECT c.id FROM classes c
  JOIN etablissements et ON et.id = c.etablissement_id
  WHERE et.nom LIKE '[DEMO]%'
);
DELETE FROM classes
WHERE etablissement_id IN (SELECT id FROM etablissements WHERE nom LIKE '[DEMO]%');
DELETE FROM periodes
WHERE etablissement_id IN (SELECT id FROM etablissements WHERE nom LIKE '[DEMO]%');
DELETE FROM etablissements WHERE nom LIKE '[DEMO]%';

DELETE FROM coordo_etablissements
WHERE coordo_id IN (SELECT id FROM auth.users WHERE email LIKE '%@fluence-demo.fr');
DELETE FROM ien_etablissements
WHERE ien_id IN (SELECT id FROM auth.users WHERE email LIKE '%@fluence-demo.fr');
DELETE FROM enseignant_classes
WHERE enseignant_id IN (SELECT id FROM auth.users WHERE email LIKE '%@fluence-demo.fr');
DELETE FROM profils
WHERE id IN (SELECT id FROM auth.users WHERE email LIKE '%@fluence-demo.fr');
DELETE FROM auth.identities
WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@fluence-demo.fr');
DELETE FROM auth.users WHERE email LIKE '%@fluence-demo.fr';

-- ── 2. Génération ─────────────────────────────────────────────
DO $$
DECLARE
  prenoms_m  TEXT[] := ARRAY[
    'Lucas','Nathan','Thomas','Hugo','Maxime','Antoine','Louis','Arthur',
    'Théo','Romain','Alexis','Quentin','Baptiste','Kévin','Bryan','Jérémy',
    'Dylan','Yanis','Mehdi','Axel','Clément','Julien','Nicolas','Sébastien',
    'Valentin','Enzo','Loïc','Gaëtan','Mathieu','Raphaël'
  ];
  prenoms_f  TEXT[] := ARRAY[
    'Emma','Léa','Chloé','Manon','Camille','Inès','Alice','Juliette',
    'Sofia','Anaïs','Jade','Lucie','Océane','Pauline','Cindy','Mélissa',
    'Audrey','Laure','Amandine','Stéphanie','Noémie','Elisa','Margot',
    'Céline','Lola','Clara','Sarah','Salomé','Maëva','Priya'
  ];
  noms_fam   TEXT[] := ARRAY[
    'Martin','Bernard','Dubois','Thomas','Robert','Richard','Petit','Durand',
    'Leroy','Moreau','Simon','Laurent','Lefebvre','Michel','Garcia','David',
    'Bertrand','Roux','Vincent','Fontaine','Hamard','Christophe','Bourgoin',
    'Pelletier','Marchal','Lemaire','Renard','Girard','Gauthier','Morel',
    'Janvier','Séverin','Elfort','Calmont','Mondésir','Céleste','Nérée',
    'Tavernier','Lubin','Céphas','Danaé','Octave','Rosine','Tiburce'
  ];

  noms_ecole TEXT[] := ARRAY[
    'Léon-Bertrand','des Savanes','des Remparts','de Matoury','des Palmiers',
    'Victor-Hugo','Félix-Eboué','des Maraîchers','de la Madeleine','Les Flamboyants',
    'du Larivot','des Mangroves','du Maroni','de Kourou','des Étoiles',
    'du Bagne','de la Paix','des Colibris','des Orchidées','du Fleuve'
  ];
  noms_college TEXT[] := ARRAY[
    'Lumina-Sophie','Félix-Eboué','de l''Oyapock','des Palmistes'
  ];

  niveaux_primaire TEXT[] := ARRAY['CP','CE1','CE2','CM1','CM2'];
  niveaux_college  TEXT[] := ARRAY['6eme','5eme','4eme','3eme'];
  lettres          TEXT[] := ARRAY['A','B','C','D','E','F','G','H','I','J'];
  periodes_codes   TEXT[] := ARRAY['T1','T2','T3'];
  periodes_labels  TEXT[] := ARRAY['Trimestre 1','Trimestre 2','Trimestre 3'];
  modes            TEXT[] := ARRAY['saisie','passation'];

  -- IDs utilisateurs
  v_recteur_id    UUID;
  v_admin_id      UUID;
  v_coordo_id     UUID;
  v_ien_id        UUID;
  v_directeur_id  UUID;
  v_principal_id  UUID;
  v_enseignant_id UUID;

  -- IDs établissements
  v_ecole_ids   UUID[];
  v_college_ids UUID[];
  v_etab_id     UUID;

  -- Variables de boucle
  v_classe_id   UUID;
  v_eleve_id    UUID;
  v_periode_id  UUID;
  v_periode_ids UUID[];
  v_first_classe UUID;
  v_nb_eleves   INT;
  v_score       INT;
  v_is_ne       BOOLEAN;
  v_is_nr       BOOLEAN;
  v_prenom      TEXT;
  v_nom         TEXT;
  v_genre       INT;
  v_rnd         FLOAT;

  i INT; j INT; k INT; l INT; n INT; p INT;

BEGIN

  -- ── Comptes auth ───────────────────────────────────────────
  -- auth.users + auth.identities (obligatoire pour que la connexion fonctionne)

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
    'recteur@fluence-demo.fr', crypt('Demo1234!',gen_salt('bf', 10)),
    NOW(),'{"provider":"email","providers":["email"]}','{}',NOW(),NOW())
  RETURNING id INTO v_recteur_id;
  INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), 'recteur@fluence-demo.fr', v_recteur_id,
    json_build_object('sub', v_recteur_id::text, 'email', 'recteur@fluence-demo.fr'),
    'email', NOW(), NOW(), NOW());

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
    'admin@fluence-demo.fr', crypt('Demo1234!',gen_salt('bf', 10)),
    NOW(),'{"provider":"email","providers":["email"]}','{}',NOW(),NOW())
  RETURNING id INTO v_admin_id;
  INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), 'admin@fluence-demo.fr', v_admin_id,
    json_build_object('sub', v_admin_id::text, 'email', 'admin@fluence-demo.fr'),
    'email', NOW(), NOW(), NOW());

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
    'coordo@fluence-demo.fr', crypt('Demo1234!',gen_salt('bf', 10)),
    NOW(),'{"provider":"email","providers":["email"]}','{}',NOW(),NOW())
  RETURNING id INTO v_coordo_id;
  INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), 'coordo@fluence-demo.fr', v_coordo_id,
    json_build_object('sub', v_coordo_id::text, 'email', 'coordo@fluence-demo.fr'),
    'email', NOW(), NOW(), NOW());

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
    'ien@fluence-demo.fr', crypt('Demo1234!',gen_salt('bf', 10)),
    NOW(),'{"provider":"email","providers":["email"]}','{}',NOW(),NOW())
  RETURNING id INTO v_ien_id;
  INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), 'ien@fluence-demo.fr', v_ien_id,
    json_build_object('sub', v_ien_id::text, 'email', 'ien@fluence-demo.fr'),
    'email', NOW(), NOW(), NOW());

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
    'directeur@fluence-demo.fr', crypt('Demo1234!',gen_salt('bf', 10)),
    NOW(),'{"provider":"email","providers":["email"]}','{}',NOW(),NOW())
  RETURNING id INTO v_directeur_id;
  INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), 'directeur@fluence-demo.fr', v_directeur_id,
    json_build_object('sub', v_directeur_id::text, 'email', 'directeur@fluence-demo.fr'),
    'email', NOW(), NOW(), NOW());

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
    'principal@fluence-demo.fr', crypt('Demo1234!',gen_salt('bf', 10)),
    NOW(),'{"provider":"email","providers":["email"]}','{}',NOW(),NOW())
  RETURNING id INTO v_principal_id;
  INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), 'principal@fluence-demo.fr', v_principal_id,
    json_build_object('sub', v_principal_id::text, 'email', 'principal@fluence-demo.fr'),
    'email', NOW(), NOW(), NOW());

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
    'enseignant@fluence-demo.fr', crypt('Demo1234!',gen_salt('bf', 10)),
    NOW(),'{"provider":"email","providers":["email"]}','{}',NOW(),NOW())
  RETURNING id INTO v_enseignant_id;
  INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), 'enseignant@fluence-demo.fr', v_enseignant_id,
    json_build_object('sub', v_enseignant_id::text, 'email', 'enseignant@fluence-demo.fr'),
    'email', NOW(), NOW(), NOW());

  -- ── Établissements ─────────────────────────────────────────
  v_ecole_ids := ARRAY[]::UUID[];
  FOR i IN 1..20 LOOP
    INSERT INTO etablissements (id, nom, type, type_reseau)
    VALUES (
      gen_random_uuid(),
      '[DEMO] École ' || noms_ecole[i],
      'école',
      CASE WHEN i <= 5 THEN 'REP+' WHEN i <= 10 THEN 'REP' ELSE 'Hors REP' END
    ) RETURNING id INTO v_etab_id;
    v_ecole_ids := v_ecole_ids || v_etab_id;
  END LOOP;

  v_college_ids := ARRAY[]::UUID[];
  FOR i IN 1..4 LOOP
    INSERT INTO etablissements (id, nom, type, type_reseau)
    VALUES (
      gen_random_uuid(),
      '[DEMO] Collège ' || noms_college[i],
      'collège',
      CASE WHEN i <= 2 THEN 'REP+' ELSE 'REP' END
    ) RETURNING id INTO v_etab_id;
    v_college_ids := v_college_ids || v_etab_id;
  END LOOP;

  -- ── Profils ────────────────────────────────────────────────
  INSERT INTO profils (id, nom, prenom, role, etablissement_id)
  VALUES
    (v_recteur_id,    '[DEMO]', 'Recteur',    'recteur',    NULL             ),
    (v_admin_id,      '[DEMO]', 'Admin',      'admin',      NULL             ),
    (v_coordo_id,     '[DEMO]', 'Coordo',     'coordo_rep', NULL             ),
    (v_ien_id,        '[DEMO]', 'IEN',        'ien',        NULL             ),
    (v_directeur_id,  '[DEMO]', 'Directeur',  'directeur',  v_ecole_ids[1]  ),
    (v_principal_id,  '[DEMO]', 'Principal',  'principal',  v_college_ids[1]),
    (v_enseignant_id, '[DEMO]', 'Enseignant', 'enseignant', v_ecole_ids[1]  );

  -- ── Écoles primaires (20) : 15 classes × ~22 élèves ────────
  v_first_classe := NULL;
  FOR i IN 1..20 LOOP

    v_periode_ids := ARRAY[]::UUID[];
    FOR p IN 1..3 LOOP
      INSERT INTO periodes (id, code, label, actif, etablissement_id)
      VALUES (gen_random_uuid(), periodes_codes[p], periodes_labels[p], true, v_ecole_ids[i])
      RETURNING id INTO v_periode_id;
      v_periode_ids := v_periode_ids || v_periode_id;
    END LOOP;

    -- 5 niveaux × 3 classes = 15 classes/école
    FOR n IN 1..5 LOOP
      FOR j IN 1..3 LOOP
        v_classe_id := gen_random_uuid();
        INSERT INTO classes (id, nom, niveau, etablissement_id)
        VALUES (v_classe_id, niveaux_primaire[n] || ' ' || lettres[j], niveaux_primaire[n], v_ecole_ids[i]);

        -- Mémoriser CP A de l'école 1 pour l'enseignant démo
        IF i = 1 AND n = 1 AND j = 1 THEN v_first_classe := v_classe_id; END IF;

        v_nb_eleves := 20 + floor(random() * 6)::INT;

        FOR k IN 1..v_nb_eleves LOOP
          v_genre  := floor(random() * 2)::INT;
          v_nom    := noms_fam[1 + floor(random() * array_length(noms_fam, 1))::INT];
          v_prenom := CASE WHEN v_genre = 1
            THEN prenoms_m[1 + floor(random() * array_length(prenoms_m, 1))::INT]
            ELSE prenoms_f[1 + floor(random() * array_length(prenoms_f, 1))::INT]
          END;

          INSERT INTO eleves (id, nom, prenom, classe_id, actif)
          VALUES (gen_random_uuid(), upper(v_nom), v_prenom, v_classe_id, true)
          RETURNING id INTO v_eleve_id;

          -- Une passation par période (8% non-renseigné = pas de ligne, 7% non-évalué, 85% scoré)
          FOR l IN 1..3 LOOP
            v_rnd   := random();
            v_is_nr := v_rnd < 0.08;
            v_is_ne := NOT v_is_nr AND random() < 0.075;
            v_score := CASE WHEN v_is_nr OR v_is_ne THEN NULL
                            ELSE floor(random() * 181)::INT END;

            IF NOT v_is_nr THEN
              INSERT INTO passations (
                id, eleve_id, periode_id, score, non_evalue, mode, hors_periode,
                q1, q2, q3, q4, q5, q6
              ) VALUES (
                gen_random_uuid(), v_eleve_id, v_periode_ids[l],
                v_score, v_is_ne, modes[1 + floor(random() * 2)::INT], false,
                CASE WHEN random()<0.15 THEN NULL WHEN random()<0.6 THEN 'Correct' ELSE 'Incorrect' END,
                CASE WHEN random()<0.15 THEN NULL WHEN random()<0.6 THEN 'Correct' ELSE 'Incorrect' END,
                CASE WHEN random()<0.15 THEN NULL WHEN random()<0.6 THEN 'Correct' ELSE 'Incorrect' END,
                CASE WHEN random()<0.15 THEN NULL WHEN random()<0.55 THEN 'Correct' ELSE 'Incorrect' END,
                CASE WHEN random()<0.15 THEN NULL WHEN random()<0.55 THEN 'Correct' ELSE 'Incorrect' END,
                CASE WHEN random()<0.15 THEN NULL WHEN random()<0.5  THEN 'Correct' ELSE 'Incorrect' END
              ) ON CONFLICT DO NOTHING;
            END IF;
          END LOOP;

        END LOOP; -- élèves
      END LOOP; -- classes par niveau
    END LOOP; -- niveaux primaire

    RAISE NOTICE 'École % / 20 : %', i, noms_ecole[i];
  END LOOP; -- écoles

  -- ── Collèges (4) : 40 classes × ~25 élèves ─────────────────
  FOR i IN 1..4 LOOP

    v_periode_ids := ARRAY[]::UUID[];
    FOR p IN 1..3 LOOP
      INSERT INTO periodes (id, code, label, actif, etablissement_id)
      VALUES (gen_random_uuid(), periodes_codes[p], periodes_labels[p], true, v_college_ids[i])
      RETURNING id INTO v_periode_id;
      v_periode_ids := v_periode_ids || v_periode_id;
    END LOOP;

    -- 4 niveaux × 10 classes = 40 classes/collège
    FOR n IN 1..4 LOOP
      FOR j IN 1..10 LOOP
        v_classe_id := gen_random_uuid();
        INSERT INTO classes (id, nom, niveau, etablissement_id)
        VALUES (v_classe_id, niveaux_college[n] || ' ' || lettres[j], niveaux_college[n], v_college_ids[i]);

        v_nb_eleves := 20 + floor(random() * 11)::INT;

        FOR k IN 1..v_nb_eleves LOOP
          v_genre  := floor(random() * 2)::INT;
          v_nom    := noms_fam[1 + floor(random() * array_length(noms_fam, 1))::INT];
          v_prenom := CASE WHEN v_genre = 1
            THEN prenoms_m[1 + floor(random() * array_length(prenoms_m, 1))::INT]
            ELSE prenoms_f[1 + floor(random() * array_length(prenoms_f, 1))::INT]
          END;

          INSERT INTO eleves (id, nom, prenom, classe_id, actif)
          VALUES (gen_random_uuid(), upper(v_nom), v_prenom, v_classe_id, true)
          RETURNING id INTO v_eleve_id;

          FOR l IN 1..3 LOOP
            v_rnd   := random();
            v_is_nr := v_rnd < 0.06;
            v_is_ne := NOT v_is_nr AND random() < 0.05;
            v_score := CASE WHEN v_is_nr OR v_is_ne THEN NULL
                            ELSE floor(random() * 181)::INT END;

            IF NOT v_is_nr THEN
              INSERT INTO passations (
                id, eleve_id, periode_id, score, non_evalue, mode, hors_periode,
                q1, q2, q3, q4, q5, q6
              ) VALUES (
                gen_random_uuid(), v_eleve_id, v_periode_ids[l],
                v_score, v_is_ne, modes[1 + floor(random() * 2)::INT], false,
                CASE WHEN random()<0.15 THEN NULL WHEN random()<0.6 THEN 'Correct' ELSE 'Incorrect' END,
                CASE WHEN random()<0.15 THEN NULL WHEN random()<0.6 THEN 'Correct' ELSE 'Incorrect' END,
                CASE WHEN random()<0.15 THEN NULL WHEN random()<0.6 THEN 'Correct' ELSE 'Incorrect' END,
                CASE WHEN random()<0.15 THEN NULL WHEN random()<0.55 THEN 'Correct' ELSE 'Incorrect' END,
                CASE WHEN random()<0.15 THEN NULL WHEN random()<0.55 THEN 'Correct' ELSE 'Incorrect' END,
                CASE WHEN random()<0.15 THEN NULL WHEN random()<0.5  THEN 'Correct' ELSE 'Incorrect' END
              ) ON CONFLICT DO NOTHING;
            END IF;
          END LOOP;

        END LOOP; -- élèves
      END LOOP; -- classes par niveau
    END LOOP; -- niveaux collège

    RAISE NOTICE 'Collège % / 4 : %', i, noms_college[i];
  END LOOP; -- collèges

  -- ── Affectations réseau ────────────────────────────────────

  -- Enseignant → CP A de l'école 1
  IF v_first_classe IS NOT NULL THEN
    INSERT INTO enseignant_classes (enseignant_id, classe_id)
    VALUES (v_enseignant_id, v_first_classe)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Coordo → écoles 1-10 + collège 1
  FOR i IN 1..10 LOOP
    INSERT INTO coordo_etablissements (coordo_id, etablissement_id)
    VALUES (v_coordo_id, v_ecole_ids[i])
    ON CONFLICT DO NOTHING;
  END LOOP;
  INSERT INTO coordo_etablissements (coordo_id, etablissement_id)
  VALUES (v_coordo_id, v_college_ids[1])
  ON CONFLICT DO NOTHING;

  -- IEN → écoles 11-20 + collèges 2-4
  FOR i IN 11..20 LOOP
    INSERT INTO ien_etablissements (ien_id, etablissement_id)
    VALUES (v_ien_id, v_ecole_ids[i])
    ON CONFLICT DO NOTHING;
  END LOOP;
  FOR i IN 2..4 LOOP
    INSERT INTO ien_etablissements (ien_id, etablissement_id)
    VALUES (v_ien_id, v_college_ids[i])
    ON CONFLICT DO NOTHING;
  END LOOP;

  RAISE NOTICE '✅ Simulation terminée — 7 comptes démo, 20 écoles, 4 collèges';
  RAISE NOTICE '   Comptes : *@fluence-demo.fr / Demo1234!';
  RAISE NOTICE '   recteur · admin · coordo · ien · directeur · principal · enseignant';

END $$;
