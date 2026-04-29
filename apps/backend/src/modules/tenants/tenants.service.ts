import { Injectable, NotFoundException } from "@nestjs/common";
import { Canton, type PartnerLinkLevel, PartnerLinkStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "@/common/prisma/prisma.service";

export interface AccessibleTenant {
  id: string;
  nom: string;
  code: string;
  canton: string;
  /** "home" pour mon exploitation, "partner" si lien partenaire actif. */
  kind: "home" | "partner";
  /** Niveau d'autorisation pour les tenants partenaires. */
  niveau?: PartnerLinkLevel;
}

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
   * Liste les tenants accessibles à l'utilisateur : son propre tenant +
   * tous les tenants où il a un PartnerLink ACTIVE en tant que partner.
   * Utilisé par le tenant switcher dans la topbar.
   */
  async listAccessible(homeTenantId: string): Promise<AccessibleTenant[]> {
    const [home, links] = await Promise.all([
      this.prisma.exploitation.findUnique({
        where: { id: homeTenantId },
        select: { id: true, nom: true, code: true, canton: true },
      }),
      this.prisma.partnerLink.findMany({
        where: { partnerTenantId: homeTenantId, status: PartnerLinkStatus.ACTIVE },
        include: {
          ownerTenant: { select: { id: true, nom: true, code: true, canton: true } },
        },
      }),
    ]);
    if (!home) throw new NotFoundException("Exploitation introuvable");

    const out: AccessibleTenant[] = [{ ...home, kind: "home" }];
    for (const link of links) {
      out.push({ ...link.ownerTenant, kind: "partner", niveau: link.niveau });
    }
    return out;
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
