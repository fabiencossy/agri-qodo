import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { TenantContextService } from "../tenant/tenant-context.service";
import { buildTenantExtension } from "./tenant.middleware";

/**
 * Construit le client Prisma "tenant-aware" via $extends.
 * Le retour porte le typage exact du client extended (pour intellisense).
 */
function makeTenantAware(base: PrismaClient, tenantContext: TenantContextService) {
  return base.$extends(buildTenantExtension(tenantContext));
}

export type TenantAwarePrisma = ReturnType<typeof makeTenantAware>;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /**
   * Client multi-tenant strict.
   *
   * Tous les services métier touchant aux modèles tenant-scoped (Parcelle,
   * Culture, Animal, LotAnimal) DOIVENT utiliser `prisma.tenantAware.X`.
   *
   * Le client de base (`prisma.X`) reste accessible pour les modèles non
   * tenant-scoped (User, RefreshToken, Exploitation, Intervention, PartnerLink)
   * et les opérations admin (seed, jobs internes).
   */
  readonly tenantAware: TenantAwarePrisma;

  constructor(private readonly tenantContext: TenantContextService) {
    super({
      log: [
        { emit: "event", level: "query" },
        { emit: "event", level: "warn" },
        { emit: "event", level: "error" },
      ],
    });
    this.tenantAware = makeTenantAware(this, this.tenantContext);
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Prisma connecté à la base de données");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Vide toutes les tables — usage strict tests / seed.
   * Throw si NODE_ENV === 'production'.
   */
  async truncateAll(): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error("truncateAll() interdit en production");
    }
    const tables = await this.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    for (const { tablename } of tables) {
      if (tablename === "_prisma_migrations") continue;
      await this.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE`);
    }
  }
}
