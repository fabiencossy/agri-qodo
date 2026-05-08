# PRD — Automatisation Odoo : Prestations Agri Qodo → Tâche projet + Devis lié

> **Modules concernés :** M11 / Travaux pour tiers ET M2 / Carnet des champs (fusion M2/M6/M11 Interventions, cf. PRD fusion-interventions v0.2)
> **Contexte :** Agri Qodo, SaaS agricole suisse connecté à Odoo Enterprise (instance per-tenant)
> **Objectif :** Automatiser la création d'une tâche projet et la génération d'un devis lié dès qu'une prestation facturable est saisie depuis Agri Qodo, **quel que soit le type de produit (Bien ou Service)**.
> **Statut :** v0.3 — 2026-05-06. À compléter avec choix d'implémentation après validation métier et tests sur instance Odoo de dev.

---

## 1. Périmètre fonctionnel — quand créer une tâche Odoo ?

Trois cas déclencheurs côté Agri Qodo :

### 1.1 Travaux pour tiers (M11)

- Toute prestation "Travaux pour tiers" → **toujours** création d'une tâche Odoo
- Projet cible : **« Projet Travaux pour tiers »** (paramétré dans Settings)

### 1.2 Carnet des champs — parcelle propre, sans client lié

- Création d'une tâche Odoo dans un **projet interne Odoo** (usage interne uniquement, traçabilité agronomique)
- Pas de devis généré
- Projet cible : **« Projet interne — Carnet des champs »** (paramétré dans Settings)

### 1.3 Carnet des champs — parcelle avec client lié

- Cas : travail à façon, prestation à un voisin, sous-traitance
- Création d'une tâche Odoo **+ devis lié**
- Projet cible : **« Projet Carnet des champs tiers »** (paramétré dans Settings, peut être identique ou distinct du projet Travaux pour tiers)

---

## 2. Paramétrage préalable

Dans les **Settings d'Agri Qodo**, trois champs de configuration distincts :

| Paramètre                                              | Modèle Odoo       | Module Agri Qodo |
| ------------------------------------------------------ | ----------------- | ---------------- |
| Projet cible — Travaux pour tiers                      | `project.project` | M11              |
| Projet cible — Carnet des champs tiers (avec client)   | `project.project` | M2               |
| Projet cible — Carnet des champs interne (sans client) | `project.project` | M2               |

Les paramètres peuvent pointer vers le même projet ou vers des projets distincts selon l'organisation.

---

## 3. Catalogue produits avec prix à l'hectare

### 3.1 Définition côté Agri Qodo

L'utilisateur définit ses produits/prestations dans l'application :

- **Type** : Bien (semence, engrais, phyto…) ou Service (heures de tracteur, prestation, traitement…)
- **Unité de tarification** :
  - Forfait
  - Prix unitaire (CHF/unité)
  - **Prix à l'hectare** (CHF/ha) — courant en agriculture
  - Prix à l'heure (CHF/h)
  - Prix au kg / litre
- **Prix de vente** par défaut
- **Taux de TVA** (taux agricole CH ou taux normal)
- **Catégorie analytique** (optionnel)

### 3.2 Synchronisation Odoo (lazy create)

- Le produit reste **uniquement dans Agri Qodo** tant qu'il n'est pas utilisé en facturation
- **Dès la première utilisation** dans un carnet des champs avec client OU dans une prestation Travaux pour tiers :
  - Création automatique du `product.template` dans Odoo
  - Mapping enregistré : `agriqodo_product_id` ↔ `odoo_product_id`
- Les utilisations suivantes réutilisent le produit Odoo existant (idempotent)

### 3.3 Calcul automatique de la quantité

Pour les produits tarifés **à l'hectare** :

- Quantité du devis = **surface de la parcelle** (issue du SIG/parcellaire Agri Qodo)
- Exemple : traitement à 80 CHF/ha sur parcelle de 3.5 ha → ligne devis = 3.5 × 80 = 280 CHF

---

## 4. Création de la tâche Odoo

À la validation de la prestation :

- Création d'une `project.task` dans le projet cible (cf. §2)
- Champs reportés :
  - Libellé de la prestation
  - Client (`partner_id`) — sauf cas 1.2 (interne)
  - Date d'intervention
  - Parcelle / exploitation
  - Opérateur·trice (`user_ids`)
  - Durée prévue
  - Tag distinctif : `tag_ids` = "Service sur site" pour cas 1.3

---

## 5. Génération du devis lié — approche tout-en-Agri-Qodo

> **Décision Fabien 2026-05-06 : pas de module Odoo custom.** Toute la
> mécanique est implémentée côté backend Agri Qodo (NestJS), qui parle
> à Odoo via XML-RPC standard (`OdooClient` déjà en place pour les
> produits/matériels et le push sale.order existant).
>
> Les sections 5.2 et 5.3 ci-dessous décrivent l'historique de la
> réflexion. **L'implémentation suit la nouvelle section 5.4.**

### 5.1 Comportement Odoo natif (rappel correct)

Dans Odoo standard, sur une tâche de type **"Service sur site"** (module `industry_fsm`) :

- ✅ **Ajout d'un produit de type "Bien" depuis la tâche** → création/mise à jour automatique d'un `sale.order` lié
- ✅ **Marquer la tâche comme "Terminée"** → confirmation automatique du devis
- ❌ **Impossible d'ajouter un produit de type "Service" directement depuis la tâche** _via l'UI Odoo_
  - Pour facturer un service depuis l'UI, il faut créer manuellement un `sale.order` à part, puis le lier au projet/tâche via `sale_order_id`
  - **MAIS** : depuis l'extérieur via XML-RPC/JSON-RPC, on peut créer directement la `sale.order.line` avec un `task_id` rempli — Odoo enregistre la ligne sans broncher. C'est ce que fait Agri Qodo.

### 5.2 Solution technique recommandée

**Module Odoo custom `agri_qodo_sync`** qui étend le module `industry_fsm` pour autoriser l'ajout de produits Service depuis la tâche.

#### 5.2.1 Approche

Hériter de `project.task` et reproduire / étendre la mécanique native d'ajout de matériel (`fsm_set_product`, `_fsm_ensure_sale_order`) pour qu'elle accepte aussi les produits de type Service.

```python
# agri_qodo_sync/models/project_task.py
from odoo import models, fields, api

class ProjectTask(models.Model):
    _inherit = 'project.task'

    x_agri_qodo_prestation_id = fields.Char(index=True)
    x_agri_qodo_source = fields.Selection([
        ('travaux_tiers', 'Travaux pour tiers'),
        ('carnet_tiers', 'Carnet des champs - tiers'),
        ('carnet_interne', 'Carnet des champs - interne'),
    ])
    x_agri_qodo_parcelle_id = fields.Char(index=True)
    x_agri_qodo_surface_ha = fields.Float()

    def action_agri_qodo_add_product(self, product_id, qty, price_unit=None):
        """
        Ajoute un produit (Bien OU Service) au sale.order lié à la tâche.
        Crée le sale.order draft s'il n'existe pas encore.
        """
        self.ensure_one()
        product = self.env['product.product'].browse(product_id)

        # 1. S'assurer qu'un sale.order existe (créer si besoin)
        sale_order = self._agri_qodo_ensure_sale_order()

        # 2. Ajouter la ligne, peu importe le type de produit
        line_vals = {
            'order_id': sale_order.id,
            'product_id': product.id,
            'product_uom_qty': qty,
            'task_id': self.id,  # liaison ligne ↔ tâche
        }
        if price_unit is not None:
            line_vals['price_unit'] = price_unit

        # IMPORTANT : pour les produits Service, désactiver le service_tracking
        # afin d'éviter la création d'une nouvelle tâche par Odoo
        if product.type == 'service' and product.service_tracking != 'no':
            # Soit on impose service_tracking='no' au catalogue Agri Qodo,
            # soit on contourne via un context flag
            line_vals['_skip_service_tracking'] = True

        return self.env['sale.order.line'].with_context(
            agri_qodo_skip_task_create=True
        ).create(line_vals)

    def _agri_qodo_ensure_sale_order(self):
        """Crée le sale.order draft lié à la tâche s'il n'existe pas."""
        if self.sale_order_id:
            return self.sale_order_id
        sale_order = self.env['sale.order'].create({
            'partner_id': self.partner_id.id,
            'origin': f'Agri Qodo / {self.name}',
            'opportunity_id': False,
        })
        # Liaison bidirectionnelle
        self.write({'sale_order_id': sale_order.id})
        sale_order.write({'tasks_ids': [(4, self.id)]})
        return sale_order
```

#### 5.2.2 Override de `sale.order.line` pour bloquer la création de tâche

```python
# agri_qodo_sync/models/sale_order_line.py
class SaleOrderLine(models.Model):
    _inherit = 'sale.order.line'

    def _timesheet_create_task(self, project):
        # Si on vient d'Agri Qodo, ne pas créer de nouvelle tâche
        # (la tâche existe déjà et est référencée par task_id)
        if self.env.context.get('agri_qodo_skip_task_create'):
            return False
        return super()._timesheet_create_task(project)
```

#### 5.2.3 Configuration produit recommandée

Pour tous les produits Service synchronisés depuis Agri Qodo :

- `type` = `service`
- `service_tracking` = `no` (pas de création auto de tâche/projet)
- `invoice_policy` = `order` ou `delivery` selon préférence
- Le module custom assure la liaison `sale.order.line.task_id` → `project.task`

#### 5.2.4 Comportement "Marquer terminée"

Reproduire le comportement natif du FSM :

- Quand la tâche est marquée terminée → `sale_order.action_confirm()` automatique
- Hook : surcharge de `action_fsm_validate` ou méthode équivalente

### 5.3 Alternative — flux inversé (déconseillé)

Créer le `sale.order` **d'abord** côté Agri Qodo avec toutes les lignes, puis le confirmer pour générer la tâche via `service_tracking = 'task_in_project'`.

**Inconvénients** :

- Inverse l'UX naturelle (l'opérateur·trice raisonne "intervention → matériel/services consommés")
- Oblige à tout configurer en amont, peu adapté aux ajouts en cours d'intervention
- Ne fonctionne pas pour le cas Carnet des champs interne (pas de devis du tout)

### 5.4 Approche retenue — service backend `OdooSyncService` (sans module custom)

**Toute la mécanique vit dans le backend Agri Qodo.** Pas de code Python
côté Odoo — on n'utilise que les API standard `xmlrpc` / `jsonrpc` via
`OdooClient` (déjà en place pour Produit/Materiel/sale.order via
`OdooPushService`).

**Pourquoi ça marche sans module custom** :

- La limitation "pas de Service depuis la tâche" est une limite de l'UI
  Odoo, pas du modèle. En XML-RPC on peut écrire directement une
  `sale.order.line` avec `task_id` rempli, peu importe le `type` du
  `product.template`.
- Pour empêcher Odoo de créer une nouvelle tâche quand on ajoute une
  ligne Service (`service_tracking == 'task_in_project'`), Agri Qodo
  configure tous les `product.template` Service qu'il crée avec
  **`service_tracking = 'no'`** au moment du lazy create (PRD §3.2).
  Du coup `_timesheet_create_task` n'est jamais appelé.
- Pour la confirmation auto du devis à la clôture : Agri Qodo appelle
  explicitement `sale.order.action_confirm` depuis le backend quand
  l'utilisateur clique "Marquer terminé" sur l'app (le statut de la
  tâche Odoo n'est pas la source de vérité, c'est Agri Qodo qui pilote).

**Composants à créer côté Agri Qodo** :

- `OdooSyncService` (extension de `OdooPushService` ou nouveau module
  dans `apps/backend/src/modules/odoo-sync/`) avec les méthodes :
  - `ensureProduct(produit)` — lazy create `product.template` avec
    `service_tracking='no'` si Service ; renvoie `odooProductId` et
    le mémorise dans `Produit.odooProductId` (déjà en place).
  - `upsertTask(prestation)` — crée ou met à jour la `project.task`
    avec les champs traçabilité (utilisation des champs standards Odoo,
    pas de champ custom). Pour les références Agri Qodo, on utilise
    `description` ou `tag_ids` plutôt que des `x_agri_qodo_*` (qui
    nécessiteraient un module custom pour exister côté Odoo).
  - `ensureSaleOrder(prestation)` — crée le `sale.order` draft + lie
    bidirectionnel à la tâche (`tasks_ids`), uniquement pour les cas
    `travaux_tiers` et `carnet_tiers`.
  - `addLine(prestation, ligne)` — crée la `sale.order.line` avec
    `task_id` rempli ; supporte Bien et Service indifféremment.
  - `markCompleted(prestation)` — au "Marquer terminé", appelle
    `sale_order.action_confirm` côté Odoo.
- Migration Prisma : ajout des références `odooTaskId` (si pas déjà
  posée) sur `Travail` et `Intervention`, plus
  `odooSaleOrderLineId` sur les lignes produits/heures.

**Conséquences** :

- Pas d'installation à faire sur l'instance Odoo Enterprise du client.
  Le client active juste l'API XML-RPC (déjà standard) + crée un user
  Odoo dédié à Agri Qodo avec ACL appropriées.
- Idempotence gérée côté Agri Qodo via les colonnes `odoo*Id` mémorisées
  par le service.
- Limites :
  - Si l'utilisateur édite la tâche depuis l'UI Odoo et essaie d'ajouter
    un Service, l'UI bloquera (limitation native). Mais comme l'app
    Agri Qodo est la source de vérité, c'est acceptable.
  - Pour les cas où Odoo doit déclencher un workflow particulier sur
    `service_tracking != 'no'` (ex : timesheet auto-link), on perd ça.
    Acceptable en V1 : Agri Qodo gère son propre timesheet
    (`LigneTravailHeure`).

---

## 6. Comportement différencié Bien / Service / Interne (synthèse)

| Scénario                  | Bien (`product`/`consu`)                                                  | Service (`service`, `service_tracking='no'`)                              |
| ------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Travaux pour tiers        | Tâche + ligne XML-RPC `sale.order.line` avec `task_id`                    | Tâche + ligne XML-RPC `sale.order.line` avec `task_id`                    |
| Carnet des champs tiers   | Tâche + ligne XML-RPC `sale.order.line` avec `task_id`                    | Tâche + ligne XML-RPC `sale.order.line` avec `task_id`                    |
| Carnet des champs interne | Tâche dans projet interne, **pas de devis**                               | Tâche dans projet interne, **pas de devis**                               |
| Tâche marquée terminée    | `OdooSyncService.markCompleted` → `sale_order.action_confirm` via XML-RPC | `OdooSyncService.markCompleted` → `sale_order.action_confirm` via XML-RPC |
| Stock impacté             | Oui (mouvement à la livraison)                                            | Non                                                                       |

---

## 7. Liaisons et traçabilité

Côté Agri Qodo (Prisma), chaque prestation conserve :

- `odoo_task_id` — id tâche Odoo
- `odoo_sale_order_id` — id devis Odoo (null si interne)
- Pour chaque ligne : `odoo_sale_order_line_id`

Comportement :

- Modification d'une ligne → mise à jour `sale.order.line`
- Suppression d'une ligne → suppression `sale.order.line`
- Annulation prestation → tâche `cancelled`, devis `cancel`
- Logique **idempotente** (re-sync sans doublons)

---

## 8. Cas limites — décisions

Décisions figées 2026-05-06 (Fabien) sauf mention "à arbitrer" :

| Cas                                                | Décision                                                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Projet cible non paramétré                         | Bloquer la saisie + alerter                                                                                    |
| Carnet des champs : client ajouté **a posteriori** | Migrer la tâche du projet interne vers le projet tiers + créer le devis avec lignes existantes                 |
| Carnet des champs : client **retiré** a posteriori | **Bascule interne** : la tâche repasse dans le projet interne, **le devis lié est supprimé** (pas archivé). ✅ |
| Plusieurs clients (co-traitance)                   | Une tâche par client + un devis par client                                                                     |
| TVA agricole CH                                    | Mapping auto selon catégorie produit                                                                           |
| Confirmation devis                                 | Auto à la clôture de la tâche (cf. §5.2.4)                                                                     |
| Modification du prix à l'hectare après synchro     | Recalcul auto du devis tant que `draft`                                                                        |
| Devis confirmé puis prestation modifiée            | Avenant ou bloquer la modif (à arbitrer)                                                                       |

---

## 9. Livrables attendus

### 9.1 Backend Agri Qodo — `OdooSyncService`

> Décision §5.4 : pas de module Odoo, tout côté Agri Qodo via XML-RPC.

- Nouveau module `apps/backend/src/modules/odoo-sync/`.
- Méthodes : `ensureProduct`, `upsertTask`, `ensureSaleOrder`, `addLine`,
  `removeLine`, `markCompleted`.
- Configuration auto des `product.template` Service avec
  `service_tracking='no'` au lazy create (cf. §5.4).
- Idempotence via les colonnes `Produit.odooProductId`,
  `Travail.odooTaskId`, `Travail.odooSaleOrderId`,
  `LigneTravailProduit.odooSaleOrderLineId`.
- Tests unitaires NestJS avec mocks XML-RPC.

### 9.2 Côté Agri Qodo (UI + intégration)

- UI catalogue produits (modes de tarification : hectare, heure, forfait…)
- Hook de synchro à la création/modification de prestation (Travail +
  Intervention) appelant `OdooSyncService`.
- Gestion idempotente des appels Odoo.
- Distinction visuelle prestation interne vs tiers dans le Carnet des champs.

### 9.3 Diagramme de séquence

```
[Agri Qodo] Saisie prestation
    ↓
    ├── Travaux pour tiers ─────┐
    ├── Carnet + client ────────┤
    └── Carnet sans client ─────┴── projet interne (pas de devis)
                                ↓
[Agri Qodo] Vérif catalogue produits → lazy create dans Odoo si besoin
    ↓
[Odoo] Création project.task dans projet cible
    ↓
[Odoo] (cas tiers) Création sale.order draft + liaison bidirectionnelle
    ↓
[Agri Qodo] Ajout ligne produit (Bien OU Service)
    ↓
[Odoo] action_agri_qodo_add_product → sale.order.line (qty calculée)
    ↓
[Utilisateur] Marquage tâche terminée → confirmation devis auto
```

### 9.4 Tests fonctionnels

- Travaux pour tiers : Bien seul / Service seul / Mix
- Carnet des champs sans client → projet interne, pas de devis
- Carnet des champs avec client : Bien seul / Service seul / Mix
- Produit à l'hectare : vérif quantité = surface parcelle
- Première utilisation d'un produit non-syncé → vérif lazy create
- Tâche terminée → vérif confirmation auto du devis
- Modification prestation après sync → vérif idempotence
- Annulation → vérif états Odoo

---

## 10. Conformité & contraintes Agri Qodo

- **Odoo Enterprise only** (pas de Community)
- **Per-tenant** : 1 instance Odoo = 1 exploitation
- **Open source** côté Agri Qodo
- Variables sensibles dans `docker-compose` (jamais en dur)
- Pas de push direct sur `main` — branche dédiée + PR

---

## 11. Découpage en sprints — approche backend uniquement

> Validé Fabien 2026-05-06. **Pas de module Odoo custom** — toute la
> mécanique est dans le backend Agri Qodo (cf. §5.4). Les sprints
> suivants ne touchent qu'Agri Qodo + l'API XML-RPC standard d'Odoo.

### Sprint A — Service `OdooSyncService` + lazy create produits

- Nouveau module backend `apps/backend/src/modules/odoo-sync/` avec
  `OdooSyncService` (utilise `OdooClientManager` déjà en place).
- Méthode `ensureProduct(produit)` : lazy create `product.template` via
  XML-RPC, `service_tracking='no'` pour les Services. Mémorise dans
  `Produit.odooProductId` (colonne déjà présente).
- Méthode `upsertTask(prestation)` : crée/met à jour `project.task` via
  XML-RPC dans le projet cible (settings tenant §2). Mémorise
  `odooTaskId` côté Agri Qodo.
- Tests unitaires côté backend (mocks XML-RPC).

### Sprint B — Création devis + ajout lignes mixtes

- Settings Agri Qodo : 3 sélecteurs `project.project` (cf. §2).
- Méthode `ensureSaleOrder(prestation)` : crée `sale.order` draft Odoo
  - lie bidirectionnel à la tâche (`tasks_ids`).
- Méthode `addLine(prestation, ligne)` : crée `sale.order.line` avec
  `task_id` rempli, supporte Bien et Service (grâce au
  `service_tracking='no'` posé au lazy create).
- Hook dans `TravauxService` et `InterventionsService` pour appeler
  `OdooSyncService` aux bons moments (create/update/delete).

### Sprint C — Calcul HA + idempotence + confirmation auto

- Calcul automatique quantité depuis surface parcelle (produits à
  l'hectare, cf. §3.3).
- Idempotence : modification/annulation côté Agri Qodo répercutée sur
  `sale.order.line` Odoo (write/unlink) sans doublons.
- Confirmation auto du devis à la clôture : quand l'utilisateur clique
  "Marquer terminé" côté app, le backend appelle
  `sale_order.action_confirm` Odoo.
- Tests fonctionnels §9.4.

### Sprint D — Cas limites

- Client ajouté a posteriori : migration tâche projet interne →
  projet tiers + création devis avec lignes existantes.
- Client retiré (décision §8) : bascule tâche vers projet interne +
  suppression du devis lié côté Odoo.
- Multi-clients (co-traitance) : 1 tâche + 1 devis par client.

### Sprint E — UX catalogue produits Agri Qodo

- UI catalogue produits étendue : modes de tarification (forfait, prix
  unitaire, prix à l'hectare, prix à l'heure, prix au kg/litre).
- Mapping TVA agricole CH (catégorie produit → taux).
- Distinction visuelle prestation interne vs tiers dans le Carnet des
  champs.
- Documentation utilisateur.

---

_Document de référence v0.3 — 2026-05-06. Approche backend uniquement
validée par Fabien. Implémentation Sprint A en cours sur la branche
`feat/odoo-prestations-sync`._
