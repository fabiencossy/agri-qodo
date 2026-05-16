import type {
  FarmLivestockBalance,
  LivestockCategory,
  LivestockEntry,
  LivestockSummary,
} from './livestock.types';
import { getCategory } from './livestock.catalog';

export function summarizeEntry(entry: LivestockEntry): LivestockSummary | null {
  const category = getCategory(entry.category);
  if (!category) return null;
  return {
    category,
    count: entry.count,
    ugbTotal: round2(category.ugbPerHead * entry.count),
    nKgTotal: Math.round(category.nKgPerHeadYear * entry.count),
    pKgTotal: Math.round(category.pKgPerHeadYear * entry.count),
    kKgTotal: Math.round(category.kKgPerHeadYear * entry.count),
    manureVolumeTotal: round1(category.manureVolumePerHeadYear * entry.count),
    manureVolumeUnit: category.manureVolumeUnit,
  };
}

export function balanceForFarm(entries: ReadonlyArray<LivestockEntry>): FarmLivestockBalance {
  const summaries: LivestockSummary[] = [];
  let totalHeadCount = 0;
  let totalUgb = 0;
  let totalNKg = 0;
  let totalPKg = 0;
  let totalKKg = 0;
  let totalLisierM3 = 0;
  let totalFumierT = 0;

  for (const entry of entries) {
    const s = summarizeEntry(entry);
    if (!s) continue;
    summaries.push(s);
    totalHeadCount += s.count;
    totalUgb += s.ugbTotal;
    totalNKg += s.nKgTotal;
    totalPKg += s.pKgTotal;
    totalKKg += s.kKgTotal;
    if (s.category.manureType === 'lisier' && s.manureVolumeUnit === 'm3') {
      totalLisierM3 += s.manureVolumeTotal;
    } else if (s.manureVolumeUnit === 't') {
      totalFumierT += s.manureVolumeTotal;
    }
  }

  return {
    totalHeadCount,
    totalUgb: round2(totalUgb),
    totalNKg: Math.round(totalNKg),
    totalPKg: Math.round(totalPKg),
    totalKKg: Math.round(totalKKg),
    totalLisierM3: round1(totalLisierM3),
    totalFumierT: round1(totalFumierT),
    summaries,
  };
}

/**
 * UGB par hectare de surface agricole utile — la limite légale Suisse est
 * de 3.0 UGB/ha SAU (OPD art. 47), avec dérogations pour les ZP/ZM.
 */
export function ugbPerHectare(balance: FarmLivestockBalance, sauHa: number): number {
  if (sauHa <= 0) return 0;
  return round2(balance.totalUgb / sauHa);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Excrétions disponibles (1re année) après pertes au stockage/épandage.
 * Coefficients ~ 0.5 lisier printemps, 0.4 fumier frais, 0.25 fumier composté.
 * On applique les coefficients par défaut de fumure.helpers — ici on rend
 * juste les bruts. Le calcul exploitation détaillé se fait dans fumure.helpers.
 */
export function manureProducedByType(balance: FarmLivestockBalance): {
  lisierM3: number;
  fumierFraisT: number;
  fientesT: number;
  nByTypeKg: { lisier: number; fumier: number; fientes: number };
} {
  let lisierM3 = 0;
  let fumierFraisT = 0;
  let fientesT = 0;
  let nLisier = 0;
  let nFumier = 0;
  let nFientes = 0;
  for (const s of balance.summaries) {
    if (s.category.manureType === 'lisier') {
      lisierM3 += s.manureVolumeTotal;
      nLisier += s.nKgTotal;
    } else if (s.category.manureType === 'fientes') {
      fientesT += s.manureVolumeTotal;
      nFientes += s.nKgTotal;
    } else {
      fumierFraisT += s.manureVolumeTotal;
      nFumier += s.nKgTotal;
    }
  }
  return {
    lisierM3: round1(lisierM3),
    fumierFraisT: round1(fumierFraisT),
    fientesT: round1(fientesT),
    nByTypeKg: {
      lisier: Math.round(nLisier),
      fumier: Math.round(nFumier),
      fientes: Math.round(nFientes),
    },
  };
}

export function ugbHaLegalLimit(): number {
  return 3.0; // OPD art. 47
}

export function manureCategoryLabel(category: LivestockCategory): string {
  switch (category.manureType) {
    case 'lisier':
      return 'lisier';
    case 'fumier-frais':
      return 'fumier';
    case 'fumier-composté':
      return 'fumier composté';
    case 'fientes':
      return 'fientes';
  }
}
