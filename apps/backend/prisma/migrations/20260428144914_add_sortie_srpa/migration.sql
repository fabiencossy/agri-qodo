-- CreateTable
CREATE TABLE "sorties_srpa" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "categorie" "AnimalCategorie" NOT NULL,
    "nombre_animaux" INTEGER,
    "duree_minutes" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sorties_srpa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sorties_srpa_tenant_id_idx" ON "sorties_srpa"("tenant_id");

-- CreateIndex
CREATE INDEX "sorties_srpa_date_idx" ON "sorties_srpa"("date");

-- CreateIndex
CREATE UNIQUE INDEX "sorties_srpa_tenant_id_date_categorie_key" ON "sorties_srpa"("tenant_id", "date", "categorie");

-- AddForeignKey
ALTER TABLE "sorties_srpa" ADD CONSTRAINT "sorties_srpa_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "exploitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
