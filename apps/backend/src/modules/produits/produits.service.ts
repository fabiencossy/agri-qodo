import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { type ProduitCategorie } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import type { CreateProduitDto } from "./dto/create-produit.dto";
import type { UpdateProduitDto } from "./dto/update-produit.dto";

/**
 * Module Produits — catalogue mixte global + tenant.
 *
 * - Produits **globaux** (tenantId = NULL) : référentiel partagé livré
 *   par seed (UFA, Landor, Lonza, etc.). Read-only depuis l'API
 *   utilisateur.
 * - Produits **tenant** : créés par l'agriculteur pour ses variétés
 *   spécifiques ou mélanges maison. CRUD libre, isolé par tenantId.
 *
 * Pas dans TENANT_SCOPED_MODELS_LC (tenantId nullable) → filtre manuel
 * `OR: [{ tenantId: null }, { tenantId: ctx }]` côté lectures.
 */
@Injectable()
export class ProduitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  list(categorie?: ProduitCategorie) {
    const { tenantId } = this.tenantContext.get();
    return this.prisma.produit.findMany({
      where: {
        ...(categorie ? { categorie } : {}),
        actif: true,
        OR: [{ tenantId: null }, { tenantId }],
      },
      orderBy: [{ tenantId: "asc" }, { libelle: "asc" }], // globaux d'abord
    });
  }

  async getById(id: string) {
    const { tenantId } = this.tenantContext.get();
    const produit = await this.prisma.produit.findFirst({
      where: { id, OR: [{ tenantId: null }, { tenantId }] },
    });
    if (!produit) throw new NotFoundException("Produit introuvable");
    return produit;
  }

  async create(dto: CreateProduitDto) {
    const { tenantId } = this.tenantContext.get();
    const code = `t-${tenantId.slice(0, 8)}-${randomBytes(3).toString("hex")}`;
    return this.prisma.produit.create({
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
        notes: dto.notes ?? null,
        actif: dto.actif ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateProduitDto) {
    const { tenantId } = this.tenantContext.get();
    // Garde-fou : un produit global ne peut pas être édité par un tenant.
    const existing = await this.prisma.produit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Produit introuvable");
    if (existing.tenantId === null) {
      throw new ForbiddenException(
        "Les produits globaux ne sont pas modifiables. Crée un produit perso si tu veux personnaliser.",
      );
    }
    if (existing.tenantId !== tenantId) {
      throw new NotFoundException("Produit introuvable");
    }
    return this.prisma.produit.update({
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
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.actif !== undefined ? { actif: dto.actif } : {}),
      },
    });
  }

  async remove(id: string): Promise<void> {
    const { tenantId } = this.tenantContext.get();
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
