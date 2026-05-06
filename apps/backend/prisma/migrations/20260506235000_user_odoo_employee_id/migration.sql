-- Mapping User → hr.employee Odoo pour pousser les heures saisies
-- comme feuilles de temps (account.analytic.line) sur la project.task
-- du devis client.
-- Demande Fabien 2026-05-06 (image task vide, "il faut paramétrer pour
-- mapper les utilisateurs de l'app avec les employé odoo").

ALTER TABLE "users" ADD COLUMN "odoo_employee_id" INTEGER;
CREATE INDEX "users_odoo_employee_id_idx" ON "users"("odoo_employee_id");
