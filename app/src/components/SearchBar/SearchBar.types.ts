/**
 * SearchBar — Pattern Odoo SearchPanel, light par défaut.
 * Spec : Phase0_Components/SearchBar/SearchBar_CHECKLIST.md
 *
 * - Une barre unique : facets + input
 * - Lead : loupe + entonnoir
 * - Tail : chevron qui ouvre le panneau Filtres / Regrouper / Favoris
 * - Multi-valeur intra-facet = OR
 * - Multi-facet = AND
 */

export type FilterPrimitive = string | number | boolean | Date | null;

export interface FilterOption {
  label: string;
  value: FilterPrimitive;
}

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'starts_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'in'
  | 'not_in'
  | 'is_set'
  | 'is_not_set';

export interface FieldDescriptor {
  /** Identifiant unique. */
  id: string;
  /** Libellé affiché (chip + suggestion). */
  label: string;
  /** Type technique du champ. */
  type:
    | 'text'
    | 'number'
    | 'boolean'
    | 'date'
    | 'datetime'
    | 'select'
    | 'many2one'
    | 'many2many'
    | 'tags';
  /** Options statiques pour select / tags. */
  options?: FilterOption[];
  /** Loader async (autocomplete) pour many2one / many2many. */
  fetchOptions?: (query: string) => Promise<FilterOption[]>;
  /** Champ utilisable dans la barre de suggestions. Défaut true pour text/many2one. */
  searchable?: boolean;
  /** Champ proposable comme option de regroupement. Défaut false. */
  groupable?: boolean;
  /** Opérateurs supportés. */
  operators?: FilterOperator[];
}

/** Un filtre actif = un "facet" affiché dans la barre. */
export interface Facet {
  /** ID unique. */
  id: string;
  fieldId: string;
  operator: FilterOperator;
  /** Valeur(s) ; plusieurs = OR. */
  values: FilterPrimitive[];
  /** Label custom (sinon généré). */
  customLabel?: string;
}

export interface GroupBy {
  fieldId: string;
  granularity?: 'day' | 'week' | 'month' | 'quarter' | 'year';
}

export type SortDirection = 'asc' | 'desc';
export interface SortBy {
  fieldId: string;
  direction: SortDirection;
}

export interface SearchState {
  /** Texte libre en cours de saisie. */
  query?: string;
  facets: Facet[];
  groupBy: GroupBy[];
  sortBy?: SortBy;
}

export interface SavedFavorite {
  id: string;
  name: string;
  isDefault?: boolean;
  shared?: boolean;
  state: SearchState;
}

export interface SearchBarProps {
  /** Schéma des champs disponibles. */
  fields: FieldDescriptor[];
  /** État courant (controlled). */
  value: SearchState;
  /** Callback changement d'état. */
  onChange: (state: SearchState) => void;
  /** Favoris disponibles. */
  favorites?: SavedFavorite[];
  /** Callback création favori. */
  onSaveFavorite?: (name: string, options: { shared: boolean; isDefault: boolean }) => void;
  /** Callback suppression favori. */
  onDeleteFavorite?: (favoriteId: string) => void;
  /** Placeholder de l'input. Défaut 'Rechercher…'. */
  placeholder?: string;
  /** Délai debounce sur changements query. Défaut 300 ms. */
  debounceMs?: number;
  /** Désactive la barre. */
  disabled?: boolean;
  /** Thème. 'light' par défaut. */
  theme?: 'light' | 'dark';
  /** Label ARIA. */
  ariaLabel?: string;
  /** Classe CSS optionnelle. */
  className?: string;
  /** Identifiant stable pour persister les favoris en localStorage si aucun
   *  callback `onSaveFavorite`/`onDeleteFavorite` n'est fourni. Sans cette clé
   *  ni callback, le bouton "Enregistrer la recherche" reste affiché et persiste
   *  les favoris sous une clé dérivée du schéma de champs. */
  storageKey?: string;
}

export const SEARCH_BAR_DEFAULTS = {
  debounceMs: 300,
  placeholder: 'Rechercher…',
  theme: 'light' as const,
};

/* ============================================================
 * Helpers
 * ============================================================ */

/** Génère un ID stable pour une facet. */
export function makeFacetId(): string {
  return `facet-${Math.random().toString(36).slice(2, 10)}`;
}

/** Construit le label affiché pour une facet (à partir des valeurs). */
export function formatFacetLabel(facet: Facet, field: FieldDescriptor | undefined): string {
  if (facet.customLabel) return facet.customLabel;
  const fieldLabel = field?.label ?? facet.fieldId;
  const stringValues = facet.values.map((v) => formatFilterValue(v));
  const joiner = facet.values.length > 1 ? ' ou ' : '';
  if (stringValues.length === 0) return fieldLabel;
  return `${fieldLabel} : ${stringValues.join(joiner)}`;
}

function formatFilterValue(value: FilterPrimitive): string {
  if (value === null) return '—';
  if (value instanceof Date) return value.toLocaleDateString('fr-CH');
  return String(value);
}
