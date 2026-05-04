-- Travail.projetId : étiquette de regroupement libre.
-- Set null si le projet est supprimé.

ALTER TABLE "travaux"
  ADD COLUMN "projet_id" TEXT;

CREATE INDEX "travaux_projet_id_idx" ON "travaux" ("projet_id");

ALTER TABLE "travaux"
  ADD CONSTRAINT "travaux_projet_id_fkey"
  FOREIGN KEY ("projet_id") REFERENCES "projets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
