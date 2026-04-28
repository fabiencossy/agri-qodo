-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "Canton" AS ENUM ('VD', 'GE', 'FR', 'NE', 'JU', 'VS', 'BE', 'ZH', 'AG', 'SO', 'LU', 'TG', 'SG', 'GR', 'TI', 'BL', 'BS', 'SH', 'AR', 'AI', 'GL', 'NW', 'OW', 'SZ', 'UR', 'ZG');

-- CreateEnum
CREATE TYPE "ZoneAgricole" AS ENUM ('ZA', 'ZP', 'ZM1', 'ZM2', 'ZM3', 'ZM4', 'ZE');

-- CreateEnum
CREATE TYPE "InterventionType" AS ENUM ('SEMIS', 'FUMURE_ORGANIQUE', 'FUMURE_MINERALE', 'PHYTO', 'RECOLTE', 'TRAVAIL_DU_SOL', 'IRRIGATION', 'AUTRE');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('SELF', 'PENDING', 'VALIDATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AnimalCategorie" AS ENUM ('VACHE_LAITIERE', 'GENISSE', 'VEAU', 'TAUREAU', 'BOEUF', 'AUTRE_BOVIN', 'PORC', 'POULET', 'AUTRE');

-- CreateEnum
CREATE TYPE "PartnerLinkStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "PartnerLinkLevel" AS ENUM ('LECTURE', 'VALIDATION', 'DIRECT');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'EMPLOYE', 'COMPTABLE', 'CONSULTANT');

-- CreateTable
CREATE TABLE "exploitations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "canton" "Canton" NOT NULL,
    "numero_ufam" TEXT,
    "numero_bdta" TEXT,
    "adresse" TEXT,
    "npa" TEXT,
    "localite" TEXT,
    "email_contact" TEXT,
    "telephone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exploitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OWNER',
    "tenant_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcelles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "identifiant_cadastral" TEXT,
    "surface_m2" DECIMAL(12,2) NOT NULL,
    "zone" "ZoneAgricole" NOT NULL,
    "geom" geometry(MultiPolygon, 4326),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parcelles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cultures" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "parcelle_id" TEXT NOT NULL,
    "espece" TEXT NOT NULL,
    "variete" TEXT,
    "date_semis" TIMESTAMP(3),
    "date_recolte" TIMESTAMP(3),
    "campagne" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cultures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interventions" (
    "id" TEXT NOT NULL,
    "client_uuid" TEXT NOT NULL,
    "owner_tenant_id" TEXT NOT NULL,
    "author_tenant_id" TEXT NOT NULL,
    "parcelle_id" TEXT NOT NULL,
    "type" "InterventionType" NOT NULL,
    "date_operation" TIMESTAMP(3) NOT NULL,
    "produit" TEXT,
    "quantite" DECIMAL(12,3),
    "unite" TEXT,
    "notes" TEXT,
    "validation_status" "ValidationStatus" NOT NULL DEFAULT 'SELF',
    "validated_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interventions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animaux" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "numero_boucle" TEXT,
    "nom" TEXT,
    "categorie" "AnimalCategorie" NOT NULL,
    "date_naissance" TIMESTAMP(3),
    "lot_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "animaux_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots_animaux" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lots_animaux_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_links" (
    "id" TEXT NOT NULL,
    "owner_tenant_id" TEXT NOT NULL,
    "partner_tenant_id" TEXT NOT NULL,
    "scope" JSONB NOT NULL,
    "niveau" "PartnerLinkLevel" NOT NULL,
    "status" "PartnerLinkStatus" NOT NULL DEFAULT 'PENDING',
    "granted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exploitations_code_key" ON "exploitations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "parcelles_tenant_id_idx" ON "parcelles"("tenant_id");

-- CreateIndex
CREATE INDEX "cultures_tenant_id_idx" ON "cultures"("tenant_id");

-- CreateIndex
CREATE INDEX "cultures_parcelle_id_idx" ON "cultures"("parcelle_id");

-- CreateIndex
CREATE INDEX "cultures_campagne_idx" ON "cultures"("campagne");

-- CreateIndex
CREATE UNIQUE INDEX "interventions_client_uuid_key" ON "interventions"("client_uuid");

-- CreateIndex
CREATE INDEX "interventions_owner_tenant_id_idx" ON "interventions"("owner_tenant_id");

-- CreateIndex
CREATE INDEX "interventions_author_tenant_id_idx" ON "interventions"("author_tenant_id");

-- CreateIndex
CREATE INDEX "interventions_parcelle_id_idx" ON "interventions"("parcelle_id");

-- CreateIndex
CREATE INDEX "interventions_date_operation_idx" ON "interventions"("date_operation");

-- CreateIndex
CREATE INDEX "interventions_validation_status_idx" ON "interventions"("validation_status");

-- CreateIndex
CREATE UNIQUE INDEX "animaux_numero_boucle_key" ON "animaux"("numero_boucle");

-- CreateIndex
CREATE INDEX "animaux_tenant_id_idx" ON "animaux"("tenant_id");

-- CreateIndex
CREATE INDEX "animaux_lot_id_idx" ON "animaux"("lot_id");

-- CreateIndex
CREATE INDEX "lots_animaux_tenant_id_idx" ON "lots_animaux"("tenant_id");

-- CreateIndex
CREATE INDEX "partner_links_status_idx" ON "partner_links"("status");

-- CreateIndex
CREATE UNIQUE INDEX "partner_links_owner_tenant_id_partner_tenant_id_key" ON "partner_links"("owner_tenant_id", "partner_tenant_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "exploitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcelles" ADD CONSTRAINT "parcelles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "exploitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cultures" ADD CONSTRAINT "cultures_parcelle_id_fkey" FOREIGN KEY ("parcelle_id") REFERENCES "parcelles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_owner_tenant_id_fkey" FOREIGN KEY ("owner_tenant_id") REFERENCES "exploitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_author_tenant_id_fkey" FOREIGN KEY ("author_tenant_id") REFERENCES "exploitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_parcelle_id_fkey" FOREIGN KEY ("parcelle_id") REFERENCES "parcelles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animaux" ADD CONSTRAINT "animaux_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "exploitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animaux" ADD CONSTRAINT "animaux_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots_animaux"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots_animaux" ADD CONSTRAINT "lots_animaux_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "exploitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_links" ADD CONSTRAINT "partner_links_owner_tenant_id_fkey" FOREIGN KEY ("owner_tenant_id") REFERENCES "exploitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_links" ADD CONSTRAINT "partner_links_partner_tenant_id_fkey" FOREIGN KEY ("partner_tenant_id") REFERENCES "exploitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
