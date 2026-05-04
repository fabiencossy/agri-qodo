-- Travail interne : on ne crée pas de devis Odoo (sale.order) mais une
-- project.task avec le détail (heures, employés, parcelle...) dans le
-- chatter Odoo. Champ optionnel.

ALTER TABLE "travaux"
  ADD COLUMN "odoo_task_id" INTEGER;
