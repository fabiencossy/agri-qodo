import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { MaterielCategorie, MaterielUnite, type UserRole } from "@prisma/client";
import { randomBytes } from "node:crypto";
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

export interface SyncOdooMaterielsResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ odooId: number; raison: string }>;
}

const ADMIN_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(["OWNER", "COMPTABLE"]);

/**
 * Mapping libellé Odoo → enum MaterielUnite. Heuristique tolérante.
 * Default = FORFAIT (bonne valeur par défaut pour un service à la pièce).
 */
function mapUnite(uomLabel: string | undefined): MaterielUnite {
  if (!uomLabel) return MaterielUnite.FORFAIT;
  const u = uomLabel.toLowerCase();
  if (u.includes("hectare") || u === "ha") return MaterielUnite.HA;
  if (u.includes("m3") || u.includes("m³") || u.includes("cube")) return MaterielUnite.M3;
  if (u.includes("ton")) return MaterielUnite.T;
  if (u.includes("heure") || u === "h" || u.includes("hour")) return MaterielUnite.H;
  return MaterielUnite.FORFAIT;
}

/**
 * Mapping libellé Odoo (categ_id label OU name) → MaterielCategorie.
 * Heuristique sur les mots-clés français + anglais. Tout ce qui n'est
 * pas reconnu tombe en AUTRE — l'admin peut affiner après import.
 */
function mapCategorie(...labels: Array<string | undefined>): MaterielCategorie {
  const text = labels.filter(Boolean).join(" ").toLowerCase();
  if (!text) return MaterielCategorie.AUTRE;
  if (
    text.includes("labour") ||
    text.includes("charrue") ||
    text.includes("herse") ||
    text.includes("vibro") ||
    text.includes("déchaum") ||
    text.includes("dechaum") ||
    text.includes("sol") ||
    text.includes("till")
  ) {
    return MaterielCategorie.TRAVAIL_DU_SOL;
  }
  if (
    text.includes("semis") ||
    text.includes("semoir") ||
    text.includes("plantation") ||
    text.includes("plant") ||
    text.includes("seed")
  ) {
    return MaterielCategorie.SEMIS;
  }
  if (
    text.includes("épandage") ||
    text.includes("epandage") ||
    text.includes("fumure") ||
    text.includes("lisier") ||
    text.includes("fumier") ||
    text.includes("engrais") ||
    text.includes("fertilis")
  ) {
    return MaterielCategorie.FERTILISATION;
  }
  if (
    text.includes("pulvé") ||
    text.includes("pulve") ||
    text.includes("phyto") ||
    text.includes("traitement") ||
    text.includes("désherb") ||
    text.includes("desherb") ||
    text.includes("spray")
  ) {
    return MaterielCategorie.PROTECTION;
  }
  if (
    text.includes("moisson") ||
    text.includes("récolte") ||
    text.includes("recolte") ||
    text.includes("ensilage") ||
    text.includes("balle") ||
    text.includes("presse") ||
    text.includes("fauchage") ||
    text.includes("fanage") ||
    text.includes("andain") ||
    text.includes("arrach") ||
    text.includes("harvest")
  ) {
    return MaterielCategorie.RECOLTE;
  }
  if (text.includes("irrig") || text.includes("enrouleur")) {
    return MaterielCategorie.IRRIGATION;
  }
  if (text.includes("transport") || text.includes("benne") || text.includes("autochar")) {
    return MaterielCategorie.TRANSPORT;
  }
  return MaterielCategorie.AUTRE;
}

/**
 * Sync Materiel ↔ Odoo `product.product` type=service.
 *
 * Deux directions :
 *  - **Pull** (`syncMateriels`) — admin only, importe les services Odoo
 *    actifs vers le catalogue tenant.
 *  - **Push on demand** (`ensureOdooProduct`) — appelé par le push d'un
 *    Travail/Intervention en cas B : si le matériel n'a pas encore
 *    `odooProductId`, on crée le service côté Odoo et on stocke l'id.
 */
@Injectable()
export class MaterielsOdooSyncService {
  private readonly logger = new Logger(MaterielsOdooSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly odooClientManager: OdooClientManager,
  ) {}

  private assertAdmin(): void {
    const ctx = this.tenantContext.tryGet();
    if (!ctx?.role || !ADMIN_ROLES.has(ctx.role)) {
      throw new ForbiddenException(
        "Seul un OWNER ou COMPTABLE peut synchroniser le catalogue Matériel Odoo.",
      );
    }
  }

  async syncMateriels(): Promise<SyncOdooMaterielsResult> {
    this.assertAdmin();
    const { tenantId } = this.tenantContext.get();
    const client = await this.odooClientManager.forTenant(tenantId);

    let rows: OdooProductRow[];
    try {
      rows = await client.searchRead<OdooProductRow>(
        "product.product",
        [
          ["active", "=", true],
          ["type", "=", "service"],
        ],
        {
          fields: ["id", "name", "default_code", "list_price", "uom_id", "categ_id", "active"],
          limit: 5000,
          order: "name ASC",
        },
      );
    } catch (err) {
      this.logger.error(
        `Sync Odoo matériels — search_read échoué pour tenant ${tenantId} : ${err instanceof Error ? err.message : err}`,
      );
      throw new ServiceUnavailableException(
        "Impossible de lire les services Odoo. Vérifie la config et l'accès.",
      );
    }

    const result: SyncOdooMaterielsResult = {
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
        const categorie = mapCategorie(categLabel, row.name);

        const data = {
          libelle: row.name.trim() || `Service Odoo #${row.id}`,
          categorie,
          unite,
          prixUnitaireCHF: row.list_price > 0 ? row.list_price : null,
          notes: row.default_code ? `Réf. Odoo : ${row.default_code}` : null,
          actif: row.active,
          odooSyncedAt: now,
        };

        const existing = await this.prisma.materiel.findFirst({
          where: { tenantId, odooProductId: row.id },
          select: { id: true },
        });

        if (existing) {
          await this.prisma.materiel.update({ where: { id: existing.id }, data });
          result.updated++;
        } else {
          const code = `odoo-${tenantId.slice(0, 8)}-${row.id}`;
          await this.prisma.materiel.create({
            data: { ...data, tenantId, code, odooProductId: row.id },
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
      `Sync Odoo matériels terminée pour tenant ${tenantId} : ${result.created} créés, ${result.updated} mis à jour, ${result.skipped} skip`,
    );
    return result;
  }

  /**
   * Garantit qu'un matériel a un product.product Odoo associé. Crée le
   * service côté Odoo si `odooProductId` est null. Idempotent.
   *
   * Appelé par le push d'un Travail/Intervention en cas B au moment de
   * construire les sale.order.line. Si l'admin n'a pas pré-sync les
   * services depuis Odoo, on crée à la volée.
   */
  async ensureOdooProduct(materielId: string): Promise<number> {
    const { tenantId } = this.tenantContext.get();
    const materiel = await this.prisma.materiel.findFirst({
      where: { id: materielId, OR: [{ tenantId: null }, { tenantId }] },
    });
    if (!materiel) throw new NotFoundException("Matériel introuvable");
    if (materiel.odooProductId) return materiel.odooProductId;

    const client = await this.odooClientManager.forTenant(tenantId);

    let odooId: number;
    try {
      odooId = await client.create("product.product", {
        name: materiel.libelle,
        type: "service",
        list_price: materiel.prixUnitaireCHF ? Number(materiel.prixUnitaireCHF) : 0,
        // Code interne traçable côté Odoo — repère que ce service a été
        // créé par agri-qodo.
        default_code: `AQ-${materiel.code}`,
      });
    } catch (err) {
      this.logger.error(
        `Création product.product service échouée pour matériel ${materielId} : ${err instanceof Error ? err.message : err}`,
      );
      throw new ServiceUnavailableException(
        "Impossible de créer le service côté Odoo. Vérifie la config.",
      );
    }

    // Si le matériel est global (tenantId null), on ne peut pas y stocker
    // l'odooProductId tenant-specific. On crée alors une copie tenant
    // avec le mapping. Sinon on update direct.
    if (materiel.tenantId === null) {
      await this.prisma.materiel.create({
        data: {
          tenantId,
          code: `t-${tenantId.slice(0, 8)}-${randomBytes(3).toString("hex")}-${materiel.code}`,
          libelle: materiel.libelle,
          categorie: materiel.categorie,
          unite: materiel.unite,
          prixUnitaireCHF: materiel.prixUnitaireCHF,
          notes: materiel.notes,
          actif: materiel.actif,
          odooProductId: odooId,
          odooSyncedAt: new Date(),
        },
      });
    } else {
      await this.prisma.materiel.update({
        where: { id: materiel.id },
        data: { odooProductId: odooId, odooSyncedAt: new Date() },
      });
    }

    return odooId;
  }
}
