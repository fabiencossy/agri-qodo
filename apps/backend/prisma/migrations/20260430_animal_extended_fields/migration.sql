-- Champs étendus pour Animal : sexe, date de mort, usage, secteur/label,
-- statut BVD. Tous nullable — pas de défaut, pas de contrainte enum (texte
-- libre validé côté app pour rester souple sur des espèces atypiques).

ALTER TABLE "animaux" ADD COLUMN IF NOT EXISTS "sexe" TEXT;
ALTER TABLE "animaux" ADD COLUMN IF NOT EXISTS "date_mort" TIMESTAMP(3);
ALTER TABLE "animaux" ADD COLUMN IF NOT EXISTS "usage" TEXT;
ALTER TABLE "animaux" ADD COLUMN IF NOT EXISTS "secteur_label" TEXT;
ALTER TABLE "animaux" ADD COLUMN IF NOT EXISTS "statut_bvd" TEXT;
