# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Qodo SA
"""
project.task étendu pour Agri Qodo.

Cœur du module : la méthode `action_agri_qodo_add_product` permet
d'ajouter un produit (Bien OU Service) au sale.order lié à la tâche,
en bypassant la limitation FSM native qui bloque les Services.

Voir docs/PRD-odoo-prestations-tache-devis-v0.3.md §5.2.1.
"""
from odoo import api, fields, models


SOURCE_SELECTION = [
    ("travaux_tiers", "Travaux pour tiers"),
    ("carnet_tiers", "Carnet des champs — tiers"),
    ("carnet_interne", "Carnet des champs — interne"),
]


class ProjectTask(models.Model):
    _inherit = "project.task"

    # ---- Champs de traçabilité Agri Qodo --------------------------------
    x_agri_qodo_prestation_id = fields.Char(
        string="Agri Qodo prestation ID",
        index=True,
        help="UUID Travail ou Intervention côté Agri Qodo.",
    )
    x_agri_qodo_source = fields.Selection(
        SOURCE_SELECTION,
        string="Source Agri Qodo",
        help="Type de prestation à l'origine de la tâche.",
    )
    x_agri_qodo_parcelle_id = fields.Char(
        string="Agri Qodo parcelle ID",
        index=True,
    )
    x_agri_qodo_surface_ha = fields.Float(
        string="Surface (ha)",
        digits=(10, 4),
        help="Surface de la parcelle utilisée pour le calcul des "
             "quantités tarifées à l'hectare (PRD §3.3).",
    )

    # ---- API d'ajout de produit (Bien ou Service) -----------------------
    def action_agri_qodo_add_product(self, product_id, qty, price_unit=None):
        """
        Ajoute un produit au sale.order lié à la tâche, indépendamment
        de son type (Bien ou Service). Crée le sale.order draft à la
        volée s'il n'existe pas encore.

        Voir PRD §5.2.1.
        """
        self.ensure_one()
        product = self.env["product.product"].browse(product_id)
        if not product.exists():
            raise ValueError(f"Produit Odoo introuvable : {product_id}")

        sale_order = self._agri_qodo_ensure_sale_order()

        line_vals = {
            "order_id": sale_order.id,
            "product_id": product.id,
            "product_uom_qty": qty,
            "task_id": self.id,
        }
        if price_unit is not None:
            line_vals["price_unit"] = price_unit

        # Pour les Services dont le service_tracking créerait sinon une
        # nouvelle tâche, on bypasse via le context flag (cf override
        # sale_order_line._timesheet_create_task).
        return self.env["sale.order.line"].with_context(
            agri_qodo_skip_task_create=True,
        ).create(line_vals)

    def _agri_qodo_ensure_sale_order(self):
        """Crée (ou retourne) le sale.order draft lié à la tâche.

        Cas Carnet interne (`x_agri_qodo_source == 'carnet_interne'`) :
        pas de devis. La méthode renvoie False et le caller (controller)
        doit gérer ce cas en amont — appeler `action_agri_qodo_add_product`
        sur une tâche interne lèvera une erreur.
        """
        self.ensure_one()
        if self.x_agri_qodo_source == "carnet_interne":
            raise ValueError(
                "Une tâche Carnet interne ne peut pas avoir de devis lié — "
                "n'appelle pas action_agri_qodo_add_product dans ce cas."
            )
        if self.sale_order_id:
            return self.sale_order_id
        if not self.partner_id:
            raise ValueError(
                "Impossible de créer un devis : la tâche n'a pas de partner_id "
                "(client Odoo). Vérifie le mapping côté Agri Qodo."
            )
        sale_order = self.env["sale.order"].create({
            "partner_id": self.partner_id.id,
            "origin": f"Agri Qodo / {self.name}",
        })
        self.write({"sale_order_id": sale_order.id})
        sale_order.write({"tasks_ids": [(4, self.id)]})
        return sale_order

    # ---- Confirmation auto du devis à la clôture (PRD §5.2.4) -----------
    def action_fsm_validate(self, stop_running_timers=False):
        """Override : confirme automatiquement le sale.order au passage
        de la tâche en 'terminé' (FSM)."""
        result = super().action_fsm_validate(stop_running_timers=stop_running_timers)
        for task in self:
            if task.sale_order_id and task.sale_order_id.state in ("draft", "sent"):
                task.sale_order_id.action_confirm()
        return result
