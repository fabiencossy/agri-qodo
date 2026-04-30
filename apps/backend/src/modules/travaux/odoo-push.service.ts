import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { OdooClient } from "@agri-qodo/odoo-client";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import { OdooClientManager } from "@/modules/odoo/odoo-client-manager.service";

/**
 * Résultat du push : url Odoo + id sale.order, pour que le frontend
 * puisse afficher un lien direct vers le devis dans Odoo.
 */
export interface PushTravailResult {
  odooSaleOrderId: number;
  odooUrl: string;
  partnerCreated: boolean;
  productsCreated: number;
  linesCount: number;
}

interface OdooSaleOrderLineCreate {
  product_id: number;
  name?: string;
  product_uom_qty: number;
  price_unit?: number;
}

interface ResPartnerRow {
  id: number;
}

interface ProductProductRow {
  id: number;
  type?: "service" | "consu" | "product";
}

@Injectable()
export class OdooPushService {
  private readonly logger = new Logger(OdooPushService.name);

  // Cache mémoire (par process) du product.product "Heure de travail"
  // résolu/créé par tenant. Évite d'aller le rechercher à chaque push.
  private readonly hourProductCache = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly odooClientManager: OdooClientManager,
  ) {}

  /**
   * Pousse un travail vers Odoo en tant que sale.order brouillon.
   *
   * Mapping :
   *   - Travail.partenaire (Exploitation) → res.partner (lookup par nom,
   *     création si absent, mémorisé sur PartnerLink.odooPartnerId)
   *   - LigneTravailProduit.produit → product.product via odooProductId.
   *     Si pas de mapping, on lookup par libellé puis on crée un product
   *     consommable basique.
   *   - LigneTravailHeure → product.product service "Main d'œuvre" (unique
   *     par tenant, créé à la 1re push).
   *
   * Idempotence : si Travail.odooSaleOrderId est déjà posé, on refuse
   * (sécurité contre le double devis). L'utilisateur doit annuler côté
   * Odoo s'il veut re-pousser.
   */
  async pushTravail(travailId: string): Promise<PushTravailResult> {
    const { tenantId } = this.tenantContext.get();
    const travail = await this.prisma.travail.findFirst({
      where: { id: travailId, tenantId },
      include: {
        partenaire: { select: { id: true, nom: true, emailContact: true, telephone: true } },
        lignesProduit: {
          include: {
            produit: { select: { id: true, libelle: true, odooProductId: true, unite: true } },
          },
        },
        lignesHeure: true,
      },
    });
    if (!travail) throw new NotFoundException("Travail introuvable");
    if (travail.odooSaleOrderId) {
      throw new ConflictException(
        `Travail déjà poussé vers Odoo (sale.order #${travail.odooSaleOrderId}). ` +
          `Annule le devis côté Odoo avant de re-pousser.`,
      );
    }
    if (travail.lignesProduit.length === 0 && travail.lignesHeure.length === 0) {
      throw new BadRequestException(
        "Travail vide : ajoute au moins une ligne produit ou une ligne heure avant de pousser vers Odoo.",
      );
    }

    let client: OdooClient;
    try {
      client = await this.odooClientManager.forTenant(tenantId);
    } catch (err) {
      this.logger.error(`Push Odoo : pas de client pour tenant ${tenantId} : ${err}`);
      throw new ServiceUnavailableException(
        "Configuration Odoo absente ou invalide. Renseigne-la dans Paramètres → Odoo.",
      );
    }

    let partnerCreated = false;
    let productsCreated = 0;

    // 1. Résolution / création du res.partner (client) ----------------
    let partnerId: number | undefined;
    if (travail.partenaireId && travail.partenaire) {
      const link = await this.prisma.partnerLink.findFirst({
        where: {
          OR: [
            { ownerTenantId: tenantId, partnerTenantId: travail.partenaireId },
            { ownerTenantId: travail.partenaireId, partnerTenantId: tenantId },
          ],
        },
      });
      if (link?.odooPartnerId) {
        partnerId = link.odooPartnerId;
      } else {
        // Lookup par nom dans Odoo
        const found = await client.searchRead<ResPartnerRow>(
          "res.partner",
          [["name", "=", travail.partenaire.nom]],
          { fields: ["id"], limit: 1 },
        );
        if (found.length > 0 && found[0]) {
          partnerId = found[0].id;
        } else {
          // Création
          partnerId = await client.create("res.partner", {
            name: travail.partenaire.nom,
            is_company: true,
            ...(travail.partenaire.emailContact ? { email: travail.partenaire.emailContact } : {}),
            ...(travail.partenaire.telephone ? { phone: travail.partenaire.telephone } : {}),
          });
          partnerCreated = true;
        }
        // Mémorise le mapping si on a un lien
        if (link) {
          await this.prisma.partnerLink.update({
            where: { id: link.id },
            data: { odooPartnerId: partnerId },
          });
        }
      }
    }
    // Si pas de partenaire (travail interne) : on utilise le tenant lui-même
    // comme client (Odoo refuse une commande sans partner).
    if (!partnerId) {
      const tenant = await this.prisma.exploitation.findUnique({
        where: { id: tenantId },
        select: { nom: true, emailContact: true },
      });
      const found = await client.searchRead<ResPartnerRow>(
        "res.partner",
        [["name", "=", tenant?.nom ?? "Interne"]],
        { fields: ["id"], limit: 1 },
      );
      if (found.length > 0 && found[0]) {
        partnerId = found[0].id;
      } else {
        partnerId = await client.create("res.partner", {
          name: tenant?.nom ?? "Interne",
          is_company: true,
          ...(tenant?.emailContact ? { email: tenant.emailContact } : {}),
        });
        partnerCreated = true;
      }
    }

    // 2. Construction des lignes ----------------------------------------
    const orderLines: OdooSaleOrderLineCreate[] = [];

    // 2a. Lignes produit
    for (const lp of travail.lignesProduit) {
      let productId: number | undefined = lp.produit?.odooProductId ?? undefined;
      if (!productId) {
        // Lookup par libellé
        const found = await client.searchRead<ProductProductRow>(
          "product.product",
          [["name", "=", lp.libelle]],
          { fields: ["id"], limit: 1 },
        );
        if (found.length > 0 && found[0]) {
          productId = found[0].id;
        } else {
          productId = await client.create("product.product", {
            name: lp.libelle,
            type: "consu",
            list_price: lp.prixUnitaireCHF ? Number(lp.prixUnitaireCHF) : 0,
          });
          productsCreated++;
        }
        // Met à jour le produit local pour les futurs push
        if (lp.produit?.id) {
          await this.prisma.produit.update({
            where: { id: lp.produit.id },
            data: { odooProductId: productId },
          });
        }
      }
      const line: OdooSaleOrderLineCreate = {
        product_id: productId,
        name: lp.libelle,
        product_uom_qty: Number(lp.quantite),
      };
      if (lp.prixUnitaireCHF) line.price_unit = Number(lp.prixUnitaireCHF);
      orderLines.push(line);
    }

    // 2b. Lignes heures : produit "Main d'œuvre" générique par tenant
    if (travail.lignesHeure.length > 0) {
      let hourProductId = this.hourProductCache.get(tenantId);
      if (!hourProductId) {
        const found = await client.searchRead<ProductProductRow>(
          "product.product",
          [
            ["name", "=", "Main d'œuvre (Agri Qodo)"],
            ["type", "=", "service"],
          ],
          { fields: ["id"], limit: 1 },
        );
        if (found.length > 0 && found[0]) {
          hourProductId = found[0].id;
        } else {
          hourProductId = await client.create("product.product", {
            name: "Main d'œuvre (Agri Qodo)",
            type: "service",
            list_price: 0,
          });
          productsCreated++;
        }
        this.hourProductCache.set(tenantId, hourProductId);
      }
      for (const lh of travail.lignesHeure) {
        const heures = Number(lh.dureeMinutes) / 60;
        const line: OdooSaleOrderLineCreate = {
          product_id: hourProductId,
          name: lh.notes ?? `Travail (${heures.toFixed(2)}h)`,
          product_uom_qty: heures,
        };
        if (lh.tauxHoraireCHF) line.price_unit = Number(lh.tauxHoraireCHF);
        orderLines.push(line);
      }
    }

    // 3. Création du sale.order brouillon -------------------------------
    let saleOrderId: number;
    try {
      saleOrderId = await client.create("sale.order", {
        partner_id: partnerId,
        state: "draft",
        client_order_ref: travail.titre,
        note: travail.notes ?? "",
        order_line: orderLines.map((l) => [0, 0, l]),
      });
    } catch (err) {
      this.logger.error(
        `Push Odoo : sale.order create échoué pour travail ${travailId} : ${err instanceof Error ? err.message : err}`,
      );
      throw new ServiceUnavailableException(
        "Création du devis Odoo échouée. Vérifie les permissions du compte API et la config TVA.",
      );
    }

    // 4. Mémorisation côté local ----------------------------------------
    await this.prisma.travail.update({
      where: { id: travailId },
      data: { odooSaleOrderId: saleOrderId },
    });

    const tenant = await this.prisma.exploitation.findUnique({
      where: { id: tenantId },
      select: { odooUrl: true },
    });
    const odooUrl = tenant?.odooUrl
      ? `${tenant.odooUrl.replace(/\/+$/, "")}/odoo/sales/${saleOrderId}`
      : "";

    this.logger.log(
      `Push Odoo OK : travail ${travailId} → sale.order #${saleOrderId} (${orderLines.length} lignes)`,
    );

    return {
      odooSaleOrderId: saleOrderId,
      odooUrl,
      partnerCreated,
      productsCreated,
      linesCount: orderLines.length,
    };
  }

  /**
   * Variante best-effort de `pushTravail` pour les déclenchements
   * automatiques (cas B après save d'intervention). Ne throw jamais —
   * log l'échec et renvoie null. Le Travail reste DRAFT sans
   * odooSaleOrderId, l'utilisateur peut re-pousser manuellement.
   */
  async tryPushTravailQuotation(travailId: string): Promise<PushTravailResult | null> {
    try {
      return await this.pushTravail(travailId);
    } catch (err) {
      this.logger.warn(
        `Push Odoo auto échoué pour travail ${travailId} : ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /**
   * Confirme un devis Odoo (sale.order draft) pour qu'il devienne une
   * commande client (state='sale'). Appelé automatiquement quand le
   * Travail passe DRAFT → VALIDATED.
   *
   * Idempotent côté Odoo : action_confirm sur un sale.order déjà
   * confirmé est un no-op. Best-effort : on ne throw pas pour ne pas
   * bloquer la validation locale.
   */
  async tryConfirmSaleOrder(
    travailId: string,
  ): Promise<{ confirmed: boolean; odooSaleOrderId: number | null }> {
    const { tenantId } = this.tenantContext.get();
    const travail = await this.prisma.travail.findFirst({
      where: { id: travailId, tenantId },
      select: { odooSaleOrderId: true },
    });
    if (!travail?.odooSaleOrderId) {
      return { confirmed: false, odooSaleOrderId: null };
    }

    let client: OdooClient;
    try {
      client = await this.odooClientManager.forTenant(tenantId);
    } catch (err) {
      this.logger.warn(
        `Confirm sale.order : pas de client Odoo pour tenant ${tenantId} : ${err instanceof Error ? err.message : err}`,
      );
      return { confirmed: false, odooSaleOrderId: travail.odooSaleOrderId };
    }

    try {
      await client.callKw("sale.order", "action_confirm", [[travail.odooSaleOrderId]]);
      this.logger.log(`Sale.order #${travail.odooSaleOrderId} confirmé (travail ${travailId})`);
      return { confirmed: true, odooSaleOrderId: travail.odooSaleOrderId };
    } catch (err) {
      this.logger.warn(
        `Confirm sale.order #${travail.odooSaleOrderId} échoué : ${err instanceof Error ? err.message : err}`,
      );
      return { confirmed: false, odooSaleOrderId: travail.odooSaleOrderId };
    }
  }
}
