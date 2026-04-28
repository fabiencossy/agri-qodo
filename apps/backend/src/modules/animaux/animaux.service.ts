import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { type AnimalCategorie, Prisma } from "@prisma/client";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import type { CreateAnimalDto } from "./dto/create-animal.dto";
import type { CreateAnimauxBatchDto } from "./dto/create-animaux-batch.dto";
import type { UpdateAnimalDto } from "./dto/update-animal.dto";

@Injectable()
export class AnimauxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  list() {
    return this.prisma.tenantAware.animal.findMany({
      orderBy: [{ categorie: "asc" }, { createdAt: "asc" }],
      take: 5000,
    });
  }

  /** Effectif groupé par catégorie : utile pour la vue liste + Suisse-Bilanz UI. */
  async summary(): Promise<Array<{ categorie: AnimalCategorie; nombreActifs: number }>> {
    const groupes = await this.prisma.tenantAware.animal.groupBy({
      by: ["categorie"],
      where: { isActive: true },
      _count: { _all: true },
    });
    return groupes
      .map((g) => ({ categorie: g.categorie, nombreActifs: g._count._all }))
      .sort((a, b) => b.nombreActifs - a.nombreActifs);
  }

  /**
   * Catégories animales effectivement présentes (≥ 1 animal actif). Le
   * frontend les utilise pour ne proposer dans les formulaires (SRPA, etc.)
   * que les catégories pertinentes pour l'exploitation.
   */
  async categoriesActives(): Promise<AnimalCategorie[]> {
    const summary = await this.summary();
    return summary.filter((s) => s.nombreActifs > 0).map((s) => s.categorie);
  }

  async getById(id: string) {
    const animal = await this.prisma.tenantAware.animal.findFirst({ where: { id } });
    if (!animal) throw new NotFoundException("Animal introuvable");
    return animal;
  }

  async create(dto: CreateAnimalDto) {
    const { tenantId } = this.tenantContext.get();
    try {
      return await this.prisma.tenantAware.animal.create({
        data: {
          tenantId,
          categorie: dto.categorie,
          nom: dto.nom ?? null,
          numeroBoucle: dto.numeroBoucle ?? null,
          dateNaissance: dto.dateNaissance ? new Date(dto.dateNaissance) : null,
          lotId: dto.lotId ?? null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Ce numéro de boucle BDTA existe déjà");
      }
      throw err;
    }
  }

  /**
   * Saisie rapide pour cheptel non identifié individuellement (porcs,
   * poulets, autres bovins en groupe). Crée N rows Animal sans nom ni boucle.
   */
  async createBatch(dto: CreateAnimauxBatchDto) {
    const { tenantId } = this.tenantContext.get();
    const result = await this.prisma.tenantAware.animal.createMany({
      data: Array.from({ length: dto.nombre }, () => ({
        tenantId,
        categorie: dto.categorie,
      })),
    });
    return { created: result.count, categorie: dto.categorie };
  }

  async update(id: string, dto: UpdateAnimalDto) {
    const result = await this.prisma.tenantAware.animal.updateMany({
      where: { id },
      data: {
        ...(dto.categorie !== undefined ? { categorie: dto.categorie } : {}),
        ...(dto.nom !== undefined ? { nom: dto.nom } : {}),
        ...(dto.numeroBoucle !== undefined ? { numeroBoucle: dto.numeroBoucle } : {}),
        ...(dto.dateNaissance !== undefined
          ? { dateNaissance: dto.dateNaissance ? new Date(dto.dateNaissance) : null }
          : {}),
        ...(dto.lotId !== undefined ? { lotId: dto.lotId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    if (result.count === 0) throw new NotFoundException("Animal introuvable");
    return this.getById(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.prisma.tenantAware.animal.deleteMany({ where: { id } });
    if (result.count === 0) throw new NotFoundException("Animal introuvable");
  }

  /** Suppression batch : retire `nombre` derniers animaux d'une catégorie. */
  async removeBatch(categorie: AnimalCategorie, nombre: number): Promise<{ deleted: number }> {
    if (!Number.isInteger(nombre) || nombre <= 0) {
      throw new ConflictException("Nombre invalide");
    }
    // Sélection sans tenantId explicite — l'extension Prisma l'injecte.
    const ids = await this.prisma.tenantAware.animal.findMany({
      where: { categorie, isActive: true },
      orderBy: { createdAt: "desc" },
      take: nombre,
      select: { id: true },
    });
    if (ids.length === 0) return { deleted: 0 };
    const result = await this.prisma.tenantAware.animal.deleteMany({
      where: { id: { in: ids.map((a) => a.id) } },
    });
    return { deleted: result.count };
  }
}
