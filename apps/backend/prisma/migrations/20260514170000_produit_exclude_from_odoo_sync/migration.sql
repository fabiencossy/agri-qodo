-- Flag pour exclure un produit des sync Odoo (Fabien 2026-05-14 image 58).
-- Permet de protéger les modifications locales (catégorie corrigée,
-- libellé renommé) contre l'écrasement par la sync auto/manuelle.

ALTER TABLE "produits"
  ADD COLUMN "exclude_from_odoo_sync" BOOLEAN NOT NULL DEFAULT false;
