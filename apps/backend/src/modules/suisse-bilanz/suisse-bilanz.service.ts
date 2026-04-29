import { BadRequestException, Injectable } from "@nestjs/common";
import {
  type ApportEngrais,
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

    // Apports d'engrais : on lit les interventions FUMURE de l'année qui ont
    // un produitRef, et on calcule kgN/kgP via tauxN/tauxP × quantité.
    // Les interventions sans produitRef sont ignorées (pas de référence
    // pour calculer les nutriments) — surface en warning.
    const interventionsFumure = await this.prisma.intervention.findMany({
      where: {
        ownerTenantId: tenantId,
        type: { in: [InterventionType.FUMURE_MINERALE, InterventionType.FUMURE_ORGANIQUE] },
        dateOperation: {
          gte: new Date(`${annee}-01-01T00:00:00.000Z`),
          lt: new Date(`${annee + 1}-01-01T00:00:00.000Z`),
        },
      },
      include: {
        produitRef: { select: { tauxN: true, tauxP: true, libelle: true } },
      },
    });

    const apportsEngrais: ApportEngrais[] = [];
    let fumuresSansProduit = 0;
    let fumuresSansQuantite = 0;
    let fumuresOrgSansTechnique = 0;
    for (const iv of interventionsFumure) {
      if (!iv.produitRef) {
        fumuresSansProduit++;
        continue;
      }
      if (iv.quantite === null) {
        fumuresSansQuantite++;
        continue;
      }
      const qte = Number(iv.quantite);
      const tauxN = iv.produitRef.tauxN !== null ? Number(iv.produitRef.tauxN) : 0;
      const tauxP = iv.produitRef.tauxP !== null ? Number(iv.produitRef.tauxP) : 0;
      // tauxN/tauxP exprimés en kg / 100 kg de produit (cf. Produit schema)
      let kgN = (qte * tauxN) / 100;
      const kgP = (qte * tauxP) / 100;

      // Pertes NH3 par volatilisation pour FUMURE_ORGANIQUE.
      // Si pas de technique saisie : on prend EPANDEUR_CLASSIQUE (30%) +
      // warning pour inciter à préciser. P n'est pas volatil.
      if (iv.type === InterventionType.FUMURE_ORGANIQUE) {
        const technique = iv.techniqueEpandage ?? "EPANDEUR_CLASSIQUE";
        const perte = config.pertesNH3ParTechnique[technique] ?? 0.3;
        kgN = kgN * (1 - perte);
        if (!iv.techniqueEpandage) {
          fumuresOrgSansTechnique++;
        }
      }

      apportsEngrais.push({
        parcelleId: iv.parcelleId,
        kgN,
        kgP,
        categorie:
          iv.type === InterventionType.FUMURE_ORGANIQUE ? "ENGRAIS_ORGANIQUE" : "ENGRAIS_MINERAL",
      });
    }
    if (fumuresSansProduit > 0) {
      warnings.push(
        `${fumuresSansProduit} fumure(s) sans produit du catalogue ignorée(s) — ` +
          "saisis le produit pour qu'elles comptent dans le bilan.",
      );
    }
    if (fumuresSansQuantite > 0) {
      warnings.push(`${fumuresSansQuantite} fumure(s) sans quantité ignorée(s).`);
    }
    if (fumuresOrgSansTechnique > 0) {
      warnings.push(
        `${fumuresOrgSansTechnique} fumure(s) organique(s) sans technique d'épandage — ` +
          "épandeur classique présumé (30% pertes NH3). Précise la technique pour un bilan plus juste.",
      );
    }

    const input: BilanInput = {
      cultures: culturesInput,
      animaux: animauxInput,
      apportsEngrais,
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
      apportAtmospheriqueN,
      fixationLegumineuses,
      pertesNH3ParTechnique,
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
        "suisse_bilanz.apport_atmospherique_n",
        DEFAULT_SUISSE_BILANZ_CONFIG.apportAtmospheriqueN,
      ),
      this.ruleEngine.get<Record<string, number>>(
        "suisse_bilanz.fixation_legumineuses",
        DEFAULT_SUISSE_BILANZ_CONFIG.fixationLegumineuses,
      ),
      this.ruleEngine.get<Record<string, number>>(
        "suisse_bilanz.pertes_nh3_par_technique",
        DEFAULT_SUISSE_BILANZ_CONFIG.pertesNH3ParTechnique,
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
      apportAtmospheriqueN,
      fixationLegumineuses,
      pertesNH3ParTechnique,
      tolerance,
    };
  }
}
