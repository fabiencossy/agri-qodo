-- CreateTable
CREATE TABLE "plan_apports" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "parcelle_id" TEXT NOT NULL,
    "campagne" INTEGER NOT NULL,
    "date_prevue" TIMESTAMP(3),
    "produit_id" TEXT,
    "produit_libre" TEXT,
    "quantite_prevue" DECIMAL(12,3),
    "unite" TEXT,
    "kg_n_prevu" DECIMAL(10,2),
    "kg_p_prevu" DECIMAL(10,2),
    "technique" "TechniqueEpandage",
    "notes" TEXT,
    "intervention_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_apports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_apports_intervention_id_key" ON "plan_apports"("intervention_id");

-- CreateIndex
CREATE INDEX "plan_apports_tenant_id_idx" ON "plan_apports"("tenant_id");

-- CreateIndex
CREATE INDEX "plan_apports_parcelle_id_idx" ON "plan_apports"("parcelle_id");

-- CreateIndex
CREATE INDEX "plan_apports_campagne_idx" ON "plan_apports"("campagne");

-- AddForeignKey
ALTER TABLE "plan_apports" ADD CONSTRAINT "plan_apports_parcelle_id_fkey" FOREIGN KEY ("parcelle_id") REFERENCES "parcelles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_apports" ADD CONSTRAINT "plan_apports_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_apports" ADD CONSTRAINT "plan_apports_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "interventions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
