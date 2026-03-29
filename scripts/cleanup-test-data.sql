-- ============================================================
-- SCRIPT DE NETTOYAGE DES DONNÉES [TEST]
-- Exécuter dans Supabase SQL Editor pour supprimer toutes les
-- données fictives générées pour les tests.
-- ============================================================

-- 1. Supprimer les passations liées aux élèves [TEST]
DELETE FROM passations WHERE eleve_id IN (
  SELECT id FROM eleves WHERE classe_id IN (
    SELECT id FROM classes WHERE nom LIKE '[TEST]%'
  )
);

-- 2. Supprimer les passations faites par des enseignants [TEST]
DELETE FROM passations WHERE enseignant_id IN (
  SELECT id FROM profils WHERE nom LIKE '[TEST]%'
);

-- 3. Supprimer les assignations enseignant-classe [TEST]
DELETE FROM enseignant_classes WHERE enseignant_id IN (
  SELECT id FROM profils WHERE nom LIKE '[TEST]%'
);
DELETE FROM enseignant_classes WHERE classe_id IN (
  SELECT id FROM classes WHERE nom LIKE '[TEST]%'
);

-- 4. Supprimer les élèves [TEST]
DELETE FROM eleves WHERE classe_id IN (
  SELECT id FROM classes WHERE nom LIKE '[TEST]%'
);

-- 5. Supprimer les classes [TEST]
DELETE FROM classes WHERE nom LIKE '[TEST]%';

-- 6. Supprimer les affectations réseau [TEST]
DELETE FROM ien_etablissements WHERE ien_id IN (
  SELECT id FROM profils WHERE nom LIKE '[TEST]%'
);
DELETE FROM coordo_etablissements WHERE coordo_id IN (
  SELECT id FROM profils WHERE nom LIKE '[TEST]%'
);

-- 7. Supprimer les périodes [TEST]
DELETE FROM periodes WHERE etablissement_id IN (
  SELECT id FROM etablissements WHERE nom LIKE '[TEST]%'
);

-- 8. Supprimer les normes liées aux périodes supprimées
DELETE FROM config_normes WHERE periode_id NOT IN (
  SELECT id FROM periodes
);

-- 9. Supprimer les profils [TEST]
DELETE FROM profils WHERE nom LIKE '[TEST]%';

-- 10. Supprimer les utilisateurs auth [TEST]
DELETE FROM auth.identities WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE 'test-%@fluence-test.fr'
);
DELETE FROM auth.users WHERE email LIKE 'test-%@fluence-test.fr';

-- 11. Supprimer les établissements [TEST]
DELETE FROM etablissements WHERE nom LIKE '[TEST]%';

-- Vérification
SELECT
  (SELECT count(*) FROM etablissements WHERE nom LIKE '[TEST]%') as etab_restants,
  (SELECT count(*) FROM classes WHERE nom LIKE '[TEST]%') as classes_restantes,
  (SELECT count(*) FROM profils WHERE nom LIKE '[TEST]%') as profils_restants;
