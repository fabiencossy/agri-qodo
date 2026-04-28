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

      // ----- Module Suisse-Bilanz (M3) — coefficients Agridea 1.18 simplifiés -----
      {
        key: "suisse_bilanz.besoin_n_par_culture",
        valueJson: {
          ble_panifiable: 140,
          ble_fourrager: 130,
          orge: 110,
          mais_grain: 180,
          mais_ensilage: 160,
          colza: 130,
          tournesol: 80,
          pomme_de_terre: 120,
          betterave_sucre: 130,
          prairie_temporaire: 130,
          prairie_permanente: 110,
          paturage_extensif: 50,
          paturage_intensif: 130,
        },
        description: "Besoins azote par culture (kg N / ha / an) — Agridea 1.18 simplifié.",
      },
      {
        key: "suisse_bilanz.besoin_p_par_culture",
        valueJson: {
          ble_panifiable: 35,
          ble_fourrager: 35,
          orge: 30,
          mais_grain: 50,
          mais_ensilage: 45,
          colza: 35,
          tournesol: 30,
          pomme_de_terre: 50,
          betterave_sucre: 50,
          prairie_temporaire: 30,
          prairie_permanente: 25,
          paturage_extensif: 15,
          paturage_intensif: 30,
        },
        description: "Besoins phosphore par culture (kg P / ha / an) — Agridea 1.18 simplifié.",
      },
      {
        key: "suisse_bilanz.apport_n_par_ugb",
        valueJson: {
          VACHE_LAITIERE: 105,
          GENISSE: 75,
          VEAU: 35,
          TAUREAU: 90,
          BOEUF: 80,
          AUTRE_BOVIN: 75,
          PORC: 90,
          POULET: 60,
          AUTRE: 70,
        },
        description: "Apports azote par UGB et catégorie animale (kg N / UGB / an).",
      },
      {
        key: "suisse_bilanz.apport_p_par_ugb",
        valueJson: {
          VACHE_LAITIERE: 18,
          GENISSE: 14,
          VEAU: 6,
          TAUREAU: 16,
          BOEUF: 14,
          AUTRE_BOVIN: 14,
          PORC: 30,
          POULET: 25,
          AUTRE: 14,
        },
        description: "Apports phosphore par UGB et catégorie animale (kg P / UGB / an).",
      },
      {
        key: "suisse_bilanz.facteur_ugb",
        valueJson: {
          VACHE_LAITIERE: 1.0,
          GENISSE: 0.7,
          VEAU: 0.4,
          TAUREAU: 1.2,
          BOEUF: 0.9,
          AUTRE_BOVIN: 0.6,
          PORC: 0.15,
          POULET: 0.01,
          AUTRE: 0.5,
        },
        description: "Facteur UGB par catégorie animale (UGB par tête).",
      },
      {
        key: "suisse_bilanz.tolerance",
        valueJson: 0.1,
        description: "Tolérance sur le solde N/P (10% des besoins) pour conformité PER.",
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
      {
        key: "suisse_bilanz.tolerance",
        valueJson: 0.05,
        description: "Bio : tolérance bilan abaissée à 5% (vs 10% standard).",
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
