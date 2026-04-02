-- Migration: Ajouter onboarding_done à profils
-- Les directeurs/principaux seront redirigés vers /dashboard/onboarding
-- tant que ce flag est false

ALTER TABLE profils ADD COLUMN IF NOT EXISTS onboarding_done boolean NOT NULL DEFAULT false;

-- Marquer les profils existants comme ayant déjà fait l'onboarding
UPDATE profils SET onboarding_done = true WHERE role IN ('directeur', 'principal');
