"use client";

/**
 * Composant générique de visualisation de ressource — pattern Odoo.
 *
 * Bascule **liste / kanban**, avec **barre de recherche Odoo-like** :
 * un dropdown 3 colonnes qui ouvre Filtres / Regrouper par / Favoris.
 *
 * - **Search** : matching live sur les champs déclarés (`searchFields`).
 * - **Filtres** : prédicats cochables (un par un, ou cumulables). Le
 *   parent passe la liste de filtres ; le composant gère l'état actif
 *   et le rendu en chips.
 * - **Regrouper par** : option exclusive qui contrôle le `kanbanGroups`
 *   en mode kanban (et un séparateur visuel en mode liste plus tard).
 * - **Favoris** : sauvegarde locale d'une combinaison
 *   {recherche, filtres, regroupement, vue} sous un nom donné. Persistée
 *   en localStorage pour ne pas re-cocher à chaque visite.
 *
 * Ne dépend que de `@/components/ui/{button,input}` + lucide.
 */
import {
  Bookmark,
  CalendarDays,
  ChevronDown,
  Columns,
  Filter as FilterIcon,
  Layers as LayersIcon,
  LayoutGrid,
  List,
  type LucideIcon,
  Map as MapIcon,
  Search,
  Star,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

// ---------- Types publics ---------------------------------------------------

export type ViewMode = "list" | "kanban" | "card" | "calendar" | "map";

export interface ListColumn<T> {
  key: string;
  /** Texte ou node (ex : checkbox "tout sélectionner") du header. */
  header: React.ReactNode;
  cell: (item: T) => React.ReactNode;
  className?: string;
  hideBelow?: "sm" | "md" | "lg";
}

export interface SavedFavorite {
  name: string;
  search: string;
  activeFilterKeys: string[];
  groupByKey: string | null;
  view: ViewMode;
}

/**
 * Un filtre prédéfini. `predicate` filtre les items quand le filtre est
 * actif. `key` est utilisé pour l'état persistant.
 */
export interface FilterOption<T> {
  key: string;
  label: string;
  /** True = on garde l'item. */
  predicate: (item: T) => boolean;
}

/**
 * Une option de regroupement. `groupKey` extrait la clé du groupe pour
 * un item ; `groupLabel` traduit la clé en libellé affiché ; `accent`
 * applique une classe Tailwind à la pastille du compteur.
 */
export interface GroupByOption<T> {
  key: string;
  label: string;
  groupKey: (item: T) => string;
  groupLabel: (key: string) => string;
  /** Ordre des colonnes dans le kanban (par groupKey). Si absent → ordre alpha. */
  order?: string[];
  accent?: (key: string) => string | undefined;
  icon?: (key: string) => LucideIcon | undefined;
}

export interface ResourceViewProps<T> {
  /** Identifiant stable de la ressource — clé localStorage favoris + vue. */
  storageKey: string;
  /** Vue par défaut si rien en localStorage. */
  defaultView?: ViewMode;
  /** Items source (non filtrés). */
  data: T[];
  /** Colonnes mode liste. */
  columns: ListColumn<T>[];
  /** Renderer d'une carte mode kanban. */
  renderKanbanCard: (item: T) => React.ReactNode;
  /**
   * Renderer d'une carte mode "card" (vue par défaut sur mobile).
   * Si non fourni, on réutilise `renderKanbanCard` — rétrocompat.
   * Conçu compact : titre + 2-3 infos clés + actions inline.
   */
  renderCard?: (item: T) => React.ReactNode;
  /** Champs où la search bar matche (insensible casse, includes). */
  searchFields: (item: T) => string;
  /** Filtres cochables. */
  filters?: FilterOption<T>[];
  /** Options de regroupement (mode kanban). */
  groupBys?: GroupByOption<T>[];
  /** Clé unique d'un item (key React + localStorage). */
  getKey: (item: T) => string;
  /** Action sur clic ligne / carte. */
  onItemClick?: (item: T) => void;
  /** Slot vide quand `data` est vide à la source. */
  emptyState?: React.ReactNode;
  /** Placeholder de la search bar. */
  searchPlaceholder?: string;
  /**
   * Champ date utilisé par le mode "calendar" pour positionner les
   * items sur la grille mensuelle. Doit retourner une date (Date ou
   * ISO string). Si absent, le mode calendar est désactivé.
   */
  dateField?: (item: T) => Date | string | null | undefined;
  /**
   * Renderer compact d'un item dans une cellule de calendrier (sert
   * aussi de tooltip au survol). Si absent, on retombe sur renderCard.
   */
  renderCalendarItem?: (item: T) => React.ReactNode;
  /**
   * Renderer custom pour le mode "map" — typiquement une vue Leaflet
   * pour les ressources géolocalisées (parcelles, animaux GPS…).
   * Reçoit la liste des items filtrés (post-recherche/filtres). Si
   * absent, le mode map est désactivé.
   */
  renderMapView?: (filteredData: T[]) => React.ReactNode;
  /**
   * Restreint les vues affichées dans le toolbar. Par défaut card+list+
   * kanban (+ calendar si dateField, + map si renderMapView).
   */
  availableViews?: ViewMode[];
  /**
   * Active les checkboxes de sélection multiple + barre flottante
   * d'actions bulk. Active la 1re colonne checkbox + checkbox "tout
   * cocher" en tête, et expose les items sélectionnés via les actions.
   * Demande Fabien 2026-05-06 : pattern bulk edit sur toutes les listes.
   */
  selectable?: boolean;
  /**
   * Actions disponibles dans la barre flottante quand au moins un item
   * est sélectionné. Chaque action reçoit la liste des items et gère
   * son propre feedback (toast/alert).
   */
  bulkActions?: BulkAction<T>[];
}

/**
 * Action bulk sur la sélection : libellé, icône optionnelle, classe
 * Tailwind pour la couleur (ex bg-red-600 pour Supprimer), handler.
 */
export interface BulkAction<T> {
  key: string;
  label: string;
  icon?: LucideIcon;
  className?: string;
  /**
   * Confirmation message — si fourni, on affiche une confirm() avant
   * d'appeler handler. Useful for destructive actions.
   */
  confirm?: string;
  handler: (items: T[]) => void | Promise<void>;
}

// ---------- Implémentation --------------------------------------------------

interface PersistedState {
  view: ViewMode;
  search: string;
  activeFilterKeys: string[];
  groupByKey: string | null;
  favorites: SavedFavorite[];
}

function loadState(storageKey: string, defaultView: ViewMode): PersistedState {
  if (typeof window === "undefined") {
    return { view: defaultView, search: "", activeFilterKeys: [], groupByKey: null, favorites: [] };
  }
  try {
    const raw = window.localStorage.getItem(`resourceView:${storageKey}`);
    if (!raw) {
      return {
        view: defaultView,
        search: "",
        activeFilterKeys: [],
        groupByKey: null,
        favorites: [],
      };
    }
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      view:
        parsed.view === "kanban" ||
        parsed.view === "list" ||
        parsed.view === "card" ||
        parsed.view === "calendar" ||
        parsed.view === "map"
          ? parsed.view
          : defaultView,
      search: typeof parsed.search === "string" ? parsed.search : "",
      activeFilterKeys: Array.isArray(parsed.activeFilterKeys) ? parsed.activeFilterKeys : [],
      groupByKey: typeof parsed.groupByKey === "string" ? parsed.groupByKey : null,
      favorites: Array.isArray(parsed.favorites) ? (parsed.favorites as SavedFavorite[]) : [],
    };
  } catch {
    return { view: defaultView, search: "", activeFilterKeys: [], groupByKey: null, favorites: [] };
  }
}

function saveState(storageKey: string, state: PersistedState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`resourceView:${storageKey}`, JSON.stringify(state));
  } catch {
    // localStorage plein ou désactivé — on ignore silencieusement.
  }
}

export function ResourceView<T>(props: ResourceViewProps<T>) {
  // Sur mobile (< sm), default = "card" (compact, gros doigts).
  // Sur desktop, on garde la valeur explicite (default "list").
  // Une fois que l'user a basculé manuellement, le choix est persisté
  // en localStorage et prime sur l'auto-default.
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
  const defaultView: ViewMode = props.defaultView ?? (isMobile ? "card" : "list");
  const [view, setView] = useState<ViewMode>(defaultView);
  const [search, setSearch] = useState("");
  const [activeFilterKeys, setActiveFilterKeys] = useState<string[]>([]);
  const [groupByKey, setGroupByKey] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<SavedFavorite[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  /** Clés des colonnes masquées par l'utilisateur (Cmd+colonnes). */
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<Set<string>>(new Set());
  const [columnsPanelOpen, setColumnsPanelOpen] = useState(false);

  // Réhydratation de l'état au mount (et à chaque changement de storageKey).
  useEffect(() => {
    const persisted = loadState(props.storageKey, defaultView);
    setView(persisted.view);
    setSearch(persisted.search);
    setActiveFilterKeys(persisted.activeFilterKeys);
    setGroupByKey(persisted.groupByKey);
    setFavorites(persisted.favorites);
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(`resourceView:${props.storageKey}:hiddenCols`);
        if (raw) setHiddenColumnKeys(new Set(JSON.parse(raw) as string[]));
      } catch {
        // ignore
      }
    }
  }, [props.storageKey, defaultView]);

  // Persistance à chaque changement.
  useEffect(() => {
    saveState(props.storageKey, { view, search, activeFilterKeys, groupByKey, favorites });
  }, [props.storageKey, view, search, activeFilterKeys, groupByKey, favorites]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        `resourceView:${props.storageKey}:hiddenCols`,
        JSON.stringify(Array.from(hiddenColumnKeys)),
      );
    } catch {
      // ignore
    }
  }, [props.storageKey, hiddenColumnKeys]);

  const activeFilters = useMemo(
    () => (props.filters ?? []).filter((f) => activeFilterKeys.includes(f.key)),
    [props.filters, activeFilterKeys],
  );
  const activeGroupBy = useMemo(
    () => (props.groupBys ?? []).find((g) => g.key === groupByKey) ?? null,
    [props.groupBys, groupByKey],
  );

  // Application : search → filtres → tri ne sont pas faits ici (le tri reste
  // au parent). On n'expose que la liste filtrée + les groupes calculés.
  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = props.data;
    if (q) {
      out = out.filter((item) => props.searchFields(item).toLowerCase().includes(q));
    }
    for (const f of activeFilters) {
      out = out.filter(f.predicate);
    }
    return out;
  }, [props.data, search, activeFilterKeys, activeFilters, props]);

  const groups = useMemo(() => {
    if (!activeGroupBy) return null;
    const map = new Map<string, T[]>();
    for (const item of filteredData) {
      const key = activeGroupBy.groupKey(item);
      const bucket = map.get(key);
      if (bucket) bucket.push(item);
      else map.set(key, [item]);
    }
    const order = activeGroupBy.order ?? Array.from(map.keys()).sort();
    const ordered: {
      key: string;
      label: string;
      items: T[];
      accent?: string;
      icon?: LucideIcon;
    }[] = [];
    for (const key of order) {
      const accent = activeGroupBy.accent?.(key);
      const icon = activeGroupBy.icon?.(key);
      ordered.push({
        key,
        label: activeGroupBy.groupLabel(key),
        items: map.get(key) ?? [],
        ...(accent ? { accent } : {}),
        ...(icon ? { icon } : {}),
      });
    }
    // Ajoute en bas les groupes non listés dans `order` mais présents.
    for (const key of map.keys()) {
      if (!order.includes(key)) {
        const accent = activeGroupBy.accent?.(key);
        const icon = activeGroupBy.icon?.(key);
        ordered.push({
          key,
          label: activeGroupBy.groupLabel(key),
          items: map.get(key) ?? [],
          ...(accent ? { accent } : {}),
          ...(icon ? { icon } : {}),
        });
      }
    }
    return ordered;
  }, [activeGroupBy, filteredData]);

  const toggleFilter = (key: string) => {
    setActiveFilterKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };
  const setGroupBy = (key: string | null) => {
    setGroupByKey(key);
    // UX : choisir un groupBy depuis la vue Cartes ou Liste bascule
    // automatiquement en mode Kanban (où le regroupement a un effet
    // visuel — les colonnes par groupe). Désactiver le groupBy ne
    // re-bascule PAS — on laisse l'utilisateur sur le kanban si c'est
    // ce qu'il veut.
    if (key !== null && view !== "kanban") {
      setView("kanban");
    }
  };

  const saveFavorite = () => {
    const name = window.prompt(
      "Nom du favori ?",
      `Recherche du ${new Date().toLocaleDateString("fr-CH")}`,
    );
    if (!name) return;
    const fav: SavedFavorite = { name, search, activeFilterKeys, groupByKey, view };
    setFavorites((prev) => [...prev.filter((f) => f.name !== name), fav]);
  };
  const applyFavorite = (fav: SavedFavorite) => {
    setSearch(fav.search);
    setActiveFilterKeys(fav.activeFilterKeys);
    setGroupByKey(fav.groupByKey);
    setView(fav.view);
    setPanelOpen(false);
  };
  const removeFavorite = (name: string) => {
    setFavorites((prev) => prev.filter((f) => f.name !== name));
  };

  return (
    <div className="space-y-3">
      <SearchBar
        search={search}
        onSearchChange={setSearch}
        activeFilters={activeFilters}
        activeGroupBy={activeGroupBy}
        onRemoveFilter={(k) => toggleFilter(k)}
        onClearGroupBy={() => setGroupByKey(null)}
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen((v) => !v)}
        onClosePanel={() => setPanelOpen(false)}
        view={view}
        onViewChange={setView}
        filters={props.filters ?? []}
        groupBys={props.groupBys ?? []}
        favorites={favorites}
        activeFilterKeys={activeFilterKeys}
        groupByKey={groupByKey}
        onToggleFilter={toggleFilter}
        onSetGroupBy={setGroupBy}
        onSaveFavorite={saveFavorite}
        onApplyFavorite={applyFavorite}
        onRemoveFavorite={removeFavorite}
        searchPlaceholder={props.searchPlaceholder ?? "Rechercher…"}
        allColumns={props.columns}
        hiddenColumnKeys={hiddenColumnKeys}
        onToggleColumn={(k) => {
          setHiddenColumnKeys((prev) => {
            const next = new Set(prev);
            if (next.has(k)) next.delete(k);
            else next.add(k);
            return next;
          });
        }}
        columnsPanelOpen={columnsPanelOpen}
        onToggleColumnsPanel={() => setColumnsPanelOpen((v) => !v)}
        onCloseColumnsPanel={() => setColumnsPanelOpen(false)}
        calendarAvailable={!!props.dateField}
        mapAvailable={!!props.renderMapView}
        {...(props.availableViews ? { availableViews: props.availableViews } : {})}
      />

      {props.data.length === 0 && props.emptyState ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
          {props.emptyState}
        </div>
      ) : filteredData.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-foreground/60">
          Aucun résultat pour cette recherche / ce filtre.
        </p>
      ) : view === "list" ? (
        <ListView
          data={filteredData}
          columns={(() => {
            const visible = props.columns.filter((c) => !hiddenColumnKeys.has(c.key));
            return props.selectable
              ? [buildSelectColumn(props, filteredData, selectedKeys, setSelectedKeys), ...visible]
              : visible;
          })()}
          getKey={props.getKey}
          {...(props.onItemClick ? { onItemClick: props.onItemClick } : {})}
          {...(groups ? { groups } : {})}
        />
      ) : view === "card" ? (
        <CardView
          data={filteredData}
          getKey={props.getKey}
          renderCard={props.renderCard ?? props.renderKanbanCard}
          {...(props.onItemClick ? { onItemClick: props.onItemClick } : {})}
          {...(props.selectable
            ? {
                selectable: true,
                selectedKeys,
                onToggleSelect: (k: string) => {
                  const next = new Set(selectedKeys);
                  if (next.has(k)) next.delete(k);
                  else next.add(k);
                  setSelectedKeys(next);
                },
              }
            : {})}
        />
      ) : view === "calendar" ? (
        props.dateField ? (
          <CalendarView
            data={filteredData}
            getKey={props.getKey}
            dateField={props.dateField}
            renderItem={props.renderCalendarItem ?? props.renderCard ?? props.renderKanbanCard}
            {...(props.onItemClick ? { onItemClick: props.onItemClick } : {})}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-foreground/60">
            Vue calendrier indisponible : aucun champ date configuré pour cette ressource.
          </p>
        )
      ) : view === "map" ? (
        props.renderMapView ? (
          <div>{props.renderMapView(filteredData)}</div>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-foreground/60">
            Vue carte indisponible pour cette ressource.
          </p>
        )
      ) : (
        <KanbanView
          groups={
            groups ?? [
              {
                key: "all",
                label: "Tous",
                items: filteredData,
                accent: undefined,
                icon: undefined,
              },
            ]
          }
          getKey={props.getKey}
          renderKanbanCard={props.renderKanbanCard}
          {...(props.onItemClick ? { onItemClick: props.onItemClick } : {})}
          {...(props.selectable
            ? {
                selectable: true,
                selectedKeys,
                onToggleSelect: (k: string) => {
                  const next = new Set(selectedKeys);
                  if (next.has(k)) next.delete(k);
                  else next.add(k);
                  setSelectedKeys(next);
                },
              }
            : {})}
        />
      )}

      {props.selectable && selectedKeys.size > 0 && (
        <BulkActionBar
          count={selectedKeys.size}
          onClear={() => setSelectedKeys(new Set())}
          actions={props.bulkActions ?? []}
          onAction={async (action) => {
            const items = filteredData.filter((it) => selectedKeys.has(props.getKey(it)));
            if (action.confirm && !confirm(action.confirm.replace("{n}", String(items.length))))
              return;
            await action.handler(items);
            setSelectedKeys(new Set());
          }}
        />
      )}
    </div>
  );
}

/**
 * Construit la colonne checkbox de sélection : checkbox "tout" en
 * tête (avec indeterminate), checkbox par ligne. La colonne est
 * insérée en 1re position quand props.selectable=true.
 */
function buildSelectColumn<T>(
  props: ResourceViewProps<T>,
  filteredData: T[],
  selectedKeys: Set<string>,
  setSelectedKeys: (next: Set<string>) => void,
): ListColumn<T> {
  const allKeys = filteredData.map(props.getKey);
  const selectedVisible = allKeys.filter((k) => selectedKeys.has(k));
  const allChecked = filteredData.length > 0 && selectedVisible.length === filteredData.length;
  const someChecked = selectedVisible.length > 0 && selectedVisible.length < filteredData.length;
  return {
    key: "__select__",
    className: "w-10",
    header: (
      <input
        type="checkbox"
        aria-label="Tout sélectionner"
        checked={allChecked}
        ref={(el) => {
          if (el) el.indeterminate = someChecked;
        }}
        onChange={() => {
          if (allChecked || someChecked) setSelectedKeys(new Set());
          else setSelectedKeys(new Set(allKeys));
        }}
        className="h-5 w-5 cursor-pointer"
      />
    ),
    cell: (item) => {
      const k = props.getKey(item);
      return (
        <input
          type="checkbox"
          aria-label="Sélectionner"
          checked={selectedKeys.has(k)}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation();
            const next = new Set(selectedKeys);
            if (next.has(k)) next.delete(k);
            else next.add(k);
            setSelectedKeys(next);
          }}
          className="h-5 w-5 cursor-pointer"
        />
      );
    },
  };
}

/**
 * Barre flottante d'actions bulk affichée en bas de page quand au
 * moins un item est sélectionné. Pattern Odoo / Notion.
 */
function BulkActionBar<T>({
  count,
  onClear,
  actions,
  onAction,
}: {
  count: number;
  onClear: () => void;
  actions: BulkAction<T>[];
  onAction: (action: BulkAction<T>) => void | Promise<void>;
}) {
  return (
    <div
      className="
        fixed bottom-0 left-0 right-0 z-40
        border-t border-border bg-background px-3 py-2 shadow-2xl
        sm:bottom-4 sm:left-1/2 sm:right-auto sm:rounded-full sm:border sm:px-4 sm:-translate-x-1/2
      "
    >
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <span className="text-sm font-medium">
          {count} sélectionné{count > 1 ? "s" : ""}
        </span>
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => void onAction(a)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 active:opacity-80 sm:py-1.5 ${
                a.className ?? "bg-green hover:bg-green-dark"
              }`}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {a.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg px-3 py-2 text-xs text-foreground/60 hover:bg-muted hover:text-foreground sm:py-1"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

// ---------- CardView (vue par défaut sur mobile) -------------------------

interface CardViewProps<T> {
  data: T[];
  getKey: (item: T) => string;
  renderCard: (item: T) => React.ReactNode;
  onItemClick?: (item: T) => void;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onToggleSelect?: (key: string) => void;
}

function CardView<T>({
  data,
  getKey,
  renderCard,
  onItemClick,
  selectable,
  selectedKeys,
  onToggleSelect,
}: CardViewProps<T>) {
  return (
    <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((item) => {
        const key = getKey(item);
        const isSelected = selectedKeys?.has(key) ?? false;
        const content = (
          <div
            className={`relative h-full rounded-xl border bg-background p-3 transition-colors hover:bg-muted/30 ${
              isSelected ? "border-green ring-2 ring-green/20" : "border-border"
            }`}
          >
            {selectable && (
              <input
                type="checkbox"
                aria-label="Sélectionner"
                checked={isSelected}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggleSelect?.(key);
                }}
                className="absolute left-2 top-2 z-10 h-5 w-5 cursor-pointer"
              />
            )}
            <div className={selectable ? "pl-6" : undefined}>{renderCard(item)}</div>
          </div>
        );
        return onItemClick ? (
          <button
            key={key}
            type="button"
            onClick={() => onItemClick(item)}
            className="block h-full w-full text-left"
          >
            {content}
          </button>
        ) : (
          <div key={key} className="h-full">
            {content}
          </div>
        );
      })}
    </div>
  );
}

// ---------- CalendarView (vue mensuelle) ---------------------------------

interface CalendarViewProps<T> {
  data: T[];
  getKey: (item: T) => string;
  dateField: (item: T) => Date | string | null | undefined;
  renderItem: (item: T) => React.ReactNode;
  onItemClick?: (item: T) => void;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function CalendarView<T>({
  data,
  getKey,
  dateField,
  renderItem,
  onItemClick,
}: CalendarViewProps<T>) {
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));

  // Map jour ISO (YYYY-MM-DD) → items pour ce jour. Skip items sans date.
  const itemsByDay = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const item of data) {
      const raw = dateField(item);
      if (!raw) continue;
      const d = typeof raw === "string" ? new Date(raw) : raw;
      if (Number.isNaN(d.getTime())) continue;
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const bucket = map.get(k);
      if (bucket) bucket.push(item);
      else map.set(k, [item]);
    }
    return map;
  }, [data, dateField]);

  // Construit la grille du mois : 1ère case = lundi de la semaine du 1er
  // jour du mois (peut être en mois précédent), 6 semaines × 7 jours.
  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const dayOfWeek = (first.getDay() + 6) % 7; // 0 = lundi
    const start = new Date(first);
    start.setDate(first.getDate() - dayOfWeek);
    const out: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d);
    }
    return out;
  }, [cursor]);

  const today = new Date();
  const monthLabel = cursor.toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
  const goPrev = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const goNext = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  const goToday = () => setCursor(startOfMonth(new Date()));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2">
        <button
          type="button"
          onClick={goPrev}
          className="rounded-md p-1.5 hover:bg-muted"
          aria-label="Mois précédent"
        >
          ←
        </button>
        <span className="text-sm font-semibold capitalize">{monthLabel}</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={goToday}
            className="rounded-md px-2 py-1 text-xs hover:bg-muted"
          >
            Aujourd&apos;hui
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-md p-1.5 hover:bg-muted"
            aria-label="Mois suivant"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
        {JOURS_COURTS.map((j) => (
          <div
            key={j}
            className="bg-muted px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-foreground/60 sm:text-xs"
          >
            {j}
          </div>
        ))}
        {cells.map((d) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = isSameDay(d, today);
          const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const items = itemsByDay.get(k) ?? [];
          return (
            <div
              key={k}
              className={`min-h-[80px] bg-background p-1 sm:min-h-[110px] ${
                inMonth ? "" : "opacity-40"
              } ${isToday ? "ring-2 ring-inset ring-green" : ""}`}
            >
              <div className="mb-1 flex items-baseline justify-between text-[11px]">
                <span className={`font-medium ${isToday ? "text-green" : "text-foreground/70"}`}>
                  {d.getDate()}
                </span>
                {items.length > 0 && (
                  <span className="rounded-full bg-muted px-1.5 text-[10px] text-foreground/60">
                    {items.length}
                  </span>
                )}
              </div>
              <ul className="space-y-1">
                {items.slice(0, 3).map((item) => {
                  const key = getKey(item);
                  const content = (
                    <div className="cursor-pointer truncate rounded border border-green/30 bg-green/5 px-1 py-0.5 text-[11px] hover:bg-green/10">
                      {renderItem(item)}
                    </div>
                  );
                  return onItemClick ? (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => onItemClick(item)}
                        className="block w-full text-left"
                      >
                        {content}
                      </button>
                    </li>
                  ) : (
                    <li key={key}>{content}</li>
                  );
                })}
                {items.length > 3 && (
                  <li className="text-[10px] text-foreground/50">+ {items.length - 3} autres</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- SearchBar + Panel ---------------------------------------------

function SearchBar<T>(props: {
  search: string;
  onSearchChange: (v: string) => void;
  activeFilters: FilterOption<T>[];
  activeGroupBy: GroupByOption<T> | null;
  onRemoveFilter: (key: string) => void;
  onClearGroupBy: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
  onClosePanel: () => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  filters: FilterOption<T>[];
  groupBys: GroupByOption<T>[];
  favorites: SavedFavorite[];
  activeFilterKeys: string[];
  groupByKey: string | null;
  onToggleFilter: (key: string) => void;
  onSetGroupBy: (key: string | null) => void;
  onSaveFavorite: () => void;
  onApplyFavorite: (fav: SavedFavorite) => void;
  onRemoveFavorite: (name: string) => void;
  searchPlaceholder: string;
  calendarAvailable: boolean;
  mapAvailable: boolean;
  availableViews?: ViewMode[];
  /** Toutes les colonnes définies (pour le menu Colonnes). */
  allColumns: ListColumn<T>[];
  /** Clés des colonnes actuellement masquées. */
  hiddenColumnKeys: Set<string>;
  /** Toggle visibilité d'une colonne. */
  onToggleColumn: (key: string) => void;
  /** État du dropdown Colonnes. */
  columnsPanelOpen: boolean;
  onToggleColumnsPanel: () => void;
  onCloseColumnsPanel: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const colsPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!props.columnsPanelOpen) return;
    const handler = (e: PointerEvent) => {
      if (!colsPanelRef.current?.contains(e.target as Node)) {
        props.onCloseColumnsPanel();
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [props.columnsPanelOpen, props.onCloseColumnsPanel]);
  useEffect(() => {
    if (!props.panelOpen) return;
    // pointerdown couvre tactile (iOS Safari), souris et stylet — plus
    // robuste que mousedown qui peut être manqué sur tactile derrière
    // certains parents fixed/sticky.
    const handler = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        props.onClosePanel();
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [props.panelOpen, props.onClosePanel]);

  // Pattern Odoo : clic n'importe où dans la search bar (input ou chips)
  // ouvre le panneau Filtres / Regrouper / Favoris.
  const openPanelIfClosed = () => {
    if (!props.panelOpen) props.onTogglePanel();
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-stretch gap-2">
        <div
          role="button"
          tabIndex={-1}
          onClick={openPanelIfClosed}
          className="relative flex flex-1 cursor-text items-center rounded-lg border border-border bg-background"
        >
          <Search className="ml-3 h-4 w-4 text-foreground/40" />
          <div className="flex flex-1 flex-wrap items-center gap-1 px-2 py-1.5">
            {props.activeFilters.map((f) => (
              <Chip
                key={f.key}
                icon={FilterIcon}
                label={f.label}
                accent="bg-purple-100 text-purple-900"
                onRemove={() => props.onRemoveFilter(f.key)}
              />
            ))}
            {props.activeGroupBy && (
              <Chip
                icon={LayersIcon}
                label={`Groupé par ${props.activeGroupBy.label.toLowerCase()}`}
                accent="bg-blue-100 text-blue-900"
                onRemove={props.onClearGroupBy}
              />
            )}
            <input
              type="text"
              value={props.search}
              onChange={(e) => props.onSearchChange(e.target.value)}
              placeholder={props.searchPlaceholder}
              className="min-w-[120px] flex-1 bg-transparent py-1 text-sm outline-none"
              onFocus={openPanelIfClosed}
              onClick={(e) => {
                e.stopPropagation();
                openPanelIfClosed();
              }}
            />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              props.onTogglePanel();
            }}
            className="flex h-full items-center border-l border-border px-3 hover:bg-muted"
            aria-label="Filtres et regroupement"
          >
            <ChevronDown
              className={`h-4 w-4 text-foreground/60 transition-transform ${
                props.panelOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
          {(props.availableViews ?? ["card", "list", "kanban"]).includes("card") && (
            <ViewToggleButton
              active={props.view === "card"}
              onClick={() => props.onViewChange("card")}
              icon={LayoutGrid}
              label="Cartes"
            />
          )}
          {(props.availableViews ?? ["card", "list", "kanban"]).includes("list") && (
            <ViewToggleButton
              active={props.view === "list"}
              onClick={() => props.onViewChange("list")}
              icon={List}
              label="Liste"
            />
          )}
          {(props.availableViews ?? ["card", "list", "kanban"]).includes("kanban") && (
            <ViewToggleButton
              active={props.view === "kanban"}
              onClick={() => props.onViewChange("kanban")}
              icon={Columns}
              label="Kanban"
            />
          )}
          {props.calendarAvailable &&
            (props.availableViews ?? ["calendar"]).includes("calendar") && (
              <ViewToggleButton
                active={props.view === "calendar"}
                onClick={() => props.onViewChange("calendar")}
                icon={CalendarDays}
                label="Calendrier"
              />
            )}
          {props.mapAvailable && (props.availableViews ?? ["map"]).includes("map") && (
            <ViewToggleButton
              active={props.view === "map"}
              onClick={() => props.onViewChange("map")}
              icon={MapIcon}
              label="Carte"
            />
          )}
        </div>

        {/* Bouton "Colonnes" — visible uniquement en vue liste, où il
            a un effet. Demande Fabien 2026-05-06 : "il manque le
            bouton pour ajouter ou masquer des colonnes". */}
        {props.view === "list" && props.allColumns.length > 0 && (
          <div className="relative" ref={colsPanelRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                props.onToggleColumnsPanel();
              }}
              className="flex h-10 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground/70 hover:bg-muted"
              aria-label="Colonnes"
              title="Afficher / masquer les colonnes"
            >
              <Columns className="h-4 w-4" />
              <span className="hidden sm:inline">Colonnes</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${props.columnsPanelOpen ? "rotate-180" : ""}`}
              />
            </button>
            {props.columnsPanelOpen && (
              <div className="absolute right-0 top-full z-[8500] mt-2 w-56 rounded-xl border border-border bg-background p-2 shadow-xl">
                <div className="mb-1 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-foreground/60">
                  Colonnes affichées
                </div>
                {props.allColumns.map((c) => {
                  const headerLabel =
                    typeof c.header === "string" ? c.header : c.key.replace(/^__/, "");
                  const visible = !props.hiddenColumnKeys.has(c.key);
                  return (
                    <label
                      key={c.key}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={() => props.onToggleColumn(c.key)}
                        className="h-4 w-4 cursor-pointer"
                      />
                      <span className="flex-1 truncate">{headerLabel || c.key}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {props.panelOpen && (
        // z-index : top-bar mobile = 8000, drawer hamburger = 9100. Le panel
        // filtres doit passer au-dessus de la top-bar (sinon il se masque
        // quand on scroll le carnet sur mobile) mais rester sous le drawer
        // ouvert. 8500 satisfait les deux contraintes.
        <div
          className={`absolute left-0 right-0 top-full z-[8500] mt-2 grid max-h-[70vh] grid-cols-1 gap-0 overflow-y-auto rounded-xl border border-border bg-background shadow-xl ${
            // Adapter le nombre de colonnes selon ce qui est dispo —
            // évite les colonnes vides "Filtres / Regrouper par" sur
            // les pages qui ne passent rien (demande Fabien
            // 2026-05-06 : pas de filtres préconçus).
            props.filters.length > 0 && props.groupBys.length > 0
              ? "md:grid-cols-3"
              : props.filters.length > 0 || props.groupBys.length > 0
                ? "md:grid-cols-2"
                : "md:grid-cols-1"
          }`}
        >
          {props.filters.length > 0 && (
            <PanelColumn title="Filtres" icon={FilterIcon} accent="text-purple-700">
              {props.filters.map((f) => (
                <PanelItem
                  key={f.key}
                  active={props.activeFilterKeys.includes(f.key)}
                  onClick={() => props.onToggleFilter(f.key)}
                >
                  {f.label}
                </PanelItem>
              ))}
            </PanelColumn>
          )}
          {props.groupBys.length > 0 && (
            <PanelColumn title="Regrouper par" icon={LayersIcon} accent="text-blue-700">
              <PanelItem
                active={props.groupByKey === null}
                onClick={() => props.onSetGroupBy(null)}
              >
                Aucun regroupement
              </PanelItem>
              {props.groupBys.map((g) => (
                <PanelItem
                  key={g.key}
                  active={props.groupByKey === g.key}
                  onClick={() => props.onSetGroupBy(g.key)}
                >
                  {g.label}
                </PanelItem>
              ))}
            </PanelColumn>
          )}
          <PanelColumn title="Favoris" icon={Star} accent="text-amber-700">
            {props.favorites.length === 0 ? (
              <p className="text-xs text-foreground/40">Aucun favori.</p>
            ) : (
              props.favorites.map((fav) => (
                <div key={fav.name} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => props.onApplyFavorite(fav)}
                    className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <Bookmark className="h-3.5 w-3.5 text-amber-700" />
                    <span className="truncate">{fav.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onRemoveFavorite(fav.name)}
                    className="rounded p-1 text-foreground/40 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Supprimer le favori ${fav.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
            <button
              type="button"
              onClick={props.onSaveFavorite}
              className="mt-2 flex w-full items-center gap-2 rounded-md border border-dashed border-amber-300 bg-amber-50/50 px-2 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              <Star className="h-3.5 w-3.5" />
              Enregistrer la recherche actuelle
            </button>
          </PanelColumn>
        </div>
      )}
    </div>
  );
}

function PanelColumn({
  title,
  icon: Icon,
  accent,
  children,
}: {
  title: string;
  icon: LucideIcon;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border p-3 md:not-last:border-r">
      <div className={`mb-2 flex items-center gap-1.5 text-sm font-semibold ${accent}`}>
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function PanelItem({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
        active ? "bg-green/10 font-medium text-green-dark" : "hover:bg-muted"
      }`}
    >
      <span
        className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
          active ? "border-green bg-green text-white" : "border-foreground/20"
        }`}
      >
        {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
      <span className="flex-1 truncate">{children}</span>
    </button>
  );
}

function Chip({
  icon: Icon,
  label,
  accent,
  onRemove,
}: {
  icon: LucideIcon;
  label: string;
  accent: string;
  onRemove: () => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${accent}`}
    >
      <Icon className="h-3 w-3" />
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded hover:opacity-70"
        aria-label="Retirer"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function ViewToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-9 items-center justify-center rounded-md px-3 transition-colors ${
        active ? "bg-background shadow-sm" : "text-foreground/60 hover:bg-background/40"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

// ---------- ListView + KanbanView (rendus internes) -----------------------

function ListView<T>(props: {
  data: T[];
  columns: ListColumn<T>[];
  getKey: (item: T) => string;
  onItemClick?: (item: T) => void;
  groups?: { key: string; label: string; items: T[] }[] | undefined;
}) {
  // Groupes collapsibles : par défaut fermés (on doit cliquer pour ouvrir,
  // c'est le comportement Odoo-like demandé).
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (!props.groups) return new Set();
    return new Set(props.groups.map((g) => g.key));
  });

  // Quand la liste de groupes change (ex: regroupement différent), on
  // ferme les nouveaux groupes par défaut.
  const groupKeysSig = props.groups?.map((g) => g.key).join("|") ?? "";
  const lastSig = useRef(groupKeysSig);
  useEffect(() => {
    if (lastSig.current === groupKeysSig) return;
    lastSig.current = groupKeysSig;
    if (!props.groups) return;
    setCollapsed(new Set(props.groups.map((g) => g.key)));
  }, [groupKeysSig, props.groups]);

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const allCollapsed = props.groups ? props.groups.every((g) => collapsed.has(g.key)) : false;
  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set((props.groups ?? []).map((g) => g.key)));

  const hideClass = (h: ListColumn<T>["hideBelow"]) =>
    h === "sm"
      ? "hidden sm:table-cell"
      : h === "md"
        ? "hidden md:table-cell"
        : h === "lg"
          ? "hidden lg:table-cell"
          : "";

  // Si on a des groupes, on affiche un header de groupe entre les rangées.
  if (props.groups) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <div className="flex items-center justify-end gap-2 border-b border-border bg-foreground/5 px-3 py-1.5 text-xs">
          <button
            type="button"
            onClick={allCollapsed ? expandAll : collapseAll}
            className="text-foreground/60 hover:text-foreground"
          >
            {allCollapsed ? "Tout ouvrir" : "Tout fermer"}
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-foreground/60">
            <tr>
              <th className="w-8 px-2 py-2" aria-hidden />
              {props.columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2 ${col.className ?? ""} ${hideClass(col.hideBelow)}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.groups.map((g) => (
              <ListGroup
                key={g.key}
                groupKey={g.key}
                groupLabel={g.label}
                items={g.items}
                columns={props.columns}
                getKey={props.getKey}
                {...(props.onItemClick ? { onItemClick: props.onItemClick } : {})}
                hideClass={hideClass}
                collapsed={collapsed.has(g.key)}
                onToggle={() => toggle(g.key)}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-background">
      <table className="w-full text-sm">
        <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-foreground/60">
          <tr>
            {props.columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-2 ${col.className ?? ""} ${hideClass(col.hideBelow)}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.data.map((item) => (
            <tr
              key={props.getKey(item)}
              {...(props.onItemClick ? { onClick: () => props.onItemClick?.(item) } : {})}
              className={`border-t border-border ${
                props.onItemClick ? "cursor-pointer hover:bg-muted" : ""
              }`}
            >
              {props.columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-2 ${col.className ?? ""} ${hideClass(col.hideBelow)}`}
                >
                  {col.cell(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListGroup<T>(props: {
  groupKey: string;
  groupLabel: string;
  items: T[];
  columns: ListColumn<T>[];
  getKey: (item: T) => string;
  onItemClick?: (item: T) => void;
  hideClass: (h: ListColumn<T>["hideBelow"]) => string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="cursor-pointer bg-muted/60 hover:bg-muted"
        onClick={props.onToggle}
        aria-expanded={!props.collapsed}
      >
        <td className="w-8 px-2 py-2 text-foreground/60">
          <ChevronDown
            className={`h-4 w-4 transition-transform ${props.collapsed ? "-rotate-90" : ""}`}
          />
        </td>
        <td
          colSpan={props.columns.length}
          className="px-4 py-2 text-sm font-semibold text-foreground"
        >
          {props.groupLabel}{" "}
          <span className="ml-1 rounded bg-background px-1.5 py-0.5 text-xs font-medium text-foreground/70">
            {props.items.length}
          </span>
        </td>
      </tr>
      {!props.collapsed &&
        props.items.map((item) => (
          <tr
            key={props.getKey(item)}
            {...(props.onItemClick ? { onClick: () => props.onItemClick?.(item) } : {})}
            className={`border-t border-border ${props.onItemClick ? "cursor-pointer hover:bg-muted" : ""}`}
          >
            <td className="w-8 px-2 py-2" aria-hidden />
            {props.columns.map((col) => (
              <td
                key={col.key}
                className={`px-4 py-2 ${col.className ?? ""} ${props.hideClass(col.hideBelow)}`}
              >
                {col.cell(item)}
              </td>
            ))}
          </tr>
        ))}
    </>
  );
}

function KanbanView<T>(props: {
  groups: {
    key: string;
    label: string;
    items: T[];
    accent?: string | undefined;
    icon?: LucideIcon | undefined;
  }[];
  getKey: (item: T) => string;
  renderKanbanCard: (item: T) => React.ReactNode;
  onItemClick?: (item: T) => void;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onToggleSelect?: (key: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {props.groups.map((group) => {
        const Icon = group.icon;
        return (
          <div
            key={group.key}
            className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4 text-foreground/60" />}
                <span className="text-sm font-semibold">{group.label}</span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  group.accent ?? "bg-foreground/10 text-foreground/70"
                }`}
              >
                {group.items.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {group.items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/50 bg-background/50 p-3 text-center text-xs text-foreground/40">
                  Aucun
                </p>
              ) : (
                group.items.map((item) => {
                  const k = props.getKey(item);
                  const isSelected = props.selectedKeys?.has(k) ?? false;
                  return (
                    <div
                      key={k}
                      {...(props.onItemClick ? { onClick: () => props.onItemClick?.(item) } : {})}
                      className={`relative rounded-lg border bg-background p-3 ${
                        props.onItemClick
                          ? "cursor-pointer hover:border-green hover:bg-green/5"
                          : ""
                      } ${isSelected ? "border-green ring-2 ring-green/20" : "border-border"}`}
                    >
                      {props.selectable && (
                        <input
                          type="checkbox"
                          aria-label="Sélectionner"
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            props.onToggleSelect?.(k);
                          }}
                          className="absolute left-2 top-2 z-10 h-5 w-5 cursor-pointer"
                        />
                      )}
                      <div className={props.selectable ? "pl-6" : undefined}>
                        {props.renderKanbanCard(item)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
