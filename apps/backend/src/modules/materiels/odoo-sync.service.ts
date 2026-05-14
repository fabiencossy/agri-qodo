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

  // Cache mémoire (par tenant) du mapping unité agri-qodo → uom.uom Odoo.
  // Évite les lookup uom.uom à chaque création de produit.
  private readonly uomCache = new Map<string, Map<MaterielUnite, number>>();

  // Cache mémoire (par tenant) du mapping tauxTvaPercent → account.tax
  // Odoo (sale). Clé interne = `taux.toFixed(2)`. 0 = lookup négatif.
  private readonly saleTaxCache = new Map<string, Map<string, number>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly odooClientManager: OdooClientManager,
  ) {}

  /**
   * Résout l'id `uom.uom` Odoo correspondant à l'unité agri-qodo. Lookup
   * tolérant sur le nom (Odoo expose "Hectare(s)", "m³", "Tonne(s)",
   * "Heure(s)", "Unité(s)"). Cache en mémoire par tenant pour éviter le
   * lookup répété.
   */
  private async resolveUomId(
    client: import("@agri-qodo/odoo-client").OdooClient,
    tenantId: string,
    unite: MaterielUnite,
  ): Promise<number | null> {
    let cache = this.uomCache.get(tenantId);
    if (!cache) {
      cache = new Map();
      this.uomCache.set(tenantId, cache);
    }
    const cached = cache.get(unite);
    if (cached !== undefined) return cached || null;

    const candidates: Record<MaterielUnite, string[]> = {
      HA: ["Hectare(s)", "Hectare", "ha"],
      M3: ["m³", "m3", "Mètre(s) cube", "Mètre cube"],
      T: ["Tonne(s)", "Tonne", "t"],
      H: ["Heure(s)", "Heure", "hour", "h"],
      FORFAIT: ["Unité(s)", "Units", "Unit"],
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
    cache.set(unite, 0); // 0 = not found, on cache pour ne pas relooker
    return null;
  }

  /**
   * Résout l'`account.tax` Odoo (type_tax_use=sale) qui a `amount` égal au
   * taux fourni. Retourne null si aucune taxe configurée. Cache par tenant.
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
      // Best-effort.
    }
    cache.set(key, 0);
    return null;
  }

  /**
   * Construit le payload Odoo `taxes_id` à partir du tauxTvaPercent local.
   * Retourne `undefined` si non défini ou si la taxe n'existe pas côté
   * Odoo (on laisse alors Odoo conserver ses taxes existantes / par défaut).
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
    return { taxes_id: [[6, 0, [taxId]]] };
  }

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
  /**
   * Pousse en masse tous les matériels visibles du tenant vers Odoo.
   * Variante Matériel de `pushAllProduits` (cf produits/odoo-sync).
   */
  async pushAllMateriels(): Promise<{
    total: number;
    pushed: number;
    skipped: number;
    errors: Array<{ materielId: string; libelle: string; raison: string }>;
  }> {
    this.assertAdmin();
    const { tenantId } = this.tenantContext.get();

    const all = await this.prisma.materiel.findMany({
      where: {
        actif: true,
        OR: [{ tenantId: null }, { tenantId }],
      },
      select: { id: true, libelle: true, tenantId: true, odooProductId: true },
      orderBy: { libelle: "asc" },
    });

    const persoLibelles = new Set(
      all.filter((m) => m.tenantId === tenantId).map((m) => m.libelle.toLowerCase().trim()),
    );
    const toPush = all.filter(
      (m) => m.tenantId === tenantId || !persoLibelles.has(m.libelle.toLowerCase().trim()),
    );

    const result = {
      total: toPush.length,
      pushed: 0,
      skipped: 0,
      errors: [] as Array<{ materielId: string; libelle: string; raison: string }>,
    };

    for (const materiel of toPush) {
      try {
        await this.ensureOdooProduct(materiel.id);
        result.pushed++;
      } catch (err) {
        result.errors.push({
          materielId: materiel.id,
          libelle: materiel.libelle,
          raison: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.logger.log(
      `Push all matériels terminé pour tenant ${tenantId} : ${result.pushed}/${result.total} poussés (${result.errors.length} erreurs).`,
    );
    return result;
  }

  async ensureOdooProduct(materielId: string): Promise<number> {
    const { tenantId } = this.tenantContext.get();
    const materiel = await this.prisma.materiel.findFirst({
      where: { id: materielId, OR: [{ tenantId: null }, { tenantId }] },
    });
    if (!materiel) throw new NotFoundException("Matériel introuvable");

    // Sync bidirectionnelle (demande Fabien 2026-05-06) : si déjà
    // mappé, on aligne Odoo sur les valeurs locales (libellé, prix,
    // unité), puis on relit Odoo pour rapatrier d'éventuels écarts
    // (ex prix modifié côté Odoo entre-temps). Agri Qodo prime au
    // moment du push, mais Odoo conserve la main sur les autres
    // champs métier qu'on ne touche pas (catégorie comptable,
    // taxes, etc.).
    if (materiel.odooProductId) {
      const client = await this.odooClientManager.forTenant(tenantId);

      // Fabien 2026-05-14 : si Odoo a supprimé le produit, on retombe
      // sur la branche de création au lieu d'écrire dans le vide.
      let stillExists = true;
      try {
        const probe = await client.searchRead<{ id: number }>(
          "product.product",
          [["id", "=", materiel.odooProductId]],
          { fields: ["id"], limit: 1 },
        );
        stillExists = probe.length > 0;
      } catch {
        // Best-effort.
      }
      if (!stillExists) {
        this.logger.log(
          `Matériel ${materiel.id} : odooProductId #${materiel.odooProductId} orphelin (supprimé côté Odoo) → reset local et re-création.`,
        );
        await this.prisma.materiel.update({
          where: { id: materiel.id },
          data: { odooProductId: null, odooSyncedAt: null },
        });
        materiel.odooProductId = null;
        // Tombe dans la branche de création plus bas.
      } else {
        const uomId = await this.resolveUomId(client, tenantId, materiel.unite);
        const taxesPayload = await this.buildTaxesPayload(
          client,
          tenantId,
          materiel.tauxTvaPercent,
        );
        // Push local → Odoo (best-effort). default_code mis à false
        // pour effacer la référence interne AQ-... visible côté Odoo.
        // uom_po_id même valeur que uom_id sinon Odoo refuse parfois
        // le write d'uom_id seul (incohérence cat. unité achat/vente).
        await client
          .write("product.product", [materiel.odooProductId], {
            name: materiel.libelle,
            list_price: materiel.prixUnitaireCHF ? Number(materiel.prixUnitaireCHF) : 0,
            default_code: false,
            expense_policy: "no",
            ...(uomId ? { uom_id: uomId, uom_po_id: uomId } : {}),
            ...(taxesPayload ?? {}),
          })
          .catch((err) =>
            this.logger.warn(
              `Sync push (mat #${materiel.odooProductId}) échoué : ${err instanceof Error ? err.message : err}`,
            ),
          );
        // Pull Odoo → local : on relit list_price, name, uom pour
        // refléter ce qu'Odoo a finalement enregistré (taxes éventuelles
        // sur le prix HT/TTC, validation Odoo). Best-effort.
        try {
          const probe = await client.searchRead<{
            id: number;
            name?: string;
            list_price?: number;
          }>("product.product", [["id", "=", materiel.odooProductId]], {
            fields: ["id", "name", "list_price"],
            limit: 1,
          });
          const o = probe[0];
          if (o) {
            await this.prisma.materiel.update({
              where: { id: materiel.id },
              data: {
                ...(o.name ? { libelle: o.name } : {}),
                ...(typeof o.list_price === "number"
                  ? { prixUnitaireCHF: o.list_price > 0 ? o.list_price : null }
                  : {}),
                odooSyncedAt: new Date(),
              },
            });
          }
        } catch {
          // Lecture best-effort.
        }
        return materiel.odooProductId;
      }
    }

    // Dédup #1 : si on a déjà un matériel perso pour le même libellé
    // côté tenant avec un odooProductId, on renvoie celui-ci sans rien
    // recréer côté Odoo (cas où Fabien clique "Pousser" 2 fois sur un
    // matériel global → on évite le doublon Odoo et le doublon perso).
    if (materiel.tenantId === null) {
      const existingPerso = await this.prisma.materiel.findFirst({
        where: { tenantId, libelle: materiel.libelle, odooProductId: { not: null } },
        select: { id: true, odooProductId: true },
      });
      if (existingPerso?.odooProductId) {
        return existingPerso.odooProductId;
      }
    }

    const client = await this.odooClientManager.forTenant(tenantId);

    // Résout l'unité de mesure Odoo correspondant à matériel.unite.
    // Si introuvable, on laisse Odoo prendre l'unité par défaut.
    const uomId = await this.resolveUomId(client, tenantId, materiel.unite);
    const taxesPayload = await this.buildTaxesPayload(client, tenantId, materiel.tauxTvaPercent);

    // Dédup #2 : avant de créer côté Odoo, on cherche par
    // default_code AQ-{code} ou par name=service. Si trouvé, on
    // réutilise au lieu de créer un doublon Odoo.
    const defaultCode = `AQ-${materiel.code}`;
    let odooId: number | undefined;
    try {
      const found = await client.searchRead<{ id: number }>(
        "product.product",
        [
          "|",
          ["default_code", "=", defaultCode],
          "&",
          ["name", "=", materiel.libelle],
          ["type", "=", "service"],
        ],
        { fields: ["id"], limit: 1 },
      );
      if (found.length > 0 && found[0]) {
        odooId = found[0].id;
      }
    } catch {
      // Lookup best-effort, on continue avec création si échec.
    }

    if (!odooId) {
      try {
        odooId = await client.create("product.product", {
          name: materiel.libelle,
          type: "service",
          list_price: materiel.prixUnitaireCHF ? Number(materiel.prixUnitaireCHF) : 0,
          // default_code retiré (demande Fabien 2026-05-06) — la
          // traçabilité Agri Qodo passe par odooProductId stocké en
          // local, pas par une référence interne visible côté Odoo.
          // Unité de mesure (uom.uom Odoo) — sert à afficher "ha" / "m³" /
          // "t" / "h" sur le sale.order au lieu du défaut "Unité(s)".
          ...(uomId ? { uom_id: uomId } : {}),
          ...(taxesPayload ?? {}),
        });
      } catch (err) {
        this.logger.error(
          `Création product.product service échouée pour matériel ${materielId} : ${err instanceof Error ? err.message : err}`,
        );
        throw new ServiceUnavailableException(
          "Impossible de créer le service côté Odoo. Vérifie la config.",
        );
      }
    } else if (uomId || taxesPayload) {
      // Produit existant côté Odoo : on aligne son unité (ha/m³/t/h…)
      // et ses taxes sur celles d'Agri Qodo — best-effort.
      await client
        .write("product.product", [odooId], {
          ...(uomId ? { uom_id: uomId } : {}),
          ...(taxesPayload ?? {}),
        })
        .catch(() => undefined);
    }

    // Libère un éventuel doublon (Fabien 2026-05-14) : un autre
    // matériel du tenant peut déjà avoir cet odooProductId suite à
    // des syncs antérieures, ce qui ferait planter l'update sur la
    // contrainte unique.
    await this.releaseOdooProductIdConflict(tenantId, odooId, materiel.id);

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
          tauxTvaPercent: materiel.tauxTvaPercent,
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

  private async releaseOdooProductIdConflict(
    tenantId: string,
    odooId: number,
    excludeMaterielId: string,
  ): Promise<void> {
    const conflict = await this.prisma.materiel.findFirst({
      where: {
        tenantId,
        odooProductId: odooId,
        id: { not: excludeMaterielId },
      },
      select: { id: true, libelle: true },
    });
    if (conflict) {
      this.logger.log(
        `Reset odooProductId=${odooId} sur matériel ${conflict.id} (${conflict.libelle}) pour libérer le slot.`,
      );
      await this.prisma.materiel.update({
        where: { id: conflict.id },
        data: { odooProductId: null, actif: false },
      });
    }
  }
}
