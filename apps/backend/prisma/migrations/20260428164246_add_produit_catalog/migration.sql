-- CreateEnum
CREATE TYPE "ProduitCategorie" AS ENUM ('SEMENCE', 'ENGRAIS_MINERAL', 'ENGRAIS_ORGANIQUE', 'PHYTO', 'AUTRE');

-- CreateEnum
CREATE TYPE "ProduitUnite" AS ENUM ('KG', 'L', 'T', 'M3', 'DOSE');

-- CreateTable
CREATE TABLE "produits" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "categorie" "ProduitCategorie" NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "fournisseur" TEXT,
    "marque" TEXT,
    "espece_code" TEXT,
    "taux_n" DECIMAL(8,3),
    "taux_p" DECIMAL(8,3),
    "taux_k" DECIMAL(8,3),
    "unite" "ProduitUnite" NOT NULL DEFAULT 'KG',
    "notes" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "produits_code_key" ON "produits"("code");

-- CreateIndex
CREATE INDEX "produits_tenant_id_idx" ON "produits"("tenant_id");

-- CreateIndex
CREATE INDEX "produits_categorie_idx" ON "produits"("categorie");

-- AddForeignKey
ALTER TABLE "produits" ADD CONSTRAINT "produits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "exploitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
