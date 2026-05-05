-- Sprint 2 fusion-interventions — Planning.
-- Ajoute datePrevue + assignedToUserId sur Travail et Intervention.
-- Étend l'enum TravailStatut avec PLANIFIE et PENDING_REVIEW.

-- 1) Étendre l'enum TravailStatut.
ALTER TYPE "TravailStatut" ADD VALUE IF NOT EXISTS 'PLANIFIE' BEFORE 'DRAFT';
ALTER TYPE "TravailStatut" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW' BEFORE 'VALIDATED';

-- 2) Travail : datePrevue + assignedToUserId.
ALTER TABLE "travaux"
    ADD COLUMN "date_prevue" TIMESTAMP(3),
    ADD COLUMN "assigned_to_user_id" TEXT;

ALTER TABLE "travaux"
    ADD CONSTRAINT "travaux_assigned_to_user_id_fkey"
    FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "travaux_assigned_to_user_id_idx" ON "travaux"("assigned_to_user_id");
CREATE INDEX "travaux_date_prevue_idx" ON "travaux"("date_prevue");

-- 3) Intervention : datePrevue + assignedToUserId.
ALTER TABLE "interventions"
    ADD COLUMN "date_prevue" TIMESTAMP(3),
    ADD COLUMN "assigned_to_user_id" TEXT;

ALTER TABLE "interventions"
    ADD CONSTRAINT "interventions_assigned_to_user_id_fkey"
    FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "interventions_assigned_to_user_id_idx" ON "interventions"("assigned_to_user_id");
CREATE INDEX "interventions_date_prevue_idx" ON "interventions"("date_prevue");
