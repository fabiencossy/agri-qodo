-- Webhook temps réel Odoo → Agri Qodo (Fabien 2026-05-14).

ALTER TABLE "exploitations"
  ADD COLUMN "odoo_webhook_token" TEXT,
  ADD COLUMN "odoo_webhook_enabled_at" TIMESTAMP(3);
