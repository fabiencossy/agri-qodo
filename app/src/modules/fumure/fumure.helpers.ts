import type {
  ApplicationSeason,
  ApplicationWindow,
  CultureNeeds,
  FumureBalance,
  OrganicEfficiency,
  PreviousCropEffect,
} from './fumure.types';
import type { Intervention } from '../carnet/carnet.types';
import { getProductById } from '../products/products.store';

/**
 * Besoins par culture en kg/ha (norme OEngrais 2024, classe de rendement moyen).
 * Valeurs simplifiées pour MVP — à raffiner avec analyses de sol Phase 3.
 */
const NEEDS: Record<string, Omit<CultureNeeds, 'culture'>> = {
  "Blé d'automne": { nKgHa: 180, pKgHa: 60, kKgHa: 90, notes: 'Rendement réf. 70 q/ha' },
  'Blé de printemps': { nKgHa: 160, pKgHa: 60, kKgHa: 80 },
  'Maïs ensilage': { nKgHa: 200, pKgHa: 70, kKgHa: 200, notes: 'Rendement réf. 50 t MS/ha' },
  'Maïs grain': { nKgHa: 200, pKgHa: 70, kKgHa: 200 },
  "Colza d'automne": { nKgHa: 220, pKgHa: 60, kKgHa: 110 },
  "Orge d'automne": { nKgHa: 150, pKgHa: 50, kKgHa: 80 },
  'Orge de printemps': { nKgHa: 130, pKgHa: 50, kKgHa: 70 },
  'Pomme de terre': { nKgHa: 140, pKgHa: 90, kKgHa: 280 },
  'Betterave sucrière': { nKgHa: 120, pKgHa: 80, kKgHa: 250 },
  'Prairie temporaire': { nKgHa: 200, pKgHa: 70, kKgHa: 280, notes: '4 coupes/an' },
  'Prairie naturelle': { nKgHa: 100, pKgHa: 40, kKgHa: 150 },
  'Prairie extensive': { nKgHa: 0, pKgHa: 0, kKgHa: 0, notes: 'SPB — pas de fertilisation' },
};

export function cultureNeeds(culture: string | undefined): CultureNeeds | null {
  if (!culture) return null;
  const base = NEEDS[culture];
  if (!base) return null;
  return { culture, ...base };
}

/**
 * Effet azoté résiduel de la culture précédente.
 * Valeurs OEngrais 2024 simplifiées — Suisse-Bilanz détaillé Phase 3.
 */
const PREVIOUS_CROP: Record<string, Omit<PreviousCropEffect, 'culture'>> = {
  Luzerne: { residualNKgHa: 50, notes: 'Légumineuse — fort restitution N' },
  Trèfle: { residualNKgHa: 40 },
  Pois: { residualNKgHa: 30 },
  Soja: { residualNKgHa: 30 },
  'Prairie temporaire': { residualNKgHa: 40, notes: 'Destruction printemps' },
  'Prairie naturelle': { residualNKgHa: 60, notes: 'Destruction (rare)' },
  'Engrais vert': { residualNKgHa: 25 },
  Jachère: { residualNKgHa: 10 },
  "Blé d'automne": { residualNKgHa: 0 },
  "Orge d'automne": { residualNKgHa: 0 },
  'Maïs ensilage': { residualNKgHa: 0 },
  "Colza d'automne": { residualNKgHa: -10, notes: 'Faim azotée à la décomposition' },
};

export function previousCropResidualN(previousCulture: string | undefined): number {
  if (!previousCulture) return 0;
  return PREVIOUS_CROP[previousCulture]?.residualNKgHa ?? 0;
}

/**
 * Table d'efficacité des apports organiques (fraction du N total disponible
 * la 1re année). Référence OEngrais 2024.
 */
const ORGANIC_EFFICIENCY: ReadonlyArray<OrganicEfficiency> = [
  { productCategory: 'mineral', season: 'printemps', coef: 1.0 },
  { productCategory: 'mineral', season: 'été', coef: 1.0 },
  { productCategory: 'mineral', season: 'automne', coef: 1.0 },
  { productCategory: 'mineral', season: 'hiver', coef: 1.0 },
  { productCategory: 'lisier', season: 'printemps', coef: 0.5 },
  { productCategory: 'lisier', season: 'été', coef: 0.3 },
  { productCategory: 'lisier', season: 'automne', coef: 0.3 },
  { productCategory: 'lisier', season: 'hiver', coef: 0.2 },
  { productCategory: 'fumier-frais', season: 'printemps', coef: 0.4 },
  { productCategory: 'fumier-frais', season: 'été', coef: 0.3 },
  { productCategory: 'fumier-frais', season: 'automne', coef: 0.3 },
  { productCategory: 'fumier-frais', season: 'hiver', coef: 0.2 },
  { productCategory: 'fumier-composté', season: 'printemps', coef: 0.25 },
  { productCategory: 'fumier-composté', season: 'été', coef: 0.2 },
  { productCategory: 'fumier-composté', season: 'automne', coef: 0.2 },
  { productCategory: 'fumier-composté', season: 'hiver', coef: 0.15 },
  { productCategory: 'compost', season: 'printemps', coef: 0.15 },
  { productCategory: 'compost', season: 'été', coef: 0.12 },
  { productCategory: 'compost', season: 'automne', coef: 0.12 },
  { productCategory: 'compost', season: 'hiver', coef: 0.1 },
];

export function organicEfficiencyCoef(
  productCategory: OrganicEfficiency['productCategory'],
  season: ApplicationSeason,
): number {
  const entry = ORGANIC_EFFICIENCY.find(
    (e) => e.productCategory === productCategory && e.season === season,
  );
  return entry?.coef ?? 1;
}

export function dateToSeason(date: string): ApplicationSeason {
  const m = Number(date.slice(5, 7));
  if (m >= 3 && m <= 5) return 'printemps';
  if (m >= 6 && m <= 8) return 'été';
  if (m >= 9 && m <= 11) return 'automne';
  return 'hiver';
}

/** Déduit la catégorie organique depuis le produit lié à l'intervention. */
function productCategoryOf(intervention: Intervention): OrganicEfficiency['productCategory'] {
  const product = getProductById(intervention.productId);
  if (!product || product.type !== 'fertilizer') return 'mineral';
  if (product.category === 'mineral') return 'mineral';
  if (product.category === 'amendment') return 'compost';
  // Heuristique sur le nom pour distinguer lisier / fumier
  const name = product.name.toLowerCase();
  if (name.includes('lisier')) return 'lisier';
  if (name.includes('fumier') && name.includes('compost')) return 'fumier-composté';
  if (name.includes('fumier')) return 'fumier-frais';
  if (name.includes('compost')) return 'compost';
  return 'fumier-frais';
}

/**
 * Calcule le bilan de fumure complet pour une parcelle/campagne donnée.
 *
 * @param culture Culture en place pour cette campagne (segment d'assolement actif)
 * @param surfaceHa Surface de la parcelle (ha)
 * @param campaign Année de campagne
 * @param interventions Toutes les interventions de cette parcelle (filtrées sur l'année par cette fonction)
 * @param previousCulture (Optionnel) culture précédente — détermine le résidu N
 */
export function computeFumureBalance(
  culture: string | undefined,
  surfaceHa: number,
  campaign: number,
  interventions: ReadonlyArray<Intervention>,
  previousCulture?: string,
): FumureBalance | null {
  const needs = cultureNeeds(culture);
  if (!needs || !culture) return null;

  const yearStart = `${campaign}-01-01`;
  const yearEnd = `${campaign}-12-31`;
  const inYear = interventions.filter(
    (i) => i.category === 'fertilization' && i.date >= yearStart && i.date <= yearEnd,
  );

  let nKgRaw = 0;
  let pKgRaw = 0;
  let kKgRaw = 0;
  let nKgEffective = 0;
  for (const i of inYear) {
    const treated = i.surfaceTreatedHa ?? surfaceHa;
    const n = (i.nKgPerHa ?? 0) * treated;
    const p = (i.pKgPerHa ?? 0) * treated;
    const k = (i.kKgPerHa ?? 0) * treated;
    nKgRaw += n;
    pKgRaw += p;
    kKgRaw += k;
    // Coefficient d'efficacité 1re année — applique seulement à l'azote.
    const cat = productCategoryOf(i);
    const season = dateToSeason(i.date);
    const coef = organicEfficiencyCoef(cat, season);
    nKgEffective += n * coef;
  }

  const residual = previousCropResidualN(previousCulture) * surfaceHa;
  const nKgDisponible = nKgEffective + residual;

  const needsTotal = {
    nKg: Math.round(needs.nKgHa * surfaceHa),
    pKg: Math.round(needs.pKgHa * surfaceHa),
    kKg: Math.round(needs.kKgHa * surfaceHa),
  };

  const applied = {
    nKg: Math.round(nKgDisponible),
    pKg: Math.round(pKgRaw),
    kKg: Math.round(kKgRaw),
  };

  const appliedRaw = {
    nKg: Math.round(nKgRaw),
    pKg: Math.round(pKgRaw),
    kKg: Math.round(kKgRaw),
  };

  const remaining = {
    nKg: needsTotal.nKg - applied.nKg,
    pKg: needsTotal.pKg - applied.pKg,
    kKg: needsTotal.kKg - applied.kKg,
  };

  const coverage = {
    n: needsTotal.nKg > 0 ? (applied.nKg / needsTotal.nKg) * 100 : 0,
    p: needsTotal.pKg > 0 ? (applied.pKg / needsTotal.pKg) * 100 : 0,
    k: needsTotal.kKg > 0 ? (applied.kKg / needsTotal.kKg) * 100 : 0,
  };

  // Seuils Suisse-Bilanz v1.16 : couverture < 90% = sous-fertilisation,
  // > 110% = sur-fertilisation (limite légale OEngrais 2024).
  const status: FumureBalance['status'] =
    coverage.n < 90 ? 'sous-fertilisé' : coverage.n > 110 ? 'sur-fertilisé' : 'équilibré';

  return {
    culture,
    surfaceHa,
    campaign,
    needs: needsTotal,
    applied,
    appliedRaw,
    previousCropResidualN: Math.round(residual),
    remaining,
    coverage,
    status,
  };
}

/** Fenêtres d'apport conseillées par culture (BBCH + dose N/ha). */
const APPLICATION_WINDOWS: Record<string, ReadonlyArray<ApplicationWindow>> = {
  "Blé d'automne": [
    {
      bbchStart: 25,
      bbchEnd: 29,
      label: 'Sortie hiver (tallage)',
      nKgHa: { min: 50, max: 80 },
      notes: 'Apport N1 — fin février / début mars',
    },
    {
      bbchStart: 30,
      bbchEnd: 32,
      label: 'Début montaison',
      nKgHa: { min: 60, max: 80 },
      notes: 'Apport N2 — fin mars / début avril',
    },
    {
      bbchStart: 37,
      bbchEnd: 49,
      label: 'Dernière feuille',
      nKgHa: { min: 30, max: 60 },
      notes: 'Apport N3 — protéines',
    },
  ],
  'Maïs ensilage': [
    {
      bbchStart: 0,
      bbchEnd: 9,
      label: 'Semis (starter)',
      nKgHa: { min: 30, max: 60 },
      notes: 'Engrais starter au semis',
    },
    {
      bbchStart: 14,
      bbchEnd: 18,
      label: '6-8 feuilles',
      nKgHa: { min: 100, max: 140 },
      notes: 'Apport principal',
    },
  ],
  "Colza d'automne": [
    {
      bbchStart: 12,
      bbchEnd: 19,
      label: 'Automne (feuilles)',
      nKgHa: { min: 30, max: 50 },
      notes: 'Si peu de résidus précédent',
    },
    {
      bbchStart: 30,
      bbchEnd: 32,
      label: 'Reprise printemps',
      nKgHa: { min: 80, max: 120 },
    },
    {
      bbchStart: 50,
      bbchEnd: 55,
      label: 'Bouton floral',
      nKgHa: { min: 60, max: 100 },
    },
  ],
};

export function applicationWindows(culture: string | undefined): ReadonlyArray<ApplicationWindow> {
  if (!culture) return [];
  return APPLICATION_WINDOWS[culture] ?? [];
}
