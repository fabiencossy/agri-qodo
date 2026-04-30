-- Rendement à l'hectare optionnel (utile sur RECOLTE pour suivre la
-- productivité par parcelle multi-année). Unité = celle saisie sur
-- Intervention.unite (kg, t, q…).
ALTER TABLE "interventions"
    ADD COLUMN "rendement_par_ha" DECIMAL(12,3);
