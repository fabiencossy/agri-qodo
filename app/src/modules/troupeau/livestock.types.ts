/**
 * Module Troupeau / cheptel — modèle simple par catégorie.
 *
 * Source agronomique : OEngrais 2024 + Données de base pour la fumure 2017
 * (Agroscope / Sinaj) — tableaux des "Apports des animaux de rente".
 *
 * On stocke pour chaque catégorie :
 *   - UGB par tête (équivalent grand bétail)
 *   - Excrétion azote totale (kg N / tête / an)
 *   - Excrétion phosphore (kg P₂O₅ / tête / an)
 *   - Excrétion potasse (kg K₂O / tête / an)
 *   - Fraction stockée en lisier vs fumier (selon système d'étable typique)
 *   - Volume effluents (m³ lisier ou t fumier / tête / an)
 *
 * MVP : juste un compteur par catégorie pour le cheptel de l'exploitation.
 * Phase 3 : import BDTA (animaux individuels + événements).
 */

export type LivestockSpecies =
  | 'bovine-dairy'
  | 'bovine-suckler'
  | 'bovine-young'
  | 'bovine-fattening'
  | 'ovine'
  | 'caprine'
  | 'porcine'
  | 'equine'
  | 'poultry'
  | 'other';

/**
 * Identifiant stable de catégorie (en-tête anglais — réutilisable Phase 3
 * pour mapper avec BDTA / Suisse-Bilanz).
 */
export type LivestockCategoryKey =
  // Bovins laitiers
  | 'dairy-cow-7000' // vache laitière 7000 kg
  | 'dairy-cow-8500' // vache laitière 8500 kg
  | 'dairy-cow-10000' // vache laitière 10 000 kg
  // Bovins viande
  | 'suckler-cow' // vache allaitante
  | 'fattening-bull' // taurillon engraissement
  | 'veal-calf' // veau engraissement
  // Bovins jeunes / élevage
  | 'young-cattle-lt1' // jeune bétail < 1 an
  | 'heifer-1-2' // génisse 1-2 ans
  | 'heifer-gt2' // génisse > 2 ans
  // Ovins
  | 'ewe' // brebis
  | 'lamb' // agneau engraissement
  // Caprins
  | 'goat' // chèvre laitière
  // Porcins
  | 'sow' // truie d'élevage (avec porcelets)
  | 'fattening-pig' // porc engraissement
  | 'piglet' // porcelet 25-35 kg
  // Équins
  | 'horse' // cheval > 3 ans
  | 'pony' // poney / petit cheval
  // Volailles
  | 'laying-hen' // poule pondeuse
  | 'broiler' // poulet de chair
  | 'turkey'; // dinde engraissement

/** Type d'effluent dominant pour la catégorie. */
export type ManureType = 'lisier' | 'fumier-frais' | 'fumier-composté' | 'fientes';

export interface LivestockCategory {
  key: LivestockCategoryKey;
  species: LivestockSpecies;
  /** Libellé court pour l'UI. */
  label: string;
  /** Description (poids, classe, source). */
  description?: string;
  /** UGB par tête (équivalent grand bétail). */
  ugbPerHead: number;
  /** Excrétion azote brute kg N/tête/an (avant pertes au stockage/épandage). */
  nKgPerHeadYear: number;
  /** Excrétion P₂O₅ kg/tête/an. */
  pKgPerHeadYear: number;
  /** Excrétion K₂O kg/tête/an. */
  kKgPerHeadYear: number;
  /** Volume annuel d'effluents (m³ pour lisier, t pour fumier). */
  manureVolumePerHeadYear: number;
  /** Unité du volume effluents. */
  manureVolumeUnit: 'm3' | 't';
  /** Type d'effluent dominant. */
  manureType: ManureType;
  /** Notes (système d'étable typique, références). */
  notes?: string;
}

export interface LivestockEntry {
  id: string;
  category: LivestockCategoryKey;
  /** Effectif moyen annuel (têtes). */
  count: number;
  /** Notes libres (étable, lot, etc.). */
  notes?: string;
  /** Date d'enregistrement / dernière mise à jour. */
  updatedAt?: string;
}

/** Résumé calculé pour une catégorie / un effectif. */
export interface LivestockSummary {
  category: LivestockCategory;
  count: number;
  ugbTotal: number;
  nKgTotal: number;
  pKgTotal: number;
  kKgTotal: number;
  manureVolumeTotal: number;
  manureVolumeUnit: 'm3' | 't';
}

/** Bilan agrégé du cheptel d'une exploitation. */
export interface FarmLivestockBalance {
  totalHeadCount: number;
  totalUgb: number;
  totalNKg: number;
  totalPKg: number;
  totalKKg: number;
  totalLisierM3: number;
  totalFumierT: number;
  summaries: ReadonlyArray<LivestockSummary>;
}
