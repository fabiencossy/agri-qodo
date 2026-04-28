import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/common/prisma/prisma.service";

@Injectable()
export class InterventionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.intervention.findMany({
      where: { ownerTenantId: tenantId },
      orderBy: { dateOperation: "desc" },
      take: 100,
    });
  }
}
