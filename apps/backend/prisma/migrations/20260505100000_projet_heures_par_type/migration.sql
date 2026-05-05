-- PRD fusion-interventions v0.2 — décision 2026-05-05.
-- Ajoute 3 FK Projet sur Exploitation : projet d'imputation des heures
-- saisies par onglet (Carnet / Travaux tiers / Travaux interne).
-- Obligatoire (validation service) dès que le toggle heures_visibles_*
-- correspondant est ON. Nullable au niveau DB pour permettre OFF.
-- Type TEXT (pas UUID) pour cohérence avec projets.id (Prisma @default(uuid)).

ALTER TABLE "exploitations"
    ADD COLUMN "projet_heures_carnet_id" TEXT,
    ADD COLUMN "projet_heures_travaux_tiers_id" TEXT,
    ADD COLUMN "projet_heures_travaux_interne_id" TEXT;

ALTER TABLE "exploitations"
    ADD CONSTRAINT "exploitations_projet_heures_carnet_id_fkey"
    FOREIGN KEY ("projet_heures_carnet_id") REFERENCES "projets"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "exploitations"
    ADD CONSTRAINT "exploitations_projet_heures_travaux_tiers_id_fkey"
    FOREIGN KEY ("projet_heures_travaux_tiers_id") REFERENCES "projets"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "exploitations"
    ADD CONSTRAINT "exploitations_projet_heures_travaux_interne_id_fkey"
    FOREIGN KEY ("projet_heures_travaux_interne_id") REFERENCES "projets"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
