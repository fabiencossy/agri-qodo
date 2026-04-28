import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/common/prisma/prisma.service";

@Injectable()
export class PartnerLinksService {
  constructor(private readonly prisma: PrismaService) {}

  listForTenant(tenantId: string) {
    return this.prisma.partnerLink.findMany({
      where: {
        OR: [{ ownerTenantId: tenantId }, { partnerTenantId: tenantId }],
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
