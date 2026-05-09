-- Statut initial / culture en place sur la parcelle (2026-05-09).
-- Sert au Suisse-Bilanz : si aucune `Culture` n'existe pour la campagne
-- demandée et que `culture_actuelle` est posé, on l'utilise comme
-- fallback (utile pour les prairies permanentes qui n'ont pas besoin
-- d'une saisie Culture chaque année).
-- Code espèce libre — réutilise les clés `besoinNParCulture` du
-- domain (ex. prairie_permanente, ble_panifiable, …).

ALTER TABLE "parcelles" ADD COLUMN "culture_actuelle" TEXT;
