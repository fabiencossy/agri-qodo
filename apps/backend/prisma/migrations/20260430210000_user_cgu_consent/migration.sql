-- Consentement CGU + politique confidentialité (nFADP/RGPD)
ALTER TABLE "users"
    ADD COLUMN "cgu_accepted_at" TIMESTAMP(3),
    ADD COLUMN "cgu_version" TEXT;
