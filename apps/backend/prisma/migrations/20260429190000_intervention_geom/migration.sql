-- Plan d'assolement spatial — l'intervention peut désormais porter sur
-- une sous-zone précise de la parcelle (polygone). Si NULL, l'intervention
-- couvre toute la parcelle (comportement legacy conservé).
--
-- Validation ST_Within parcelle.geom appliquée côté service (Nest), pas en
-- contrainte SQL : Prisma ne sait pas exprimer ce type de check, et un
-- trigger ralentirait inutilement les imports en bulk.

ALTER TABLE "interventions"
  ADD COLUMN "geom" geometry(Polygon, 4326);

CREATE INDEX "interventions_geom_idx" ON "interventions" USING GIST ("geom");
