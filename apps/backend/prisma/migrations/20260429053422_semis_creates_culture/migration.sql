-- AlterTable
ALTER TABLE "interventions" ADD COLUMN     "culture_id" TEXT,
ADD COLUMN     "produit_id" TEXT;

-- CreateIndex
CREATE INDEX "interventions_produit_id_idx" ON "interventions"("produit_id");

-- CreateIndex
CREATE INDEX "interventions_culture_id_idx" ON "interventions"("culture_id");

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_culture_id_fkey" FOREIGN KEY ("culture_id") REFERENCES "cultures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
