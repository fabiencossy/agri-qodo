import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
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

  /** Cache du mapping ProduitUnite → uom.uom Odoo, par tenant. */
  private readonly uomCache = new Map<string, Map<ProduitUnite, number>>();

  /**
   * Cache du mapping tauxTvaPercent → account.tax Odoo (sale), par tenant.
   * Clé interne = `taux.toFixed(2)` pour éviter les soucis de virgule
   * flottante (8.1 != 8.10000001). Valeur 0 = lookup négatif (mémorisé
   * pour éviter les retries inutiles).
   */
  private readonly saleTaxCache = new Map<string, Map<string, number>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly odooClientManager: OdooClientManager,
  ) {}

  /**
   * Résout l'uom.uom Odoo correspondant à une ProduitUnite locale.
   * Cache par tenant pour éviter les lookups répétés. Retourne null
   * si Odoo n'a pas l'unité — auquel cas on laisse Odoo prendre son
   * unité par défaut (souvent "Unité(s)").
   */
  private async resolveUomId(
    client: import("@agri-qodo/odoo-client").OdooClient,
    tenantId: string,
    unite: ProduitUnite,
  ): Promise<number | null> {
    let cache = this.uomCache.get(tenantId);
    if (!cache) {
      cache = new Map();
      this.uomCache.set(tenantId, cache);
    }
    const cached = cache.get(unite);
    if (cached !== undefined) return cached || null;

    const candidates: Record<ProduitUnite, string[]> = {
      KG: ["kg", "Kilogramme(s)", "Kilogramme"],
      T: ["Tonne(s)", "Tonne", "t"],
      L: ["L", "Litre(s)", "Litre"],
      M3: ["m³", "m3", "Mètre(s) cube", "Mètre cube"],
      DOSE: ["Dose(s)", "Dose"],
    };
    for (const name of candidates[unite]) {
      try {
        const found = await client.searchRead<{ id: number }>("uom.uom", [["name", "=", name]], {
          fields: ["id"],
          limit: 1,
        });
        if (found.length > 0 && found[0]) {
          cache.set(unite, found[0].id);
          return found[0].id;
        }
      } catch {
        // Continue trying next candidate
      }
    }
    cache.set(unite, 0);
    return null;
  }

  /**
   * Résout l'`account.tax` Odoo (type_tax_use=sale) qui a `amount` égal au
   * taux fourni. Retourne null si aucune taxe configurée — l'admin Odoo
   * doit alors créer la taxe manuellement (cas d'une instance fraîche
   * sans préset CH). Cache par tenant pour éviter les lookups répétés.
   */
  private async resolveSaleTaxId(
    client: import("@agri-qodo/odoo-client").OdooClient,
    tenantId: string,
    tauxPercent: number,
  ): Promise<number | null> {
    let cache = this.saleTaxCache.get(tenantId);
    if (!cache) {
      cache = new Map();
      this.saleTaxCache.set(tenantId, cache);
    }
    const key = tauxPercent.toFixed(2);
    const cached = cache.get(key);
    if (cached !== undefined) return cached || null;
    try {
      const found = await client.searchRead<{ id: number }>(
        "account.tax",
        [
          ["amount", "=", tauxPercent],
          ["type_tax_use", "=", "sale"],
          ["active", "=", true],
        ],
        { fields: ["id"], limit: 1 },
      );
      if (found.length > 0 && found[0]) {
        cache.set(key, found[0].id);
        return found[0].id;
      }
    } catch {
      // Best-effort : l'absence de droit lecture account.tax sur le rôle
      // technique d'intégration ne doit pas bloquer la sync produit.
    }
    cache.set(key, 0);
    return null;
  }

  /**
   * Construit le payload Odoo `taxes_id` à partir du tauxTvaPercent
   * local. Retourne `undefined` quand le champ n'est pas défini (on
   * laisse alors Odoo conserver ses taxes existantes / par défaut).
   */
  private async buildTaxesPayload(
    client: import("@agri-qodo/odoo-client").OdooClient,
    tenantId: string,
    tauxTvaPercent: unknown,
  ): Promise<{ taxes_id: Array<[number, number, number[]]> } | undefined> {
    if (tauxTvaPercent === null || tauxTvaPercent === undefined) return undefined;
    const taux = Number(tauxTvaPercent);
    if (Number.isNaN(taux)) return undefined;
    const taxId = await this.resolveSaleTaxId(client, tenantId, taux);
    if (taxId === null) {
      this.logger.warn(
        `account.tax sale ${taux}% introuvable pour tenant ${tenantId} — taxes_id non poussé.`,
      );
      return undefined;
    }
    // Commande Odoo many2many : [[6, 0, [ids]]] remplace toute la liste.
    return { taxes_id: [[6, 0, [taxId]]] };
  }

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
      // Décision Fabien 2026-05-06 : la sync Biens ne doit PAS importer
      // les services (sinon doublon avec l'onglet Prestations qui les
      // gère). On filtre type ∈ {consu, product} côté Odoo.
      rows = await client.searchRead<OdooProductRow>(
        "product.product",
        [
          ["active", "=", true],
          ["type", "in", ["consu", "product"]],
        ],
        {
          fields: ["id", "name", "default_code", "list_price", "uom_id", "categ_id", "active"],
          limit: 5000,
          order: "name ASC",
        },
      );
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

  /**
   * Garantit qu'un produit a un product.product Odoo associé. Crée le
   * produit côté Odoo si `odooProductId` est null, sinon retourne
   * l'existant (idempotent). Sert au bouton "Pousser vers Odoo" sur
   * la fiche produit côté UI.
   */
  async ensureOdooProduct(produitId: string): Promise<number> {
    const { tenantId } = this.tenantContext.get();
    const produit = await this.prisma.produit.findFirst({
      where: { id: produitId, OR: [{ tenantId: null }, { tenantId }] },
    });
    if (!produit) throw new NotFoundException("Produit introuvable");

    // Sync bidirectionnelle (demande Fabien 2026-05-06) : si déjà
    // mappé, on push les valeurs locales vers Odoo puis on rapatrie
    // ce qu'Odoo enregistre finalement (prix, libellé). Agri Qodo
    // prime au moment du push.
    if (produit.odooProductId) {
      const client = await this.odooClientManager.forTenant(tenantId);
      const uomId = await this.resolveUomId(client, tenantId, produit.unite);
      const taxesPayload = await this.buildTaxesPayload(client, tenantId, produit.tauxTvaPercent);
      // default_code mis à false pour effacer la référence interne
      // visible côté Odoo (demande Fabien 2026-05-06).
      await client
        .write("product.product", [produit.odooProductId], {
          name: produit.libelle,
          list_price: produit.prixVenteCHF ? Number(produit.prixVenteCHF) : 0,
          default_code: false,
          ...(uomId ? { uom_id: uomId } : {}),
          ...(taxesPayload ?? {}),
        })
        .catch((err) =>
          this.logger.warn(
            `Sync push (prod #${produit.odooProductId}) échoué : ${err instanceof Error ? err.message : err}`,
          ),
        );
      try {
        const probe = await client.searchRead<{
          id: number;
          name?: string;
          list_price?: number;
        }>("product.product", [["id", "=", produit.odooProductId]], {
          fields: ["id", "name", "list_price"],
          limit: 1,
        });
        const o = probe[0];
        if (o) {
          await this.prisma.produit.update({
            where: { id: produit.id },
            data: {
              ...(o.name ? { libelle: o.name } : {}),
              ...(typeof o.list_price === "number"
                ? { prixVenteCHF: o.list_price > 0 ? o.list_price : null }
                : {}),
              odooSyncedAt: new Date(),
            },
          });
        }
      } catch {
        // Lecture best-effort.
      }
      return produit.odooProductId;
    }

    // Dédup : si on a déjà un produit perso avec même libellé côté
    // tenant, et qu'il a un odooProductId, on renvoie celui-ci.
    if (produit.tenantId === null) {
      const existingPerso = await this.prisma.produit.findFirst({
        where: { tenantId, libelle: produit.libelle, odooProductId: { not: null } },
        select: { id: true, odooProductId: true },
      });
      if (existingPerso?.odooProductId) {
        return existingPerso.odooProductId;
      }
    }

    const client = await this.odooClientManager.forTenant(tenantId);

    // Lookup Odoo par default_code AQ-{code} ou name+type=consu pour
    // éviter un doublon côté Odoo si un produit identique existe déjà.
    const defaultCode = `AQ-${produit.code}`;
    let odooId: number | undefined;
    try {
      const found = await client.searchRead<{ id: number }>(
        "product.product",
        [
          "|",
          ["default_code", "=", defaultCode],
          "&",
          ["name", "=", produit.libelle],
          ["type", "in", ["consu", "product"]],
        ],
        { fields: ["id"], limit: 1 },
      );
      if (found.length > 0 && found[0]) {
        odooId = found[0].id;
      }
    } catch {
      // Lookup best-effort.
    }

    // Unité de mesure Odoo correspondant à produit.unite (kg, t, L,
    // m³, dose). Si trouvée on la pose à la création — sinon Odoo
    // prend son défaut "Unité(s)" qui n'est pas adapté.
    const uomId = await this.resolveUomId(client, tenantId, produit.unite);
    const taxesPayload = await this.buildTaxesPayload(client, tenantId, produit.tauxTvaPercent);

    if (!odooId) {
      try {
        odooId = await client.create("product.product", {
          name: produit.libelle,
          type: "consu",
          list_price: produit.prixVenteCHF ? Number(produit.prixVenteCHF) : 0,
          // default_code retiré (demande Fabien 2026-05-06).
          ...(uomId ? { uom_id: uomId } : {}),
          ...(taxesPayload ?? {}),
        });
      } catch (err) {
        this.logger.error(
          `Création product.product échouée pour produit ${produitId} : ${err instanceof Error ? err.message : err}`,
        );
        throw new ServiceUnavailableException(
          "Impossible de créer le produit côté Odoo. Vérifie la config.",
        );
      }
    } else if (uomId || taxesPayload) {
      // Produit existant côté Odoo : on s'assure que son unité et ses
      // taxes sont alignées avec Agri Qodo (best-effort, ne casse pas
      // si l'admin a verrouillé certains champs côté Odoo).
      await client
        .write("product.product", [odooId], {
          ...(uomId ? { uom_id: uomId } : {}),
          ...(taxesPayload ?? {}),
        })
        .catch(() => undefined);
    }

    if (produit.tenantId === null) {
      // Globaux : on duplique en perso pour pouvoir poser l'odooProductId
      // sans contaminer le catalogue partagé.
      await this.prisma.produit.create({
        data: {
          tenantId,
          code: `t-${tenantId.slice(0, 8)}-${produit.code}`,
          libelle: produit.libelle,
          categorie: produit.categorie,
          unite: produit.unite,
          marque: produit.marque,
          fournisseur: produit.fournisseur,
          especeCode: produit.especeCode,
          tauxN: produit.tauxN,
          tauxP: produit.tauxP,
          tauxK: produit.tauxK,
          prixVenteCHF: produit.prixVenteCHF,
          tauxTvaPercent: produit.tauxTvaPercent,
          notes: produit.notes,
          actif: produit.actif,
          odooProductId: odooId,
          odooSyncedAt: new Date(),
        },
      });
    } else {
      await this.prisma.produit.update({
        where: { id: produit.id },
        data: { odooProductId: odooId, odooSyncedAt: new Date() },
      });
    }

    return odooId;
  }
}
