/**
 * Catalogue centralisé des cultures et assolements selon les standards Agridéa
 * (suisse romande). Source unique de vérité pour la cartographie (couleur des
 * parcelles) et l'UI (badges, légendes, sélecteurs).
 *
 * Couleurs : volontairement vives / non-naturelles pour contraster avec
 * l'imagerie satellite (qui contient déjà beaucoup de vert et de brun).
 */

export type CultureCategory =
  | 'cereal' // céréales
  | 'oilseed' // oléagineux
  | 'protein' // protéagineux
  | 'root' // sarclées / cultures racines
  | 'forage' // prairies, herbages, légumineuses fourragères
  | 'biodiversity' // SPB, jachères biodiversité, bandes fleuries
  | 'special' // vigne, vergers, légumes, maraîchage
  | 'cover' // engrais verts, couverts végétaux
  | 'fallow' // jachère générique / sol nu
  | 'other'; // archivé / divers

export interface CultureInfo {
  /** Identifiant stable, en-tête anglais (réutilisable côté Odoo plus tard). */
  key: string;
  /** Libellé français affiché dans l'UI. */
  label: string;
  /** Couleur hex utilisée par la carte et les badges. */
  color: string;
  category: CultureCategory;
}

export const CULTURES: ReadonlyArray<CultureInfo> = [
  // === Céréales — orange / jaune
  { key: 'wheat-winter', label: "Blé d'automne", color: '#f97316', category: 'cereal' },
  { key: 'wheat-spring', label: 'Blé de printemps', color: '#fb923c', category: 'cereal' },
  { key: 'durum-wheat', label: 'Blé dur', color: '#c2410c', category: 'cereal' },
  { key: 'barley-winter', label: "Orge d'automne", color: '#fbbf24', category: 'cereal' },
  { key: 'barley-spring', label: 'Orge de printemps', color: '#fde047', category: 'cereal' },
  { key: 'oats', label: 'Avoine', color: '#facc15', category: 'cereal' },
  { key: 'rye', label: 'Seigle', color: '#eab308', category: 'cereal' },
  { key: 'triticale', label: 'Triticale', color: '#d97706', category: 'cereal' },
  { key: 'spelt', label: 'Épeautre', color: '#92400e', category: 'cereal' },

  // === Oléagineux — jaunes vifs / cyan
  { key: 'rapeseed-winter', label: "Colza d'automne", color: '#fef08a', category: 'oilseed' },
  { key: 'rapeseed-spring', label: 'Colza de printemps', color: '#fde68a', category: 'oilseed' },
  { key: 'sunflower', label: 'Tournesol', color: '#f59e0b', category: 'oilseed' },
  { key: 'soybean', label: 'Soja', color: '#a3e635', category: 'oilseed' },
  { key: 'linseed', label: 'Lin oléagineux', color: '#0ea5e9', category: 'oilseed' },

  // === Protéagineux — turquoise / cyan / vert
  { key: 'pea', label: 'Pois protéagineux', color: '#22c55e', category: 'protein' },
  { key: 'faba-bean', label: 'Féverole', color: '#14b8a6', category: 'protein' },
  { key: 'lupin', label: 'Lupin', color: '#06b6d4', category: 'protein' },

  // === Sarclées / racines — rouges / violets
  { key: 'corn-grain', label: 'Maïs grain', color: '#ea580c', category: 'root' },
  { key: 'corn-silage', label: 'Maïs ensilage', color: '#dc2626', category: 'root' },
  { key: 'sugar-beet', label: 'Betterave sucrière', color: '#ec4899', category: 'root' },
  { key: 'fodder-beet', label: 'Betterave fourragère', color: '#f472b6', category: 'root' },
  { key: 'potato', label: 'Pomme de terre', color: '#a855f7', category: 'root' },

  // === Prairies, herbages, légumineuses fourragères
  { key: 'natural-meadow', label: 'Prairie naturelle', color: '#4ade80', category: 'forage' },
  { key: 'temporary-meadow', label: 'Prairie temporaire', color: '#34d399', category: 'forage' },
  { key: 'artificial-meadow', label: 'Prairie artificielle', color: '#10b981', category: 'forage' },
  { key: 'grass-mix', label: 'Mélange fourrager (M)', color: '#059669', category: 'forage' },
  { key: 'lucerne', label: 'Luzerne', color: '#6366f1', category: 'forage' },
  { key: 'clover', label: 'Trèfle', color: '#8b5cf6', category: 'forage' },
  { key: 'pasture', label: 'Pâturage', color: '#65a30d', category: 'forage' },

  // === Surfaces de promotion biodiversité (SPB)
  { key: 'flower-fallow', label: 'Jachère florale', color: '#e879f9', category: 'biodiversity' },
  {
    key: 'rotational-fallow',
    label: 'Jachère tournante',
    color: '#d946ef',
    category: 'biodiversity',
  },
  { key: 'flower-strip', label: 'Bande fleurie', color: '#f0abfc', category: 'biodiversity' },
  { key: 'litter-area', label: 'Surface à litière', color: '#a3a380', category: 'biodiversity' },
  {
    key: 'extensive-meadow',
    label: 'Prairie extensive',
    color: '#bef264',
    category: 'biodiversity',
  },

  // === Cultures spéciales — couleurs distinctives
  { key: 'vineyard', label: 'Vigne', color: '#7c3aed', category: 'special' },
  { key: 'orchard', label: 'Verger', color: '#db2777', category: 'special' },
  { key: 'field-vegetables', label: 'Légumes plein champ', color: '#0891b2', category: 'special' },
  { key: 'market-garden', label: 'Maraîchage', color: '#0284c7', category: 'special' },
  { key: 'aromatic-plants', label: 'Plantes aromatiques', color: '#5eead4', category: 'special' },
  { key: 'tobacco', label: 'Tabac', color: '#78350f', category: 'special' },

  // === Couverts / engrais verts
  { key: 'green-manure', label: 'Engrais vert', color: '#16a34a', category: 'cover' },
  { key: 'cover-crop', label: 'Couvert végétal', color: '#15803d', category: 'cover' },

  // === Jachère / sol nu / non-productif
  { key: 'fallow', label: 'Jachère', color: '#a3a380', category: 'fallow' },
  { key: 'bare-soil', label: 'Sol nu / Labour', color: '#a8a29e', category: 'fallow' },
  { key: 'forest', label: 'Forêt', color: '#064e3b', category: 'fallow' },
  { key: 'unproductive', label: 'Surface improductive', color: '#525252', category: 'fallow' },

  // === Autre (exclu des listes de sélection)
  { key: 'archived', label: 'Archivé', color: '#9ca3af', category: 'other' },
];

const DEFAULT_COLOR = '#9ca3af';

// Fusion catalogue Agridéa + cultures custom utilisateur (overlay localStorage).
// cultures-custom n'importe que des `type` depuis ce fichier → pas de cycle runtime.
import { getCustomCultures } from './cultures-custom.store';

function allCultures(): ReadonlyArray<CultureInfo> {
  return [...CULTURES, ...getCustomCultures()];
}

export function cultureByLabel(label: string | undefined): CultureInfo | undefined {
  if (!label) return undefined;
  const norm = label.toLowerCase();
  return allCultures().find((c) => c.label.toLowerCase() === norm);
}

export function cultureByKey(key: string | undefined): CultureInfo | undefined {
  if (!key) return undefined;
  return allCultures().find((c) => c.key === key);
}

/** Conversion label FR -> key stable (pour persistance DB). */
export function cultureKeyByLabel(label: string | undefined): string | undefined {
  return cultureByLabel(label)?.key;
}

/** Conversion key DB -> label FR (pour affichage UI). */
export function cultureLabelByKey(key: string | undefined): string | undefined {
  return cultureByKey(key)?.label;
}

export function cultureColor(label: string | undefined): string {
  return cultureByLabel(label)?.color ?? DEFAULT_COLOR;
}

/**
 * Retourne `#fff` ou `#000` selon la luminosité perçue du fond.
 * Formule YIQ : luminance = 0.299*R + 0.587*G + 0.114*B.
 * Seuil 140 (ajusté empiriquement pour les couleurs vives flashy du catalogue).
 */
export function contrastTextColor(hexBg: string): '#000' | '#fff' {
  const hex = hexBg.replace('#', '');
  if (hex.length !== 6) return '#fff';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 140 ? '#000' : '#fff';
}

/** Cultures disponibles dans les sélecteurs (exclut "Archivé"). */
export function listCultureLabels(): string[] {
  return allCultures()
    .filter((c) => c.category !== 'other')
    .map((c) => c.label);
}

/**
 * Radicaux des cultures pour le filtrage : on regroupe les variantes
 * ("Blé d'automne", "Blé de printemps", "Blé dur" → "Blé").
 * Le filtre SearchBar exploite ces groupes ; le détail des variétés
 * reste accessible dans le form d'édition d'un segment d'assolement.
 */
const GROUP_RADICALS = ['Blé', 'Orge', 'Maïs', 'Colza', 'Betterave', 'Prairie', 'Jachère'];

export function cultureGroup(label: string | undefined): string {
  if (!label) return '';
  for (const radical of GROUP_RADICALS) {
    if (label === radical || label.startsWith(radical + ' ')) return radical;
  }
  return label;
}

/** Groupes uniques (radicaux) — utilisé dans les options des filtres. */
export function listCultureGroups(): string[] {
  const groups = new Set<string>();
  for (const c of allCultures()) {
    if (c.category === 'other') continue;
    groups.add(cultureGroup(c.label));
  }
  return [...groups];
}

/** Groupé par catégorie pour les <optgroup> dans les <select>. */
export const CULTURES_BY_CATEGORY: ReadonlyArray<{
  category: CultureCategory;
  label: string;
  cultures: ReadonlyArray<CultureInfo>;
}> = (
  [
    ['cereal', 'Céréales'],
    ['oilseed', 'Oléagineux'],
    ['protein', 'Protéagineux'],
    ['root', 'Sarclées / racines'],
    ['forage', 'Prairies & fourrages'],
    ['biodiversity', 'Biodiversité (SPB)'],
    ['special', 'Cultures spéciales'],
    ['cover', 'Couverts / engrais verts'],
    ['fallow', 'Jachère / sol nu'],
  ] as ReadonlyArray<[CultureCategory, string]>
).map(([category, label]) => ({
  category,
  label,
  cultures: CULTURES.filter((c) => c.category === category),
}));
