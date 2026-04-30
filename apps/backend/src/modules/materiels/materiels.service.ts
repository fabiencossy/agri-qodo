import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { type Materiel, type MaterielCategorie, type UserRole } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import type { CreateMaterielDto } from "./dto/create-materiel.dto";
import type { UpdateMaterielDto } from "./dto/update-materiel.dto";

/**
 * Catalogue Matériel — symétrique de Produits (global + tenant).
 *
 * - Matériels **globaux** (tenantId = NULL) : référentiel partagé livré
 *   par seed (catalogue ETA suisse, tarifs Agridea). Read-only.
 * - Matériels **tenant** : créés par l'agriculteur (tarif négocié, machine
 *   spécifique). CRUD libre par OWNER ou COMPTABLE.
 *
 * Les prix sont publics (pas de masquage RBAC comme Produits) — c'est
 * un tarif de prestation à l'hectare, transparent côté client.
 */
const ADMIN_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(["OWNER", "COMPTABLE"]);

@Injectable()
export class MaterielsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private isAdmin(): boolean {
    const ctx = this.tenantContext.tryGet();
    return !!ctx?.role && ADMIN_ROLES.has(ctx.role);
  }

  async list(categorie?: MaterielCategorie): Promise<Materiel[]> {
    const { tenantId } = this.tenantContext.get();
    return this.prisma.materiel.findMany({
      where: {
        ...(categorie ? { categorie } : {}),
        actif: true,
        OR: [{ tenantId: null }, { tenantId }],
      },
      orderBy: [{ tenantId: "asc" }, { libelle: "asc" }],
    });
  }

  async getById(id: string): Promise<Materiel> {
    const { tenantId } = this.tenantContext.get();
    const materiel = await this.prisma.materiel.findFirst({
      where: { id, OR: [{ tenantId: null }, { tenantId }] },
    });
    if (!materiel) throw new NotFoundException("Matériel introuvable");
    return materiel;
  }

  async create(dto: CreateMaterielDto): Promise<Materiel> {
    const { tenantId } = this.tenantContext.get();
    if (!this.isAdmin()) {
      throw new ForbiddenException("Seul un OWNER ou COMPTABLE peut créer un matériel custom.");
    }
    const code = `t-${tenantId.slice(0, 8)}-${randomBytes(3).toString("hex")}`;
    return this.prisma.materiel.create({
      data: {
        tenantId,
        code,
        libelle: dto.libelle,
        categorie: dto.categorie,
        unite: dto.unite ?? "HA",
        prixUnitaireCHF: dto.prixUnitaireCHF ?? null,
        notes: dto.notes ?? null,
        actif: dto.actif ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateMaterielDto): Promise<Materiel> {
    const { tenantId } = this.tenantContext.get();
    if (!this.isAdmin()) {
      throw new ForbiddenException("Seul un OWNER ou COMPTABLE peut modifier un matériel.");
    }
    const existing = await this.prisma.materiel.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Matériel introuvable");
    if (existing.tenantId === null) {
      throw new ForbiddenException(
        "Les matériels globaux ne sont pas modifiables. Crée un matériel perso si tu veux personnaliser.",
      );
    }
    if (existing.tenantId !== tenantId) {
      throw new NotFoundException("Matériel introuvable");
    }
    return this.prisma.materiel.update({
      where: { id },
      data: {
        ...(dto.libelle !== undefined ? { libelle: dto.libelle } : {}),
        ...(dto.categorie !== undefined ? { categorie: dto.categorie } : {}),
        ...(dto.unite !== undefined ? { unite: dto.unite } : {}),
        ...(dto.prixUnitaireCHF !== undefined ? { prixUnitaireCHF: dto.prixUnitaireCHF } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.actif !== undefined ? { actif: dto.actif } : {}),
      },
    });
  }

  async remove(id: string): Promise<void> {
    const { tenantId } = this.tenantContext.get();
    if (!this.isAdmin()) {
      throw new ForbiddenException("Seul un OWNER ou COMPTABLE peut supprimer un matériel.");
    }
    const existing = await this.prisma.materiel.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Matériel introuvable");
    if (existing.tenantId === null) {
      throw new ForbiddenException("Les matériels globaux ne sont pas supprimables");
    }
    if (existing.tenantId !== tenantId) {
      throw new NotFoundException("Matériel introuvable");
    }
    await this.prisma.materiel.delete({ where: { id } });
  }
}
