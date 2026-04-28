/**
 * Seed du catalogue Produits — référentiel global (tenantId = NULL).
 *
 * Sources officielles utilisées :
 *   - Variétés céréales : swissgranum / Agroscope, "Liste recommandée des
 *     variétés de céréales pour la récolte 2025" (Agroscope Transfer N°542,
 *     mai 2024). Référence valable pour les semis 2025 → récolte 2026.
 *   - Variétés maïs : swiss granum / Agroscope, liste 2026 (publication
 *     janvier 2026 — 11 nouvelles variétés cette année).
 *   - Mélanges fourragers (Mst) : Agroscope / eADCF, "Mélanges standard
 *     pour la production fourragère, révision 2025-2028".
 *   - Engrais : références terrain Agridea + catalogues Landor/Lonza.
 *   - Phytos : index OSAV (psm.admin.ch) — sélection des plus courants ;
 *     l'import complet via XML OSAV viendra en Phase B.
 *
 * Idempotent : `upsert` par `code`.
 */
import { PrismaClient, ProduitCategorie, ProduitUnite } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedProduit {
  code: string;
  categorie: ProduitCategorie;
  libelle: string;
  fournisseur?: string;
  marque?: string;
  numeroOfficiel?: string;
  especeCode?: string;
  tauxN?: number;
  tauxP?: number;
  tauxK?: number;
  unite?: ProduitUnite;
  notes?: string;
  sourceCatalogue: string;
}

const SRC_SG = "swissgranum 2025 (récolte 2026)";
const SRC_SG_MAIS = "swiss granum / Agroscope — liste maïs 2026";
const SRC_MST = "Agroscope / eADCF — Mst 2025-2028";
const SRC_LANDOR = "Catalogue Landor (Fenaco)";
const SRC_AGRIDEA = "Agridea 1.18 — valeurs moyennes";
const SRC_OSAV = "OSAV — psm.admin.ch (sélection MVP)";

// Helper pour réduire la verbosité.
function ble(
  code: string,
  libelle: string,
  classe: "TOP" | "I" | "II" | "FOURRAGER" | "BISCUIT",
  origine = "CH",
): SeedProduit {
  return {
    code,
    categorie: ProduitCategorie.SEMENCE,
    libelle,
    fournisseur: "swissgranum / Agroscope",
    marque: classe,
    especeCode: classe === "FOURRAGER" || classe === "BISCUIT" ? "ble_fourrager" : "ble_panifiable",
    unite: ProduitUnite.KG,
    notes: `Origine ${origine}. Classe ${classe}.`,
    sourceCatalogue: SRC_SG,
  };
}

const PRODUITS: SeedProduit[] = [
  // ==================================================================
  // SEMENCES — Blé d'automne (swissgranum 2025 — 23 variétés)
  // ==================================================================
  ble("aq-sem-ble-bodeli", "Blé Bodeli", "TOP"),
  ble("aq-sem-ble-caminada", "Blé Caminada (provisoire)", "TOP"),
  ble("aq-sem-ble-piznair", "Blé Piznair", "TOP"),
  ble("aq-sem-ble-runal", "Blé Runal", "TOP"),
  ble("aq-sem-ble-axen", "Blé Axen", "TOP"),
  ble("aq-sem-ble-bonavau", "Blé Bonavau", "TOP"),
  ble("aq-sem-ble-baretta", "Blé Baretta", "TOP"),
  ble("aq-sem-ble-cadlimo", "Blé Cadlimo", "TOP"),
  ble("aq-sem-ble-diavel", "Blé Diavel (alternatif)", "TOP"),
  ble("aq-sem-ble-ch-nara", "Blé CH Nara", "TOP"),
  ble("aq-sem-ble-montalbano", "Blé Montalbano", "TOP"),
  ble("aq-sem-ble-camedo", "Blé CH Camedo", "TOP"),
  ble("aq-sem-ble-arina", "Blé Arina", "I"),
  ble("aq-sem-ble-forel", "Blé Forel", "I"),
  ble("aq-sem-ble-hanswin", "Blé Hanswin", "I"),
  ble("aq-sem-ble-alpval", "Blé Alpval", "I"),
  ble("aq-sem-ble-campanile", "Blé Campanile", "I", "UE"),
  ble("aq-sem-ble-posmeda", "Blé Posmeda", "II", "UE"),
  ble("aq-sem-ble-spontan", "Blé Spontan", "II", "UE"),
  ble("aq-sem-ble-ludwig", "Blé Ludwig (dernière année)", "II", "UE"),
  ble("aq-sem-ble-campesino", "Blé fourrager Campesino", "FOURRAGER", "UE"),
  ble("aq-sem-ble-sailor", "Blé fourrager Sailor", "FOURRAGER", "UE"),
  ble("aq-sem-ble-poncione", "Blé fourrager Poncione", "FOURRAGER"),
  ble("aq-sem-ble-dilago", "Blé biscuit Dilago", "BISCUIT"),

  // Blé de printemps (alternatives)
  {
    code: "aq-sem-ble-pr-fiorina",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Blé de printemps Fiorina",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "ble_panifiable",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-ble-pr-rubli",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Blé de printemps Rubli",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "ble_panifiable",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },

  // ==================================================================
  // SEMENCES — Orge (automne + printemps)
  // ==================================================================
  {
    code: "aq-sem-orge-aut-kws-orbit",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Orge d'automne KWS Orbit",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "orge",
    unite: ProduitUnite.KG,
    notes: "6 rangs, fourragère",
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-orge-aut-kws-higgins",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Orge d'automne KWS Higgins",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "orge",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-orge-aut-kingston",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Orge d'automne Kingston",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "orge",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-orge-aut-canyon",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Orge d'automne Canyon",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "orge",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-orge-aut-tardis",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Orge d'automne Tardis",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "orge",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-orge-aut-arthene",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Orge d'automne Arthene (nouvelle 2026)",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "orge",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-orge-pr-malva",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Orge brassicole de printemps Malva",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "orge",
    unite: ProduitUnite.KG,
    notes: "Brassicole, 2 rangs",
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-orge-pr-quench",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Orge brassicole Quench",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "orge",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },

  // ==================================================================
  // SEMENCES — Triticale, seigle, avoine, épeautre
  // ==================================================================
  {
    code: "aq-sem-tritic-atrika",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Triticale Atrika",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "ble_fourrager",
    unite: ProduitUnite.KG,
    notes: "Triticale (× ble_fourrager pour bilanz)",
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-tritic-larossa",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Triticale Larossa",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "ble_fourrager",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-tritic-cosinus",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Triticale Cosinus",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "ble_fourrager",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-tritic-kitesurf",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Triticale Kitesurf (nouvelle 2026)",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "ble_fourrager",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-seigle-aleksandra",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Seigle Aleksandra",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "ble_fourrager",
    unite: ProduitUnite.KG,
    notes: "Seigle hiver",
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-seigle-mufa",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Seigle Mufa",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "ble_fourrager",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-seigle-pufa",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Seigle Pufa",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "ble_fourrager",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-avoine-husky",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Avoine Husky",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "orge",
    unite: ProduitUnite.KG,
    notes: "Avoine printemps (besoin N proche orge)",
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-avoine-lion",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Avoine Lion",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "orge",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-avoine-galileoo",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Avoine Galileoo",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "orge",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-epeautre-oberkulmer",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Épeautre Oberkulmer",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "ble_panifiable",
    unite: ProduitUnite.KG,
    notes: "Épeautre rotkorn, valeur boulangère",
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-epeautre-ostro",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Épeautre Ostro",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "ble_panifiable",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-epeautre-edelweisser",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Épeautre Edelweisser",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "ble_panifiable",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-epeautre-gletscher",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Épeautre Gletscher (nouvelle 2026)",
    fournisseur: "swissgranum / Agroscope",
    especeCode: "ble_panifiable",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },

  // ==================================================================
  // SEMENCES — Maïs (Agroscope 2026, 11 nouvelles)
  // ==================================================================
  {
    code: "aq-sem-mais-grain-lg31272",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Maïs grain LG31272",
    fournisseur: "Limagrain",
    marque: "LG31272",
    especeCode: "mais_grain",
    unite: ProduitUnite.DOSE,
    notes: "1 dose = 50 000 grains",
    sourceCatalogue: SRC_SG_MAIS,
  },
  {
    code: "aq-sem-mais-grain-sy-orpheus",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Maïs grain SY Orpheus",
    fournisseur: "Syngenta",
    especeCode: "mais_grain",
    unite: ProduitUnite.DOSE,
    sourceCatalogue: SRC_SG_MAIS,
  },
  {
    code: "aq-sem-mais-grain-p8888",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Maïs grain P8888 (Pioneer)",
    fournisseur: "Corteva / Pioneer",
    especeCode: "mais_grain",
    unite: ProduitUnite.DOSE,
    sourceCatalogue: SRC_SG_MAIS,
  },
  {
    code: "aq-sem-mais-grain-figaro",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Maïs grain Figaro",
    fournisseur: "KWS",
    especeCode: "mais_grain",
    unite: ProduitUnite.DOSE,
    sourceCatalogue: SRC_SG_MAIS,
  },
  {
    code: "aq-sem-mais-ens-ds1492c",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Maïs ensilage DS1492C",
    fournisseur: "Delley Semences",
    marque: "DS1492C",
    especeCode: "mais_ensilage",
    unite: ProduitUnite.DOSE,
    sourceCatalogue: SRC_SG_MAIS,
  },
  {
    code: "aq-sem-mais-ens-lg31256",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Maïs ensilage LG31256",
    fournisseur: "Limagrain",
    especeCode: "mais_ensilage",
    unite: ProduitUnite.DOSE,
    sourceCatalogue: SRC_SG_MAIS,
  },
  {
    code: "aq-sem-mais-ens-sy-amfora",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Maïs ensilage SY Amfora",
    fournisseur: "Syngenta",
    especeCode: "mais_ensilage",
    unite: ProduitUnite.DOSE,
    sourceCatalogue: SRC_SG_MAIS,
  },
  {
    code: "aq-sem-mais-ens-prosperia",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Maïs ensilage Prosperia",
    fournisseur: "KWS",
    especeCode: "mais_ensilage",
    unite: ProduitUnite.DOSE,
    sourceCatalogue: SRC_SG_MAIS,
  },

  // ==================================================================
  // SEMENCES — Colza, tournesol, soja, protéagineux
  // ==================================================================
  {
    code: "aq-sem-colza-architect",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Colza Architect (hybride)",
    fournisseur: "UFA-Semences",
    marque: "Architect",
    especeCode: "colza",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-colza-lg-austin",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Colza LG Austin (nouvelle 2026)",
    fournisseur: "Limagrain",
    especeCode: "colza",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-colza-blackmoon",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Colza Blackmoon (nouvelle 2026)",
    fournisseur: "DSV",
    especeCode: "colza",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-colza-dk-excited",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Colza DK Excited",
    fournisseur: "Bayer / Dekalb",
    especeCode: "colza",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-colza-dk-expansion",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Colza DK Expansion",
    fournisseur: "Bayer / Dekalb",
    especeCode: "colza",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-tournesol-sy-talento",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Tournesol SY Talento",
    fournisseur: "Syngenta",
    especeCode: "tournesol",
    unite: ProduitUnite.DOSE,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-tournesol-es-niagara",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Tournesol ES Niagara",
    fournisseur: "Lidea",
    especeCode: "tournesol",
    unite: ProduitUnite.DOSE,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-soja-galice",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Soja Galice",
    fournisseur: "Agroscope / DSP",
    especeCode: "tournesol", // pas dans rule engine, fallback raisonnable
    unite: ProduitUnite.KG,
    notes: "Soja — légumineuse (apport N atmosphérique non couvert V1)",
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-feverole-fanfare",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Féverole Fanfare",
    fournisseur: "swissgranum / Agroscope",
    unite: ProduitUnite.KG,
    notes: "Féverole — légumineuse",
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-pois-protein-astronaute",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Pois protéagineux Astronaute",
    fournisseur: "swissgranum / Agroscope",
    unite: ProduitUnite.KG,
    notes: "Pois protéagineux — légumineuse",
    sourceCatalogue: SRC_SG,
  },

  // ==================================================================
  // SEMENCES — Pomme de terre, betterave
  // ==================================================================
  {
    code: "aq-sem-pdt-charlotte",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Pomme de terre Charlotte",
    fournisseur: "Semences Suisses",
    especeCode: "pomme_de_terre",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-pdt-agria",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Pomme de terre Agria",
    fournisseur: "Semences Suisses",
    especeCode: "pomme_de_terre",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-pdt-erika",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Pomme de terre Erika",
    fournisseur: "Semences Suisses",
    especeCode: "pomme_de_terre",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-pdt-gourmandine",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Pomme de terre Gourmandine",
    fournisseur: "Semences Suisses",
    especeCode: "pomme_de_terre",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-betterave-magnum",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Betterave sucrière Magnum",
    fournisseur: "Strube",
    especeCode: "betterave_sucre",
    unite: ProduitUnite.DOSE,
    sourceCatalogue: SRC_SG,
  },
  {
    code: "aq-sem-betterave-thunder",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Betterave sucrière Thunder",
    fournisseur: "KWS",
    especeCode: "betterave_sucre",
    unite: ProduitUnite.DOSE,
    sourceCatalogue: SRC_SG,
  },

  // ==================================================================
  // SEMENCES — Mélanges fourragers Mst (Agroscope 2025-2028)
  // Codification : 1xx = annuel, 3xx = 3 ans, 4xx = long terme
  //                x3x = dactyle, x4x = sans dactyle, x5x = prairie permanente
  //                xx0 = zones favorables ray-grass, xxN = défavorables
  // ==================================================================
  {
    code: "aq-mst-100",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Mst 100 (annuel — ray-grass d'Italie pur)",
    fournisseur: "UFA-Semences / Otto Hauenstein",
    numeroOfficiel: "Mst 100",
    especeCode: "prairie_temporaire",
    unite: ProduitUnite.KG,
    notes: "Annuel, fauche, après céréales",
    sourceCatalogue: SRC_MST,
  },
  {
    code: "aq-mst-200",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Mst 200 (graminées-trèfles courte durée)",
    fournisseur: "UFA-Semences",
    numeroOfficiel: "Mst 200",
    especeCode: "prairie_temporaire",
    unite: ProduitUnite.KG,
    notes: "1-2 ans, fauche intensive",
    sourceCatalogue: SRC_MST,
  },
  {
    code: "aq-mst-220",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Mst 220 (luzerne pure ou en association)",
    fournisseur: "UFA-Semences",
    numeroOfficiel: "Mst 220",
    especeCode: "prairie_temporaire",
    unite: ProduitUnite.KG,
    notes: "2-3 ans, fauche, sols profonds",
    sourceCatalogue: SRC_MST,
  },
  {
    code: "aq-mst-240",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Mst 240 (luzerne + graminées)",
    fournisseur: "UFA-Semences",
    numeroOfficiel: "Mst 240",
    especeCode: "prairie_temporaire",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_MST,
  },
  {
    code: "aq-mst-300",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Mst 300 (graminées-trèfles 3 ans, dactyle)",
    fournisseur: "UFA-Semences",
    numeroOfficiel: "Mst 300",
    especeCode: "prairie_temporaire",
    unite: ProduitUnite.KG,
    notes: "3 ans, dactyle, zones défavorables ray-grass",
    sourceCatalogue: SRC_MST,
  },
  {
    code: "aq-mst-310",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Mst 310 (graminées-trèfles, dactyle, ray-grass)",
    fournisseur: "UFA-Semences",
    numeroOfficiel: "Mst 310",
    especeCode: "prairie_temporaire",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_MST,
  },
  {
    code: "aq-mst-320",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Mst 320 (sans dactyle, fauche)",
    fournisseur: "UFA-Semences",
    numeroOfficiel: "Mst 320",
    especeCode: "prairie_temporaire",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_MST,
  },
  {
    code: "aq-mst-330",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Mst 330 (graminées-trèfle blanc, longue durée)",
    fournisseur: "UFA-Semences",
    numeroOfficiel: "Mst 330",
    especeCode: "prairie_temporaire",
    unite: ProduitUnite.KG,
    notes: "ADCF qualité G — 4-5 ans, mixte fauche/pâture",
    sourceCatalogue: SRC_MST,
  },
  {
    code: "aq-mst-340",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Mst 340 (longue durée, sans dactyle)",
    fournisseur: "UFA-Semences",
    numeroOfficiel: "Mst 340",
    especeCode: "prairie_temporaire",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_MST,
  },
  {
    code: "aq-mst-431",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Mst 431 (long terme, dactyle)",
    fournisseur: "UFA-Semences",
    numeroOfficiel: "Mst 431",
    especeCode: "prairie_permanente",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_MST,
  },
  {
    code: "aq-mst-440",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Mst 440 (long terme, sans dactyle)",
    fournisseur: "UFA-Semences",
    numeroOfficiel: "Mst 440",
    especeCode: "paturage_extensif",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_MST,
  },
  {
    code: "aq-mst-450",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Mst 450 (prairie permanente fauchée)",
    fournisseur: "UFA-Semences",
    numeroOfficiel: "Mst 450",
    especeCode: "prairie_permanente",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_MST,
  },
  {
    code: "aq-mst-462",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Mst 462 (prairie pâturée intensive)",
    fournisseur: "UFA-Semences",
    numeroOfficiel: "Mst 462",
    especeCode: "paturage_intensif",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_MST,
  },
  {
    code: "aq-mst-481",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Mst 481 (pâturage intensif, ray-grass anglais)",
    fournisseur: "UFA-Semences",
    numeroOfficiel: "Mst 481",
    especeCode: "paturage_intensif",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_MST,
  },
  {
    code: "aq-mst-911",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Mst 911 (zone alpine, pâture intensive)",
    fournisseur: "UFA-Semences",
    numeroOfficiel: "Mst 911",
    especeCode: "paturage_intensif",
    unite: ProduitUnite.KG,
    notes: "Zone montagne / estivage",
    sourceCatalogue: SRC_MST,
  },
  {
    code: "aq-mst-940",
    categorie: ProduitCategorie.SEMENCE,
    libelle: "Mst 940 (zone alpine, fauche)",
    fournisseur: "UFA-Semences",
    numeroOfficiel: "Mst 940",
    especeCode: "prairie_permanente",
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_MST,
  },

  // ==================================================================
  // ENGRAIS MINÉRAUX — Landor (Fenaco)
  // ==================================================================
  {
    code: "aq-eng-ammonitrate-27",
    categorie: ProduitCategorie.ENGRAIS_MINERAL,
    libelle: "Ammonitrate 27% N",
    fournisseur: "Landor",
    tauxN: 27,
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_LANDOR,
  },
  {
    code: "aq-eng-uree-46",
    categorie: ProduitCategorie.ENGRAIS_MINERAL,
    libelle: "Urée 46% N",
    fournisseur: "Landor",
    tauxN: 46,
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_LANDOR,
  },
  {
    code: "aq-eng-nitrate-ca-15",
    categorie: ProduitCategorie.ENGRAIS_MINERAL,
    libelle: "Nitrate de chaux 15.5% N",
    fournisseur: "Landor",
    tauxN: 15.5,
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_LANDOR,
  },
  {
    code: "aq-eng-sulfate-am-21",
    categorie: ProduitCategorie.ENGRAIS_MINERAL,
    libelle: "Sulfate d'ammoniaque 21% N",
    fournisseur: "Landor",
    tauxN: 21,
    unite: ProduitUnite.KG,
    notes: "Apport souffre + acidification sols calcaires",
    sourceCatalogue: SRC_LANDOR,
  },
  {
    code: "aq-eng-npk-15-15-15",
    categorie: ProduitCategorie.ENGRAIS_MINERAL,
    libelle: "NPK 15-15-15 (Nitrophoska bleu)",
    fournisseur: "Landor",
    tauxN: 15,
    tauxP: 15 * 0.436,
    tauxK: 15 * 0.83,
    unite: ProduitUnite.KG,
    notes: "Tauxs P et K en élémentaire (pas oxyde)",
    sourceCatalogue: SRC_LANDOR,
  },
  {
    code: "aq-eng-npk-20-10-10",
    categorie: ProduitCategorie.ENGRAIS_MINERAL,
    libelle: "NPK 20-10-10",
    fournisseur: "Landor",
    tauxN: 20,
    tauxP: 10 * 0.436,
    tauxK: 10 * 0.83,
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_LANDOR,
  },
  {
    code: "aq-eng-npk-12-12-17",
    categorie: ProduitCategorie.ENGRAIS_MINERAL,
    libelle: "NPK 12-12-17 (+ Mg + S)",
    fournisseur: "Landor",
    tauxN: 12,
    tauxP: 12 * 0.436,
    tauxK: 17 * 0.83,
    unite: ProduitUnite.KG,
    notes: "Engrais complet pour grandes cultures",
    sourceCatalogue: SRC_LANDOR,
  },
  {
    code: "aq-eng-superphosphate-46",
    categorie: ProduitCategorie.ENGRAIS_MINERAL,
    libelle: "Superphosphate triple 46% P₂O₅",
    fournisseur: "Landor",
    tauxP: 46 * 0.436,
    unite: ProduitUnite.KG,
    notes: "P₂O₅ × 0.436 = P élémentaire",
    sourceCatalogue: SRC_LANDOR,
  },
  {
    code: "aq-eng-kcl-60",
    categorie: ProduitCategorie.ENGRAIS_MINERAL,
    libelle: "Chlorure de potassium 60% K₂O",
    fournisseur: "Landor",
    tauxK: 60 * 0.83,
    unite: ProduitUnite.KG,
    sourceCatalogue: SRC_LANDOR,
  },
  {
    code: "aq-eng-patentkali",
    categorie: ProduitCategorie.ENGRAIS_MINERAL,
    libelle: "Patentkali 30% K₂O + 10% MgO + 17% S",
    fournisseur: "Landor",
    tauxK: 30 * 0.83,
    unite: ProduitUnite.KG,
    notes: "K + Mg + S — cultures sensibles au chlore",
    sourceCatalogue: SRC_LANDOR,
  },

  // ==================================================================
  // ENGRAIS ORGANIQUES — valeurs Agridea moyennes
  // ==================================================================
  {
    code: "aq-org-lisier-bovin",
    categorie: ProduitCategorie.ENGRAIS_ORGANIQUE,
    libelle: "Lisier bovin (moyenne)",
    tauxN: 0.4,
    tauxP: 0.07,
    tauxK: 0.5,
    unite: ProduitUnite.M3,
    notes: "≈ 4 kg N/m³ — analyser pour précision",
    sourceCatalogue: SRC_AGRIDEA,
  },
  {
    code: "aq-org-lisier-bovin-dilue",
    categorie: ProduitCategorie.ENGRAIS_ORGANIQUE,
    libelle: "Lisier bovin dilué (rinçage)",
    tauxN: 0.2,
    tauxP: 0.04,
    tauxK: 0.3,
    unite: ProduitUnite.M3,
    sourceCatalogue: SRC_AGRIDEA,
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
    sourceCatalogue: SRC_AGRIDEA,
  },
  {
    code: "aq-org-lisier-porc-truies",
    categorie: ProduitCategorie.ENGRAIS_ORGANIQUE,
    libelle: "Lisier porc (truies allaitantes)",
    tauxN: 0.45,
    tauxP: 0.1,
    tauxK: 0.25,
    unite: ProduitUnite.M3,
    sourceCatalogue: SRC_AGRIDEA,
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
    sourceCatalogue: SRC_AGRIDEA,
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
    sourceCatalogue: SRC_AGRIDEA,
  },
  {
    code: "aq-org-fumier-cheval",
    categorie: ProduitCategorie.ENGRAIS_ORGANIQUE,
    libelle: "Fumier de cheval",
    tauxN: 0.4,
    tauxP: 0.1,
    tauxK: 0.5,
    unite: ProduitUnite.T,
    sourceCatalogue: SRC_AGRIDEA,
  },
  {
    code: "aq-org-compost-vegetal",
    categorie: ProduitCategorie.ENGRAIS_ORGANIQUE,
    libelle: "Compost végétal",
    tauxN: 0.6,
    tauxP: 0.2,
    tauxK: 0.5,
    unite: ProduitUnite.T,
    sourceCatalogue: SRC_AGRIDEA,
  },
  {
    code: "aq-org-digestat-meth",
    categorie: ProduitCategorie.ENGRAIS_ORGANIQUE,
    libelle: "Digestat de méthanisation",
    tauxN: 0.45,
    tauxP: 0.08,
    tauxK: 0.4,
    unite: ProduitUnite.M3,
    sourceCatalogue: SRC_AGRIDEA,
  },

  // ==================================================================
  // PHYTOS — sélection courante (catalogue OSAV — psm.admin.ch)
  // Phase B : import auto via XML OSAV.
  // ==================================================================
  {
    code: "aq-phyto-roundup-max",
    categorie: ProduitCategorie.PHYTO,
    libelle: "Roundup MAX 360 (glyphosate)",
    fournisseur: "Bayer",
    unite: ProduitUnite.L,
    notes: "Herbicide total non sélectif",
    sourceCatalogue: SRC_OSAV,
  },
  {
    code: "aq-phyto-stomp-aqua",
    categorie: ProduitCategorie.PHYTO,
    libelle: "Stomp Aqua (pendiméthaline)",
    fournisseur: "BASF",
    unite: ProduitUnite.L,
    notes: "Herbicide pré-levée maïs/tournesol",
    sourceCatalogue: SRC_OSAV,
  },
  {
    code: "aq-phyto-orius",
    categorie: ProduitCategorie.PHYTO,
    libelle: "Orius (tébuconazole)",
    fournisseur: "Adama",
    unite: ProduitUnite.L,
    notes: "Fongicide blé/orge",
    sourceCatalogue: SRC_OSAV,
  },
  {
    code: "aq-phyto-karate-zeon",
    categorie: ProduitCategorie.PHYTO,
    libelle: "Karate Zeon (lambda-cyhalothrine)",
    fournisseur: "Syngenta",
    unite: ProduitUnite.L,
    notes: "Insecticide pyréthrinoïde",
    sourceCatalogue: SRC_OSAV,
  },
  {
    code: "aq-phyto-banjo-forte",
    categorie: ProduitCategorie.PHYTO,
    libelle: "Banjo Forte (fluazinam + dimétomorphe)",
    fournisseur: "Adama",
    unite: ProduitUnite.L,
    notes: "Fongicide mildiou pomme de terre",
    sourceCatalogue: SRC_OSAV,
  },
  {
    code: "aq-phyto-prosaro",
    categorie: ProduitCategorie.PHYTO,
    libelle: "Prosaro (prothioconazole + tébuconazole)",
    fournisseur: "Bayer",
    unite: ProduitUnite.L,
    sourceCatalogue: SRC_OSAV,
  },
  {
    code: "aq-phyto-mospilan",
    categorie: ProduitCategorie.PHYTO,
    libelle: "Mospilan (acétamipride)",
    fournisseur: "Sumi Agro",
    unite: ProduitUnite.KG,
    notes: "Insecticide colza, pommes de terre",
    sourceCatalogue: SRC_OSAV,
  },
  {
    code: "aq-phyto-axial-50",
    categorie: ProduitCategorie.PHYTO,
    libelle: "Axial 50 (pinoxaden)",
    fournisseur: "Syngenta",
    unite: ProduitUnite.L,
    notes: "Anti-graminées céréales",
    sourceCatalogue: SRC_OSAV,
  },
];

async function seed(): Promise<void> {
  for (const p of PRODUITS) {
    const data = {
      libelle: p.libelle,
      fournisseur: p.fournisseur ?? null,
      marque: p.marque ?? null,
      numeroOfficiel: p.numeroOfficiel ?? null,
      especeCode: p.especeCode ?? null,
      tauxN: p.tauxN ?? null,
      tauxP: p.tauxP ?? null,
      tauxK: p.tauxK ?? null,
      unite: p.unite ?? ProduitUnite.KG,
      notes: p.notes ?? null,
      sourceCatalogue: p.sourceCatalogue,
      actif: true,
    };
    await prisma.produit.upsert({
      where: { code: p.code },
      update: data,
      create: { tenantId: null, code: p.code, categorie: p.categorie, ...data },
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
