-- PRD prestations v0.3 §2 — 3 projets Odoo cibles configurés par tenant.
-- IDs Odoo (entiers) mémorisés côté Agri Qodo pour driver upsertTask
-- de OdooSyncService. La vérité vit côté Odoo, on stocke juste l'ID.

ALTER TABLE "exploitations"
    ADD COLUMN "odoo_project_id_travaux_tiers"  INTEGER,
    ADD COLUMN "odoo_project_id_carnet_tiers"   INTEGER,
    ADD COLUMN "odoo_project_id_carnet_interne" INTEGER;
