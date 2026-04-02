-- Migration 003: Ajouter annee_scolaire à classes (colonne existe déjà nullable)
-- On la rend NOT NULL avec défaut

UPDATE classes SET annee_scolaire = '2025-2026' WHERE annee_scolaire IS NULL;
ALTER TABLE classes ALTER COLUMN annee_scolaire SET NOT NULL;
ALTER TABLE classes ALTER COLUMN annee_scolaire SET DEFAULT '2025-2026';
CREATE INDEX IF NOT EXISTS idx_classes_annee ON classes(annee_scolaire);
CREATE INDEX IF NOT EXISTS idx_classes_etab_annee ON classes(etablissement_id, annee_scolaire);
