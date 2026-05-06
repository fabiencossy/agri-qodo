-- PRD prestations v0.3 — création rapide de parcelle pour clients Odoo
-- non-partenaires (Fabien 2026-05-06). Stocke juste le point GPS du
-- centre + la surface, sans polygone complet. À enrichir plus tard via
-- la fiche parcelle.

ALTER TABLE "parcelles"
    ADD COLUMN "centre_lat" DOUBLE PRECISION,
    ADD COLUMN "centre_lng" DOUBLE PRECISION;
