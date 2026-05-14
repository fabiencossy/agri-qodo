-- Extension de ProduitUnite (Fabien 2026-05-14) : HA pour les
-- prestations facturées à l'hectare, UNITE pour les balles de foin
-- et pièces dénombrables, HEURE pour la main d'œuvre.

ALTER TYPE "ProduitUnite" ADD VALUE IF NOT EXISTS 'HA';
ALTER TYPE "ProduitUnite" ADD VALUE IF NOT EXISTS 'UNITE';
ALTER TYPE "ProduitUnite" ADD VALUE IF NOT EXISTS 'HEURE';
