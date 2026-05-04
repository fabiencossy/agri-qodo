-- Audit log générique pour l'historique des modifications matérielles.
-- Sert :
--  - de base future pour les audit logs LPD/nFADP (Mois 2 backlog),
--  - à afficher l'historique d'un enregistrement dans l'UI.

CREATE TABLE "edit_history" (
  "id"          TEXT NOT NULL,
  "tenant_id"   TEXT NOT NULL,
  "entity_type" VARCHAR(50) NOT NULL,
  "entity_id"   TEXT NOT NULL,
  "user_id"     TEXT,
  "action"      VARCHAR(20) NOT NULL,
  "diff"        JSONB,
  "meta"        JSONB,
  "edited_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "edit_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "edit_history_tenant_id_entity_type_entity_id_idx"
  ON "edit_history" ("tenant_id", "entity_type", "entity_id");

CREATE INDEX "edit_history_tenant_id_edited_at_idx"
  ON "edit_history" ("tenant_id", "edited_at");

ALTER TABLE "edit_history"
  ADD CONSTRAINT "edit_history_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "exploitations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "edit_history"
  ADD CONSTRAINT "edit_history_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
