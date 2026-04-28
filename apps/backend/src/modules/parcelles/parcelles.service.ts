import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/common/prisma/prisma.service";

@Injectable()
export class ParcellesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Le filtre `tenantId` est injecté automatiquement par
   * `prisma.tenantAware` (voir tenant.middleware.ts). Aucun filtre manuel
   * nécessaire.
   */
  list() {
    return this.prisma.tenantAware.parcelle.findMany({
      orderBy: { nom: "asc" },
    });
  }
}
