-- Migration: Ajouter started_at à test_sessions pour validation timer côté serveur
-- À exécuter AVANT la mise à jour de submit_qcm_individual

ALTER TABLE test_sessions ADD COLUMN IF NOT EXISTS started_at timestamptz;

-- Remplir les sessions existantes avec created_at comme fallback
UPDATE test_sessions SET started_at = created_at WHERE started_at IS NULL;
