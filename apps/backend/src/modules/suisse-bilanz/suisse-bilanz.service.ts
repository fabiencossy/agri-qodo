import { BadRequestException, Injectable } from "@nestjs/common";
import {
  type BilanInput,
  type BilanResult,
  calculerBilan,
  DEFAULT_SUISSE_BILANZ_CONFIG,
  type SuisseBilanzConfig,
} from "@agri-qodo/domain";
import { InterventionType } from "@prisma/client";
import { PrismaService } from "@/common/prisma/prisma.service";
import { RuleEngineService } from "@/common/rule-engine/rule-engine.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";

export interface BilanResponse extends BilanResult {
  annee: number;
  warnings: string[];
}

@Injectable()
export class SuisseBilanzService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly ruleEngine: RuleEngineService,
  ) {}

  async getForAnnee(annee: number): Promise<BilanResponse> {
    if (!Number.isInteger(annee) || annee < 2000 || annee > 2100) {
      throw new BadRequestException("Année invalide");
    }

    const { tenantId } = this.tenantContext.get();
    const config = await this.loadConfig();
    const warnings: string[] = [];

    // Cultures de la campagne (filtre tenantId auto via extension)
    const cultures = await this.prisma.tenantAware.culture.findMany({
      where: { campagne: annee },
      include: { parcelle: { select: { id: true, nom: true, surfaceM2: true } } },
    });

    const culturesInput = cultures.map((c) => ({
      parcelleId: c.parcelleId,
      parcelleNom: c.parcelle.nom,
      surfaceHa: Number(c.parcelle.surfaceM2) / 10000,
      espece: c.espece,
    }));

    // Animaux actifs groupés par catégorie (filtre tenantId auto)
    const animauxGroupes = await this.prisma.tenantAware.animal.groupBy({
      by: ["categorie"],
      where: { isActive: true },
      _count: { _all: true },
    });
    const animauxInput = animauxGroupes.map((g) => ({
      categorie: g.categorie,
      nombre: g._count._all,
    }));

    // Apports d'engrais V1 — non comptés (mapping produit → kg N/P en V2).
    // On surface l'info dans warnings pour que l'utilisateur sache que les
    // interventions de fumure saisies ne sont pas (encore) intégrées au calcul.
    const interventionsFumure = await this.prisma.intervention.count({
      where: {
        ownerTenantId: tenantId,
        type: { in: [InterventionType.FUMURE_MINERALE, InterventionType.FUMURE_ORGANIQUE] },
        dateOperation: {
          gte: new Date(`${annee}-01-01T00:00:00.000Z`),
          lt: new Date(`${annee + 1}-01-01T00:00:00.000Z`),
        },
      },
    });
    if (interventionsFumure > 0) {
      warnings.push(
        `${interventionsFumure} intervention(s) de fumure pour ${annee} non comptées : ` +
          "le mapping produit → kg N/P arrive en V2.",
      );
    }

    const input: BilanInput = {
      cultures: culturesInput,
      animaux: animauxInput,
      apportsEngrais: [],
    };
    const result = calculerBilan(input, config);

    if (result.culturesInconnues.length > 0) {
      warnings.push(`Cultures sans coefficient connu : ${result.culturesInconnues.join(", ")}.`);
    }

    return { annee, ...result, warnings };
  }

  private async loadConfig(): Promise<SuisseBilanzConfig> {
    const [
      besoinNParCulture,
      besoinPParCulture,
      apportNParUgb,
      apportPParUgb,
      facteurUgb,
      tolerance,
    ] = await Promise.all([
      this.ruleEngine.get<Record<string, number>>(
        "suisse_bilanz.besoin_n_par_culture",
        DEFAULT_SUISSE_BILANZ_CONFIG.besoinNParCulture,
      ),
      this.ruleEngine.get<Record<string, number>>(
        "suisse_bilanz.besoin_p_par_culture",
        DEFAULT_SUISSE_BILANZ_CONFIG.besoinPParCulture,
      ),
      this.ruleEngine.get<Record<string, number>>(
        "suisse_bilanz.apport_n_par_ugb",
        DEFAULT_SUISSE_BILANZ_CONFIG.apportNParUgb,
      ),
      this.ruleEngine.get<Record<string, number>>(
        "suisse_bilanz.apport_p_par_ugb",
        DEFAULT_SUISSE_BILANZ_CONFIG.apportPParUgb,
      ),
      this.ruleEngine.get<Record<string, number>>(
        "suisse_bilanz.facteur_ugb",
        DEFAULT_SUISSE_BILANZ_CONFIG.facteurUgb,
      ),
      this.ruleEngine.get<number>(
        "suisse_bilanz.tolerance",
        DEFAULT_SUISSE_BILANZ_CONFIG.tolerance,
      ),
    ]);
    return {
      besoinNParCulture,
      besoinPParCulture,
      apportNParUgb,
      apportPParUgb,
      facteurUgb,
      tolerance,
    };
  }
}
