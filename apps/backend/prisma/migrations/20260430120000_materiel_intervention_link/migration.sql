-- CreateEnum
CREATE TYPE "MaterielCategorie" AS ENUM (
    'TRAVAIL_DU_SOL',
    'SEMIS',
    'FERTILISATION',
    'PROTECTION',
    'RECOLTE',
    'IRRIGATION',
    'TRANSPORT',
    'AUTRE'
);

-- CreateEnum
CREATE TYPE "MaterielUnite" AS ENUM ('HA', 'M3', 'T', 'H', 'FORFAIT');

-- CreateTable
CREATE TABLE "materiels" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "categorie" "MaterielCategorie" NOT NULL,
    "unite" "MaterielUnite" NOT NULL DEFAULT 'HA',
    "prix_unitaire_chf" DECIMAL(12,2),
    "odoo_product_id" INTEGER,
    "odoo_synced_at" TIMESTAMP(3),
    "notes" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materiels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "materiels_code_key" ON "materiels"("code");

-- CreateIndex
CREATE INDEX "materiels_tenant_id_idx" ON "materiels"("tenant_id");

-- CreateIndex
CREATE INDEX "materiels_categorie_idx" ON "materiels"("categorie");

-- CreateIndex
CREATE UNIQUE INDEX "materiels_tenant_id_odoo_product_id_key" ON "materiels"("tenant_id", "odoo_product_id");

-- AddForeignKey
ALTER TABLE "materiels"
    ADD CONSTRAINT "materiels_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "exploitations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable interventions : matériel utilisé + surface ha + lien Travail (cas B)
ALTER TABLE "interventions"
    ADD COLUMN "materiel_id" TEXT,
    ADD COLUMN "surface_ha" DECIMAL(10,4),
    ADD COLUMN "linked_travail_id" TEXT;

-- CreateIndex
CREATE INDEX "interventions_materiel_id_idx" ON "interventions"("materiel_id");

-- CreateIndex (1-1 vers travail prestataire)
CREATE UNIQUE INDEX "interventions_linked_travail_id_key" ON "interventions"("linked_travail_id");

-- AddForeignKey
ALTER TABLE "interventions"
    ADD CONSTRAINT "interventions_materiel_id_fkey"
    FOREIGN KEY ("materiel_id") REFERENCES "materiels"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions"
    ADD CONSTRAINT "interventions_linked_travail_id_fkey"
    FOREIGN KEY ("linked_travail_id") REFERENCES "travaux"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
