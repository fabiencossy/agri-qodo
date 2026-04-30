-- CreateEnum
CREATE TYPE "TravailStatut" AS ENUM ('DRAFT', 'VALIDATED', 'INVOICED', 'CANCELLED');

-- DropIndex
DROP INDEX "exploitations_localite_trgm_idx";

-- DropIndex
DROP INDEX "exploitations_nom_trgm_idx";

-- DropIndex
DROP INDEX "interventions_geom_idx";

-- CreateTable
CREATE TABLE "travaux" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "partenaire_id" TEXT,
    "parcelle_id" TEXT,
    "titre" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "date_debut" TIMESTAMP(3),
    "date_fin" TIMESTAMP(3),
    "statut" "TravailStatut" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "odoo_sale_order_id" INTEGER,
    "invoiced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travaux_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travail_lignes_produit" (
    "id" TEXT NOT NULL,
    "travail_id" TEXT NOT NULL,
    "produit_id" TEXT,
    "libelle" TEXT NOT NULL,
    "quantite" DECIMAL(12,3) NOT NULL,
    "unite" TEXT NOT NULL DEFAULT 'kg',
    "prix_unitaire_chf" DECIMAL(12,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "travail_lignes_produit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travail_lignes_heure" (
    "id" TEXT NOT NULL,
    "travail_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "duree_minutes" INTEGER NOT NULL,
    "taux_horaire_chf" DECIMAL(12,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "travail_lignes_heure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "travaux_tenant_id_idx" ON "travaux"("tenant_id");

-- CreateIndex
CREATE INDEX "travaux_partenaire_id_idx" ON "travaux"("partenaire_id");

-- CreateIndex
CREATE INDEX "travaux_parcelle_id_idx" ON "travaux"("parcelle_id");

-- CreateIndex
CREATE INDEX "travaux_statut_idx" ON "travaux"("statut");

-- CreateIndex
CREATE INDEX "travaux_date_idx" ON "travaux"("date");

-- CreateIndex
CREATE INDEX "travail_lignes_produit_travail_id_idx" ON "travail_lignes_produit"("travail_id");

-- CreateIndex
CREATE INDEX "travail_lignes_produit_produit_id_idx" ON "travail_lignes_produit"("produit_id");

-- CreateIndex
CREATE INDEX "travail_lignes_heure_travail_id_idx" ON "travail_lignes_heure"("travail_id");

-- CreateIndex
CREATE INDEX "travail_lignes_heure_user_id_idx" ON "travail_lignes_heure"("user_id");

-- AddForeignKey
ALTER TABLE "travaux" ADD CONSTRAINT "travaux_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "exploitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travaux" ADD CONSTRAINT "travaux_partenaire_id_fkey" FOREIGN KEY ("partenaire_id") REFERENCES "exploitations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travaux" ADD CONSTRAINT "travaux_parcelle_id_fkey" FOREIGN KEY ("parcelle_id") REFERENCES "parcelles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travail_lignes_produit" ADD CONSTRAINT "travail_lignes_produit_travail_id_fkey" FOREIGN KEY ("travail_id") REFERENCES "travaux"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travail_lignes_produit" ADD CONSTRAINT "travail_lignes_produit_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travail_lignes_heure" ADD CONSTRAINT "travail_lignes_heure_travail_id_fkey" FOREIGN KEY ("travail_id") REFERENCES "travaux"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travail_lignes_heure" ADD CONSTRAINT "travail_lignes_heure_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
