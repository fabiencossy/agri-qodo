-- Profil utilisateur : champs perso + préférences UI.
ALTER TABLE "users"
    ADD COLUMN "telephone" TEXT,
    ADD COLUMN "avatar_url" TEXT,
    ADD COLUMN "preferences" JSONB;
