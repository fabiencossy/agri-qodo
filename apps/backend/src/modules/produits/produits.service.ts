import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { type Produit, type ProduitCategorie, type UserRole } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import type { CreateProduitDto } from "./dto/create-produit.dto";
import type { UpdateProduitDto } from "./dto/update-produit.dto";
import { OdooSyncService } from "./odoo-sync.service";

/**
 * Module Produits — catalogue mixte global + tenant.
 *
 * - Produits **globaux** (tenantId = NULL) : référentiel partagé livré
 *   par seed (UFA, Landor, Lonza, etc.). Read-only depuis l'API.
 * - Produits **tenant** : créés par l'agriculteur. CRUD libre.
 *
 * **RBAC prix** : prixVenteCHF est visible/éditable uniquement par les
 * rôles OWNER et COMPTABLE. Les EMPLOYE et CONSULTANT reçoivent un produit
 * sans cette colonne (et leur tentative d'écriture est rejetée).
 */
const ADMIN_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(["OWNER", "COMPTABLE"]);

@Injectable()
export class ProduitsService {
  private readonly logger = new Logger(ProduitsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly odooSync: OdooSyncService,
  ) {}

  private isAdmin(): boolean {
    const ctx = this.tenantContext.tryGet();
    return !!ctx?.role && ADMIN_ROLES.has(ctx.role);
  }

  private maskPrice<T extends { prixVenteCHF: unknown }>(p: T): T {
    if (this.isAdmin()) return p;
    return { ...p, prixVenteCHF: null };
  }

  async list(categorie?: ProduitCategorie): Promise<Produit[]> {
    const { tenantId } = this.tenantContext.get();
    const rows = await this.prisma.produit.findMany({
      where: {
        ...(categorie ? { categorie } : {}),
        actif: true,
        OR: [{ tenantId: null }, { tenantId }],
      },
      orderBy: [{ tenantId: "asc" }, { libelle: "asc" }],
    });
    return rows.map((p) => this.maskPrice(p));
  }

  async getById(id: string): Promise<Produit> {
    const { tenantId } = this.tenantContext.get();
    const produit = await this.prisma.produit.findFirst({
      where: { id, OR: [{ tenantId: null }, { tenantId }] },
    });
    if (!produit) throw new NotFoundException("Produit introuvable");
    return this.maskPrice(produit);
  }

  async create(dto: CreateProduitDto): Promise<Produit> {
    const { tenantId } = this.tenantContext.get();
    if (dto.prixVenteCHF !== undefined && !this.isAdmin()) {
      throw new ForbiddenException(
        "Seul un OWNER ou COMPTABLE peut définir un prix de vente catalogue.",
      );
    }
    const code = `t-${tenantId.slice(0, 8)}-${randomBytes(3).toString("hex")}`;
    const created = await this.prisma.produit.create({
      data: {
        tenantId,
        code,
        categorie: dto.categorie,
        libelle: dto.libelle,
        fournisseur: dto.fournisseur ?? null,
        marque: dto.marque ?? null,
        especeCode: dto.especeCode ?? null,
        tauxN: dto.tauxN ?? null,
        tauxP: dto.tauxP ?? null,
        tauxK: dto.tauxK ?? null,
        unite: dto.unite ?? "KG",
        prixVenteCHF: dto.prixVenteCHF ?? null,
        tauxTvaPercent: dto.tauxTvaPercent ?? null,
        notes: dto.notes ?? null,
        actif: dto.actif ?? true,
      },
    });
    return this.maskPrice(created);
  }

  async update(id: string, dto: UpdateProduitDto): Promise<Produit> {
    const { tenantId } = this.tenantContext.get();
    const existing = await this.prisma.produit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Produit introuvable");
    if (dto.prixVenteCHF !== undefined && !this.isAdmin()) {
      throw new ForbiddenException(
        "Seul un OWNER ou COMPTABLE peut modifier le prix de vente catalogue.",
      );
    }

    // Fork-on-edit (demande Fabien 2026-05-07) : modifier un produit
    // global ne lève plus d'erreur — on crée (ou on réutilise) une
    // copie perso pour le tenant et on applique les modifs dessus.
    // Évite à l'utilisateur de devoir cliquer "Pousser vers Odoo" puis
    // "Modifier" en deux étapes pour personnaliser un item du catalogue.
    if (existing.tenantId === null) {
      const existingPerso = await this.prisma.produit.findFirst({
        where: { tenantId, libelle: existing.libelle },
      });
      const data = {
        categorie: dto.categorie ?? existing.categorie,
        libelle: dto.libelle ?? existing.libelle,
        fournisseur: dto.fournisseur ?? existing.fournisseur,
        marque: dto.marque ?? existing.marque,
        especeCode: dto.especeCode ?? existing.especeCode,
        tauxN: dto.tauxN !== undefined ? dto.tauxN : existing.tauxN,
        tauxP: dto.tauxP !== undefined ? dto.tauxP : existing.tauxP,
        tauxK: dto.tauxK !== undefined ? dto.tauxK : existing.tauxK,
        unite: dto.unite ?? existing.unite,
        prixVenteCHF: dto.prixVenteCHF !== undefined ? dto.prixVenteCHF : existing.prixVenteCHF,
        tauxTvaPercent:
          dto.tauxTvaPercent !== undefined ? dto.tauxTvaPercent : existing.tauxTvaPercent,
        notes: dto.notes ?? existing.notes,
        actif: dto.actif ?? existing.actif,
      };
      const persisted = existingPerso
        ? await this.prisma.produit.update({
            where: { id: existingPerso.id },
            data,
          })
        : await this.prisma.produit.create({
            data: {
              ...data,
              tenantId,
              code: `t-${tenantId.slice(0, 8)}-${randomBytes(3).toString("hex")}`,
            },
          });
      if (persisted.odooProductId) {
        this.odooSync
          .ensureOdooProduct(persisted.id)
          .catch((err) =>
            this.logger.warn(
              `Sync Odoo après fork produit ${persisted.id} échouée : ${err instanceof Error ? err.message : err}`,
            ),
          );
      }
      return this.maskPrice(persisted);
    }

    if (existing.tenantId !== tenantId) {
      throw new NotFoundException("Produit introuvable");
    }
    const updated = await this.prisma.produit.update({
      where: { id },
      data: {
        ...(dto.categorie !== undefined ? { categorie: dto.categorie } : {}),
        ...(dto.libelle !== undefined ? { libelle: dto.libelle } : {}),
        ...(dto.fournisseur !== undefined ? { fournisseur: dto.fournisseur } : {}),
        ...(dto.marque !== undefined ? { marque: dto.marque } : {}),
        ...(dto.especeCode !== undefined ? { especeCode: dto.especeCode } : {}),
        ...(dto.tauxN !== undefined ? { tauxN: dto.tauxN } : {}),
        ...(dto.tauxP !== undefined ? { tauxP: dto.tauxP } : {}),
        ...(dto.tauxK !== undefined ? { tauxK: dto.tauxK } : {}),
        ...(dto.unite !== undefined ? { unite: dto.unite } : {}),
        ...(dto.prixVenteCHF !== undefined ? { prixVenteCHF: dto.prixVenteCHF } : {}),
        ...(dto.tauxTvaPercent !== undefined ? { tauxTvaPercent: dto.tauxTvaPercent } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.actif !== undefined ? { actif: dto.actif } : {}),
        ...(dto.excludeFromOdooSync !== undefined
          ? { excludeFromOdooSync: dto.excludeFromOdooSync }
          : {}),
      },
    });

    // Sync bidirectionnelle (demande Fabien 2026-05-06 : "je veux
    // pouvoir modifier les produits dans Odoo ou dans Agri Qodo").
    // Si le produit est mappé Odoo, on push les valeurs locales
    // mises à jour en best-effort. ensureOdooProduct gère le push
    // bidir : write libelle/prix/uom puis pull pour aligner.
    if (updated.odooProductId) {
      this.odooSync
        .ensureOdooProduct(id)
        .catch((err) =>
          this.logger.warn(
            `Sync Odoo après update produit ${id} échouée : ${err instanceof Error ? err.message : err}`,
          ),
        );
    }
    return this.maskPrice(updated);
  }

  async remove(id: string): Promise<void> {
    const { tenantId } = this.tenantContext.get();
    if (!this.isAdmin()) {
      throw new ForbiddenException(
        "Seul un OWNER ou COMPTABLE peut supprimer un produit du catalogue.",
      );
    }
    const existing = await this.prisma.produit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Produit introuvable");
    if (existing.tenantId === null) {
      throw new ForbiddenException("Les produits globaux ne sont pas supprimables");
    }
    if (existing.tenantId !== tenantId) {
      throw new NotFoundException("Produit introuvable");
    }
    await this.prisma.produit.delete({ where: { id } });
  }
}
