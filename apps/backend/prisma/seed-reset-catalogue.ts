/**
 * Reset complet du catalogue Produits + Matériels (demande Fabien
 * 2026-05-06 : "supprime tous les produits et recrée une base
 * complète avec tous les travaux possibles ainsi que tous les
 * produits possibles pour l'agriculture").
 *
 * 1) DELETE Produit + Matériel (globaux + perso, tous tenants).
 *    Les Interventions/Travaux qui les référençaient gardent leur
 *    libellé/quantité/prix (snapshot dans LigneTravailProduit) — les
 *    relations sont en onDelete: SetNull.
 * 2) Re-run seed-materiels (33 prestations Agridea) +
 *    seed-produits (176 produits : semences, engrais, phytos…).
 * 3) Ajoute des prestations et produits supplémentaires pour couvrir
 *    le maximum d'opérations agricoles courantes en Suisse.
 *
 * Idempotent : on peut le rejouer, les upserts gèrent.
 *
 * Lancement : `pnpm db:seed:reset-catalogue` (à ajouter au package.json
 * une fois validé).
 */
import { execSync } from "node:child_process";
import {
  MaterielCategorie,
  MaterielUnite,
  PrismaClient,
  ProduitCategorie,
  ProduitUnite,
} from "@prisma/client";

const prisma = new PrismaClient();

// ─── Matériels supplémentaires (prestations) ──────────────────────────
// Complète seed-materiels.ts avec des opérations courantes manquantes.
interface SeedMateriel {
  code: string;
  libelle: string;
  categorie: MaterielCategorie;
  unite: MaterielUnite;
  prixUnitaireCHF: number | null;
  notes?: string;
}

const MATERIELS_EXTRA: SeedMateriel[] = [
  // Travail du sol — compléments
  {
    code: "MAT-TRAV-COVER-CROP",
    libelle: "Cover crop (déchaumeur à disques)",
    categorie: "TRAVAIL_DU_SOL",
    unite: "HA",
    prixUnitaireCHF: 90,
    notes: "Disques indépendants, ~10-15 cm, gestion résidus + adventices.",
  },
  {
    code: "MAT-TRAV-CULT-DENTS",
    libelle: "Cultivateur à dents (chisel)",
    categorie: "TRAVAIL_DU_SOL",
    unite: "HA",
    prixUnitaireCHF: 100,
    notes: "Travail superficiel 8-15 cm sans retourner.",
  },
  {
    code: "MAT-TRAV-ROUL-LISSE",
    libelle: "Roulage (rouleau lisse)",
    categorie: "TRAVAIL_DU_SOL",
    unite: "HA",
    prixUnitaireCHF: 35,
    notes: "Rouleau Cambridge ou lisse — rappuyage post-semis.",
  },
  {
    code: "MAT-TRAV-ROUL-CROSSKILL",
    libelle: "Roulage (Crosskill)",
    categorie: "TRAVAIL_DU_SOL",
    unite: "HA",
    prixUnitaireCHF: 40,
  },
  {
    code: "MAT-TRAV-SOUS-SOL",
    libelle: "Sous-solage (décompacteur lourd)",
    categorie: "TRAVAIL_DU_SOL",
    unite: "HA",
    prixUnitaireCHF: 165,
    notes: "Travail profond 35-45 cm sans retourner.",
  },
  // Semis & plantation — compléments
  {
    code: "MAT-SEM-PNEUM",
    libelle: "Semis céréales (semoir pneumatique)",
    categorie: "SEMIS",
    unite: "HA",
    prixUnitaireCHF: 145,
    notes: "Semoir pneumatique précision, idéal grandes parcelles.",
  },
  {
    code: "MAT-SEM-COMBINE",
    libelle: "Semis combiné (herse + semoir)",
    categorie: "SEMIS",
    unite: "HA",
    prixUnitaireCHF: 175,
    notes: "Préparation lit + semis en un passage.",
  },
  {
    code: "MAT-SEM-COLZA",
    libelle: "Semis colza (semoir précision)",
    categorie: "SEMIS",
    unite: "HA",
    prixUnitaireCHF: 155,
  },
  {
    code: "MAT-SEM-BETT",
    libelle: "Semis betteraves sucrières (semoir mono-graine)",
    categorie: "SEMIS",
    unite: "HA",
    prixUnitaireCHF: 160,
  },
  {
    code: "MAT-SEM-PRAIRIE",
    libelle: "Semis prairie (semoir herbe)",
    categorie: "SEMIS",
    unite: "HA",
    prixUnitaireCHF: 110,
  },
  {
    code: "MAT-SEM-DEROBEE",
    libelle: "Semis dérobée fourragère",
    categorie: "SEMIS",
    unite: "HA",
    prixUnitaireCHF: 95,
    notes: "Semis après moisson — interculture / engrais vert.",
  },
  // Fertilisation — compléments
  {
    code: "MAT-FERT-COMPOST",
    libelle: "Épandage compost",
    categorie: "FERTILISATION",
    unite: "T",
    prixUnitaireCHF: 12,
    notes: "Compost végétal ou de fumier — épandeur classique.",
  },
  {
    code: "MAT-FERT-LISIER-INJ",
    libelle: "Épandage lisier (injection)",
    categorie: "FERTILISATION",
    unite: "M3",
    prixUnitaireCHF: 19,
    notes: "Injection sous-sol — perte NH3 ~5% (cf Agridea 1.18).",
  },
  {
    code: "MAT-FERT-CHAULAGE",
    libelle: "Chaulage (épandeur centrifuge)",
    categorie: "FERTILISATION",
    unite: "T",
    prixUnitaireCHF: 18,
    notes: "Chaux vive ou carbonate — correction pH.",
  },
  // Protection — compléments
  {
    code: "MAT-PROT-DESHERB-MEC",
    libelle: "Désherbage mécanique (bineuse)",
    categorie: "PROTECTION",
    unite: "HA",
    prixUnitaireCHF: 75,
    notes: "Bineuse à dents ou à disques — Bio / IP-Suisse.",
  },
  {
    code: "MAT-PROT-HERSE-ETRILLE",
    libelle: "Herse étrille (post-levée)",
    categorie: "PROTECTION",
    unite: "HA",
    prixUnitaireCHF: 45,
  },
  {
    code: "MAT-PROT-PULV-CONFINE",
    libelle: "Pulvérisation confinée (anti-dérive)",
    categorie: "PROTECTION",
    unite: "HA",
    prixUnitaireCHF: 70,
    notes: "Buses anti-dérive 50% — exigé près des eaux de surface.",
  },
  // Récolte — compléments
  {
    code: "MAT-REC-ENS-MAIS",
    libelle: "Ensilage maïs (ensileuse automotrice)",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 420,
    notes: "Ensileuse 6 rangs + transport bord de champ inclus.",
  },
  {
    code: "MAT-REC-ENS-HERBE",
    libelle: "Ensilage herbe (ensileuse)",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 290,
  },
  {
    code: "MAT-REC-PRESS-CARRE",
    libelle: "Pressage balles carrées",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 180,
  },
  {
    code: "MAT-REC-MAIS-GRAIN",
    libelle: "Récolte maïs grain (moissonneuse + bec)",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 410,
  },
  {
    code: "MAT-REC-BROYAGE",
    libelle: "Broyage de cultures (couvert / résidus)",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 110,
  },
  // Irrigation — compléments
  {
    code: "MAT-IRR-PIVOT",
    libelle: "Irrigation pivot (rampe rotative)",
    categorie: "IRRIGATION",
    unite: "HA",
    prixUnitaireCHF: 65,
  },
  {
    code: "MAT-IRR-GOUTTE",
    libelle: "Irrigation goutte-à-goutte (pose système)",
    categorie: "IRRIGATION",
    unite: "HA",
    prixUnitaireCHF: 950,
    notes: "Pose initiale — réutilisable plusieurs années.",
  },
  // Transport — compléments
  {
    code: "MAT-TRANS-BENNE",
    libelle: "Transport benne 12-16 t (tracteur + remorque)",
    categorie: "TRANSPORT",
    unite: "H",
    prixUnitaireCHF: 95,
  },
  {
    code: "MAT-TRANS-ANIM",
    libelle: "Transport bétail (camion bétaillère)",
    categorie: "TRANSPORT",
    unite: "H",
    prixUnitaireCHF: 130,
  },
  // Autre — compléments
  {
    code: "MAT-AUT-CONSEIL",
    libelle: "Conseil agronomique (Agridea / privé)",
    categorie: "AUTRE",
    unite: "H",
    prixUnitaireCHF: 150,
  },
  {
    code: "MAT-AUT-MAINT",
    libelle: "Maintenance / atelier",
    categorie: "AUTRE",
    unite: "H",
    prixUnitaireCHF: 95,
  },
];

// ─── Produits supplémentaires (Biens) ─────────────────────────────────
interface SeedProduit {
  code: string;
  libelle: string;
  categorie: ProduitCategorie;
  unite: ProduitUnite;
  marque?: string;
  fournisseur?: string;
  especeCode?: string;
  tauxN?: number;
  tauxP?: number;
  tauxK?: number;
  prixVenteCHF?: number;
  notes?: string;
}

const PRODUITS_EXTRA: SeedProduit[] = [
  // Engrais minéraux supplémentaires
  {
    code: "ENG-MIN-NPK-15",
    libelle: "NPK 15-15-15 (équilibré)",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    tauxN: 15,
    tauxP: 15,
    tauxK: 15,
    prixVenteCHF: 850,
    notes: "Engrais polyvalent printemps — toutes cultures.",
  },
  {
    code: "ENG-MIN-NPK-12-12-17",
    libelle: "NPK 12-12-17 + 2 MgO",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    tauxN: 12,
    tauxP: 12,
    tauxK: 17,
    prixVenteCHF: 880,
    notes: "Riche en potasse + Mg — pour pommes de terre / vignes.",
  },
  {
    code: "ENG-MIN-UREE",
    libelle: "Urée 46% N",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    tauxN: 46,
    prixVenteCHF: 720,
    notes: "Engrais azoté concentré — perte volat. NH3 si non incorporé.",
  },
  {
    code: "ENG-MIN-AMMO",
    libelle: "Ammonitrate 27% N",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    tauxN: 27,
    prixVenteCHF: 690,
  },
  {
    code: "ENG-MIN-SULFAM",
    libelle: "Sulfate d'ammoniaque 21% N + 24% S",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    tauxN: 21,
    prixVenteCHF: 580,
  },
  {
    code: "ENG-MIN-KCL",
    libelle: "Chlorure de potasse 60% K2O",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    tauxK: 60,
    prixVenteCHF: 620,
  },
  {
    code: "ENG-MIN-PATENTKALI",
    libelle: "Patentkali 30 K + 10 Mg + 17 S",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    tauxK: 30,
    prixVenteCHF: 740,
  },
  {
    code: "ENG-MIN-SUPER",
    libelle: "Superphosphate triple 46% P2O5",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    tauxP: 46,
    prixVenteCHF: 850,
  },
  {
    code: "ENG-MIN-SOUFRE",
    libelle: "Soufre élémentaire 90%",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    prixVenteCHF: 480,
    notes: "Acidification + apport S — vignes, colza.",
  },
  // Engrais organiques supplémentaires
  {
    code: "ENG-ORG-FUM-BOVIN",
    libelle: "Fumier bovin solide",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "T",
    tauxN: 0.45,
    tauxP: 0.18,
    tauxK: 0.6,
    notes: "5-6 kg N/t. Référence Agridea 1.18.",
  },
  {
    code: "ENG-ORG-FUM-CHEVAL",
    libelle: "Fumier de cheval",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "T",
    tauxN: 0.5,
    tauxP: 0.22,
    tauxK: 0.7,
  },
  {
    code: "ENG-ORG-LIS-BOV",
    libelle: "Lisier bovin (8% MS)",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "M3",
    tauxN: 0.34,
    tauxP: 0.06,
    tauxK: 0.32,
    notes: "Référence 3.4 kg N/m³ (lisier moyen). Cf Agridea 1.18.",
  },
  {
    code: "ENG-ORG-LIS-PORC",
    libelle: "Lisier porc engraissement",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "M3",
    tauxN: 0.55,
    tauxP: 0.12,
    tauxK: 0.25,
    notes: "5.5 kg N/m³ — concentration élevée azote.",
  },
  {
    code: "ENG-ORG-COMPOST",
    libelle: "Compost végétal (15-25% MS)",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "T",
    tauxN: 0.7,
    tauxP: 0.3,
    tauxK: 0.8,
  },
  {
    code: "ENG-ORG-DIGESTAT",
    libelle: "Digestat de méthanisation (liquide)",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "M3",
    tauxN: 0.42,
    tauxP: 0.08,
    tauxK: 0.4,
  },
  {
    code: "ENG-ORG-VINASSE",
    libelle: "Vinasse de betterave (mélasse)",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "T",
    tauxN: 4,
    tauxK: 7,
    notes: "Sous-produit sucrerie — riche K.",
  },
  // Phytos — compléments courants
  {
    code: "PHY-HERB-GLYPHO",
    libelle: "Glyphosate 360 g/L (Roundup)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 14,
    notes: "Herbicide non-sélectif foliaire. Index OSAV W-7165.",
  },
  {
    code: "PHY-HERB-MCPA",
    libelle: "MCPA 750 g/L",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 22,
    notes: "Herbicide hormonal — céréales, prairies.",
  },
  {
    code: "PHY-HERB-BENTAZ",
    libelle: "Bentazone 480 g/L (Basagran)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 38,
  },
  {
    code: "PHY-FONG-AZOXY",
    libelle: "Azoxystrobine 250 g/L (Score équivalent)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 95,
    notes: "Fongicide systémique large spectre.",
  },
  {
    code: "PHY-FONG-CUIVRE",
    libelle: "Bouillie bordelaise (cuivre)",
    categorie: "PHYTO",
    unite: "KG",
    prixVenteCHF: 8,
    notes: "Fongicide minéral — Bio autorisé. Vignes, fruits.",
  },
  {
    code: "PHY-FONG-SOUFRE",
    libelle: "Soufre micronisé mouillable",
    categorie: "PHYTO",
    unite: "KG",
    prixVenteCHF: 5,
    notes: "Anti-oïdium — Bio autorisé.",
  },
  {
    code: "PHY-INSEC-DELTA",
    libelle: "Deltaméthrine 25 g/L (Decis)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 65,
  },
  {
    code: "PHY-INSEC-LAMBDA",
    libelle: "Lambda-cyhalothrine 100 g/L (Karaté Zeon)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 88,
  },
  // Autres consommables agricoles
  {
    code: "AUT-FICELLE",
    libelle: "Ficelle balles rondes",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 7,
  },
  {
    code: "AUT-BACHE-ENS",
    libelle: "Bâche d'ensilage 200 µm",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 4.5,
  },
  {
    code: "AUT-FILET-PROT",
    libelle: "Filet de protection (anti-grêle / oiseaux)",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 12,
  },
  {
    code: "AUT-CARB-AGRI",
    libelle: "Carburant agricole (diesel rouge)",
    categorie: "AUTRE",
    unite: "L",
    prixVenteCHF: 1.65,
  },
  {
    code: "AUT-LUB",
    libelle: "Huile moteur tracteur 15W-40",
    categorie: "AUTRE",
    unite: "L",
    prixVenteCHF: 8.5,
  },
];

async function purge() {
  console.log("🗑️  Suppression de TOUS les Produits et Matériels (globaux + perso)…");

  const delMateriels = await prisma.materiel.deleteMany({});
  console.log(`   ✓ ${delMateriels.count} matériels supprimés`);

  const delProduits = await prisma.produit.deleteMany({});
  console.log(`   ✓ ${delProduits.count} produits supprimés`);
}

async function reseedMateriels() {
  console.log("\n🌱 Re-seed des matériels (sous-process seed-materiels.ts)…");
  // On délègue à un sous-process pour isoler le client Prisma du seed
  // officiel (qui fait son propre $disconnect au top-level).
  execSync("pnpm tsx prisma/seed-materiels.ts", { stdio: "inherit" });

  // Ajouts complémentaires (idempotent : upsert par code).
  let added = 0;
  for (const m of MATERIELS_EXTRA) {
    await prisma.materiel.upsert({
      where: { code: m.code },
      update: {
        libelle: m.libelle,
        categorie: m.categorie,
        unite: m.unite,
        prixUnitaireCHF: m.prixUnitaireCHF,
        notes: m.notes ?? null,
      },
      create: {
        code: m.code,
        libelle: m.libelle,
        categorie: m.categorie,
        unite: m.unite,
        prixUnitaireCHF: m.prixUnitaireCHF,
        notes: m.notes ?? null,
        actif: true,
      },
    });
    added++;
  }
  console.log(`   ✓ ${added} matériels supplémentaires upsertés`);
}

async function reseedProduits() {
  console.log("\n🌱 Re-seed des produits (sous-process seed-produits.ts)…");
  execSync("pnpm tsx prisma/seed-produits.ts", { stdio: "inherit" });

  let added = 0;
  for (const p of PRODUITS_EXTRA) {
    await prisma.produit.upsert({
      where: { code: p.code },
      update: {
        libelle: p.libelle,
        categorie: p.categorie,
        unite: p.unite,
        marque: p.marque ?? null,
        fournisseur: p.fournisseur ?? null,
        especeCode: p.especeCode ?? null,
        tauxN: p.tauxN ?? null,
        tauxP: p.tauxP ?? null,
        tauxK: p.tauxK ?? null,
        prixVenteCHF: p.prixVenteCHF ?? null,
        notes: p.notes ?? null,
      },
      create: {
        code: p.code,
        libelle: p.libelle,
        categorie: p.categorie,
        unite: p.unite,
        marque: p.marque ?? null,
        fournisseur: p.fournisseur ?? null,
        especeCode: p.especeCode ?? null,
        tauxN: p.tauxN ?? null,
        tauxP: p.tauxP ?? null,
        tauxK: p.tauxK ?? null,
        prixVenteCHF: p.prixVenteCHF ?? null,
        notes: p.notes ?? null,
        actif: true,
      },
    });
    added++;
  }
  console.log(`   ✓ ${added} produits supplémentaires upsertés`);
}

async function main() {
  console.log("══════════════════════════════════════════════════════════");
  console.log(" Reset catalogue Agri Qodo — Produits + Matériels");
  console.log("══════════════════════════════════════════════════════════");

  await purge();
  await reseedMateriels();
  await reseedProduits();

  const totalMat = await prisma.materiel.count();
  const totalProd = await prisma.produit.count();
  console.log("\n══════════════════════════════════════════════════════════");
  console.log(` ✓ Catalogue final : ${totalMat} matériels · ${totalProd} produits`);
  console.log("══════════════════════════════════════════════════════════");
}

main()
  .catch((e) => {
    console.error("✗ Erreur reset catalogue :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
