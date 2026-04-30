-- Cas A : référence project.task Odoo créé pour l'intervention perso
-- (sans facturation). En cas B c'est linkedTravailId qui pointe vers
-- le Travail facturable porteur du sale.order.
ALTER TABLE "interventions"
    ADD COLUMN "odoo_task_id" INTEGER,
    ADD COLUMN "odoo_task_pushed_at" TIMESTAMP(3);

CREATE INDEX "interventions_odoo_task_id_idx" ON "interventions"("odoo_task_id");
