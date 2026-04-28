import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: "event", level: "query" },
        { emit: "event", level: "warn" },
        { emit: "event", level: "error" },
      ],
    });
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
