-- PRD prestations v0.3 — décision Fabien 2026-05-06.
-- Stocker l'ID res.partner Odoo direct sur Travail quand on cible un
-- client Odoo "seul" (= pas un partenaire Agri Qodo). Évite la création
-- de fausses Exploitations shadow + PartnerLinks pour ces clients.

ALTER TABLE "travaux" ADD COLUMN "odoo_partner_id" INTEGER;
