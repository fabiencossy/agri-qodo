/**
 * Bilan de fumure exploitation — Suisse-Bilanz simplifié.
 *
 * Norme de référence : OEngrais 2024 (RS 916.171), méthode Suisse-Bilanz
 * v1.16 (Office fédéral de l'agriculture / Agroscope).
 *
 * Le bilan complet officiel comporte 3 modules :
 *   1. Bilan d'apport (besoins des cultures × surface)
 *   2. Bilan de fourniture (excrétions des animaux + engrais importés +
 *      résidus culturaux + apports atmosphériques)
 *   3. Bilan de transferts (DIGIFLUX — engrais de ferme exportés / importés)
 *
 * Le solde du bilan doit être < +10% des besoins N et P pour être conforme.
 * Au-dessus, l'exploitation est en sur-fertilisation et doit être déclarée.
 *
 * Pour le MVP, on couvre les modules 1 et 2 ; les transferts DIGIFLUX sont
 * un champ libre dans `FertilizerExportInput`.
 */

import type { ParcelDetail } from '../parcellaire/parcellaire.mocks';
import type { Intervention } from '../carnet/carnet.types';
import type { AssolementSegment } from '../assolement/assolement.types';
import type { LivestockEntry } from '../troupeau/livestock.types';
import { balanceForFarm } from '../troupeau/livestock.helpers';
import { cultureNeeds } from './fumure.helpers';
import { getProductById } from '../products/products.store';

/**
 * Coefficients d'efficacité 1re année pour les effluents bovins (lisier &
 * fumier) selon Suisse-Bilanz. Saisonnier — moyenne annuelle pondérée
 * appliquée ici pour rester simple (50% lisier / 35% fumier frais / 20%
 * fumier composté / 15% compost / 60% fientes volailles).
 *
 * Source : OEngrais 2024 Annexe 3 + Agroscope DBF 2017 chapitre 6.
 */
export const ORGANIC_FIRST_YEAR_EFFICIENCY = {
  lisier: 0.5,
  'fumier-frais': 0.35,
  'fumier-composté': 0.2,
  fientes: 0.6,
  compost: 0.15,
} as const;

/**
 * Apport atmosphérique d'azote (déposition humide + sèche) — Suisse plateau.
 * Source : OFEV 2018, données régionales. ~15-20 kg N/ha/an.
 */
export const ATMOSPHERIC_N_KG_HA = 17;

/**
 * Limite légale UGB par ha SAU (OPD art. 47).
 * 3.0 UGB/ha SAU en zone de plaine, plus restrictif en montagne.
 */
export const UGB_HA_LIMIT_PLAIN = 3.0;

/** Type d'effluent importé via DIGIFLUX — détermine le coefficient d'efficacité. */
export type ImportedManureType = keyof typeof ORGANIC_FIRST_YEAR_EFFICIENCY;

export interface FertilizerImportInput {
  /** Quantité totale d'azote minéral importé (kg N/an). */
  mineralNitrogenKg: number;
  /** Phosphore minéral (kg P₂O₅/an). */
  mineralPhosphorusKg: number;
  /** Potassium minéral (kg K₂O/an). */
  mineralPotassiumKg: number;
  /** Engrais organiques importés (DIGIFLUX IN) — kg N/an. */
  importedOrganicNitrogenKg: number;
  /** Type d'effluent importé — détermine le coefficient d'efficacité 1re année. */
  importedOrganicManureType: ImportedManureType;
  /** Engrais organiques exportés (DIGIFLUX OUT) — kg N/an. */
  exportedOrganicNitrogenKg: number;
}

export interface SuisseBilanzNeedsRow {
  culture: string;
  surfaceHa: number;
  nKgHa: number;
  pKgHa: number;
  kKgHa: number;
  nKgTotal: number;
  pKgTotal: number;
  kKgTotal: number;
}

export interface SuisseBilanzSupplyBreakdown {
  /** N disponible 1re année issu des effluents troupeau (kg). */
  livestockManureNKgAvailable: number;
  /** N brut issu des effluents (avant coefficient). */
  livestockManureNKgGross: number;
  /** N atmosphérique (déposition × SAU). */
  atmosphericNKg: number;
  /** N résidus culturaux (légumineuses, prairies détruites). */
  residualNKg: number;
  /** N minéral importé. */
  mineralNKg: number;
  /** N organique importé (DIGIFLUX IN, après coefficient). */
  importedOrganicNKgAvailable: number;
  /** N organique exporté (DIGIFLUX OUT). */
  exportedOrganicNKg: number;
}

export interface SuisseBilanzResult {
  campaign: number;
  /** Surface agricole utile (somme des surfaces actives). */
  sauHa: number;
  /** Charge UGB par ha. */
  ugbPerHa: number;
  /** Détail des besoins par culture (parcelles actives). */
  needs: ReadonlyArray<SuisseBilanzNeedsRow>;
  /** Total des besoins. */
  totalNeeds: { nKg: number; pKg: number; kKg: number };
  /** Décomposition des apports en azote. */
  supplyN: SuisseBilanzSupplyBreakdown;
  /** Total des apports disponibles 1re année (kg). */
  totalSupply: { nKg: number; pKg: number; kKg: number };
  /** Solde = apports - besoins (positif = excédent, négatif = manque). */
  balance: { nKg: number; pKg: number; kKg: number };
  /** Taux de couverture (apports / besoins) en %. */
  coverage: { n: number; p: number; k: number };
  /** Statut de conformité Suisse-Bilanz (limite : ±10%). */
  compliance: {
    n: 'conforme' | 'sous-fertilisation' | 'sur-fertilisation';
    p: 'conforme' | 'sous-fertilisation' | 'sur-fertilisation';
  };
  /** Liste des warnings & alertes. */
  warnings: ReadonlyArray<string>;
}

/**
 * Trouve la culture active pour une parcelle à une date donnée (campagne).
 * On prend le segment qui couvre la mi-saison (1er juillet).
 */
function activeCultureForCampaign(
  parcelId: string,
  campaign: number,
  segments: ReadonlyArray<AssolementSegment>,
): string | undefined {
  const midSeason = `${campaign}-07-01`;
  const candidate = segments.find(
    (s) => s.parcelId === parcelId && s.startDate <= midSeason && s.endDate >= midSeason,
  );
  return candidate?.culture;
}

/**
 * Décompose les apports d'azote du carnet en : minéral, lisier, fumier, etc.
 * (utilisé pour les apports déjà saisis si l'utilisateur veut un récap, sinon
 * on prend uniquement les imports déclarés explicitement).
 */
export function summarizeCarnetMineralApports(
  interventions: ReadonlyArray<Intervention>,
  campaign: number,
): { mineralNKg: number; mineralPKg: number; mineralKKg: number } {
  let n = 0;
  let p = 0;
  let k = 0;
  const yearStart = `${campaign}-01-01`;
  const yearEnd = `${campaign}-12-31`;
  for (const i of interventions) {
    if (i.category !== 'fertilization') continue;
    if (i.date < yearStart || i.date > yearEnd) continue;
    const product = getProductById(i.productId);
    if (!product || product.type !== 'fertilizer') continue;
    if (product.category !== 'mineral') continue;
    const treated = i.surfaceTreatedHa ?? 0;
    n += (i.nKgPerHa ?? 0) * treated;
    p += (i.pKgPerHa ?? 0) * treated;
    k += (i.kKgPerHa ?? 0) * treated;
  }
  return {
    mineralNKg: Math.round(n),
    mineralPKg: Math.round(p),
    mineralKKg: Math.round(k),
  };
}

interface ComputeSuisseBilanzArgs {
  parcels: ReadonlyArray<ParcelDetail>;
  segments: ReadonlyArray<AssolementSegment>;
  livestock: ReadonlyArray<LivestockEntry>;
  imports: FertilizerImportInput;
  campaign: number;
  /** Bonus résidus culturaux global (kg N) — peut être renseigné directement
   *  ou estimé depuis les segments de l'année précédente. Pour le MVP, 0
   *  par défaut, l'utilisateur le saisit. */
  residualNitrogenKg?: number;
}

/**
 * Calcule le bilan exploitation Suisse-Bilanz simplifié pour une campagne.
 *
 * Méthode :
 *  1. SAU = somme des parcelles status='active'
 *  2. Besoins = pour chaque parcelle, surface × besoins de la culture active
 *     (au 1er juillet de la campagne)
 *  3. Apports N disponibles = livestock × coef + atmosphérique + résidus
 *     + minéral importé + DIGIFLUX IN - DIGIFLUX OUT
 *  4. Apports P/K disponibles = livestock + minéral (pas de coefficient pour
 *     P et K, la disponibilité est ~100% sur le cycle pluriannuel)
 *  5. Solde = apports - besoins
 *  6. Conforme si |solde| < 10% des besoins (norme Suisse-Bilanz)
 */
export function computeSuisseBilanz(args: ComputeSuisseBilanzArgs): SuisseBilanzResult {
  const { parcels, segments, livestock, imports, campaign, residualNitrogenKg = 0 } = args;

  // Surface agricole utile : on exclut les forêts, surfaces improductives, archivées.
  const activeParcels = parcels.filter(
    (p) => p.status === 'active' && p.culture !== 'Forêt' && p.culture !== 'Surface improductive',
  );
  const sauHa = round2(activeParcels.reduce((sum, p) => sum + p.surfaceHa, 0));

  // 1. Besoins par parcelle
  const needs: SuisseBilanzNeedsRow[] = [];
  let totalNeedsN = 0;
  let totalNeedsP = 0;
  let totalNeedsK = 0;
  for (const parcel of activeParcels) {
    const cultureName = activeCultureForCampaign(parcel.id, campaign, segments) ?? parcel.culture;
    const n = cultureNeeds(cultureName);
    if (!n) continue;
    const nKgTotal = n.nKgHa * parcel.surfaceHa;
    const pKgTotal = n.pKgHa * parcel.surfaceHa;
    const kKgTotal = n.kKgHa * parcel.surfaceHa;
    needs.push({
      culture: n.culture,
      surfaceHa: parcel.surfaceHa,
      nKgHa: n.nKgHa,
      pKgHa: n.pKgHa,
      kKgHa: n.kKgHa,
      nKgTotal: Math.round(nKgTotal),
      pKgTotal: Math.round(pKgTotal),
      kKgTotal: Math.round(kKgTotal),
    });
    totalNeedsN += nKgTotal;
    totalNeedsP += pKgTotal;
    totalNeedsK += kKgTotal;
  }

  // 2. Apports — décomposition par source
  const livestockBalance = balanceForFarm(livestock);

  // Effluents : on applique le coefficient 1re année moyen pondéré par type
  let manureNAvailable = 0;
  let manureNGross = 0;
  let manurePAvailable = 0;
  let manureKAvailable = 0;
  for (const s of livestockBalance.summaries) {
    const coef = ORGANIC_FIRST_YEAR_EFFICIENCY[s.category.manureType] ?? 0.4;
    manureNGross += s.nKgTotal;
    manureNAvailable += s.nKgTotal * coef;
    // P et K : disponibilité ~100% sur la rotation (cumul pluriannuel)
    manurePAvailable += s.pKgTotal;
    manureKAvailable += s.kKgTotal;
  }

  const atmosphericNKg = ATMOSPHERIC_N_KG_HA * sauHa;

  const importedManureCoef =
    ORGANIC_FIRST_YEAR_EFFICIENCY[imports.importedOrganicManureType] ?? 0.5;
  const importedOrganicAvailable = imports.importedOrganicNitrogenKg * importedManureCoef;

  const supplyN: SuisseBilanzSupplyBreakdown = {
    livestockManureNKgAvailable: Math.round(manureNAvailable),
    livestockManureNKgGross: Math.round(manureNGross),
    atmosphericNKg: Math.round(atmosphericNKg),
    residualNKg: Math.round(residualNitrogenKg),
    mineralNKg: Math.round(imports.mineralNitrogenKg),
    importedOrganicNKgAvailable: Math.round(importedOrganicAvailable),
    exportedOrganicNKg: Math.round(imports.exportedOrganicNitrogenKg),
  };

  const totalSupplyN =
    supplyN.livestockManureNKgAvailable +
    supplyN.atmosphericNKg +
    supplyN.residualNKg +
    supplyN.mineralNKg +
    supplyN.importedOrganicNKgAvailable -
    supplyN.exportedOrganicNKg;

  const totalSupplyP = manurePAvailable + imports.mineralPhosphorusKg;
  const totalSupplyK = manureKAvailable + imports.mineralPotassiumKg;

  const totalNeeds = {
    nKg: Math.round(totalNeedsN),
    pKg: Math.round(totalNeedsP),
    kKg: Math.round(totalNeedsK),
  };
  const totalSupply = {
    nKg: Math.round(totalSupplyN),
    pKg: Math.round(totalSupplyP),
    kKg: Math.round(totalSupplyK),
  };

  const balance = {
    nKg: totalSupply.nKg - totalNeeds.nKg,
    pKg: totalSupply.pKg - totalNeeds.pKg,
    kKg: totalSupply.kKg - totalNeeds.kKg,
  };

  const coverage = {
    n: totalNeeds.nKg > 0 ? (totalSupply.nKg / totalNeeds.nKg) * 100 : 0,
    p: totalNeeds.pKg > 0 ? (totalSupply.pKg / totalNeeds.pKg) * 100 : 0,
    k: totalNeeds.kKg > 0 ? (totalSupply.kKg / totalNeeds.kKg) * 100 : 0,
  };

  const compliance = {
    n: complianceFor(coverage.n),
    p: complianceFor(coverage.p),
  };

  const ugbPerHa = sauHa > 0 ? round2(livestockBalance.totalUgb / sauHa) : 0;

  const warnings: string[] = [];
  if (ugbPerHa > UGB_HA_LIMIT_PLAIN) {
    warnings.push(
      `Charge UGB/ha (${ugbPerHa}) dépasse la limite OPD de ${UGB_HA_LIMIT_PLAIN} UGB/ha SAU.`,
    );
  }
  if (compliance.n === 'sur-fertilisation') {
    warnings.push(
      `Sur-fertilisation azote : couverture ${Math.round(coverage.n)}% (> 110% — limite Suisse-Bilanz).`,
    );
  }
  if (compliance.p === 'sur-fertilisation') {
    warnings.push(`Sur-fertilisation phosphore : couverture ${Math.round(coverage.p)}% (> 110%).`);
  }
  if (compliance.n === 'sous-fertilisation') {
    warnings.push(
      `Sous-fertilisation azote : couverture ${Math.round(coverage.n)}% (< 90% — rendement à risque).`,
    );
  }
  if (sauHa === 0) {
    warnings.push('Aucune parcelle active : impossible de calculer un bilan.');
  }

  return {
    campaign,
    sauHa,
    ugbPerHa,
    needs,
    totalNeeds,
    supplyN,
    totalSupply,
    balance,
    coverage,
    compliance,
    warnings,
  };
}

function complianceFor(
  coveragePct: number,
): 'conforme' | 'sous-fertilisation' | 'sur-fertilisation' {
  if (coveragePct > 110) return 'sur-fertilisation';
  if (coveragePct < 90) return 'sous-fertilisation';
  return 'conforme';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
