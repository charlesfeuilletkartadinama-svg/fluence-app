-- Migration 006: Déprécier eleves.classe_id (source de vérité = affectations)
COMMENT ON COLUMN eleves.classe_id IS 'DEPRECATED — source de vérité = table affectations. Conservé pour compatibilité ascendante.';
