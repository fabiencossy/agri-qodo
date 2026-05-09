-- Champs Odoo enrichis sur Projet (2026-05-09).
-- Demande Fabien : « créer un projet avec toutes les infos qu'Odoo a
-- besoin ». Les champs ci-dessous sont propagés au push Odoo
-- (`project.project`) :
-- - date_start ↔ date_debut
-- - date (deadline) ↔ date_fin
-- - allow_billable ↔ allow_billable
-- - partner_id (res.partner) ↔ odoo_partner_id (cache d'ID Odoo,
--   pas de FK locale — pattern identique à Travail.odoo_partner_id)

ALTER TABLE "projets"
  ADD COLUMN "date_debut" TIMESTAMP(3),
  ADD COLUMN "date_fin" TIMESTAMP(3),
  ADD COLUMN "allow_billable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "odoo_partner_id" INTEGER;
