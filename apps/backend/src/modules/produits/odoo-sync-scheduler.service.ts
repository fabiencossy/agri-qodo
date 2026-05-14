import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "@/common/prisma/prisma.service";
import { OdooSyncService } from "./odoo-sync.service";

/**
 * Sync auto périodique du catalogue Odoo (Fabien 2026-05-14 image 58 :
 * "un bouton pour synchroniser une seule fois puis ensuite ils sont
 * synchronisés tout le temps").
 *
 * Toutes les 6h, on parcourt les exploitations qui ont une config Odoo
 * complète et on lance `syncProduitsForTenant` pour chacune.
 * Best-effort : un tenant down ne bloque pas les autres.
 *
 * Le bouton "Synchroniser" manuel reste actif pour forcer immédiatement
 * (utile après une modif côté Odoo qu'on ne veut pas attendre).
 */
@Injectable()
export class OdooSyncSchedulerService {
  private readonly logger = new Logger(OdooSyncSchedulerService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly odooSync: OdooSyncService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async syncAllTenants(): Promise<void> {
    if (this.running) {
      this.logger.warn("Sync Odoo précédente encore en cours — skip de ce tick.");
      return;
    }
    this.running = true;
    try {
      const tenants = await this.prisma.exploitation.findMany({
        where: {
          odooUrl: { not: null },
          odooDb: { not: null },
          odooUsername: { not: null },
          odooApiKeyEncrypted: { not: null },
        },
        select: { id: true, nom: true },
      });
      this.logger.log(`Sync auto Odoo : ${tenants.length} tenant(s) à traiter.`);
      for (const tenant of tenants) {
        try {
          const result = await this.odooSync.syncProduitsForTenant(tenant.id);
          this.logger.log(
            `Sync auto ${tenant.nom} (${tenant.id}) : ${result.created} créés, ${result.updated} màj, ${result.skipped} skip`,
          );
        } catch (err) {
          this.logger.warn(
            `Sync auto ${tenant.nom} (${tenant.id}) échouée : ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }
}
