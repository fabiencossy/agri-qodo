-- Travail.interne : non facturable / non poussé vers Odoo (entretien,
-- formation, déplacement personnel). Default false (rétro-compat).
ALTER TABLE "travaux" ADD COLUMN IF NOT EXISTS "interne" BOOLEAN NOT NULL DEFAULT FALSE;

-- LigneTravailHeure : heure début / fin (optionnels). Quand renseignés,
-- dureeMinutes est calculée par le service avant le persist.
ALTER TABLE "travail_lignes_heure" ADD COLUMN IF NOT EXISTS "heure_debut" TIMESTAMP(3);
ALTER TABLE "travail_lignes_heure" ADD COLUMN IF NOT EXISTS "heure_fin" TIMESTAMP(3);
