-- CreateEnum
CREATE TYPE "PresenceType" AS ENUM (
    'CHANTIER',
    'DEPLACEMENT',
    'REPAS',
    'PAUSE',
    'BUREAU',
    'AUTRE'
);

-- CreateTable
CREATE TABLE "presences" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "PresenceType" NOT NULL DEFAULT 'CHANTIER',
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3),
    "duree_minutes" INTEGER,
    "travail_id" TEXT,
    "linked_ligne_heure_id" TEXT,
    "latitude_debut" DECIMAL(9,6),
    "longitude_debut" DECIMAL(9,6),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "presences_tenant_id_idx" ON "presences"("tenant_id");

-- CreateIndex
CREATE INDEX "presences_user_id_idx" ON "presences"("user_id");

-- CreateIndex
CREATE INDEX "presences_date_debut_idx" ON "presences"("date_debut");

-- CreateIndex
CREATE INDEX "presences_travail_id_idx" ON "presences"("travail_id");

-- CreateIndex
CREATE UNIQUE INDEX "presences_linked_ligne_heure_id_key" ON "presences"("linked_ligne_heure_id");

-- AddForeignKey
ALTER TABLE "presences"
    ADD CONSTRAINT "presences_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "exploitations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presences"
    ADD CONSTRAINT "presences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presences"
    ADD CONSTRAINT "presences_travail_id_fkey"
    FOREIGN KEY ("travail_id") REFERENCES "travaux"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presences"
    ADD CONSTRAINT "presences_linked_ligne_heure_id_fkey"
    FOREIGN KEY ("linked_ligne_heure_id") REFERENCES "travail_lignes_heure"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
