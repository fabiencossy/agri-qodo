-- Permet d'associer une parcelle à un client Odoo non-partenaire
-- (Fabien 2026-05-06). Le tenantId reste celui du prestataire ; le
-- odoo_partner_id sert au filtrage quand l'utilisateur resélectionne
-- le même client dans /interventions/new ou /travaux/new.

ALTER TABLE "parcelles" ADD COLUMN "odoo_partner_id" INTEGER;
CREATE INDEX "parcelles_odoo_partner_id_idx" ON "parcelles"("odoo_partner_id");
