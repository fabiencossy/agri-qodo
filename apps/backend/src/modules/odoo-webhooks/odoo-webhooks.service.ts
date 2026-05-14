import { Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ProduitCategorie, ProduitUnite } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "@/common/prisma/prisma.service";
import { OdooClientManager } from "@/modules/odoo/odoo-client-manager.service";

/**
 * Webhook bidirectionnel temps réel Odoo ↔ Agri Qodo
 * (Fabien 2026-05-14 : "il faut que ça soit avec des webhook, chaque
 * changement immédiat").
 *
 * Côté Odoo → AQ : Odoo POST sur `/api/webhooks/odoo/product` avec un
 * header `X-Agri-Qodo-Webhook-Token`. Le service authentifie via le
 * token (qui résout aussi le tenantId) puis upsert les produits
 * concernés en relisant l'état Odoo.
 *
 * Côté AQ → Odoo : déjà géré dans produits.service.update / matériels
 * via ensureOdooProduct post-mutation.
 */
@Injectable()
export class OdooWebhooksService {
  private readonly logger = new Logger(OdooWebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly odooClientManager: OdooClientManager,
  ) {}

  /**
   * Génère ou réutilise le token webhook d'un tenant. Le token est
   * utilisé par Odoo pour s'identifier dans le header X-Agri-Qodo-
   * Webhook-Token.
   */
  async ensureToken(tenantId: string): Promise<string> {
    const tenant = await this.prisma.exploitation.findUnique({
      where: { id: tenantId },
      select: { odooWebhookToken: true },
    });
    if (!tenant) throw new NotFoundException("Tenant introuvable");
    if (tenant.odooWebhookToken) return tenant.odooWebhookToken;
    const token = randomBytes(24).toString("base64url");
    await this.prisma.exploitation.update({
      where: { id: tenantId },
      data: { odooWebhookToken: token },
    });
    return token;
  }

  /**
   * Authentifie un webhook entrant par token et retourne le tenantId.
   * Lève UnauthorizedException si token absent ou invalide.
   */
  async authenticateByToken(token: string | undefined): Promise<string> {
    if (!token) throw new UnauthorizedException("Token webhook manquant");
    const tenant = await this.prisma.exploitation.findFirst({
      where: { odooWebhookToken: token },
      select: { id: true },
    });
    if (!tenant) throw new UnauthorizedException("Token webhook invalide");
    return tenant.id;
  }

  /**
   * Traite un webhook product.product : (re)lit chaque id côté Odoo
   * et upsert dans la table produits. Pour event=unlink, on désactive
   * localement (actif=false) sans toucher au reste — l'admin peut
   * réactiver manuellement si suppression Odoo accidentelle.
   */
  async handleProductWebhook(
    tenantId: string,
    event: "create" | "write" | "unlink",
    odooIds: number[],
  ): Promise<{ processed: number; skipped: number }> {
    if (odooIds.length === 0) return { processed: 0, skipped: 0 };

    // unlink : désactiver localement, ne pas requêter Odoo (qui n'a
    // plus le record).
    if (event === "unlink") {
      const result = await this.prisma.produit.updateMany({
        where: { tenantId, odooProductId: { in: odooIds } },
        data: { actif: false, odooSyncedAt: new Date() },
      });
      this.logger.log(
        `Webhook unlink product.product : ${result.count} produit(s) désactivé(s) (tenant ${tenantId}).`,
      );
      return { processed: result.count, skipped: 0 };
    }

    // create / write : lire les enregistrements Odoo et upserter.
    const client = await this.odooClientManager.forTenant(tenantId);
    const rows = await client.searchRead<{
      id: number;
      name: string;
      default_code: string | false;
      list_price: number;
      uom_id: [number, string] | false;
      categ_id: [number, string] | false;
      active: boolean;
      type: string;
    }>("product.product", [["id", "in", odooIds]], {
      fields: ["id", "name", "default_code", "list_price", "uom_id", "categ_id", "active", "type"],
      limit: odooIds.length,
    });

    const now = new Date();
    let processed = 0;
    let skipped = 0;

    for (const row of rows) {
      // Seuls les biens et matériels sont synchronisés ici. type=service
      // est géré par MatérielsOdooSyncService (à brancher dans une 2e
      // PR pour rester focus). On skip pour l'instant.
      if (row.type === "service") {
        skipped++;
        continue;
      }

      const existing = await this.prisma.produit.findFirst({
        where: { tenantId, odooProductId: row.id },
        select: { id: true, excludeFromOdooSync: true },
      });

      // Respecter le flag exclude-from-sync local.
      if (existing?.excludeFromOdooSync) {
        await this.prisma.produit.update({
          where: { id: existing.id },
          data: { odooSyncedAt: now, actif: row.active },
        });
        skipped++;
        continue;
      }

      const data = {
        libelle: row.name.trim() || `Produit Odoo #${row.id}`,
        categorie: mapCategorieFromOdoo(row.name, row.categ_id ? row.categ_id[1] : undefined),
        unite: mapUniteFromOdoo(row.uom_id ? row.uom_id[1] : undefined),
        prixVenteCHF: row.list_price > 0 ? row.list_price : null,
        marque: row.default_code ? row.default_code : null,
        actif: row.active,
        odooSyncedAt: now,
      };

      if (existing) {
        await this.prisma.produit.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await this.prisma.produit.create({
          data: {
            ...data,
            tenantId,
            code: `odoo-${tenantId.slice(0, 8)}-${row.id}`,
            odooProductId: row.id,
          },
        });
      }
      processed++;
    }

    this.logger.log(
      `Webhook ${event} product.product : ${processed} produit(s) upsert / ${skipped} skip (tenant ${tenantId}).`,
    );
    return { processed, skipped };
  }
}

// Helpers de mapping — dupliqués depuis produits/odoo-sync.service pour
// éviter une dépendance circulaire de module. À factoriser plus tard.

function mapUniteFromOdoo(uomLabel: string | undefined): ProduitUnite {
  if (!uomLabel) return ProduitUnite.KG;
  const u = uomLabel.toLowerCase();
  if (u.includes("kg") || u.includes("kilo")) return ProduitUnite.KG;
  if (u.includes("ton")) return ProduitUnite.T;
  if (u.includes("litre") || u === "l") return ProduitUnite.L;
  if (u.includes("m3") || u.includes("m³") || u.includes("cube")) return ProduitUnite.M3;
  if (u.includes("dose")) return ProduitUnite.DOSE;
  if (u.includes("hectare") || u === "ha") return ProduitUnite.HA;
  if (u.includes("heure") || u === "h") return ProduitUnite.HEURE;
  if (u.includes("unit")) return ProduitUnite.UNITE;
  return ProduitUnite.KG;
}

function mapCategorieFromOdoo(
  produitLabel: string | undefined,
  categLabel: string | undefined,
): ProduitCategorie {
  const haystack = `${produitLabel ?? ""} ${categLabel ?? ""}`.toLowerCase();
  if (!haystack.trim()) return ProduitCategorie.AUTRE;
  if (
    /bottel|botelage|fauch|endain|ensil|press|enrubann|moisson|battage|labour à façon|labour facon|prestation/.test(
      haystack,
    )
  )
    return ProduitCategorie.PRESTATION;
  if (
    /phyto|herbicid|fongicid|insecticid|acaricid|molluscicid|nématicid|nematicid|défoliant|defoliant|régulateur|regulateur|adjuvant/.test(
      haystack,
    )
  )
    return ProduitCategorie.PHYTO;
  if (
    /organi|compost|fumier|lisier|digestat|guano|sang séché|sang seche|corne broyée|corne broyee|tourteau|vinasse/.test(
      haystack,
    )
  )
    return ProduitCategorie.ENGRAIS_ORGANIQUE;
  if (
    /engrais|fertili|npk|nitrate|ammonitrate|ammoniac|urée|uree|potass|phosphat|chaux|magnési|magnesi|sulfat|kainit|patentkali|soufre|oligo-?élément|oligo-?element/.test(
      haystack,
    )
  )
    return ProduitCategorie.ENGRAIS_MINERAL;
  if (
    /semence|semis|\bseed\b|plantule|bouture|tubercule|graine de|graines de/.test(haystack) ||
    /\b(blé|ble|froment|orge|avoine|seigle|triticale|épeautre|epeautre|sarrasin|maïs|mais|tournesol|colza|soja|lin|pois|féverole|feverole|lupin|betterave|pomme de terre|luzerne|trèfle|trefle|dactyle|fétuque|fetuque|ray-?grass|raigrass|phacélie|phacelie|vesce)\b/.test(
      haystack,
    )
  )
    return ProduitCategorie.SEMENCE;
  if (/foin|paille|regain|botte|balle\b|round[- ]?bale|big[- ]?bale|enrubanné/.test(haystack))
    return ProduitCategorie.RECOLTE;
  if (
    /labour|déchaumage|dechaumage|hersage|herse|charrue|fraise|griffon|décompactage|decompactage|sous-?solage|roulage/.test(
      haystack,
    )
  )
    return ProduitCategorie.TRAVAIL_SOL;
  if (/irrigation|arrosage|asperseur|enrouleur/.test(haystack)) return ProduitCategorie.IRRIGATION;
  if (/diesel|gasoil|essence|carburant|fioul|fuel|huile moteur|lubrifiant|graisse/.test(haystack))
    return ProduitCategorie.CARBURANT;
  if (
    /pièce|piece|filtre|courroie|roulement|joint|boulon|soc|dent|cardan|pneu|outillage/.test(
      haystack,
    )
  )
    return ProduitCategorie.PIECES_MATERIEL;
  return ProduitCategorie.AUTRE;
}
