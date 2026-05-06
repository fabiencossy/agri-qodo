/**
 * Sync complète Agri Qodo → Odoo (demande Fabien 2026-05-06 :
 * "j'ai supprimé tout dans Odoo, fais la sync de A à Z").
 *
 * Pour chaque tenant qui a une config Odoo active :
 *   1) Reset des odooProductId locaux sur Produit + Matériel persos
 *      (les références Odoo ne sont plus valides puisque vidé côté Odoo).
 *   2) Boucle sur tous les Produit perso du tenant → create
 *      product.product type=consu côté Odoo, mémorise l'id.
 *   3) Boucle sur tous les Matériel perso → create product.product
 *      type=service avec uom_id, expense_policy=no.
 *
 * Usage : pnpm tsx scripts/sync-all-to-odoo.ts
 *
 * Note : ne réimporte PAS les globaux (ils restent globaux ; ils ne
 * seront poussés que quand Fabien clique "Pousser" dessus, ce qui
 * crée un perso). Le seed-reset-catalogue restitue les globaux ; ce
 * script ne touche qu'aux persos d'un tenant.
 */
import { createOdooClient, type OdooClient } from "@agri-qodo/odoo-client";
import { PrismaClient, ProduitUnite, MaterielUnite } from "@prisma/client";
import { createDecipheriv } from "node:crypto";

const prisma = new PrismaClient();

// Réplique de EncryptionService.decrypt — on n'a pas besoin de tout
// le contexte Nest pour un script CLI standalone.
const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
function decryptApiKey(payload: string): string {
  const raw = process.env.ODOO_CREDENTIALS_KEY;
  if (!raw) throw new Error("ODOO_CREDENTIALS_KEY manquante dans .env");
  const key = Buffer.from(raw, "hex");
  const buf = Buffer.from(payload, "base64url");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

// ─── UOM resolution (mêmes mappings que les services Nest) ────────────
const PRODUIT_UOM_CANDIDATES: Record<ProduitUnite, string[]> = {
  KG: ["kg", "Kilogramme(s)", "Kilogramme"],
  T: ["Tonne(s)", "Tonne", "t"],
  L: ["L", "Litre(s)", "Litre"],
  M3: ["m³", "m3", "Mètre(s) cube", "Mètre cube"],
  DOSE: ["Dose(s)", "Dose"],
};
const MATERIEL_UOM_CANDIDATES: Record<MaterielUnite, string[]> = {
  HA: ["Hectare(s)", "Hectare", "ha"],
  M3: ["m³", "m3", "Mètre(s) cube", "Mètre cube"],
  T: ["Tonne(s)", "Tonne", "t"],
  H: ["Heure(s)", "Heure", "hour", "h"],
  FORFAIT: ["Unité(s)", "Units", "Unit"],
};

const uomCacheBien = new Map<string, number>();
const uomCachePresta = new Map<string, number>();

async function resolveUomBien(client: OdooClient, u: ProduitUnite): Promise<number | undefined> {
  const c = uomCacheBien.get(u);
  if (c !== undefined) return c || undefined;
  for (const name of PRODUIT_UOM_CANDIDATES[u]) {
    try {
      const found = await client.searchRead<{ id: number }>("uom.uom", [["name", "=", name]], {
        fields: ["id"],
        limit: 1,
      });
      if (found[0]) {
        uomCacheBien.set(u, found[0].id);
        return found[0].id;
      }
    } catch {
      // continue
    }
  }
  uomCacheBien.set(u, 0);
  return undefined;
}
async function resolveUomPresta(client: OdooClient, u: MaterielUnite): Promise<number | undefined> {
  const c = uomCachePresta.get(u);
  if (c !== undefined) return c || undefined;
  for (const name of MATERIEL_UOM_CANDIDATES[u]) {
    try {
      const found = await client.searchRead<{ id: number }>("uom.uom", [["name", "=", name]], {
        fields: ["id"],
        limit: 1,
      });
      if (found[0]) {
        uomCachePresta.set(u, found[0].id);
        return found[0].id;
      }
    } catch {
      // continue
    }
  }
  uomCachePresta.set(u, 0);
  return undefined;
}

async function syncTenant(tenantId: string, nom: string): Promise<void> {
  const tenant = await prisma.exploitation.findUnique({
    where: { id: tenantId },
    select: { odooUrl: true, odooDb: true, odooUsername: true, odooApiKeyEncrypted: true },
  });
  if (!tenant?.odooUrl || !tenant.odooDb || !tenant.odooUsername || !tenant.odooApiKeyEncrypted) {
    console.log(`  ⊘ ${nom}: pas de config Odoo, skip`);
    return;
  }

  const apiKey = decryptApiKey(tenant.odooApiKeyEncrypted);
  const client = createOdooClient({
    url: tenant.odooUrl,
    database: tenant.odooDb,
    username: tenant.odooUsername,
    apiKey,
  });

  console.log(`\n━━━━━ ${nom} (${tenant.odooUrl}) ━━━━━`);

  // 1) Reset odooProductId perso (Odoo a été vidé).
  const resetProd = await prisma.produit.updateMany({
    where: { tenantId, odooProductId: { not: null } },
    data: { odooProductId: null, odooSyncedAt: null },
  });
  const resetMat = await prisma.materiel.updateMany({
    where: { tenantId, odooProductId: { not: null } },
    data: { odooProductId: null, odooSyncedAt: null },
  });
  console.log(`  Reset : ${resetProd.count} produits + ${resetMat.count} matériels remis à null`);

  // 2) Duplique chaque GLOBAL en perso pour ce tenant, puis push tout.
  // Les globaux sont read-only — on doit avoir une copie perso pour
  // pouvoir y stocker odooProductId.
  const allGlobauxBien = await prisma.produit.findMany({
    where: { tenantId: null, actif: true },
  });
  let dupBien = 0;
  for (const g of allGlobauxBien) {
    const exists = await prisma.produit.findFirst({
      where: { tenantId, libelle: g.libelle, categorie: g.categorie },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.produit.create({
      data: {
        tenantId,
        code: `t-${tenantId.slice(0, 8)}-${Date.now().toString(36)}-${g.code.slice(0, 40)}`,
        libelle: g.libelle,
        categorie: g.categorie,
        unite: g.unite,
        marque: g.marque,
        fournisseur: g.fournisseur,
        especeCode: g.especeCode,
        tauxN: g.tauxN,
        tauxP: g.tauxP,
        tauxK: g.tauxK,
        prixVenteCHF: g.prixVenteCHF,
        notes: g.notes,
        actif: true,
      },
    });
    dupBien++;
  }
  if (dupBien > 0) console.log(`  ${dupBien} produits globaux dupliqués en perso`);

  const produits = await prisma.produit.findMany({
    where: { tenantId, actif: true },
    orderBy: { libelle: "asc" },
  });
  console.log(`  Produits à pousser : ${produits.length}`);
  let pOk = 0,
    pKo = 0;
  for (const p of produits) {
    try {
      const uomId = await resolveUomBien(client, p.unite);
      const defaultCode = `AQ-${p.code}`;
      // Re-lookup d'abord par default_code (en cas de re-run après
      // erreur partielle, on réutilise les products déjà créés).
      let odooId: number | undefined;
      const found = await client.searchRead<{ id: number }>(
        "product.product",
        [["default_code", "=", defaultCode]],
        { fields: ["id"], limit: 1 },
      );
      if (found[0]) odooId = found[0].id;
      if (!odooId) {
        odooId = await client.create("product.product", {
          name: p.libelle,
          type: "consu",
          list_price: p.prixVenteCHF ? Number(p.prixVenteCHF) : 0,
          default_code: defaultCode,
          ...(uomId ? { uom_id: uomId } : {}),
        });
      }
      await prisma.produit.update({
        where: { id: p.id },
        data: { odooProductId: odooId, odooSyncedAt: new Date() },
      });
      pOk++;
      if (pOk % 20 === 0) console.log(`    … ${pOk} produits poussés`);
    } catch (err) {
      pKo++;
      console.error(`    ✗ ${p.libelle}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`  ✓ Produits : ${pOk} OK · ${pKo} échecs`);

  // 3) Duplique GLOBAUX matériels en perso, puis push.
  const allGlobauxPresta = await prisma.materiel.findMany({
    where: { tenantId: null, actif: true },
  });
  let dupPresta = 0;
  for (const g of allGlobauxPresta) {
    const exists = await prisma.materiel.findFirst({
      where: { tenantId, libelle: g.libelle, categorie: g.categorie },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.materiel.create({
      data: {
        tenantId,
        code: `t-${tenantId.slice(0, 8)}-${Date.now().toString(36)}-${g.code.slice(0, 40)}`,
        libelle: g.libelle,
        categorie: g.categorie,
        unite: g.unite,
        prixUnitaireCHF: g.prixUnitaireCHF,
        notes: g.notes,
        actif: true,
      },
    });
    dupPresta++;
  }
  if (dupPresta > 0) console.log(`  ${dupPresta} matériels globaux dupliqués en perso`);

  const materiels = await prisma.materiel.findMany({
    where: { tenantId, actif: true },
    orderBy: { libelle: "asc" },
  });
  console.log(`  Matériels à pousser : ${materiels.length}`);
  let mOk = 0,
    mKo = 0;
  for (const m of materiels) {
    try {
      const uomId = await resolveUomPresta(client, m.unite);
      const defaultCode = `AQ-${m.code}`;
      let odooId: number | undefined;
      const found = await client.searchRead<{ id: number }>(
        "product.product",
        [["default_code", "=", defaultCode]],
        { fields: ["id"], limit: 1 },
      );
      if (found[0]) odooId = found[0].id;
      if (!odooId) {
        odooId = await client.create("product.product", {
          name: m.libelle,
          type: "service",
          list_price: m.prixUnitaireCHF ? Number(m.prixUnitaireCHF) : 0,
          default_code: defaultCode,
          expense_policy: "no",
          ...(uomId ? { uom_id: uomId } : {}),
        });
      }
      await prisma.materiel.update({
        where: { id: m.id },
        data: { odooProductId: odooId, odooSyncedAt: new Date() },
      });
      mOk++;
      if (mOk % 20 === 0) console.log(`    … ${mOk} matériels poussés`);
    } catch (err) {
      mKo++;
      console.error(`    ✗ ${m.libelle}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`  ✓ Matériels : ${mOk} OK · ${mKo} échecs`);
}

async function main() {
  console.log("══════════════════════════════════════════════════════════");
  console.log(" Sync complète Agri Qodo → Odoo");
  console.log("══════════════════════════════════════════════════════════");

  const tenants = await prisma.exploitation.findMany({
    where: { odooUrl: { not: null }, odooApiKeyEncrypted: { not: null } },
    select: { id: true, nom: true },
  });
  console.log(`\nTenants avec config Odoo : ${tenants.length}`);

  for (const t of tenants) {
    await syncTenant(t.id, t.nom);
  }

  console.log("\n══════════════════════════════════════════════════════════");
  console.log(" Sync terminée");
  console.log("══════════════════════════════════════════════════════════");
}

main()
  .catch((e) => {
    console.error("✗ Erreur :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
