# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Qodo SA
"""
Endpoints REST exposés par le module pour Agri Qodo.

Auth : basée sur le user Odoo configuré dans Agri Qodo (clé API). Les
endpoints valident en plus que `x_agri_qodo_*` est cohérent.

Voir docs/PRD-odoo-prestations-tache-devis-v0.3.md §9.1.
"""
import logging

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class AgriQodoSyncController(http.Controller):
    """Endpoints utilisés par OdooSyncService côté backend Agri Qodo.

    Tous les endpoints sont sous /agri_qodo/v1/* et requièrent une
    session authentifiée Odoo (auth='user'). Le user Odoo dédié à
    Agri Qodo doit avoir les droits `agri_qodo_sync.group_sync_user`
    (cf. security/ir.model.access.csv).
    """

    @http.route(
        "/agri_qodo/v1/product/upsert",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def product_upsert(self, **payload):
        """Lazy create d'un product.template depuis Agri Qodo (PRD §3.2).

        Body JSON-RPC ``params`` :
            {
                "agri_qodo_product_id": "uuid…",
                "name": "Semence blé Arina",
                "type": "product" | "consu" | "service",
                "list_price": 12.5,
                "uom_name": "kg" (optionnel),
            }

        Renvoie ``{ "odoo_product_id": <int>, "created": bool }``.
        Idempotent : si un product.template avec
        ``x_agri_qodo_product_id`` existe déjà, on le renvoie tel quel.
        """
        agri_id = payload.get("agri_qodo_product_id")
        if not agri_id:
            return {"error": "agri_qodo_product_id manquant"}

        Tmpl = request.env["product.template"]
        existing = Tmpl.search([("x_agri_qodo_product_id", "=", agri_id)], limit=1)
        if existing:
            # On peut éventuellement mettre à jour les champs ici (prix,
            # libellé) mais pour V1 on reste idempotent strict.
            return {"odoo_product_id": existing.id, "created": False}

        vals = {
            "name": payload.get("name") or "Produit Agri Qodo",
            "type": payload.get("type") or "service",
            "list_price": payload.get("list_price", 0.0),
            "x_agri_qodo_product_id": agri_id,
            # Pour les Services on force service_tracking='no' (PRD §5.2.3).
            "service_tracking": "no",
        }
        created = Tmpl.create(vals)
        _logger.info(
            "agri_qodo: created product.template id=%s for agri_qodo_product_id=%s",
            created.id, agri_id,
        )
        return {"odoo_product_id": created.id, "created": True}

    @http.route(
        "/agri_qodo/v1/task/upsert",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def task_upsert(self, **payload):
        """Crée ou met à jour une project.task depuis Agri Qodo.

        Body JSON-RPC ``params`` :
            {
                "agri_qodo_prestation_id": "uuid…",
                "source": "travaux_tiers" | "carnet_tiers" | "carnet_interne",
                "project_id": <int>,
                "name": "Pulvérisation Vers les Bois",
                "partner_id": <int|null>,
                "date_deadline": "2026-05-12",
                "user_ids": [<int>, ...],
                "parcelle_id": "uuid…",
                "surface_ha": 3.5
            }

        Renvoie ``{ "odoo_task_id": <int>, "created": bool }``.
        """
        agri_id = payload.get("agri_qodo_prestation_id")
        if not agri_id:
            return {"error": "agri_qodo_prestation_id manquant"}

        Task = request.env["project.task"]
        existing = Task.search([("x_agri_qodo_prestation_id", "=", agri_id)], limit=1)

        vals = {
            "name": payload.get("name") or "Prestation Agri Qodo",
            "project_id": payload.get("project_id"),
            "x_agri_qodo_prestation_id": agri_id,
            "x_agri_qodo_source": payload.get("source"),
            "x_agri_qodo_parcelle_id": payload.get("parcelle_id"),
            "x_agri_qodo_surface_ha": payload.get("surface_ha") or 0.0,
        }
        if payload.get("partner_id") is not None:
            vals["partner_id"] = payload["partner_id"]
        if payload.get("date_deadline"):
            vals["date_deadline"] = payload["date_deadline"]
        if payload.get("user_ids"):
            vals["user_ids"] = [(6, 0, payload["user_ids"])]

        if existing:
            existing.write(vals)
            return {"odoo_task_id": existing.id, "created": False}
        created = Task.create(vals)
        return {"odoo_task_id": created.id, "created": True}

    @http.route(
        "/agri_qodo/v1/task/<int:task_id>/add_product",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def task_add_product(self, task_id, **payload):
        """Ajoute une ligne (Bien ou Service) au sale.order de la tâche.

        Body JSON-RPC ``params`` :
            {
                "product_id": <int>,
                "qty": 3.5,
                "price_unit": 80.0  // optionnel
            }
        """
        task = request.env["project.task"].browse(task_id)
        if not task.exists():
            return {"error": f"task {task_id} introuvable"}

        line = task.action_agri_qodo_add_product(
            product_id=payload["product_id"],
            qty=payload.get("qty", 1.0),
            price_unit=payload.get("price_unit"),
        )
        return {
            "sale_order_line_id": line.id,
            "sale_order_id": line.order_id.id,
        }
