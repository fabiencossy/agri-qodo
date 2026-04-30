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
  ChevronDown,
  Filter as FilterIcon,
  Layers as LayersIcon,
  LayoutGrid,
  List,
  type LucideIcon,
  Search,
  Star,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

// ---------- Types publics ---------------------------------------------------

export type ViewMode = "list" | "kanban";

export interface ListColumn<T> {
  key: string;
  header: string;
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
      view: parsed.view === "kanban" || parsed.view === "list" ? parsed.view : defaultView,
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
  const defaultView = props.defaultView ?? "list";
  const [view, setView] = useState<ViewMode>(defaultView);
  const [search, setSearch] = useState("");
  const [activeFilterKeys, setActiveFilterKeys] = useState<string[]>([]);
  const [groupByKey, setGroupByKey] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<SavedFavorite[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);

  // Réhydratation de l'état au mount (et à chaque changement de storageKey).
  useEffect(() => {
    const persisted = loadState(props.storageKey, defaultView);
    setView(persisted.view);
    setSearch(persisted.search);
    setActiveFilterKeys(persisted.activeFilterKeys);
    setGroupByKey(persisted.groupByKey);
    setFavorites(persisted.favorites);
  }, [props.storageKey, defaultView]);

  // Persistance à chaque changement.
  useEffect(() => {
    saveState(props.storageKey, { view, search, activeFilterKeys, groupByKey, favorites });
  }, [props.storageKey, view, search, activeFilterKeys, groupByKey, favorites]);

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
  const setGroupBy = (key: string | null) => setGroupByKey(key);

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
          columns={props.columns}
          getKey={props.getKey}
          {...(props.onItemClick ? { onItemClick: props.onItemClick } : {})}
          {...(groups ? { groups } : {})}
        />
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
        />
      )}
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
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!props.panelOpen) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        props.onClosePanel();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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
            onClick={props.onTogglePanel}
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
          <ViewToggleButton
            active={props.view === "list"}
            onClick={() => props.onViewChange("list")}
            icon={List}
          />
          <ViewToggleButton
            active={props.view === "kanban"}
            onClick={() => props.onViewChange("kanban")}
            icon={LayoutGrid}
          />
        </div>
      </div>

      {props.panelOpen && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 grid grid-cols-1 gap-0 overflow-hidden rounded-xl border border-border bg-background shadow-xl md:grid-cols-3">
          <PanelColumn title="Filtres" icon={FilterIcon} accent="text-purple-700">
            {props.filters.length === 0 ? (
              <p className="text-xs text-foreground/40">Pas de filtre prédéfini.</p>
            ) : (
              props.filters.map((f) => (
                <PanelItem
                  key={f.key}
                  active={props.activeFilterKeys.includes(f.key)}
                  onClick={() => props.onToggleFilter(f.key)}
                >
                  {f.label}
                </PanelItem>
              ))
            )}
          </PanelColumn>
          <PanelColumn title="Regrouper par" icon={LayersIcon} accent="text-blue-700">
            <PanelItem active={props.groupByKey === null} onClick={() => props.onSetGroupBy(null)}>
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
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
                group.items.map((item) => (
                  <div
                    key={props.getKey(item)}
                    {...(props.onItemClick ? { onClick: () => props.onItemClick?.(item) } : {})}
                    className={`rounded-lg border border-border bg-background p-3 ${
                      props.onItemClick ? "cursor-pointer hover:border-green hover:bg-green/5" : ""
                    }`}
                  >
                    {props.renderKanbanCard(item)}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
