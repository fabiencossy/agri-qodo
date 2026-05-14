/**
 * Compacte le catalogue global à ~80 items représentatifs.
 *
 * Fabien 2026-05-14 : "diminue la liste des produits avec uniquement
 * les plus populaires ! genre max 80 produit prestation comprise"
 * puis "mets au moins les produit pour ceci ! donc semis etc" — donc
 * couvrir toutes les espèces principales (1 variété par espèce courante)
 * plutôt qu'une liste alphabétique qui surreprésente les "Blé X".
 *
 * Stratégie :
 *  - SEMENCE : 1 variété représentative par espèce courante (≈25)
 *  - PHYTO : 15 plus communs
 *  - ENGRAIS_MINERAL : 10
 *  - ENGRAIS_ORGANIQUE : 5
 *  - PRESTATION (mat) : 20
 *  = ~75 items
 *
 * Les items perso (tenantId != null) hors top sont désactivés pour
 * que "Pousser tout" envoie une liste propre.
 *
 * Re-exécutable, ne crée pas de produit. Idempotent.
 *
 * Usage :
 *   pnpm tsx prisma/scripts/compact-global-catalogue.ts
 */
import { PrismaClient, type ProduitCategorie } from "@prisma/client";

const prisma = new PrismaClient();

// Espèces que Fabien va probablement cultiver — sélection plaine
// suisse (Vaud / Fribourg). 1 variété représentative par espèce.
const ESPECES_COURANTES: string[] = [
  // Céréales d'automne
  "ble_panifiable",
  "ble_fourrager",
  "orge",
  "avoine",
  "seigle",
  "triticale",
  "epeautre",
  "EPE",
  // Maïs
  "mais_grain",
  "mais_ensilage",
  // Oléagineux
  "colza",
  "tournesol",
  "soja",
  "lin",
  // Protéagineux
  "pois_proteagineux",
  "feverole",
  "lupin",
  // Tubercules / sucre
  "pomme_de_terre",
  "PDT",
  "betterave_sucre",
  "betterave_fourragere",
  // Fourrages
  "luzerne",
  "trefle_violet",
  "trefle_blanc",
  "trefle_incarnat",
  "dactyle",
  "fetuque",
  "ray_grass",
  // Prairies
  "prairie_temporaire",
  "prairie_permanente",
  "prairie_extensive",
  "paturage_intensif",
  // Couverts végétaux
  "phacelie",
  "vesce",
  "moutarde_fourragere",
  "VES",
  // Codes courts (2-3 lettres) parfois utilisés
  "BES",
  "SOR",
];

const QUOTAS: Record<ProduitCategorie, number> = {
  SEMENCE: 0, // Géré par espece_code ci-dessous
  PHYTO: 15,
  ENGRAIS_MINERAL: 10,
  ENGRAIS_ORGANIQUE: 5,
  PRESTATION: 0,
  TRAVAIL_SOL: 0,
  RECOLTE: 0,
  IRRIGATION: 0,
  CARBURANT: 0,
  PIECES_MATERIEL: 0,
  AUTRE: 0,
};

const QUOTA_MATERIELS = 20;

async function main() {
  console.log("=== Compaction du catalogue global ===\n");

  // ---- SEMENCES : 1 variété par espèce courante ----
  console.log("SEMENCES (1 par espèce courante) :");
  const semencesActivees: string[] = [];
  for (const esp of ESPECES_COURANTES) {
    const top = await prisma.produit.findFirst({
      where: { tenantId: null, categorie: "SEMENCE", especeCode: esp },
      orderBy: { libelle: "asc" },
      select: { id: true, libelle: true },
    });
    if (top) {
      await prisma.produit.update({ where: { id: top.id }, data: { actif: true } });
      semencesActivees.push(top.id);
      console.log(`  ✓ ${esp.padEnd(28)} → ${top.libelle}`);
    } else {
      console.log(`  · ${esp.padEnd(28)} → (aucune en base, skip)`);
    }
  }
  const keepSemence = new Set(semencesActivees);
  // Désactiver toutes les autres semences globales.
  const allSemences = await prisma.produit.findMany({
    where: { tenantId: null, categorie: "SEMENCE" },
    select: { id: true, actif: true },
  });
  let semDeact = 0;
  for (const s of allSemences) {
    if (!keepSemence.has(s.id) && s.actif) {
      await prisma.produit.update({ where: { id: s.id }, data: { actif: false } });
      semDeact++;
    }
  }
  console.log(`  → ${semencesActivees.length} actives, ${semDeact} désactivées.\n`);

  // ---- AUTRES CATÉGORIES PRODUITS : quota alphabétique ----
  let pActivated = 0;
  let pDeactivated = 0;
  for (const [categorie, quota] of Object.entries(QUOTAS)) {
    const cat = categorie as ProduitCategorie;
    if (cat === "SEMENCE") continue; // déjà traité
    const toKeep =
      quota > 0
        ? await prisma.produit.findMany({
            where: { tenantId: null, categorie: cat },
            orderBy: { libelle: "asc" },
            take: quota,
            select: { id: true },
          })
        : [];
    const keepIds = new Set(toKeep.map((p) => p.id));
    const allInCat = await prisma.produit.findMany({
      where: { tenantId: null, categorie: cat },
      select: { id: true, actif: true },
    });
    for (const p of allInCat) {
      const shouldKeep = keepIds.has(p.id);
      if (shouldKeep && !p.actif) {
        await prisma.produit.update({ where: { id: p.id }, data: { actif: true } });
        pActivated++;
      } else if (!shouldKeep && p.actif) {
        await prisma.produit.update({ where: { id: p.id }, data: { actif: false } });
        pDeactivated++;
      }
    }
    const actifsCat = await prisma.produit.count({
      where: { tenantId: null, categorie: cat, actif: true },
    });
    console.log(`  ${cat.padEnd(20)} : ${actifsCat}/${quota} actifs`);
  }
  console.log(`\nAutres catégories : ${pActivated} ré-activés, ${pDeactivated} désactivés.\n`);

  // ---- PRESTATIONS (matériels) ----
  const matToKeep = await prisma.materiel.findMany({
    where: { tenantId: null },
    orderBy: { libelle: "asc" },
    take: QUOTA_MATERIELS,
    select: { id: true },
  });
  const matKeepIds = new Set(matToKeep.map((m) => m.id));
  let mAct = 0;
  let mDeact = 0;
  const allMat = await prisma.materiel.findMany({
    where: { tenantId: null },
    select: { id: true, actif: true },
  });
  for (const m of allMat) {
    const keep = matKeepIds.has(m.id);
    if (keep && !m.actif) {
      await prisma.materiel.update({ where: { id: m.id }, data: { actif: true } });
      mAct++;
    } else if (!keep && m.actif) {
      await prisma.materiel.update({ where: { id: m.id }, data: { actif: false } });
      mDeact++;
    }
  }
  console.log(`Prestations : ${mAct} ré-activées, ${mDeact} désactivées.\n`);

  // ---- DÉSACTIVATION DES PERSO HORS TOP ----
  const activeGlobals = await prisma.produit.findMany({
    where: { tenantId: null, actif: true },
    select: { libelle: true },
  });
  const activeSet = new Set(activeGlobals.map((p) => p.libelle.toLowerCase().trim()));
  const persoToDeac = await prisma.produit.findMany({
    where: { tenantId: { not: null }, actif: true },
    select: { id: true, libelle: true },
  });
  let persoDeac = 0;
  for (const p of persoToDeac) {
    if (!activeSet.has(p.libelle.toLowerCase().trim())) {
      await prisma.produit.update({ where: { id: p.id }, data: { actif: false } });
      persoDeac++;
    }
  }
  if (persoDeac > 0) console.log(`Perso désactivés (hors top) : ${persoDeac}`);

  const activeMatGlobals = await prisma.materiel.findMany({
    where: { tenantId: null, actif: true },
    select: { libelle: true },
  });
  const activeMatSet = new Set(activeMatGlobals.map((m) => m.libelle.toLowerCase().trim()));
  const matPersoToDeac = await prisma.materiel.findMany({
    where: { tenantId: { not: null }, actif: true },
    select: { id: true, libelle: true },
  });
  let matPersoDeac = 0;
  for (const m of matPersoToDeac) {
    if (!activeMatSet.has(m.libelle.toLowerCase().trim())) {
      await prisma.materiel.update({ where: { id: m.id }, data: { actif: false } });
      matPersoDeac++;
    }
  }
  if (matPersoDeac > 0) console.log(`Matériels perso désactivés : ${matPersoDeac}\n`);

  // ---- BILAN ----
  const finalGlobal = await prisma.produit.count({ where: { tenantId: null, actif: true } });
  const finalGlobalMat = await prisma.materiel.count({ where: { tenantId: null, actif: true } });
  console.log("=== Bilan ===");
  console.log(`Globaux actifs : ${finalGlobal} produits + ${finalGlobalMat} prestations`);
  console.log(`Total : ${finalGlobal + finalGlobalMat} items.`);

  // Détail par catégorie pour vérif visuelle.
  console.log("\nDétail par catégorie (globaux actifs) :");
  const byCateg = await prisma.produit.groupBy({
    by: ["categorie"],
    where: { tenantId: null, actif: true },
    _count: true,
  });
  for (const c of byCateg) {
    console.log(`  ${c.categorie.padEnd(20)} : ${c._count}`);
  }
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
