import type { WorkType } from './travaux.types';

/**
 * Catalogue des types de prestations pour tiers — tarifs indicatifs Agridéa
 * "Coûts-machines 2024" / "Tarifs de la mécanisation agricole 2024" Suisse.
 *
 * Les tarifs réels dépendent de la machine, du contexte, des accords. Ce sont
 * juste des valeurs par défaut éditables depuis Paramètres > Travaux pour tiers.
 */
export const WORK_TYPES: ReadonlyArray<WorkType> = [
  // === Travail du sol
  {
    key: 'plowing',
    label: 'Labour',
    description: 'Charrue 4-5 socs, profondeur 25-30 cm',
    category: 'sol',
    defaultHourlyRateChf: 165,
    defaultPerHectareRateChf: 220,
    defaultBillingUnit: 'hectare',
    active: true,
  },
  {
    key: 'tilling',
    label: 'Préparation du sol (déchaumage)',
    description: 'Cover-crop, chisel, herse rotative',
    category: 'sol',
    defaultHourlyRateChf: 145,
    defaultPerHectareRateChf: 145,
    defaultBillingUnit: 'hectare',
    active: true,
  },
  {
    key: 'rolling',
    label: 'Roulage',
    category: 'sol',
    defaultHourlyRateChf: 90,
    defaultPerHectareRateChf: 60,
    defaultBillingUnit: 'hectare',
    active: true,
  },

  // === Semis & plantation
  {
    key: 'sowing',
    label: 'Semis céréales',
    description: 'Semoir 3-4 m, à dents ou disques',
    category: 'semis',
    defaultHourlyRateChf: 160,
    defaultPerHectareRateChf: 180,
    defaultBillingUnit: 'hectare',
    active: true,
  },
  {
    key: 'sowing-precision',
    label: 'Semis de précision (maïs, betterave)',
    category: 'semis',
    defaultHourlyRateChf: 175,
    defaultPerHectareRateChf: 220,
    defaultBillingUnit: 'hectare',
    active: true,
  },

  // === Traitement & fertilisation
  {
    key: 'spreading-mineral',
    label: 'Épandage engrais minéral',
    category: 'traitement',
    defaultHourlyRateChf: 130,
    defaultPerHectareRateChf: 65,
    defaultBillingUnit: 'hectare',
    active: true,
  },
  {
    key: 'spreading-slurry',
    label: 'Épandage de lisier (rampe à pendillards)',
    category: 'traitement',
    defaultHourlyRateChf: 195,
    defaultPerHectareRateChf: 280,
    defaultBillingUnit: 'hectare',
    active: true,
  },
  {
    key: 'spreading-manure',
    label: 'Épandage de fumier',
    category: 'traitement',
    defaultHourlyRateChf: 175,
    defaultPerHectareRateChf: 220,
    defaultBillingUnit: 'hectare',
    active: true,
  },
  {
    key: 'spraying',
    label: 'Pulvérisation phyto',
    description: 'Pulvérisateur porté ou traîné, jusqu’à 24 m',
    category: 'traitement',
    defaultHourlyRateChf: 155,
    defaultPerHectareRateChf: 75,
    defaultBillingUnit: 'hectare',
    active: true,
  },

  // === Récolte
  {
    key: 'mowing',
    label: 'Fauche',
    description: 'Faucheuse à disques, conditionneur',
    category: 'recolte',
    defaultHourlyRateChf: 145,
    defaultPerHectareRateChf: 120,
    defaultBillingUnit: 'hectare',
    active: true,
  },
  {
    key: 'tedding',
    label: 'Fanage',
    category: 'recolte',
    defaultHourlyRateChf: 105,
    defaultPerHectareRateChf: 55,
    defaultBillingUnit: 'hectare',
    active: true,
  },
  {
    key: 'raking',
    label: 'Andainage',
    category: 'recolte',
    defaultHourlyRateChf: 105,
    defaultPerHectareRateChf: 55,
    defaultBillingUnit: 'hectare',
    active: true,
  },
  {
    key: 'baling-round',
    label: 'Pressage balles rondes',
    category: 'recolte',
    defaultHourlyRateChf: 175,
    defaultBillingUnit: 'heure',
    active: true,
  },
  {
    key: 'baling-square',
    label: 'Pressage balles carrées (grosses)',
    category: 'recolte',
    defaultHourlyRateChf: 220,
    defaultBillingUnit: 'heure',
    active: true,
  },
  {
    key: 'wrapping',
    label: 'Enrubannage',
    category: 'recolte',
    defaultHourlyRateChf: 175,
    defaultBillingUnit: 'heure',
    active: true,
  },
  {
    key: 'forage-harvesting',
    label: 'Ensilage (récolteuse)',
    description: 'Ensileuse, hacheuse à fléaux',
    category: 'recolte',
    defaultHourlyRateChf: 350,
    defaultPerHectareRateChf: 480,
    defaultBillingUnit: 'hectare',
    active: true,
  },
  {
    key: 'combine-harvesting',
    label: 'Moisson (moissonneuse-batteuse)',
    category: 'recolte',
    defaultHourlyRateChf: 320,
    defaultPerHectareRateChf: 360,
    defaultBillingUnit: 'hectare',
    active: true,
  },

  // === Transport
  {
    key: 'transport',
    label: 'Transport (tracteur + remorque)',
    description: 'Facturé à l’heure, hors carburant',
    category: 'transport',
    defaultHourlyRateChf: 110,
    defaultBillingUnit: 'heure',
    active: true,
  },

  // === Entretien
  {
    key: 'mulching',
    label: 'Broyage / mulching',
    category: 'entretien',
    defaultHourlyRateChf: 130,
    defaultPerHectareRateChf: 130,
    defaultBillingUnit: 'hectare',
    active: true,
  },
  {
    key: 'hedge-trimming',
    label: 'Taille de haies',
    category: 'entretien',
    defaultHourlyRateChf: 125,
    defaultBillingUnit: 'heure',
    active: true,
  },
];

export const WORK_CATEGORY_LABELS: Record<string, string> = {
  sol: 'Travail du sol',
  semis: 'Semis & plantation',
  traitement: 'Traitement & fertilisation',
  recolte: 'Récolte',
  transport: 'Transport',
  entretien: 'Entretien & paysage',
  autre: 'Autres',
};

export function getWorkType(key: string): WorkType | undefined {
  return WORK_TYPES.find((w) => w.key === key);
}
