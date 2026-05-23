import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDownIcon, SearchIcon } from './icons';
import { Facet } from './Facet';
import { FiltersDropdown } from './FiltersDropdown';
import { SuggestionsList, type FieldSuggestion } from './SuggestionsList';
import { getSuggestableFields } from './searchable';
import {
  makeFacetId,
  SEARCH_BAR_DEFAULTS,
  type FieldDescriptor,
  type Facet as FacetT,
  type SavedFavorite,
  type SearchBarProps,
} from './SearchBar.types';

/** localStorage helpers pour favoris auto-persistés quand aucun callback parent. */
function readLocalFavorites(storageKey: string): SavedFavorite[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedFavorite[]) : [];
  } catch {
    return [];
  }
}

function writeLocalFavorites(storageKey: string, favs: SavedFavorite[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(favs));
  } catch {
    /* quota / private mode → silencieux */
  }
}

export function SearchBar({
  fields,
  value,
  onChange,
  favorites,
  onSaveFavorite,
  onDeleteFavorite,
  placeholder = SEARCH_BAR_DEFAULTS.placeholder,
  debounceMs = SEARCH_BAR_DEFAULTS.debounceMs,
  disabled = false,
  theme = SEARCH_BAR_DEFAULTS.theme,
  ariaLabel = 'Rechercher',
  className,
  storageKey,
}: SearchBarProps) {
  const fieldsById = useMemo(() => {
    const m = new Map<string, FieldDescriptor>();
    for (const f of fields) m.set(f.id, f);
    return m;
  }, [fields]);

  // Clé localStorage stable : si `storageKey` non fourni, dérive du schéma des champs
  // pour qu'une même SearchBar (même champs) partage ses favoris à travers l'app.
  const effectiveStorageKey = useMemo(() => {
    if (storageKey) return `sb-fav:${storageKey}`;
    const sig = fields
      .map((f) => f.id)
      .sort()
      .join('|');
    return `sb-fav:auto:${sig}`;
  }, [storageKey, fields]);

  // Favoris : si parent fournit ses callbacks/liste, on les utilise. Sinon
  // fallback localStorage interne pour que "Enregistrer la recherche" marche
  // toujours sans config côté section.
  const [internalFavorites, setInternalFavorites] = useState<SavedFavorite[]>(() =>
    readLocalFavorites(effectiveStorageKey),
  );
  const usingInternal = !onSaveFavorite && !onDeleteFavorite && favorites === undefined;
  const effectiveFavorites: SavedFavorite[] = favorites ?? (usingInternal ? internalFavorites : []);
  const effectiveOnSaveFavorite = onSaveFavorite
    ? onSaveFavorite
    : usingInternal
      ? (name: string, opts: { shared: boolean; isDefault: boolean }) => {
          const fav: SavedFavorite = {
            id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name,
            shared: opts.shared,
            isDefault: opts.isDefault,
            state: value,
          };
          const next = [...internalFavorites, fav];
          setInternalFavorites(next);
          writeLocalFavorites(effectiveStorageKey, next);
        }
      : undefined;
  const effectiveOnDeleteFavorite = onDeleteFavorite
    ? onDeleteFavorite
    : usingInternal
      ? (favoriteId: string) => {
          const next = internalFavorites.filter((f) => f.id !== favoriteId);
          setInternalFavorites(next);
          writeLocalFavorites(effectiveStorageKey, next);
        }
      : undefined;

  const [query, setQuery] = useState(value.query ?? '');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [focusedSuggestion, setFocusedSuggestion] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync interne query → state externe (avec debounce sur query libre)
  useEffect(() => {
    const id = setTimeout(() => {
      if ((value.query ?? '') !== query) {
        onChange({ ...value, query: query || undefined });
      }
    }, debounceMs);
    return () => clearTimeout(id);
  }, [query, debounceMs, onChange, value]);

  // Fermer dropdown au clic extérieur + Esc
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current?.contains(e.target as Node)) return;
      setSuggestionsOpen(false);
      setDropdownOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSuggestionsOpen(false);
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  /* ---------- Mutations sur l'état ---------- */

  const addFacet = useCallback(
    (field: FieldDescriptor, rawValues: string | string[]) => {
      const values = Array.isArray(rawValues) ? rawValues : [rawValues];
      const newFacet: FacetT = {
        id: makeFacetId(),
        fieldId: field.id,
        operator: field.type === 'text' ? 'contains' : 'eq',
        values,
      };
      onChange({
        ...value,
        query: undefined,
        facets: [...value.facets, newFacet],
      });
      setQuery('');
      setSuggestionsOpen(false);
      inputRef.current?.focus();
    },
    [onChange, value],
  );

  const removeFacet = useCallback(
    (facetId: string) => {
      onChange({ ...value, facets: value.facets.filter((f) => f.id !== facetId) });
    },
    [onChange, value],
  );

  const handleSuggestionSelect = useCallback(
    (s: FieldSuggestion) => {
      addFacet(s.field, s.term);
    },
    [addFacet],
  );

  /* ---------- Keyboard sur l'input ---------- */

  const suggestableFields = useMemo(() => getSuggestableFields(fields), [fields]);
  const suggestionsCount = suggestableFields.length;

  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Backspace sur input vide → retire la dernière facet
      if (e.key === 'Backspace' && query === '' && value.facets.length > 0) {
        e.preventDefault();
        const last = value.facets[value.facets.length - 1];
        if (last) removeFacet(last.id);
        return;
      }

      if (!suggestionsOpen || !query.trim()) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedSuggestion((i) => (i + 1) % Math.max(suggestionsCount, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedSuggestion((i) => (i - 1 + suggestionsCount) % Math.max(suggestionsCount, 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const field = suggestableFields[focusedSuggestion];
        if (field) addFacet(field, query);
      }
    },
    [
      addFacet,
      focusedSuggestion,
      query,
      removeFacet,
      suggestableFields,
      suggestionsCount,
      suggestionsOpen,
      value.facets,
    ],
  );

  /* ---------- Render ---------- */

  const isDark = theme === 'dark';
  const hasFilters = value.facets.length > 0;
  // Logique : query non vide → suggestions ; query vide → dropdown 3 colonnes
  const trimmedQuery = query.trim();
  const showSuggestions = suggestionsOpen && trimmedQuery.length > 0;
  const showDropdown = dropdownOpen && trimmedQuery.length === 0;

  /* Clic n'importe où dans la barre (hors actions internes) : focus input + ouvre dropdown. */
  const handleBarClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      const target = e.target as HTMLElement;
      // Ignorer les clics sur les actions internes (boutons facet remove, chevron)
      if (target.closest('[data-sb-action]')) return;
      inputRef.current?.focus();
      setDropdownOpen(true);
    },
    [disabled],
  );

  return (
    <div ref={containerRef} className={['relative w-full', className ?? ''].join(' ')}>
      <div
        role="search"
        aria-label={ariaLabel}
        onClick={handleBarClick}
        className={[
          'flex h-10 items-stretch overflow-hidden rounded-(--radius) border transition-colors',
          isDark
            ? 'border-[#2d343d] bg-[#1f242b] text-[#e8eaed]'
            : 'border-(--color-border) bg-(--color-surface) text-(--color-text)',
          disabled ? 'opacity-50' : 'cursor-text',
          hasFilters ? (isDark ? 'border-(--color-accent)/60' : 'border-(--color-accent)/40') : '',
          'focus-within:border-(--color-primary) focus-within:ring-2 focus-within:ring-(--color-primary)/15',
        ].join(' ')}
      >
        {/* Lead : icône loupe (décorative) */}
        <div
          className={[
            'inline-flex items-center px-2.5',
            isDark ? 'text-[#8a93a0]' : 'text-(--color-muted)',
          ].join(' ')}
        >
          <SearchIcon size={16} />
        </div>

        {/* Mid : facets + input */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 pr-2">
          {value.facets.map((f) => (
            <Facet
              key={f.id}
              facet={f}
              field={fieldsById.get(f.fieldId)}
              onRemove={() => removeFacet(f.id)}
              theme={theme}
            />
          ))}
          <input
            ref={inputRef}
            type="text"
            value={query}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value);
              setFocusedSuggestion(0);
              setSuggestionsOpen(true);
            }}
            onFocus={() => query.trim() && setSuggestionsOpen(true)}
            onKeyDown={onInputKeyDown}
            placeholder={value.facets.length > 0 ? 'Affiner…' : placeholder}
            aria-label={ariaLabel}
            className={[
              'h-full min-w-[40px] flex-1 bg-transparent px-1 text-sm outline-none',
              isDark ? 'placeholder:text-[#8a93a0]' : 'placeholder:text-(--color-muted)',
            ].join(' ')}
          />
        </div>

        {/* Tail : chevron */}
        <button
          type="button"
          data-sb-action="toggle-dropdown"
          aria-haspopup="menu"
          aria-expanded={dropdownOpen}
          aria-label="Ouvrir filtres et favoris"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            setDropdownOpen((o) => !o);
          }}
          className={[
            'inline-flex items-center border-l px-2.5',
            isDark
              ? 'border-[#3a414b] text-[#8a93a0]'
              : 'border-(--color-border) text-(--color-muted)',
            dropdownOpen
              ? 'bg-(--color-accent)/6 text-(--color-accent)'
              : 'hover:bg-(--color-bg) hover:text-(--color-text)',
          ].join(' ')}
        >
          <ChevronDownIcon />
        </button>
      </div>

      {/* Suggestions (priorité quand l'utilisateur saisit du texte) */}
      {showSuggestions && (
        <SuggestionsList
          query={trimmedQuery}
          fields={fields}
          focusedIndex={focusedSuggestion}
          onSelect={handleSuggestionSelect}
          onFocusedChange={setFocusedSuggestion}
        />
      )}

      {/* Dropdown 3 colonnes (visible quand pas de query active) */}
      {showDropdown && (
        <FiltersDropdown
          fields={fields}
          state={value}
          onChange={onChange}
          favorites={effectiveFavorites}
          onSaveFavorite={effectiveOnSaveFavorite}
          onDeleteFavorite={effectiveOnDeleteFavorite}
          onClose={() => setDropdownOpen(false)}
        />
      )}
    </div>
  );
}
