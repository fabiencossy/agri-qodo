-- Produit.prixVenteCHF : prix de vente catalogue HT par unité.
-- Visible uniquement par OWNER / COMPTABLE (RBAC côté API).
-- Nullable : un produit peut être un consommable interne sans prix de vente.

ALTER TABLE "produits" ADD COLUMN IF NOT EXISTS "prix_vente_chf" DECIMAL(12, 2);
