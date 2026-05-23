import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CULTURES, type CultureCategory, type CultureInfo } from '../../assolement/cultures';
import {
  addCustomCulture,
  removeCustomCulture,
  useCustomCultures,
} from '../../assolement/cultures-custom.store';
import { DataTable, type Column } from '../../../components/DataTable';
import { SearchBar, type FieldDescriptor, type SearchState } from '../../../components/SearchBar';
import type { ParametresOutletContext } from '../ParametresLayout';
import { inputClass } from './_styles';

const CATEGORY_LABELS: Record<CultureCategory, string> = {
  cereal: 'Céréales',
  oilseed: 'Oléagineux',
  protein: 'Protéagineux',
  root: 'Sarclées / racines',
  forage: 'Prairies & fourrages',
  biodiversity: 'Biodiversité / SPB',
  special: 'Cultures spéciales',
  cover: 'Couverts végétaux',
  fallow: 'Jachères / sol nu',
  other: 'Autres',
};

const CATEGORIES_ORDERED: CultureCategory[] = [
  'cereal',
  'oilseed',
  'protein',
  'root',
  'forage',
  'biodiversity',
  'special',
  'cover',
  'fallow',
  'other',
];

const DEFAULT_COLORS = [
  '#f97316',
  '#fb923c',
  '#fbbf24',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#ef4444',
];

interface CultureRow extends CultureInfo {
  isCustom: boolean;
}

export function CulturesSection() {
  const { mobileSelector } = useOutletContext<ParametresOutletContext>();
  const customCultures = useCustomCultures();
  const customKeys = useMemo(() => new Set(customCultures.map((c) => c.key)), [customCultures]);
  const [showForm, setShowForm] = useState(false);

  const allRows = useMemo<CultureRow[]>(
    () => [...CULTURES, ...customCultures].map((c) => ({ ...c, isCustom: customKeys.has(c.key) })),
    [customCultures, customKeys],
  );

  const [searchState, setSearchState] = useState<SearchState>({
    facets: [],
    groupBy: [],
  });

  const fields: FieldDescriptor[] = useMemo(
    () => [
      {
        id: 'category',
        label: 'Catégorie',
        type: 'select',
        options: CATEGORIES_ORDERED.map((k) => ({ label: CATEGORY_LABELS[k], value: k })),
        groupable: true,
      },
      { id: 'label', label: 'Nom', type: 'text' },
      { id: 'key', label: 'Clé', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const q = (searchState.query ?? '').toLowerCase().trim();
    return allRows.filter((r) => {
      if (q) {
        const hay = `${r.label} ${r.key}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      for (const facet of searchState.facets) {
        if (facet.values.length === 0) continue;
        if (facet.fieldId === 'category') {
          if (!facet.values.includes(r.category)) return false;
        } else if (facet.fieldId === 'label') {
          if (!facet.values.some((v) => r.label.toLowerCase().includes(String(v).toLowerCase())))
            return false;
        } else if (facet.fieldId === 'key') {
          if (!facet.values.some((v) => r.key.toLowerCase().includes(String(v).toLowerCase())))
            return false;
        }
      }
      return true;
    });
  }, [allRows, searchState]);

  const productsCount = CULTURES.length;
  const customCount = customCultures.length;

  const newCultureButton = (
    <button
      type="button"
      onClick={() => setShowForm(true)}
      aria-label="Nouvelle culture"
      title="Nouvelle culture"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius) bg-(--color-primary) text-white hover:bg-(--color-primary)/90 md:h-auto md:w-auto md:gap-1.5 md:px-3 md:py-2 md:text-xs md:font-semibold"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        width="18"
        height="18"
        aria-hidden="true"
        className="md:hidden"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span className="hidden md:inline">+ Nouvelle culture</span>
    </button>
  );

  return (
    <div className="flex flex-col">
      {/* Toolbar desktop : titre + SearchBar + bouton inline */}
      <div className="sticky top-0 z-10 hidden items-center gap-3 border-b border-(--color-border) bg-(--color-bg) py-2 md:flex">
        <div className="shrink-0">
          <h2 className="m-0 text-sm font-semibold">Cultures</h2>
          <span className="text-[11px] text-(--color-muted)">
            {productsCount} Agridéa · {customCount} personnalisée{customCount > 1 ? 's' : ''}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <SearchBar
            fields={fields}
            value={searchState}
            onChange={setSearchState}
            ariaLabel="Rechercher dans le catalogue cultures"
          />
        </div>
        {newCultureButton}
      </div>

      {/* Toolbar mobile : SearchBar + bouton + gear (toujours à droite) + compteurs */}
      <div className="sticky top-0 z-10 flex flex-col gap-1 border-b border-(--color-border) bg-(--color-bg) pt-1 pb-1.5 md:hidden">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SearchBar
              fields={fields}
              value={searchState}
              onChange={setSearchState}
              ariaLabel="Rechercher dans le catalogue cultures"
            />
          </div>
          {newCultureButton}
          {mobileSelector}
        </div>
        <span className="px-1 text-[10px] text-(--color-muted)">
          {productsCount} Agridéa · {customCount} personnalisée{customCount > 1 ? 's' : ''}
        </span>
      </div>

      <div className="pt-1.5">
        <DataTable<CultureRow>
          rows={filtered}
          getId={(r) => r.key}
          emptyMessage="Aucune culture ne correspond à cette recherche."
          entityLabel="culture"
          columns={cultureColumns({ handleDelete: handleDeleteCulture })}
          groupBy={{
            getKey: (r) => r.category,
            getLabel: (k) => CATEGORY_LABELS[k as CultureCategory] ?? k,
          }}
          renderMobileCard={(row, { checkbox }) => (
            <>
              <div className="shrink-0 pt-0.5">{checkbox}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3.5 w-3.5 shrink-0 rounded-(--radius-pill) border border-black/10"
                    style={{ background: row.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{row.label}</span>
                  {row.isCustom && (
                    <span className="rounded-(--radius-pill) bg-(--color-primary)/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-(--color-primary) uppercase">
                      Custom
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-(--color-muted)">
                  {row.key}
                </div>
              </div>
            </>
          )}
        />
      </div>

      {showForm && <NewCultureForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

function handleDeleteCulture(row: CultureRow) {
  if (!row.isCustom) return;
  if (confirm(`Supprimer la culture "${row.label}" ?`)) {
    removeCustomCulture(row.key);
  }
}

function cultureColumns(opts: { handleDelete: (row: CultureRow) => void }): Column<CultureRow>[] {
  const { handleDelete } = opts;
  return [
    {
      key: 'color',
      label: '',
      width: 'w-8',
      render: (row) => (
        <span
          className="inline-block h-4 w-4 rounded-(--radius-pill) border border-black/10"
          style={{ background: row.color }}
          aria-hidden
        />
      ),
    },
    {
      key: 'label',
      label: 'Nom',
      render: (row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium">{row.label}</span>
            {row.isCustom && (
              <span className="rounded-(--radius-pill) bg-(--color-primary)/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-(--color-primary) uppercase">
                Custom
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Catégorie',
      render: (row) => (
        <span className="text-(--color-muted)">{CATEGORY_LABELS[row.category]}</span>
      ),
    },
    {
      key: 'key',
      label: 'Clé',
      render: (row) => <span className="font-mono text-xs text-(--color-muted)">{row.key}</span>,
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => {
        if (!row.isCustom) {
          return (
            <span className="text-[10px] tracking-wider text-(--color-muted) uppercase">
              Agridéa
            </span>
          );
        }
        return (
          <div
            className="flex items-center justify-end gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => handleDelete(row)}
              aria-label={`Supprimer ${row.label}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-(--radius) text-(--color-error) hover:bg-[#fef2f2]"
            >
              <svg
                viewBox="0 0 24 24"
                width={14}
                height={14}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
              </svg>
            </button>
          </div>
        );
      },
    },
  ];
}

function NewCultureForm({ onClose }: { onClose: () => void }) {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(DEFAULT_COLORS[0]!);
  const [category, setCategory] = useState<CultureCategory>('cereal');
  const [keyOverride, setKeyOverride] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    addCustomCulture({
      label,
      color,
      category,
      key: keyOverride.trim() || undefined,
    });
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-(--radius-lg) bg-(--color-surface) shadow-(--shadow-popup) sm:rounded-(--radius-lg)"
      >
        <header className="flex items-center justify-between border-b border-(--color-border) px-4 py-3">
          <h2 className="m-0 text-base font-semibold">Nouvelle culture</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-(--radius-sm) text-(--color-muted) hover:bg-[#f1f1ee] hover:text-(--color-text)"
          >
            <svg
              viewBox="0 0 24 24"
              width={18}
              height={18}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <div>
            <label className="mb-1 block text-[11px] font-semibold tracking-wider text-(--color-muted) uppercase">
              Nom de la culture <span className="text-(--color-error)">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              placeholder="ex. Quinoa, Sarrasin, Lupin doux…"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold tracking-wider text-(--color-muted) uppercase">
              Catégorie
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CultureCategory)}
              className={inputClass}
            >
              {CATEGORIES_ORDERED.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold tracking-wider text-(--color-muted) uppercase">
              Couleur d'affichage
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Couleur ${c}`}
                  className={[
                    'h-8 w-8 rounded-(--radius-pill) border-2',
                    color === c ? 'border-(--color-text)' : 'border-transparent',
                  ].join(' ')}
                  style={{ background: c }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-12 cursor-pointer rounded-(--radius-sm) border border-(--color-border)"
                aria-label="Couleur personnalisée"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold tracking-wider text-(--color-muted) uppercase">
              Clé technique{' '}
              <span className="font-normal normal-case text-(--color-muted)">(auto si vide)</span>
            </label>
            <input
              type="text"
              value={keyOverride}
              onChange={(e) =>
                setKeyOverride(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
              }
              placeholder="ex. quinoa, sarrasin…"
              className={`${inputClass} font-mono`}
            />
          </div>
        </div>

        <footer className="flex items-center gap-2 border-t border-(--color-border) px-4 py-3">
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-(--radius) px-3 py-2 text-sm font-medium text-(--color-muted) hover:text-(--color-text)"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!label.trim()}
            className="rounded-(--radius) bg-(--color-primary) px-3 py-2 text-sm font-semibold text-white hover:bg-(--color-primary)/90 disabled:opacity-50"
          >
            Créer
          </button>
        </footer>
      </form>
    </div>
  );
}
