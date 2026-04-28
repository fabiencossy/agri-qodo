import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/common/prisma/prisma.service";

@Injectable()
export class ParcellesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.parcelle.findMany({
      where: { tenantId },
      orderBy: { nom: "asc" },
    });
  }
}
