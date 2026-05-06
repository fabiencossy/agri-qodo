# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Qodo SA
{
    "name": "Agri Qodo — Sync Prestations",
    "version": "1.0.0",
    "summary": "Synchronisation Agri Qodo (SaaS suisse) ↔ Odoo Enterprise — "
               "tâches projet + devis (mix Bien/Service)",
    "description": """
Module compagnon de la plateforme Agri Qodo.

Permet à Agri Qodo de pousser ses prestations (Travaux pour tiers et Carnet
des champs) sous forme de project.task + sale.order Odoo, en autorisant
l'ajout de produits Service depuis la tâche (ce que le module FSM natif
n'autorise pas par défaut).

Voir docs/PRD-odoo-prestations-tache-devis-v0.3.md dans le repo Agri Qodo.
""",
    "author": "Qodo SA",
    "website": "https://newagri.qodo.ch",
    "license": "AGPL-3",
    "category": "Agriculture",
    "depends": [
        "base",
        "product",
        "project",
        "sale_management",
        "sale_project",
        # industry_fsm est Enterprise-only — on l'ajoute pour bénéficier
        # de fsm_set_product et l'étendre. À retirer si on cible un Odoo
        # Community (auquel cas le module devra implémenter la mécanique
        # depuis zéro).
        "industry_fsm",
    ],
    "data": [
        "security/ir.model.access.csv",
    ],
    "installable": True,
    "application": False,
    "auto_install": False,
}
