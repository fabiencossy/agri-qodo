import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  DEFAULT_INTERDICTIONS_CONFIG,
  estFumureOrganiqueInterdite,
  type InterdictionsPerConfig,
} from "@agri-qodo/domain";
import { PrismaService } from "@/common/prisma/prisma.service";
import { RuleEngineService } from "@/common/rule-engine/rule-engine.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";

@Injectable()
export class PerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly ruleEngine: RuleEngineService,
  ) {}

  /**
   * Vérifie si une fumure organique est interdite à la date donnée
   * sur la parcelle indiquée (selon zone agricole + calendrier ORRChim).
   */
  async checkFumureOrganique(parcelleId: string, dateIso: string) {
    const { tenantId } = this.tenantContext.get();
    const parcelle = await this.prisma.parcelle.findFirst({
      where: { id: parcelleId, tenantId },
      select: { zone: true },
    });
    if (!parcelle) {
      throw new NotFoundException("Parcelle introuvable ou hors de votre exploitation");
    }

    const date = new Date(dateIso);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException("Date invalide (format attendu : ISO YYYY-MM-DD)");
    }

    const config = await this.loadConfig();
    return estFumureOrganiqueInterdite(date, parcelle.zone, config);
  }

  private async loadConfig(): Promise<InterdictionsPerConfig> {
    const fumureOrganiqueParZone = await this.ruleEngine.get<
      Record<string, Array<{ debut: string; fin: string; raison: string }>>
    >("per.interdictions_fumure_organique", DEFAULT_INTERDICTIONS_CONFIG.fumureOrganiqueParZone);
    return { fumureOrganiqueParZone };
  }
}
