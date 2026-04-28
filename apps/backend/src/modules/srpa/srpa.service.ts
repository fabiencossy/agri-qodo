import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import type { CreateSortieSrpaDto } from "./dto/create-sortie.dto";
import type { UpdateSortieSrpaDto } from "./dto/update-sortie.dto";

@Injectable()
export class SrpaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  list() {
    // tenantId injecté par l'extension Prisma — voir ADR-002.
    return this.prisma.tenantAware.sortieSrpa.findMany({
      orderBy: [{ date: "desc" }, { categorie: "asc" }],
      take: 365,
    });
  }

  async getById(id: string) {
    const sortie = await this.prisma.tenantAware.sortieSrpa.findFirst({
      where: { id },
    });
    if (!sortie) {
      throw new NotFoundException("Sortie introuvable");
    }
    return sortie;
  }

  async create(dto: CreateSortieSrpaDto) {
    // tenantId fourni explicitement : Prisma valide la structure data
    // AVANT que l'extension query l'intercepte. Avec tenantId explicite,
    // l'extension vérifie juste qu'il match le contexte (toujours OK ici).
    const { tenantId } = this.tenantContext.get();
    try {
      return await this.prisma.tenantAware.sortieSrpa.create({
        data: {
          tenantId,
          date: new Date(dto.date),
          categorie: dto.categorie,
          nombreAnimaux: dto.nombreAnimaux ?? null,
          dureeMinutes: dto.dureeMinutes ?? null,
          notes: dto.notes ?? null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(
          "Une sortie est déjà enregistrée pour cette date et cette catégorie",
        );
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateSortieSrpaDto) {
    const result = await this.prisma.tenantAware.sortieSrpa.updateMany({
      where: { id },
      data: {
        ...(dto.nombreAnimaux !== undefined ? { nombreAnimaux: dto.nombreAnimaux } : {}),
        ...(dto.dureeMinutes !== undefined ? { dureeMinutes: dto.dureeMinutes } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
    if (result.count === 0) {
      throw new NotFoundException("Sortie introuvable");
    }
    return this.getById(id);
  }

  async remove(id: string) {
    const result = await this.prisma.tenantAware.sortieSrpa.deleteMany({
      where: { id },
    });
    if (result.count === 0) {
      throw new NotFoundException("Sortie introuvable");
    }
  }
}
