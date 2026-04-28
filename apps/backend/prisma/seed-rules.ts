/**
 * Seed des templates de règles globaux.
 *
 * Idempotent : ré-exécutable sans dupliquer les règles. Met à jour la
 * `valueJson` si elle a changé dans le code.
 *
 * Lancer : `pnpm --filter @agri-qodo/backend exec ts-node prisma/seed-rules.ts`
 */
import { PrismaClient, RuleSetScope } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedRule {
  key: string;
  valueJson: unknown;
  description: string;
}

interface SeedRuleSet {
  name: string;
  description: string;
  scope: RuleSetScope;
  rules: SeedRule[];
}

const TEMPLATES: SeedRuleSet[] = [
  {
    name: "OPD-CH-2026",
    description: "Template Ordonnance Paiements Directs Suisse, version 2026 (standard).",
    scope: RuleSetScope.GLOBAL,
    rules: [
      // ----- Module domain : assolement -----
      {
        key: "assolement.nb_campagnes_diversite",
        valueJson: 5,
        description: "Nombre de campagnes consécutives sur lesquelles évaluer la diversité.",
      },
      {
        key: "assolement.min_especes_distinctes",
        valueJson: 4,
        description: "Nombre minimum d'espèces distinctes dans la fenêtre.",
      },
      {
        key: "assolement.prairie_prefixes",
        valueJson: ["prairie_", "paturage_"],
        description:
          "Préfixes d'espèces considérées comme prairies multi-annuelles (exemption rotation).",
      },

      // ----- Module SRPA : seuils minimaux jours/mois (V2 — calcul respect seuil) -----
      {
        key: "srpa.vache_laitiere.jours_min_ete",
        valueJson: 26,
        description: "Jours minimum de sortie en été pour vaches laitières (mai-octobre).",
      },
      {
        key: "srpa.vache_laitiere.jours_min_hiver",
        valueJson: 13,
        description: "Jours minimum de sortie en hiver pour vaches laitières (novembre-avril).",
      },
      {
        key: "srpa.autres_bovins.jours_min_ete",
        valueJson: 26,
        description: "Jours minimum de sortie en été pour les autres bovins.",
      },
      {
        key: "srpa.autres_bovins.jours_min_hiver",
        valueJson: 13,
        description: "Jours minimum de sortie en hiver pour les autres bovins.",
      },

      // ----- TVA agricole CH (M10) -----
      {
        key: "tva.taux_travail_du_sol",
        valueJson: 0.026,
        description: "Taux TVA travail du sol agricole (2.6%).",
      },
      {
        key: "tva.taux_standard",
        valueJson: 0.081,
        description: "Taux TVA standard (8.1%).",
      },
    ],
  },
  {
    name: "OPD-CH-2026-BIO",
    description:
      "Variante bio Suisse (Bio Suisse / Bourgeon). Étend OPD-CH-2026 avec règles plus strictes.",
    scope: RuleSetScope.GLOBAL,
    rules: [
      {
        key: "assolement.min_especes_distinctes",
        valueJson: 5,
        description: "Bio : 5 espèces distinctes minimum sur les 5 dernières campagnes.",
      },
      // Les autres règles héritent du template parent (à V2 quand on
      // implémentera le parentId, le seed pourra utiliser parentId).
    ],
  },
];

async function seed(): Promise<void> {
  for (const tpl of TEMPLATES) {
    const ruleSet = await prisma.ruleSet.upsert({
      where: { name: tpl.name },
      update: { description: tpl.description, isActive: true },
      create: {
        name: tpl.name,
        description: tpl.description,
        scope: tpl.scope,
        isActive: true,
      },
    });

    for (const rule of tpl.rules) {
      await prisma.rule.upsert({
        where: {
          ruleSetId_key: { ruleSetId: ruleSet.id, key: rule.key },
        },
        update: {
          valueJson: rule.valueJson as never,
          description: rule.description,
        },
        create: {
          ruleSetId: ruleSet.id,
          key: rule.key,
          valueJson: rule.valueJson as never,
          description: rule.description,
        },
      });
    }

    console.log(`Seed RuleSet ${tpl.name} OK (${tpl.rules.length} règles)`);
  }
}

seed()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
