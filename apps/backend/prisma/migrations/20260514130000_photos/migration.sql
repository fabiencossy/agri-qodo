-- Photos attachées aux interventions (carnet) et travaux (tiers).
-- Stockage : push direct en ir.attachment Odoo. Cette table garde
-- les métadonnées + l'odoo_attachment_id pour servir le binaire en
-- proxy (décision Fabien 2026-05-14).

CREATE TABLE "photos" (
  "id"                  TEXT PRIMARY KEY,
  "tenant_id"           TEXT NOT NULL,
  "intervention_id"     TEXT,
  "travail_id"          TEXT,
  "uploaded_by_user_id" TEXT,
  "original_name"       TEXT NOT NULL,
  "mime_type"           TEXT NOT NULL,
  "size_bytes"          INTEGER NOT NULL,
  "odoo_attachment_id"  INTEGER,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "photos_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "exploitations"("id") ON DELETE CASCADE,
  CONSTRAINT "photos_intervention_fk"
    FOREIGN KEY ("intervention_id") REFERENCES "interventions"("id") ON DELETE CASCADE,
  CONSTRAINT "photos_travail_fk"
    FOREIGN KEY ("travail_id") REFERENCES "travaux"("id") ON DELETE CASCADE,
  CONSTRAINT "photos_user_fk"
    FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "photos_tenant_id_idx" ON "photos"("tenant_id");
CREATE INDEX "photos_intervention_id_idx" ON "photos"("intervention_id");
CREATE INDEX "photos_travail_id_idx" ON "photos"("travail_id");
