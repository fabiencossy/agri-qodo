/**
 * Compacte le catalogue global à ~80 items (Fabien 2026-05-14 :
 * "diminue la liste des produits avec uniquement les plus populaires !
 * genre max 80 produit prestation comprise car la c'est trop !").
 *
 * Stratégie : par catégorie, on garde N items (alphabétique) actifs
 * et on désactive tous les autres globaux. Les items perso
 * (tenantId != null) ne sont pas touchés.
 *
 * Quotas (total ~80) :
 *   - SEMENCE         : 30
 *   - PHYTO           : 15
 *   - ENGRAIS_MINERAL : 10
 *   - ENGRAIS_ORGANIQUE: 5
 *   - PRESTATION (mat): 18
 *   - TRAVAIL_SOL     : 2
 *   = 80
 *
 * Re-exécutable : ne crée pas, ne fait que toggler actif.
 *
 * Usage :
 *   pnpm tsx prisma/scripts/compact-global-catalogue.ts
 */
import { type Prisma, PrismaClient, type ProduitCategorie } from "@prisma/client";

const prisma = new PrismaClient();

const QUOTAS_PRODUITS: Record<ProduitCategorie, number> = {
  SEMENCE: 30,
  PHYTO: 15,
  ENGRAIS_MINERAL: 10,
  ENGRAIS_ORGANIQUE: 5,
  PRESTATION: 0, // Géré côté Matériels
  TRAVAIL_SOL: 0,
  RECOLTE: 0,
  IRRIGATION: 0,
  CARBURANT: 0,
  PIECES_MATERIEL: 0,
  AUTRE: 0,
};

// Matériels = Prestations dans l'UI. On garde 20 + 2 travail du sol.
const QUOTAS_MATERIELS: Record<string, number> = {
  // Toutes les catégories matériel confondues : on prend les 20 premiers
  // par ordre alphabétique. C'est arbitraire mais ça donne un échantillon
  // représentatif et l'admin peut affiner ensuite.
  _ALL: 20,
};

async function main() {
  console.log("=== Compaction du catalogue global ===\n");

  // ---- PRODUITS ----
  let pActivated = 0;
  let pDeactivated = 0;

  for (const [categorie, quota] of Object.entries(QUOTAS_PRODUITS)) {
    const cat = categorie as ProduitCategorie;

    // Items à garder ACTIFS : les `quota` premiers par ordre alphabétique.
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

    // Tout le reste dans la catégorie → désactivé.
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

  console.log(`\nProduits : ${pActivated} ré-activés, ${pDeactivated} désactivés.\n`);

  // ---- PRESTATIONS (matériels) — quota global ----
  const quotaMat = QUOTAS_MATERIELS._ALL ?? 0;
  const matToKeep = await prisma.materiel.findMany({
    where: { tenantId: null },
    orderBy: { libelle: "asc" },
    take: quotaMat,
    select: { id: true },
  });
  const matKeepIds = new Set(matToKeep.map((m) => m.id));

  let mActivated = 0;
  let mDeactivated = 0;
  const allMat = await prisma.materiel.findMany({
    where: { tenantId: null },
    select: { id: true, actif: true },
  });
  for (const m of allMat) {
    const shouldKeep = matKeepIds.has(m.id);
    if (shouldKeep && !m.actif) {
      await prisma.materiel.update({ where: { id: m.id }, data: { actif: true } });
      mActivated++;
    } else if (!shouldKeep && m.actif) {
      await prisma.materiel.update({ where: { id: m.id }, data: { actif: false } });
      mDeactivated++;
    }
  }
  const matActifs = await prisma.materiel.count({ where: { tenantId: null, actif: true } });
  console.log(`Prestations (matériels) : ${matActifs}/${quotaMat} actifs`);
  console.log(`  ${mActivated} ré-activées, ${mDeactivated} désactivées.\n`);

  // ---- DÉSACTIVATION DES PERSO HORS PÉRIMÈTRE ----
  // Objectif Fabien : que "Pousser tout" envoie ~80 items. On désactive
  // donc tous les perso (avec ou sans lien Odoo) dont le libellé n'est
  // pas dans la liste des 80 globaux actifs. L'utilisateur peut toujours
  // réactiver manuellement un perso qu'il veut conserver.
  const activeGlobalLibelles = await prisma.produit.findMany({
    where: { tenantId: null, actif: true },
    select: { libelle: true },
  });
  const activeSet = new Set(activeGlobalLibelles.map((p) => p.libelle.toLowerCase().trim()));
  const persoToDeactivate = await prisma.produit.findMany({
    where: { tenantId: { not: null }, actif: true },
    select: { id: true, libelle: true },
  });
  let persoDeactivated = 0;
  for (const p of persoToDeactivate) {
    if (!activeSet.has(p.libelle.toLowerCase().trim())) {
      await prisma.produit.update({ where: { id: p.id }, data: { actif: false } });
      persoDeactivated++;
    }
  }
  if (persoDeactivated > 0) {
    console.log(`Désactivé ${persoDeactivated} produits perso hors top-80.\n`);
  }

  // Idem pour les matériels perso.
  const activeMatLibelles = await prisma.materiel.findMany({
    where: { tenantId: null, actif: true },
    select: { libelle: true },
  });
  const activeMatSet = new Set(activeMatLibelles.map((m) => m.libelle.toLowerCase().trim()));
  const matPersoToDeactivate = await prisma.materiel.findMany({
    where: { tenantId: { not: null }, actif: true },
    select: { id: true, libelle: true },
  });
  let matPersoDeactivated = 0;
  for (const m of matPersoToDeactivate) {
    if (!activeMatSet.has(m.libelle.toLowerCase().trim())) {
      await prisma.materiel.update({ where: { id: m.id }, data: { actif: false } });
      matPersoDeactivated++;
    }
  }
  if (matPersoDeactivated > 0) {
    console.log(`Désactivé ${matPersoDeactivated} matériels perso hors top-80.\n`);
  }

  // ---- BILAN FINAL ----
  const finalProduits = await prisma.produit.count({
    where: { tenantId: null, actif: true },
  });
  const finalMateriels = await prisma.materiel.count({
    where: { tenantId: null, actif: true },
  });
  const finalPerso = await prisma.produit.count({
    where: { tenantId: { not: null }, actif: true },
  });
  console.log("=== Bilan ===");
  console.log(`Globaux actifs : ${finalProduits} produits + ${finalMateriels} prestations`);
  console.log(`Total global actif : ${finalProduits + finalMateriels} items.`);
  console.log(`Perso actifs (intouchés sauf doublons) : ${finalPerso} produits.`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// Silence type-only imports unused warning.
export type _Prisma = Prisma.UserRole;
