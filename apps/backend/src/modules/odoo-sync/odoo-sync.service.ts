/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@/common/prisma/prisma.service";
import { OdooClientManager } from "@/modules/odoo/odoo-client-manager.service";

/**
 * Sprint A — Sync prestations Agri Qodo → Odoo Enterprise.
 *
 * Toute la mécanique vit côté backend : pas de module Python custom.
 * On parle à Odoo via XML-RPC (`OdooClient`) et on contourne la
 * limitation FSM "pas de Service depuis tâche" en :
 *   1. configurant les `product.template` Service avec
 *      `service_tracking='no'` au lazy create ;
 *   2. créant directement les `sale.order.line` avec un `task_id`
 *      rempli (ce qui passe en XML-RPC, l'UI Odoo ne le permet pas
 *      mais le modèle l'accepte).
 *
 * Voir docs/PRD-odoo-prestations-tache-devis-v0.3.md §5.4 + §11.
 */

export type AgriQodoSource = "travaux_tiers" | "carnet_tiers" | "carnet_interne";

export interface UpsertTaskInput {
  /** UUID prestation côté Agri Qodo (Travail.id ou Intervention.id). */
  prestationId: string;
  source: AgriQodoSource;
  /** ID `project.project` Odoo cible. */
  odooProjectId: number;
  /** Libellé affiché dans Odoo (ex : "Pulvérisation Vers les Bois"). */
  name: string;
  /** ID `res.partner` Odoo (null pour le cas `carnet_interne`). */
  odooPartnerId?: number | null;
  /** Date prévue d'exécution (date deadline Odoo). */
  dateDeadline?: Date;
  /** UUID parcelle Agri Qodo (mémorisé en description, pas de champ custom). */
  parcelleId?: string;
  /** Surface parcelle en hectares (mémorisée en description). */
  surfaceHa?: number;
  /** ID utilisateur Odoo assigné (optionnel). */
  odooUserId?: number;
}

export interface AddLineInput {
  /** ID Odoo `sale.order` cible. */
  saleOrderId: number;
  /** ID Odoo `project.task` à lier à la ligne. */
  taskId: number;
  /** ID Odoo `product.product`. */
  productId: number;
  /** Quantité (déjà calculée — pour HA c'est surface * 1, pas dose × surface). */
  quantity: number;
  /** Prix unitaire (laisse Odoo prendre le `list_price` par défaut si null). */
  priceUnit?: number;
}

@Injectable()
export class OdooSyncService {
  private readonly log = new Logger(OdooSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly odoo: OdooClientManager,
  ) {}

  /**
   * Lazy create d'un `product.template` Odoo pour un produit Agri Qodo.
   * Idempotent : si `Produit.odooProductId` existe déjà, on le renvoie
   * tel quel sans re-créer côté Odoo.
   *
   * Pour les Services on force `service_tracking='no'` pour éviter
   * qu'Odoo ne crée une nouvelle tâche/projet à l'usage (PRD §5.4).
   */
  async ensureProduct(produitId: string, tenantId: string): Promise<number> {
    const produit = await this.prisma.produit.findFirst({
      where: { id: produitId, OR: [{ tenantId: null }, { tenantId }] },
      select: {
        id: true,
        libelle: true,
        unite: true,
        prixVenteCHF: true,
        odooProductId: true,
      },
    });
    if (!produit) {
      throw new Error(`Produit Agri Qodo introuvable : ${produitId}`);
    }
    if (produit.odooProductId) return produit.odooProductId;

    const client = await this.odoo.forTenant(tenantId);

    // V1 : on ne reflète pas encore le type "Service vs Bien" depuis
    // Agri Qodo (le catalogue actuel n'a pas ce champ). Par défaut on
    // crée tous les produits en `service` avec `service_tracking='no'`
    // pour éviter l'effet de bord FSM. À ajuster Sprint E quand le
    // catalogue Agri Qodo aura le champ "type" Bien/Service.
    const odooProductId = await client.create("product.template", {
      name: produit.libelle,
      type: "service",
      service_tracking: "no",
      list_price: produit.prixVenteCHF ? Number(produit.prixVenteCHF) : 0,
    });

    await this.prisma.produit.update({
      where: { id: produit.id },
      data: { odooProductId },
    });
    this.log.log(`ensureProduct: agriqodo=${produit.id} → odoo product.template=${odooProductId}`);
    return odooProductId;
  }

  /**
   * Crée ou met à jour la `project.task` Odoo. Idempotent : si la tâche
   * existe (mémorisée par `Travail.odooTaskId` ou `Intervention.odooTaskId`),
   * on `write` les champs ; sinon on `create`.
   *
   * Note : pas de champ custom `x_agri_qodo_*` côté Odoo (pas de module
   * custom, cf. §5.4). On utilise `description` pour la traçabilité
   * Agri Qodo (parcelle, surface, source) et `tag_ids` pour le marqueur
   * "Service sur site".
   */
  async upsertTask(
    input: UpsertTaskInput,
    existingTaskId: number | null,
    tenantId: string,
  ): Promise<number> {
    const client = await this.odoo.forTenant(tenantId);

    const description = this.buildTaskDescription(input);

    const values: Record<string, unknown> = {
      name: input.name,
      project_id: input.odooProjectId,
      description,
    };
    if (input.odooPartnerId !== undefined && input.odooPartnerId !== null) {
      values.partner_id = input.odooPartnerId;
    }
    if (input.dateDeadline) {
      values.date_deadline = input.dateDeadline.toISOString().slice(0, 10);
    }
    if (input.odooUserId) {
      values.user_ids = [[6, 0, [input.odooUserId]]];
    }

    if (existingTaskId) {
      await client.write("project.task", [existingTaskId], values);
      this.log.log(`upsertTask: write task=${existingTaskId}`);
      return existingTaskId;
    }

    const created = await client.create("project.task", values);
    this.log.log(`upsertTask: create task=${created} for prestation=${input.prestationId}`);
    return created;
  }

  /**
   * Crée le `sale.order` draft lié à la tâche s'il n'existe pas, puis
   * pose le lien bidirectionnel `tasks_ids` sur le devis.
   * Renvoie l'`odooSaleOrderId` à mémoriser côté Travail.
   *
   * À NE PAS appeler pour le cas `carnet_interne` (pas de devis).
   */
  async ensureSaleOrder(
    taskId: number,
    odooPartnerId: number,
    existingSaleOrderId: number | null,
    tenantId: string,
  ): Promise<number> {
    if (existingSaleOrderId) return existingSaleOrderId;

    const client = await this.odoo.forTenant(tenantId);

    const saleOrderId = await client.create("sale.order", {
      partner_id: odooPartnerId,
      origin: `Agri Qodo / task ${taskId}`,
    });
    // Liaison bidirectionnelle. Le champ tasks_ids est un Many2many côté
    // sale.order ; on l'ajoute via la commande Odoo (4, id) = link.
    await client.write("sale.order", [saleOrderId], {
      tasks_ids: [[4, taskId, 0]],
    });
    await client.write("project.task", [taskId], {
      sale_order_id: saleOrderId,
    });

    this.log.log(`ensureSaleOrder: create sale.order=${saleOrderId} ↔ task=${taskId}`);
    return saleOrderId;
  }

  /**
   * Crée une `sale.order.line` avec `task_id` rempli. Supporte Bien et
   * Service indifféremment (la limite UI Odoo ne s'applique pas en
   * XML-RPC). Le caller doit s'assurer que le produit est bien créé
   * côté Odoo (cf. ensureProduct).
   */
  async addLine(input: AddLineInput, tenantId: string): Promise<number> {
    const client = await this.odoo.forTenant(tenantId);

    const values: Record<string, unknown> = {
      order_id: input.saleOrderId,
      product_id: input.productId,
      product_uom_qty: input.quantity,
      task_id: input.taskId,
    };
    if (input.priceUnit !== undefined) {
      values.price_unit = input.priceUnit;
    }

    const lineId = await client.create("sale.order.line", values);
    this.log.log(
      `addLine: sale.order.line=${lineId} sale.order=${input.saleOrderId} task=${input.taskId}`,
    );
    return lineId;
  }

  /**
   * Confirme le devis Odoo lié (transition `draft`/`sent` → `sale`).
   * Appelé quand l'utilisateur clique "Marquer terminé" côté Agri Qodo.
   */
  async markCompleted(saleOrderId: number, tenantId: string): Promise<void> {
    const client = await this.odoo.forTenant(tenantId);
    await client.callKw("sale.order", "action_confirm", [[saleOrderId]]);
    this.log.log(`markCompleted: sale.order=${saleOrderId} confirmé`);
  }

  /**
   * Construit la description de la tâche Odoo à partir des metadata
   * Agri Qodo. Sert de substitut aux champs `x_agri_qodo_*` qu'on
   * ajouterait avec un module custom.
   */
  private buildTaskDescription(input: UpsertTaskInput): string {
    const lines: string[] = [
      `[Agri Qodo] prestation ${input.prestationId}`,
      `Source : ${input.source}`,
    ];
    if (input.parcelleId) lines.push(`Parcelle : ${input.parcelleId}`);
    if (input.surfaceHa !== undefined) lines.push(`Surface : ${input.surfaceHa.toFixed(2)} ha`);
    return lines.join("\n");
  }
}
