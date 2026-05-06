# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Qodo SA
"""
Override `sale.order.line._timesheet_create_task` pour empêcher Odoo de
créer une nouvelle project.task quand on ajoute une ligne Service depuis
Agri Qodo (la tâche existe déjà et est référencée par task_id).

Voir docs/PRD-odoo-prestations-tache-devis-v0.3.md §5.2.2.
"""
from odoo import models


class SaleOrderLine(models.Model):
    _inherit = "sale.order.line"

    def _timesheet_create_task(self, project):
        if self.env.context.get("agri_qodo_skip_task_create"):
            return False
        return super()._timesheet_create_task(project)
