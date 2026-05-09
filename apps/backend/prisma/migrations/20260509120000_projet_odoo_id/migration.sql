-- Mapping bidirectionnel Projet AQ ↔ project.project Odoo (2026-05-09).
-- Décision Fabien : les Projets Agri Qodo doivent être exactement les
-- mêmes que les project.project Odoo, sync bidirectionnelle.
--
-- - `odoo_project_id` UNIQUE par tenant (un projet AQ = un project.project
--   Odoo, et inversement).
-- - NULL = projet créé localement et pas encore poussé vers Odoo (Odoo
--   non configuré, push échoué, etc.). Sera rempli au premier push réussi.
-- - `odoo_synced_at` : timestamp du dernier pull réussi depuis Odoo.
--   Sert au diagnostic (« dernière sync à hh:mm ») et au tri.

ALTER TABLE "projets"
  ADD COLUMN "odoo_project_id" INTEGER,
  ADD COLUMN "odoo_synced_at" TIMESTAMP(3);

-- Index unique partiel : un même project.project Odoo ne peut être
-- mappé qu'une fois par tenant. NULL toléré (plusieurs projets non
-- encore poussés peuvent coexister).
CREATE UNIQUE INDEX "projets_tenant_odoo_project_id_unique"
  ON "projets"("tenant_id", "odoo_project_id")
  WHERE "odoo_project_id" IS NOT NULL;
