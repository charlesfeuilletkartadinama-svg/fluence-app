-- ══════════════════════════════════════════════════════════════
-- RESET COMPLET — Supprime toutes les données fictives
-- NE TOUCHE PAS aux profils (comptes utilisateurs conservés)
-- ══════════════════════════════════════════════════════════════

-- Désactiver les vérifications FK temporairement
SET session_replication_role = replica;

TRUNCATE audit_logs CASCADE;
TRUNCATE test_attempts CASCADE;
TRUNCATE session_eleves CASCADE;
TRUNCATE test_sessions CASCADE;
TRUNCATE qcm_questions CASCADE;
TRUNCATE qcm_tests CASCADE;
TRUNCATE passations CASCADE;
TRUNCATE config_normes CASCADE;
TRUNCATE enseignant_classes CASCADE;
-- Truncate affectations si la table existe
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'affectations') THEN
    EXECUTE 'TRUNCATE affectations CASCADE';
  END IF;
END $$;
TRUNCATE eleves CASCADE;
TRUNCATE classes CASCADE;
TRUNCATE periodes CASCADE;
TRUNCATE invitations CASCADE;
TRUNCATE coordo_etablissements CASCADE;
TRUNCATE ien_etablissements CASCADE;
TRUNCATE etablissements CASCADE;
-- NE PAS truncate profils, departements, circonscriptions, villes, academies, config_groupes

-- Réactiver les contraintes
SET session_replication_role = DEFAULT;
