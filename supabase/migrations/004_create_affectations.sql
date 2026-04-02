-- Migration 004: Table affectations (source de vérité élève → classe par année)

CREATE TABLE IF NOT EXISTS affectations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id UUID NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  classe_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  annee_scolaire TEXT NOT NULL,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(eleve_id, annee_scolaire)
);

CREATE INDEX IF NOT EXISTS idx_affectations_eleve ON affectations(eleve_id);
CREATE INDEX IF NOT EXISTS idx_affectations_classe ON affectations(classe_id);
CREATE INDEX IF NOT EXISTS idx_affectations_annee ON affectations(annee_scolaire);

-- RLS : mêmes règles que eleves
ALTER TABLE affectations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "affectations_select" ON affectations FOR SELECT USING (
  (SELECT role FROM profils WHERE id = auth.uid()) IN ('admin','directeur','principal','ia_dasen','recteur','coordo_rep','ien')
  OR EXISTS (
    SELECT 1 FROM enseignant_classes ec WHERE ec.classe_id = affectations.classe_id AND ec.enseignant_id = auth.uid()
  )
);

CREATE POLICY "affectations_write" ON affectations FOR ALL USING (
  (SELECT role FROM profils WHERE id = auth.uid()) IN ('admin','directeur','principal','ia_dasen','recteur')
);
