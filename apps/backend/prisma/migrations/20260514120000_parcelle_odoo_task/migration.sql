-- Mapping Parcelle → project.task Odoo (décision Fabien 2026-05-14).
-- Une tâche unique par parcelle dans le projet Carnet configuré ;
-- toutes les interventions sur la parcelle posteront leurs heures
-- (account.analytic.line) et un résumé (mail.message) sur cette tâche.

ALTER TABLE "parcelles"
  ADD COLUMN "odoo_task_id" INTEGER,
  ADD COLUMN "odoo_task_pushed_at" TIMESTAMP(3);

-- Idempotence du push timesheet : si renseigné, on write() la ligne
-- analytique existante côté Odoo plutôt que d'en créer une nouvelle.
ALTER TABLE "interventions"
  ADD COLUMN "odoo_analytic_line_id" INTEGER;
