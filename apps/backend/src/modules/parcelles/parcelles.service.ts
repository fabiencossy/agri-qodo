import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/common/prisma/prisma.service";
import type { CreateParcelleDto } from "./dto/create-parcelle.dto";
import type { UpdateParcelleDto } from "./dto/update-parcelle.dto";

@Injectable()
export class ParcellesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Le filtre `tenantId` est injecté automatiquement par
   * `prisma.tenantAware`. Aucun filtre manuel nécessaire.
   */
  list() {
    return this.prisma.tenantAware.parcelle.findMany({
      orderBy: { nom: "asc" },
    });
  }

  async getById(id: string) {
    const parcelle = await this.prisma.tenantAware.parcelle.findFirst({
      where: { id },
    });
    if (!parcelle) {
      throw new NotFoundException("Parcelle introuvable");
    }
    return parcelle;
  }

  create(data: CreateParcelleDto) {
    // tenantId injecté par l'extension Prisma au runtime — voir ADR-002.
    // Le cast est safe : l'extension throw ForbiddenException si l'appelant
    // tente de forcer un autre tenantId.
    return this.prisma.tenantAware.parcelle.create({
      data: data as unknown as Prisma.ParcelleUncheckedCreateInput,
    });
  }

  /**
   * Update via updateMany pour garantir le filtre tenantId par
   * l'extension Prisma. Si count = 0, la parcelle n'appartient pas au
   * tenant courant (ou n'existe pas) → 404.
   */
  async update(id: string, data: UpdateParcelleDto) {
    const result = await this.prisma.tenantAware.parcelle.updateMany({
      where: { id },
      data,
    });
    if (result.count === 0) {
      throw new NotFoundException("Parcelle introuvable");
    }
    return this.getById(id);
  }

  async remove(id: string) {
    const result = await this.prisma.tenantAware.parcelle.deleteMany({
      where: { id },
    });
    if (result.count === 0) {
      throw new NotFoundException("Parcelle introuvable");
    }
  }
}
