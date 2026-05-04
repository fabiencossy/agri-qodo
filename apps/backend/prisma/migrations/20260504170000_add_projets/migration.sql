-- Modèle Projet : étiquette de regroupement d'opérations.
-- Settings tenant : noter_temps_par_projet + default_projet_travaux_tiers_id.

CREATE TYPE "ProjetType" AS ENUM ('INTERVENTION', 'TRAVAUX_TIERS', 'INTERNE', 'AUTRE');

CREATE TABLE "projets" (
  "id"           TEXT NOT NULL,
  "tenant_id"    TEXT NOT NULL,
  "nom"          VARCHAR(120) NOT NULL,
  "description"  TEXT,
  "type"         "ProjetType" NOT NULL DEFAULT 'AUTRE',
  "couleur_hex"  TEXT,
  "archive"      BOOLEAN NOT NULL DEFAULT false,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "projets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "projets_tenant_id_nom_key" ON "projets" ("tenant_id", "nom");
CREATE INDEX "projets_tenant_id_archive_idx" ON "projets" ("tenant_id", "archive");

ALTER TABLE "projets"
  ADD CONSTRAINT "projets_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "exploitations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exploitations"
  ADD COLUMN "noter_temps_par_projet" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "default_projet_travaux_tiers_id" TEXT;

ALTER TABLE "exploitations"
  ADD CONSTRAINT "exploitations_default_projet_travaux_tiers_id_fkey"
  FOREIGN KEY ("default_projet_travaux_tiers_id") REFERENCES "projets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
