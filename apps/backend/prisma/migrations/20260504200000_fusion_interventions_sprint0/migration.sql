-- PRD fusion-interventions v0.2 — Sprint 0
-- Migration additive et non destructive : aucun drop, aucun rename.
-- 1) customFields JSON sur interventions et travaux (q4 PRD).
-- 2) Settings tenant : 3 toggles d'affichage des heures par onglet.
--    (Pas de table InterventionParticipant : multi-employés retiré 2026-05-04.)

-- 1. customFields
ALTER TABLE "interventions" ADD COLUMN "custom_fields" JSONB;
ALTER TABLE "travaux"       ADD COLUMN "custom_fields" JSONB;

-- 2. Settings tenant : afficher / masquer les champs heures par onglet
-- (Carnet, Travail pour tiers, Travail interne). True par défaut pour
-- les nouveaux tenants ET les tenants existants (back-compat).
ALTER TABLE "exploitations"
    ADD COLUMN "heures_visibles_carnet" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "exploitations"
    ADD COLUMN "heures_visibles_travaux_tiers" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "exploitations"
    ADD COLUMN "heures_visibles_travaux_interne" BOOLEAN NOT NULL DEFAULT true;
