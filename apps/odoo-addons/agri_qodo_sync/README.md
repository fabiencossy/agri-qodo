# agri_qodo_sync — Module Odoo Enterprise pour Agri Qodo

Module compagnon de la plateforme [Agri Qodo](https://newagri.qodo.ch).

## Cœur du sujet

Quand un agriculteur saisit une prestation dans Agri Qodo (Travaux pour
tiers OU Carnet des champs avec client lié), le backend Agri Qodo pousse
vers Odoo :

- une `project.task` (avec traçabilité parcelle, surface, source) ;
- un `sale.order` lié, contenant des lignes Bien **et** Service ajoutées
  depuis la tâche.

Sans ce module, Odoo Enterprise (`industry_fsm`) bloque l'ajout de
produits Service sur une tâche FSM. Le module étend `project.task` et
`sale.order.line` pour autoriser cette mécanique tout en restant
compatible avec le flux natif.

Voir le PRD complet : `docs/PRD-odoo-prestations-tache-devis-v0.3.md`
dans le repo Agri Qodo.

## Installation

1. Copier le dossier `agri_qodo_sync` dans le `addons_path` de
   l'instance Odoo cible.
2. Mettre à jour la liste des modules (Mode développeur → Apps →
   Update Apps List).
3. Installer "Agri Qodo — Sync Prestations".

Dépend de : `base`, `product`, `project`, `sale_management`,
`sale_project`, `industry_fsm` (Enterprise-only).

## Endpoints REST

Authentification user Odoo (clé API). Tous sous `/agri_qodo/v1/*`.

### `POST /agri_qodo/v1/product/upsert`

Lazy create d'un `product.template` (idempotent par
`x_agri_qodo_product_id`).

```json
{
  "params": {
    "agri_qodo_product_id": "uuid…",
    "name": "Semence blé Arina",
    "type": "product",
    "list_price": 12.5
  }
}
```

Réponse : `{ "odoo_product_id": <int>, "created": bool }`.

### `POST /agri_qodo/v1/task/upsert`

Crée ou met à jour une `project.task`. Idempotent par
`x_agri_qodo_prestation_id`.

### `POST /agri_qodo/v1/task/<id>/add_product`

Ajoute une ligne (Bien ou Service) au `sale.order` lié. Crée le devis
draft à la volée s'il n'existe pas. Lève une erreur sur les tâches
`x_agri_qodo_source = carnet_interne` (pas de devis pour ce cas).

## Comportement à la clôture

Quand une tâche est validée en FSM (`action_fsm_validate`), le module
confirme automatiquement le `sale.order` lié s'il est en `draft` ou
`sent`.

## Licence

AGPL-3.0-or-later — © 2026 Qodo SA.
