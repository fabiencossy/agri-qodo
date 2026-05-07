-- TVA suisse sur Produit + Materiel (chantier 2026-05-07).
-- Null = non configuré → Odoo utilise sa taxe par défaut au push.
-- Valeurs cibles : 8.10, 2.60, 3.80, 0.00 (taux CH 2024+).

ALTER TABLE "produits" ADD COLUMN "taux_tva_percent" DECIMAL(5,2);
ALTER TABLE "materiels" ADD COLUMN "taux_tva_percent" DECIMAL(5,2);
