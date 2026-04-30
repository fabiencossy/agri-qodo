-- Mapping res.partner Odoo : id du contact côté Odoo de l'owner du
-- PartnerLink. Renseigné par le service de push sale.order pour
-- éviter de re-créer un res.partner à chaque devis.

ALTER TABLE "partner_links" ADD COLUMN IF NOT EXISTS "odoo_partner_id" INTEGER;
