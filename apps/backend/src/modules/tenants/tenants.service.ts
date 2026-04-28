import { Injectable, NotFoundException } from "@nestjs/common";
import { Canton } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "@/common/prisma/prisma.service";

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère l'exploitation associée au tenant courant.
   */
  async getMine(tenantId: string) {
    const tenant = await this.prisma.exploitation.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException("Exploitation introuvable");
    }
    return tenant;
  }

  /**
   * Génère un code Agri Qodo unique : `AQ-{canton}-{ufam ou seq}-{token4}`.
   * Voir spec §6.
   */
  generateCode(canton: Canton, numeroUfam?: string | null): string {
    const ufamPart = numeroUfam ?? randomBytes(2).toString("hex").toUpperCase();
    const token = randomBytes(2).toString("hex").toUpperCase();
    return `AQ-${canton}-${ufamPart}-${token}`;
  }
}
