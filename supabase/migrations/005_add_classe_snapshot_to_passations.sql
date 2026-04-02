-- Migration 005: Snapshot classe sur passations
ALTER TABLE passations ADD COLUMN IF NOT EXISTS classe_id UUID REFERENCES classes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_passations_classe ON passations(classe_id);
COMMENT ON COLUMN passations.classe_id IS 'Snapshot de la classe au moment de la passation. Indépendant des affectations futures.';
