/**
 * Seed du catalogue Matériel — référentiel global (tenantId = NULL).
 *
 * Matériel = prestation/opération facturable rendue avec une machine
 * (≠ Produit, qui est un intrant consommé). Mappé sur un product.product
 * Odoo de type "service" pour la facturation à l'hectare/m³/heure.
 *
 * Tarifs indicatifs : Agridea "Coûts-machines 2025/26" (édition juin 2025).
 * Le tarif est une référence par défaut — éditable ligne par ligne sur
 * chaque Travail/Intervention.
 *
 * Idempotent : `upsert` par `code`.
 */
import { MaterielCategorie, MaterielUnite, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedMateriel {
  code: string;
  libelle: string;
  categorie: MaterielCategorie;
  unite: MaterielUnite;
  prixUnitaireCHF?: number;
  notes?: string;
}

const MATERIELS: SeedMateriel[] = [
  // ----- Travail du sol --------------------------------------------------
  {
    code: "labour-charrue",
    libelle: "Labour à la charrue",
    categorie: MaterielCategorie.TRAVAIL_DU_SOL,
    unite: MaterielUnite.HA,
    prixUnitaireCHF: 220,
    notes: "Charrue 4 socs, ~25-30 cm. Agridea coûts-machines 2025/26.",
  },
  {
    code: "decompactage",
    libelle: "Décompactage",
    categorie: MaterielCategorie.TRAVAIL_DU_SOL,
    unite: MaterielUnite.HA,
    prixUnitaireCHF: 180,
  },
  {
    code: "herse-rotative",
    libelle: "Herse rotative",
    categorie: MaterielCategorie.TRAVAIL_DU_SOL,
    unite: MaterielUnite.HA,
    prixUnitaireCHF: 140,
  },
  {
    code: "vibroculteur",
    libelle: "Vibroculteur (préparation lit semence)",
    categorie: MaterielCategorie.TRAVAIL_DU_SOL,
    unite: MaterielUnite.HA,
    prixUnitaireCHF: 95,
  },
  {
    code: "dechaumage",
    libelle: "Déchaumage",
    categorie: MaterielCategorie.TRAVAIL_DU_SOL,
    unite: MaterielUnite.HA,
    prixUnitaireCHF: 110,
  },

  // ----- Semis -----------------------------------------------------------
  {
    code: "semis-cereale",
    libelle: "Semis céréales (semoir mécanique)",
    categorie: MaterielCategorie.SEMIS,
    unite: MaterielUnite.HA,
    prixUnitaireCHF: 130,
  },
  {
    code: "semis-direct",
    libelle: "Semis direct (sans labour)",
    categorie: MaterielCategorie.SEMIS,
    unite: MaterielUnite.HA,
    prixUnitaireCHF: 165,
  },
  {
    code: "semis-mais",
    libelle: "Semis maïs (mono-graine)",
    categorie: MaterielCategorie.SEMIS,
    unite: MaterielUnite.HA,
    prixUnitaireCHF: 145,
  },
  {
    code: "plantation-pdt",
    libelle: "Plantation pommes de terre",
    categorie: MaterielCategorie.SEMIS,
    unite: MaterielUnite.HA,
    prixUnitaireCHF: 380,
  },

  // ----- Fertilisation ---------------------------------------------------
  {
    code: "epandage-engrais-mineral",
    libelle: "Épandage engrais minéral",
    categorie: MaterielCategorie.FERTILISATION,
    unite: MaterielUnite.HA,
    prixUnitaireCHF: 45,
  },
  {
    code: "epandage-lisier-tonne",
    libelle: "Épandage lisier (tonne classique)",
    categorie: MaterielCategorie.FERTILISATION,
    unite: MaterielUnite.M3,
    prixUnitaireCHF: 12,
    notes: "Tonne ~10-15 m³, perte NH3 ~30%.",
  },
  {
    code: "epandage-lisier-pendillard",
    libelle: "Épandage lisier (rampe pendillard)",
    categorie: MaterielCategorie.FERTILISATION,
    unite: MaterielUnite.M3,
    prixUnitaireCHF: 16,
    notes: "Perte NH3 ~15% (Agridea 1.18).",
  },
  {
    code: "epandage-fumier",
    libelle: "Épandage fumier solide",
    categorie: MaterielCategorie.FERTILISATION,
    unite: MaterielUnite.T,
    prixUnitaireCHF: 14,
  },

  // ----- Protection des cultures -----------------------------------------
  {
    code: "pulve-phyto",
    libelle: "Pulvérisation phyto",
    categorie: MaterielCategorie.PROTECTION,
    unite: MaterielUnite.HA,
    prixUnitaireCHF: 65,
    notes: "Pulvérisateur traîné/porté, sans le produit.",
  },
  {
    code: "desherbage-meca",
    libelle: "Désherbage mécanique (bineuse)",
    categorie: MaterielCategorie.PROTECTION,
    unite: MaterielUnite.HA,
    prixUnitaireCHF: 95,
  },

  // ----- Récolte ---------------------------------------------------------
  {
    code: "moisson-cereale",
    libelle: "Moisson céréales (moissonneuse-batteuse)",
    categorie: MaterielCategorie.RECOLTE,
    unite: MaterielUnite.HA,
    prixUnitaireCHF: 380,
  },
  {
    code: "ensilage-mais",
    libelle: "Ensilage maïs",
    categorie: MaterielCategorie.RECOLTE,
    unite: MaterielUnite.HA,
    prixUnitaireCHF: 450,
    notes: "Ensileuse automotrice, hors transport.",
  },
  {
    code: "ensilage-herbe",
    libelle: "Ensilage herbe",
    categorie: MaterielCategorie.RECOLTE,
    unite: MaterielUnite.HA,
    prixUnitaireCHF: 320,
  },
  {
    code: "balles-rondes",
    libelle: "Pressage balles rondes",
    categorie: MaterielCategorie.RECOLTE,
    unite: MaterielUnite.FORFAIT,
    prixUnitaireCHF: 18,
    notes: "Tarif par balle (~250-300 kg).",
  },
  {
    code: "balles-carrees",
    libelle: "Pressage balles carrées (HD)",
    categorie: MaterielCategorie.RECOLTE,
    unite: MaterielUnite.FORFAIT,
    prixUnitaireCHF: 14,
    notes: "Tarif par balle.",
  },
  {
    code: "fauchage",
    libelle: "Fauchage",
    categorie: MaterielCategorie.RECOLTE,
    unite: MaterielUnite.HA,
    prixUnitaireCHF: 95,
  },
  {
    code: "fanage",
    libelle: "Fanage / pirouette",
    categorie: MaterielCategorie.RECOLTE,
    unite: MaterielUnite.HA,
    prixUnitaireCHF: 55,
  },
  {
    code: "andainage",
    libelle: "Andainage",
    categorie: MaterielCategorie.RECOLTE,
    unite: MaterielUnite.HA,
    prixUnitaireCHF: 55,
  },
  {
    code: "arrachage-pdt",
    libelle: "Arrachage pommes de terre",
    categorie: MaterielCategorie.RECOLTE,
    unite: MaterielUnite.HA,
    prixUnitaireCHF: 580,
  },
  {
    code: "arrachage-betterave",
    libelle: "Arrachage betteraves",
    categorie: MaterielCategorie.RECOLTE,
    unite: MaterielUnite.HA,
    prixUnitaireCHF: 520,
  },

  // ----- Irrigation ------------------------------------------------------
  {
    code: "irrigation-enrouleur",
    libelle: "Irrigation (enrouleur)",
    categorie: MaterielCategorie.IRRIGATION,
    unite: MaterielUnite.H,
    prixUnitaireCHF: 38,
  },

  // ----- Transport -------------------------------------------------------
  {
    code: "transport-benne",
    libelle: "Transport benne (tracteur + remorque)",
    categorie: MaterielCategorie.TRANSPORT,
    unite: MaterielUnite.H,
    prixUnitaireCHF: 95,
  },
  {
    code: "autochargeuse",
    libelle: "Autochargeuse",
    categorie: MaterielCategorie.TRANSPORT,
    unite: MaterielUnite.H,
    prixUnitaireCHF: 145,
  },

  // ----- Autre -----------------------------------------------------------
  {
    code: "broyage-residus",
    libelle: "Broyage résidus de récolte",
    categorie: MaterielCategorie.AUTRE,
    unite: MaterielUnite.HA,
    prixUnitaireCHF: 120,
  },
  {
    code: "main-oeuvre",
    libelle: "Main d'œuvre (heure conducteur)",
    categorie: MaterielCategorie.AUTRE,
    unite: MaterielUnite.H,
    prixUnitaireCHF: 55,
    notes: "Tarif moyen Agridea — facturé en plus du matériel pour les ETA.",
  },
];

async function seed(): Promise<void> {
  for (const m of MATERIELS) {
    const data = {
      libelle: m.libelle,
      categorie: m.categorie,
      unite: m.unite,
      prixUnitaireCHF: m.prixUnitaireCHF ?? null,
      notes: m.notes ?? null,
      actif: true,
    };
    await prisma.materiel.upsert({
      where: { code: m.code },
      update: data,
      create: { tenantId: null, code: m.code, ...data },
    });
  }
  const counts = await prisma.materiel.groupBy({
    by: ["categorie"],
    where: { tenantId: null },
    _count: { _all: true },
  });
  console.log(`Catalogue Matériel global seeded — ${MATERIELS.length} entrées :`);
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
