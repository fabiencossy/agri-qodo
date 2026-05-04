-- PRD fusion-interventions v0.2 — Sprint 0
-- Migration additive et non destructive : aucun drop, aucun rename.
-- 1) customFields JSON sur interventions et travaux (q4 PRD).
-- 2) Table intervention_participants pour multi-employés (q5 PRD).
-- 3) Setting tenant suiviHeuresActif (heures partout + toggle param).

-- 1. customFields
ALTER TABLE "interventions" ADD COLUMN "custom_fields" JSONB;
ALTER TABLE "travaux"       ADD COLUMN "custom_fields" JSONB;

-- 3. Setting tenant : afficher / masquer les heures sur toutes les
-- activités (Carnet, Travail tiers, Travail interne). True par défaut
-- pour les nouveaux tenants ET pour les tenants existants (back-compat).
ALTER TABLE "exploitations"
    ADD COLUMN "suivi_heures_actif" BOOLEAN NOT NULL DEFAULT true;

-- 2. InterventionParticipant
CREATE TABLE "intervention_participants" (
    "id"              TEXT NOT NULL,
    "intervention_id" TEXT NOT NULL,
    "user_id"         TEXT NOT NULL,
    "duree_minutes"   INTEGER,
    "notes"           TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intervention_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "intervention_participants_intervention_id_user_id_key"
    ON "intervention_participants"("intervention_id", "user_id");

CREATE INDEX "intervention_participants_user_id_idx"
    ON "intervention_participants"("user_id");

ALTER TABLE "intervention_participants"
    ADD CONSTRAINT "intervention_participants_intervention_id_fkey"
    FOREIGN KEY ("intervention_id") REFERENCES "interventions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "intervention_participants"
    ADD CONSTRAINT "intervention_participants_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
