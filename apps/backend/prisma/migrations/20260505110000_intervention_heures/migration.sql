-- PRD fusion-interventions v0.2 — décision 2026-05-05.
-- Ajoute la saisie d'heures sur Intervention (Carnet des champs).
-- Mono-utilisateur (l'auteur), affichage conditionné par
-- Exploitation.heuresVisiblesCarnet. Soit dureeMinutes seul, soit
-- heureDebut+heureFin (calcul auto de dureeMinutes côté service).

ALTER TABLE "interventions"
    ADD COLUMN "heure_debut" TIMESTAMP(3),
    ADD COLUMN "heure_fin" TIMESTAMP(3),
    ADD COLUMN "duree_minutes" INTEGER;
