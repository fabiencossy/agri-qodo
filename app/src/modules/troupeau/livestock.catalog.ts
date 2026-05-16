import type { LivestockCategory } from './livestock.types';

/**
 * Catalogue des catégories animales selon les normes suisses.
 *
 * Sources :
 *  - OEngrais 2024 (Ordonnance sur les engrais) — Annexe 1
 *  - Agroscope, "Données de base pour la fumure des grandes cultures et des
 *    herbages" 2017 (DBF 2017) — chapitre 6, tableau "Excrétions des animaux
 *    de rente" (N et P₂O₅ après pertes courantes en bâtiment)
 *  - Suisse-Bilanz Annexe 2 — UGB et excrétions
 *
 * Valeurs en kg élément / tête / an, situation moyenne (stabulation entravée
 * ou libre selon catégorie). Les coefficients d'efficacité (1re année) sont
 * appliqués dans fumure.helpers.ts (50% pour lisier au printemps, etc.).
 *
 * Important : ces valeurs sont des références sectorielles. Pour un bilan
 * officiel cantonal, l'exploitation doit utiliser les valeurs exactes du
 * Suisse-Bilanz à la version courante (le canton VD demande la version 1.16+).
 */
export const LIVESTOCK_CATALOG: ReadonlyArray<LivestockCategory> = [
  // ========================================
  // BOVINS LAITIERS
  // ========================================
  {
    key: 'dairy-cow-7000',
    species: 'bovine-dairy',
    label: 'Vache laitière (7000 kg lait/an)',
    description: 'Production moyenne, stabulation libre, alimentation mixte',
    ugbPerHead: 1.0,
    nKgPerHeadYear: 105,
    pKgPerHeadYear: 38,
    kKgPerHeadYear: 130,
    manureVolumePerHeadYear: 21,
    manureVolumeUnit: 'm3',
    manureType: 'lisier',
    notes: 'Réf. DBF 2017 tableau 6.1',
  },
  {
    key: 'dairy-cow-8500',
    species: 'bovine-dairy',
    label: 'Vache laitière (8500 kg lait/an)',
    description: 'Production élevée, stabulation libre',
    ugbPerHead: 1.1,
    nKgPerHeadYear: 120,
    pKgPerHeadYear: 44,
    kKgPerHeadYear: 150,
    manureVolumePerHeadYear: 24,
    manureVolumeUnit: 'm3',
    manureType: 'lisier',
  },
  {
    key: 'dairy-cow-10000',
    species: 'bovine-dairy',
    label: 'Vache laitière (10 000 kg lait/an)',
    description: 'Très haute production',
    ugbPerHead: 1.2,
    nKgPerHeadYear: 135,
    pKgPerHeadYear: 50,
    kKgPerHeadYear: 170,
    manureVolumePerHeadYear: 27,
    manureVolumeUnit: 'm3',
    manureType: 'lisier',
  },

  // ========================================
  // BOVINS VIANDE / ALLAITANTS
  // ========================================
  {
    key: 'suckler-cow',
    species: 'bovine-suckler',
    label: 'Vache allaitante (avec veau)',
    description: 'Élevage extensif, garde du veau jusqu’à 8 mois',
    ugbPerHead: 0.8,
    nKgPerHeadYear: 80,
    pKgPerHeadYear: 30,
    kKgPerHeadYear: 100,
    manureVolumePerHeadYear: 16,
    manureVolumeUnit: 'm3',
    manureType: 'lisier',
  },
  {
    key: 'fattening-bull',
    species: 'bovine-fattening',
    label: 'Taurillon engraissement',
    description: '200-450 kg PV, alimentation intensive',
    ugbPerHead: 0.4,
    nKgPerHeadYear: 45,
    pKgPerHeadYear: 18,
    kKgPerHeadYear: 55,
    manureVolumePerHeadYear: 9,
    manureVolumeUnit: 'm3',
    manureType: 'lisier',
  },
  {
    key: 'veal-calf',
    species: 'bovine-young',
    label: 'Veau d’engraissement',
    description: '60-220 kg PV, alimentation lait, séjour ~5 mois',
    ugbPerHead: 0.15,
    nKgPerHeadYear: 12,
    pKgPerHeadYear: 5,
    kKgPerHeadYear: 14,
    manureVolumePerHeadYear: 3,
    manureVolumeUnit: 'm3',
    manureType: 'lisier',
    notes: 'Suisse-Bilanz Annexe 2 : 0.15 UGB',
  },

  // ========================================
  // BOVINS JEUNES / ÉLEVAGE
  // ========================================
  {
    key: 'young-cattle-lt1',
    species: 'bovine-young',
    label: 'Jeune bétail < 1 an',
    description: 'Élève de renouvellement',
    ugbPerHead: 0.3,
    nKgPerHeadYear: 25,
    pKgPerHeadYear: 9,
    kKgPerHeadYear: 32,
    manureVolumePerHeadYear: 5,
    manureVolumeUnit: 'm3',
    manureType: 'lisier',
  },
  {
    key: 'heifer-1-2',
    species: 'bovine-young',
    label: 'Génisse 1-2 ans',
    ugbPerHead: 0.6,
    nKgPerHeadYear: 50,
    pKgPerHeadYear: 18,
    kKgPerHeadYear: 65,
    manureVolumePerHeadYear: 10,
    manureVolumeUnit: 'm3',
    manureType: 'lisier',
  },
  {
    key: 'heifer-gt2',
    species: 'bovine-young',
    label: 'Génisse > 2 ans',
    description: 'Avant 1re vêlage',
    ugbPerHead: 0.7,
    nKgPerHeadYear: 70,
    pKgPerHeadYear: 25,
    kKgPerHeadYear: 90,
    manureVolumePerHeadYear: 14,
    manureVolumeUnit: 'm3',
    manureType: 'lisier',
  },

  // ========================================
  // OVINS
  // ========================================
  {
    key: 'ewe',
    species: 'ovine',
    label: 'Brebis (avec agneaux)',
    description: 'Brebis adulte + agneaux jusqu’au sevrage',
    ugbPerHead: 0.17,
    nKgPerHeadYear: 15,
    pKgPerHeadYear: 5,
    kKgPerHeadYear: 20,
    manureVolumePerHeadYear: 1.0,
    manureVolumeUnit: 't',
    manureType: 'fumier-frais',
  },
  {
    key: 'lamb',
    species: 'ovine',
    label: 'Agneau engraissement',
    description: '15-45 kg PV',
    ugbPerHead: 0.04,
    nKgPerHeadYear: 4,
    pKgPerHeadYear: 1.5,
    kKgPerHeadYear: 5,
    manureVolumePerHeadYear: 0.3,
    manureVolumeUnit: 't',
    manureType: 'fumier-frais',
  },

  // ========================================
  // CAPRINS
  // ========================================
  {
    key: 'goat',
    species: 'caprine',
    label: 'Chèvre laitière',
    ugbPerHead: 0.15,
    nKgPerHeadYear: 14,
    pKgPerHeadYear: 5,
    kKgPerHeadYear: 22,
    manureVolumePerHeadYear: 0.8,
    manureVolumeUnit: 't',
    manureType: 'fumier-frais',
  },

  // ========================================
  // PORCINS
  // ========================================
  {
    key: 'sow',
    species: 'porcine',
    label: 'Truie d’élevage (avec porcelets)',
    description: 'Truie + porcelets jusqu’à 25 kg, alimentation phasée',
    ugbPerHead: 0.26,
    nKgPerHeadYear: 32,
    pKgPerHeadYear: 13,
    kKgPerHeadYear: 24,
    manureVolumePerHeadYear: 6.5,
    manureVolumeUnit: 'm3',
    manureType: 'lisier',
    notes: 'DBF 2017 tableau 6.3 : 11-13 kg P₂O₅ avec alimentation phasée',
  },
  {
    key: 'fattening-pig',
    species: 'porcine',
    label: 'Porc d’engraissement',
    description: '25-110 kg PV, alimentation phasée',
    ugbPerHead: 0.06,
    nKgPerHeadYear: 11,
    pKgPerHeadYear: 4.5,
    kKgPerHeadYear: 7,
    manureVolumePerHeadYear: 1.8,
    manureVolumeUnit: 'm3',
    manureType: 'lisier',
  },
  {
    key: 'piglet',
    species: 'porcine',
    label: 'Porcelet (25-35 kg)',
    ugbPerHead: 0.025,
    nKgPerHeadYear: 4,
    pKgPerHeadYear: 1.8,
    kKgPerHeadYear: 2.5,
    manureVolumePerHeadYear: 0.8,
    manureVolumeUnit: 'm3',
    manureType: 'lisier',
  },

  // ========================================
  // ÉQUINS
  // ========================================
  {
    key: 'horse',
    species: 'equine',
    label: 'Cheval > 3 ans',
    description: 'Loisir / sport / trait',
    ugbPerHead: 0.7,
    nKgPerHeadYear: 50,
    pKgPerHeadYear: 17,
    kKgPerHeadYear: 60,
    manureVolumePerHeadYear: 8,
    manureVolumeUnit: 't',
    manureType: 'fumier-frais',
  },
  {
    key: 'pony',
    species: 'equine',
    label: 'Poney / petit équidé',
    ugbPerHead: 0.4,
    nKgPerHeadYear: 28,
    pKgPerHeadYear: 10,
    kKgPerHeadYear: 35,
    manureVolumePerHeadYear: 5,
    manureVolumeUnit: 't',
    manureType: 'fumier-frais',
  },

  // ========================================
  // VOLAILLES
  // ========================================
  {
    key: 'laying-hen',
    species: 'poultry',
    label: 'Poule pondeuse',
    description: 'Élevage au sol ou volière',
    ugbPerHead: 0.013,
    nKgPerHeadYear: 0.75,
    pKgPerHeadYear: 0.45,
    kKgPerHeadYear: 0.3,
    manureVolumePerHeadYear: 0.018,
    manureVolumeUnit: 't',
    manureType: 'fientes',
  },
  {
    key: 'broiler',
    species: 'poultry',
    label: 'Poulet de chair',
    description: 'Cycle d’engraissement ~42 jours',
    ugbPerHead: 0.005,
    nKgPerHeadYear: 0.3,
    pKgPerHeadYear: 0.16,
    kKgPerHeadYear: 0.12,
    manureVolumePerHeadYear: 0.008,
    manureVolumeUnit: 't',
    manureType: 'fientes',
  },
  {
    key: 'turkey',
    species: 'poultry',
    label: 'Dinde engraissement',
    ugbPerHead: 0.015,
    nKgPerHeadYear: 1.2,
    pKgPerHeadYear: 0.6,
    kKgPerHeadYear: 0.5,
    manureVolumePerHeadYear: 0.025,
    manureVolumeUnit: 't',
    manureType: 'fientes',
  },
];

export const SPECIES_LABELS: Record<string, string> = {
  'bovine-dairy': 'Bovins laitiers',
  'bovine-suckler': 'Bovins allaitants',
  'bovine-young': 'Jeune bétail',
  'bovine-fattening': 'Engraissement bovin',
  ovine: 'Ovins',
  caprine: 'Caprins',
  porcine: 'Porcins',
  equine: 'Équins',
  poultry: 'Volailles',
  other: 'Autres',
};

export function getCategory(key: string): LivestockCategory | undefined {
  return LIVESTOCK_CATALOG.find((c) => c.key === key);
}
