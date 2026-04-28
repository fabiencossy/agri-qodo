/**
 * Seed du catalogue Produits — référentiel global (tenantId = NULL).
 *
 * Couvre le quotidien d'une exploitation suisse de plaine :
 * - SEMENCES : grandes cultures (UFA Semences, Sativa)
 * - ENGRAIS_MINERAL : Landor, Lonza
 * - ENGRAIS_ORGANIQUE : lisiers, fumiers (références terrain Agridea)
 * - PHYTO : phytos courants (catalogue OFAG)
 *
 * Idempotent : `upsert` par `code`.
 *
 * Lancer : `pnpm --filter @agri-qodo/backend exec ts-node prisma/seed-produits.ts`
 */
import { PrismaClient, ProduitCategorie, ProduitUnite } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedProduit {
  code: string;
  categorie: ProduitCategorie;
  libelle: string;
  fournisseur?: string;
  marque?: string;
  especeCode?: string;
  tauxN?: number;
  tauxP?: number;
  tauxK?: number;
  unite?: ProduitUnite;
  notes?: string;
}

const PRODUITS: SeedProduit[] = [
  // ----- Semences grandes cultures -----
  {
    code: "aq-sem-ble-arnold",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Blé panifiable Arnold",
    fournisseur: "UFA-Semences",
    marque: "Arnold",
    especeCode: "ble_panifiable",
    unite: ProduitUnite.KG,
  },
  {
    code: "aq-sem-ble-baretta",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Blé panifiable Baretta",
    fournisseur: "UFA-Semences",
    marque: "Baretta",
    especeCode: "ble_panifiable",
    unite: ProduitUnite.KG,
  },
  {
    code: "aq-sem-ble-runal",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Blé fourrager Runal",
    fournisseur: "UFA-Semences",
    marque: "Runal",
    especeCode: "ble_fourrager",
    unite: ProduitUnite.KG,
  },
  {
    code: "aq-sem-orge-malva",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Orge brassicole Malva",
    fournisseur: "UFA-Semences",
    marque: "Malva",
    especeCode: "orge",
    unite: ProduitUnite.KG,
  },
  {
    code: "aq-sem-orge-fourragere",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Orge fourragère KWS",
    fournisseur: "Sativa",
    especeCode: "orge",
    unite: ProduitUnite.KG,
  },
  {
    code: "aq-sem-mais-grain-lg",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Maïs grain LG31272",
    fournisseur: "Limagrain",
    marque: "LG31272",
    especeCode: "mais_grain",
    unite: ProduitUnite.DOSE,
    notes: "1 dose = 50 000 grains",
  },
  {
    code: "aq-sem-mais-ensilage-ds",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Maïs ensilage DS1492C",
    fournisseur: "Delley Semences",
    marque: "DS1492C",
    especeCode: "mais_ensilage",
    unite: ProduitUnite.DOSE,
  },
  {
    code: "aq-sem-colza-architect",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Colza Architect (hybride)",
    fournisseur: "UFA-Semences",
    marque: "Architect",
    especeCode: "colza",
    unite: ProduitUnite.KG,
  },
  {
    code: "aq-sem-tournesol-sy-talento",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Tournesol SY Talento",
    fournisseur: "Syngenta",
    marque: "SY Talento",
    especeCode: "tournesol",
    unite: ProduitUnite.DOSE,
  },
  {
    code: "aq-sem-pdt-charlotte",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Pomme de terre Charlotte",
    fournisseur: "Semences Suisses",
    marque: "Charlotte",
    especeCode: "pomme_de_terre",
    unite: ProduitUnite.KG,
  },
  {
    code: "aq-sem-betterave-magnum",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Betterave sucrière Magnum",
    fournisseur: "Strube",
    marque: "Magnum",
    especeCode: "betterave_sucre",
    unite: ProduitUnite.DOSE,
  },
  // Prairies — mélanges Agroscope (norme suisse, ces codes sont standards)
  {
    code: "aq-sem-mel-200",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Mélange 200 (graminées-trèfles longue durée)",
    fournisseur: "UFA-Semences",
    marque: "Mst-200",
    especeCode: "prairie_temporaire",
    unite: ProduitUnite.KG,
    notes: "Norme Agroscope, 4-5 ans",
  },
  {
    code: "aq-sem-mel-330",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Mélange 330 (prairie permanente)",
    fournisseur: "UFA-Semences",
    marque: "Mst-330",
    especeCode: "prairie_permanente",
    unite: ProduitUnite.KG,
  },
  {
    code: "aq-sem-mel-440",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Mélange 440 (extensif fauche)",
    fournisseur: "UFA-Semences",
    marque: "Mst-440",
    especeCode: "paturage_extensif",
    unite: ProduitUnite.KG,
  },

  // ----- Engrais minéraux -----
  // Landor (Fenaco) — produits courants en Suisse romande
  {
    code: "aq-eng-ammonitrate-27",
    categorie: ProduitCategorie.ENGRAIS_MINERAL,
    libelle: "Ammonitrate 27% N",
    fournisseur: "Landor",
    tauxN: 27,
    unite: ProduitUnite.KG,
  },
  {
    code: "aq-eng-uree-46",
    categorie: ProduitCategorie.ENGRAIS_MINERAL,
    libelle: "Urée 46% N",
    fournisseur: "Landor",
    tauxN: 46,
    unite: ProduitUnite.KG,
  },
  {
    code: "aq-eng-nitrate-ca-15",
    categorie: ProduitCategorie.ENGRAIS_MINERAL,
    libelle: "Nitrate de chaux 15.5% N",
    fournisseur: "Landor",
    tauxN: 15.5,
    unite: ProduitUnite.KG,
  },
  {
    code: "aq-eng-npk-15-15-15",
    categorie: ProduitCategorie.ENGRAIS_MINERAL,
    libelle: "NPK 15-15-15 (Nitrophoska)",
    fournisseur: "Landor",
    tauxN: 15,
    tauxP: 15,
    tauxK: 15,
    unite: ProduitUnite.KG,
  },
  {
    code: "aq-eng-npk-20-10-10",
    categorie: ProduitCategorie.ENGRAIS_MINERAL,
    libelle: "NPK 20-10-10",
    fournisseur: "Landor",
    tauxN: 20,
    tauxP: 10,
    tauxK: 10,
    unite: ProduitUnite.KG,
  },
  {
    code: "aq-eng-superphosphate-46",
    categorie: ProduitCategorie.ENGRAIS_MINERAL,
    libelle: "Superphosphate triple 46% P₂O₅",
    fournisseur: "Landor",
    tauxP: 46 * 0.436,
    unite: ProduitUnite.KG,
    notes: "P₂O₅ × 0.436 = P élémentaire",
  },
  {
    code: "aq-eng-kcl-60",
    categorie: ProduitCategorie.ENGRAIS_MINERAL,
    libelle: "Chlorure de potassium 60% K₂O",
    fournisseur: "Landor",
    tauxK: 60 * 0.83,
    unite: ProduitUnite.KG,
  },

  // ----- Engrais organiques -----
  // Valeurs typiques Agridea — l'utilisateur peut surcharger en perso si analyse de lisier dispo.
  {
    code: "aq-org-lisier-bovin",
    categorie: ProduitCategorie.ENGRAIS_ORGANIQUE,
    libelle: "Lisier bovin (moyenne)",
    tauxN: 0.4,
    tauxP: 0.07,
    tauxK: 0.5,
    unite: ProduitUnite.M3,
    notes: "≈ 4 kg N/m³ — analyser en cours d'année pour précision",
  },
  {
    code: "aq-org-lisier-porc",
    categorie: ProduitCategorie.ENGRAIS_ORGANIQUE,
    libelle: "Lisier porc (engraissement)",
    tauxN: 0.55,
    tauxP: 0.13,
    tauxK: 0.3,
    unite: ProduitUnite.M3,
    notes: "≈ 5.5 kg N/m³",
  },
  {
    code: "aq-org-fumier-bovin",
    categorie: ProduitCategorie.ENGRAIS_ORGANIQUE,
    libelle: "Fumier bovin composté",
    tauxN: 0.5,
    tauxP: 0.15,
    tauxK: 0.6,
    unite: ProduitUnite.T,
    notes: "≈ 5 kg N/t",
  },
  {
    code: "aq-org-fumier-volaille",
    categorie: ProduitCategorie.ENGRAIS_ORGANIQUE,
    libelle: "Fumier de volaille",
    tauxN: 1.5,
    tauxP: 0.4,
    tauxK: 0.8,
    unite: ProduitUnite.T,
    notes: "≈ 15 kg N/t — concentré",
  },
  {
    code: "aq-org-compost",
    categorie: ProduitCategorie.ENGRAIS_ORGANIQUE,
    libelle: "Compost végétal",
    tauxN: 0.6,
    tauxP: 0.2,
    tauxK: 0.5,
    unite: ProduitUnite.T,
  },

  // ----- Phyto courants (libellés indicatifs — pour traçabilité PER) -----
  {
    code: "aq-phyto-roundup-max",
    categorie: ProduitCategorie.PHYTO,
    libelle: "Roundup MAX 360 (glyphosate)",
    fournisseur: "Bayer",
    unite: ProduitUnite.L,
    notes: "Herbicide total non sélectif",
  },
  {
    code: "aq-phyto-stomp-aqua",
    categorie: ProduitCategorie.PHYTO,
    libelle: "Stomp Aqua (pendiméthaline)",
    fournisseur: "BASF",
    unite: ProduitUnite.L,
  },
  {
    code: "aq-phyto-orius",
    categorie: ProduitCategorie.PHYTO,
    libelle: "Orius (tébuconazole)",
    fournisseur: "Adama",
    unite: ProduitUnite.L,
    notes: "Fongicide blé/orge",
  },
  {
    code: "aq-phyto-karate-zeon",
    categorie: ProduitCategorie.PHYTO,
    libelle: "Karate Zeon (lambda-cyhalothrine)",
    fournisseur: "Syngenta",
    unite: ProduitUnite.L,
  },
];

async function seed(): Promise<void> {
  for (const p of PRODUITS) {
    await prisma.produit.upsert({
      where: { code: p.code },
      update: {
        libelle: p.libelle,
        fournisseur: p.fournisseur ?? null,
        marque: p.marque ?? null,
        especeCode: p.especeCode ?? null,
        tauxN: p.tauxN ?? null,
        tauxP: p.tauxP ?? null,
        tauxK: p.tauxK ?? null,
        unite: p.unite ?? ProduitUnite.KG,
        notes: p.notes ?? null,
        actif: true,
      },
      create: {
        tenantId: null,
        code: p.code,
        categorie: p.categorie,
        libelle: p.libelle,
        fournisseur: p.fournisseur ?? null,
        marque: p.marque ?? null,
        especeCode: p.especeCode ?? null,
        tauxN: p.tauxN ?? null,
        tauxP: p.tauxP ?? null,
        tauxK: p.tauxK ?? null,
        unite: p.unite ?? ProduitUnite.KG,
        notes: p.notes ?? null,
      },
    });
  }
  const counts = await prisma.produit.groupBy({
    by: ["categorie"],
    where: { tenantId: null },
    _count: { _all: true },
  });
  console.log("Catalogue Produits global seeded :");
  for (const c of counts) {
    console.log(`  ${c.categorie}: ${c._count._all}`);
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
