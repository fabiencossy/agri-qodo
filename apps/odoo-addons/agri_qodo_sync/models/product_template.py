# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Qodo SA
from odoo import fields, models


class ProductTemplate(models.Model):
    """Mapping ID Agri Qodo ↔ produit Odoo pour le lazy create (PRD §3.2)."""

    _inherit = "product.template"

    x_agri_qodo_product_id = fields.Char(
        string="Agri Qodo product ID",
        index=True,
        help="UUID du produit côté Agri Qodo. Posé à la première synchro "
             "(lazy create) pour permettre l'idempotence des appels suivants.",
    )

    _sql_constraints = [
        (
            "x_agri_qodo_product_id_unique",
            "unique(x_agri_qodo_product_id)",
            "Un produit Agri Qodo ne peut être mappé qu'à un seul produit Odoo.",
        ),
    ]
