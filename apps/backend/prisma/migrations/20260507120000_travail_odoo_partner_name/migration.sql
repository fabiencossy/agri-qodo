-- Cache local du nom du res.partner Odoo (chantier 2026-05-07).
-- Posé au save par le picker partenaire qui connaît déjà le nom.
-- Permet d'afficher "Boulangerie X" au lieu de "Client Odoo" sur la
-- fiche /travaux/[id] sans round-trip XML-RPC à chaque GET.

ALTER TABLE "travaux" ADD COLUMN "odoo_partner_name" TEXT;
