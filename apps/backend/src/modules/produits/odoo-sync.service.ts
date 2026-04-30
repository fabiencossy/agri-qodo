import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ProduitCategorie, ProduitUnite, type UserRole } from "@prisma/client";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import { OdooClientManager } from "@/modules/odoo/odoo-client-manager.service";

/** Forme partielle du record `product.product` qu'on lit côté Odoo. */
interface OdooProductRow {
  id: number;
  name: string;
  default_code: string | false;
  list_price: number;
  uom_id: [number, string] | false;
  categ_id: [number, string] | false;
  active: boolean;
}

/** Résultat de la sync — affiché à l'admin pour qu'il sache ce qui s'est passé. */
export interface SyncOdooProduitsResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ odooId: number; raison: string }>;
}

const ADMIN_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(["OWNER", "COMPTABLE"]);

/**
 * Mapping libellé Odoo → enum agri-qodo. On reste tolérant : tout ce qui
 * n'est pas reconnu tombe en AUTRE / KG. L'admin peut affiner ensuite.
 */
function mapUnite(uomLabel: string | undefined): ProduitUnite {
  if (!uomLabel) return ProduitUnite.KG;
  const u = uomLabel.toLowerCase();
  if (u.includes("kg") || u.includes("kilo")) return ProduitUnite.KG;
  if (u.includes("ton")) return ProduitUnite.T;
  if (u.includes("litre") || u === "l") return ProduitUnite.L;
  if (u.includes("m3") || u.includes("m³") || u.includes("cube")) return ProduitUnite.M3;
  if (u.includes("dose")) return ProduitUnite.DOSE;
  return ProduitUnite.KG;
}

function mapCategorie(categLabel: string | undefined): ProduitCategorie {
  if (!categLabel) return ProduitCategorie.AUTRE;
  const c = categLabel.toLowerCase();
  if (c.includes("semence") || c.includes("seed")) return ProduitCategorie.SEMENCE;
  if (c.includes("phyto") || c.includes("herbicide") || c.includes("fongicide"))
    return ProduitCategorie.PHYTO;
  if (c.includes("organi") || c.includes("compost") || c.includes("fumier") || c.includes("lisier"))
    return ProduitCategorie.ENGRAIS_ORGANIQUE;
  if (c.includes("engrais") || c.includes("fertili") || c.includes("npk"))
    return ProduitCategorie.ENGRAIS_MINERAL;
  return ProduitCategorie.AUTRE;
}

@Injectable()
export class OdooSyncService {
  private readonly logger = new Logger(OdooSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly odooClientManager: OdooClientManager,
  ) {}

  private assertAdmin(): void {
    const ctx = this.tenantContext.tryGet();
    if (!ctx?.role || !ADMIN_ROLES.has(ctx.role)) {
      throw new ForbiddenException(
        "Seul un OWNER ou COMPTABLE peut synchroniser le catalogue Odoo.",
      );
    }
  }

  /**
   * Importe tous les `product.product` actifs depuis Odoo et les
   * upsert dans le catalogue local. Idempotent : la 2e exécution
   * détecte les produits via `(tenantId, odooProductId)` et fait UPDATE.
   *
   * Limite : pas de chunking encore (50 produits = OK, 5000 prend le
   * timeout HTTP par défaut). Pour gros catalogues, on ajoutera batching.
   */
  async syncProduits(): Promise<SyncOdooProduitsResult> {
    this.assertAdmin();
    const { tenantId } = this.tenantContext.get();
    const client = await this.odooClientManager.forTenant(tenantId);

    let rows: OdooProductRow[];
    try {
      rows = await client.searchRead<OdooProductRow>("product.product", [["active", "=", true]], {
        fields: ["id", "name", "default_code", "list_price", "uom_id", "categ_id", "active"],
        limit: 5000,
        order: "name ASC",
      });
    } catch (err) {
      this.logger.error(
        `Sync Odoo produits — search_read échoué pour tenant ${tenantId} : ${err instanceof Error ? err.message : err}`,
      );
      throw new ServiceUnavailableException(
        "Impossible de lire les produits Odoo. Vérifie la config et l'accès.",
      );
    }

    const result: SyncOdooProduitsResult = {
      total: rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };
    const now = new Date();

    for (const row of rows) {
      try {
        const uniteLabel = row.uom_id ? row.uom_id[1] : undefined;
        const categLabel = row.categ_id ? row.categ_id[1] : undefined;
        const unite = mapUnite(uniteLabel);
        const categorie = mapCategorie(categLabel);

        const data = {
          libelle: row.name.trim() || `Produit Odoo #${row.id}`,
          categorie,
          unite,
          prixVenteCHF: row.list_price > 0 ? row.list_price : null,
          marque: row.default_code ? row.default_code : null,
          actif: row.active,
          odooSyncedAt: now,
        };

        const existing = await this.prisma.produit.findFirst({
          where: { tenantId, odooProductId: row.id },
          select: { id: true },
        });

        if (existing) {
          await this.prisma.produit.update({
            where: { id: existing.id },
            data,
          });
          result.updated++;
        } else {
          // Code unique : on préfixe par "odoo-{tenant}-{id}".
          const code = `odoo-${tenantId.slice(0, 8)}-${row.id}`;
          await this.prisma.produit.create({
            data: {
              ...data,
              tenantId,
              code,
              odooProductId: row.id,
            },
          });
          result.created++;
        }
      } catch (err) {
        result.skipped++;
        result.errors.push({
          odooId: row.id,
          raison: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.logger.log(
      `Sync Odoo produits terminée pour tenant ${tenantId} : ${result.created} créés, ${result.updated} mis à jour, ${result.skipped} skip`,
    );
    return result;
  }
}
