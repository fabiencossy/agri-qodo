-- Lien Produit ↔ Odoo product.product
-- Permet l'import idempotent depuis Odoo via la sync /api/produits/sync-odoo.

ALTER TABLE "produits" ADD COLUMN IF NOT EXISTS "odoo_product_id" INTEGER;
ALTER TABLE "produits" ADD COLUMN IF NOT EXISTS "odoo_synced_at" TIMESTAMP(3);

-- Unicité (tenantId, odooProductId) pour éviter les doublons à la
-- re-synchronisation. La contrainte autorise plusieurs NULL grâce à la
-- sémantique Postgres (deux NULL ne sont pas égaux).
CREATE UNIQUE INDEX IF NOT EXISTS "produits_tenant_odoo_product_unique"
  ON "produits" ("tenant_id", "odoo_product_id");
