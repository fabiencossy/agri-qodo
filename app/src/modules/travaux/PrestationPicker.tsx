import { useMemo, useState } from 'react';
import { useProducts } from '../products/products.store';
import { WORK_TYPES, WORK_CATEGORY_LABELS } from './travaux.catalog';
import type { PrestationSource } from './prestation-source';

interface PrestationPickerProps {
  currentValue?: { workType?: string; productId?: string };
  onSelect: (source: PrestationSource) => void;
  onClose: () => void;
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  phyto: 'Produits phytosanitaires',
  fertilizer: 'Engrais & amendements',
  seed: 'Semences',
};

const PRODUCT_TYPE_ORDER: ReadonlyArray<string> = ['phyto', 'fertilizer', 'seed'];

/**
 * Sélecteur unifié plein écran : prestations (services) + produits
 * (consommables). Regroupement par catégorie, recherche libre, unité de
 * mesure visible. Pas d'affichage de prix — le tarif éventuel est conservé
 * en arrière-plan pour la rétro-compat Odoo / la liste exports.
 */
export function PrestationPicker({ currentValue, onSelect, onClose }: PrestationPickerProps) {
  const products = useProducts();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'all' | 'services' | 'products'>('all');

  const worktypeSources = useMemo<ReadonlyArray<PrestationSource>>(
    () =>
      WORK_TYPES.filter((w) => w.active).map((w) => ({
        kind: 'worktype' as const,
        id: w.key,
        label: w.label,
        description: w.description,
        unit:
          w.defaultBillingUnit === 'hectare'
            ? 'ha'
            : w.defaultBillingUnit === 'heure'
              ? 'h'
              : 'forfait',
        category: WORK_CATEGORY_LABELS[w.category] ?? w.category,
        billingUnit: w.defaultBillingUnit,
        defaultRateChf:
          w.defaultBillingUnit === 'hectare' ? w.defaultPerHectareRateChf : w.defaultHourlyRateChf,
      })),
    [],
  );

  const productSources = useMemo<ReadonlyArray<PrestationSource>>(
    () =>
      products
        .filter((p) => p.active)
        .map((p) => {
          const subCategory =
            p.type === 'phyto'
              ? p.category
              : p.type === 'fertilizer'
                ? p.category
                : p.type === 'seed'
                  ? p.cropName
                  : '';
          return {
            kind: 'product' as const,
            id: p.id,
            label: p.name,
            description:
              p.type === 'phyto'
                ? `OFAG ${p.ofagNumber} · ${p.activeSubstance}${p.manufacturer ? ` · ${p.manufacturer}` : ''}`
                : p.type === 'fertilizer'
                  ? `${Math.round(p.nPerUnit * (p.defaultDoseUnit.includes('/ha') ? 1 : 100))}-${Math.round(p.pPerUnit * (p.defaultDoseUnit.includes('/ha') ? 1 : 100))}-${Math.round(p.kPerUnit * (p.defaultDoseUnit.includes('/ha') ? 1 : 100))} N-P-K${p.manufacturer ? ` · ${p.manufacturer}` : ''}`
                  : p.type === 'seed'
                    ? `${p.cropName} · ${p.varietyName}${p.certified ? ' · certifiée' : ''}`
                    : undefined,
            unit: p.defaultDoseUnit,
            category: `${PRODUCT_TYPE_LABELS[p.type] ?? p.type}${subCategory ? ` · ${subCategory}` : ''}`,
          } satisfies PrestationSource;
        }),
    [products],
  );

  const filtered = useMemo(() => {
    let list: ReadonlyArray<PrestationSource> =
      tab === 'services'
        ? worktypeSources
        : tab === 'products'
          ? productSources
          : [...worktypeSources, ...productSources];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((s) => {
        const hay = `${s.label} ${s.description ?? ''} ${s.category} ${s.unit}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [tab, worktypeSources, productSources, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, PrestationSource[]>();
    for (const s of filtered) {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    return [...map.entries()].sort((a, b) => sortCategoryKeys(a[0], b[0]));
  }, [filtered]);

  const isCurrent = (s: PrestationSource): boolean =>
    s.kind === 'worktype' ? currentValue?.workType === s.id : currentValue?.productId === s.id;

  return (
    <div className="fixed inset-0 z-[1400] flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center md:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choisir une prestation ou un produit"
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-(--radius-lg) border border-(--color-border) bg-(--color-surface) shadow-(--shadow-popup) md:max-w-3xl md:rounded-(--radius-lg)"
      >
        <header className="flex items-center gap-2 border-b border-(--color-border) px-4 py-3">
          <h2 className="m-0 text-sm font-semibold">Prestation ou produit</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-(--radius-sm) text-(--color-muted) hover:bg-[#f1f1ee]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              width={16}
              height={16}
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex flex-col gap-2 border-b border-(--color-border) bg-[#fbfbf9] px-4 py-2.5">
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (nom, description, unité)…"
            className="h-10 w-full rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 text-sm focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/15"
          />
          <div className="flex items-center gap-1">
            <TabButton active={tab === 'all'} onClick={() => setTab('all')}>
              Tout ({worktypeSources.length + productSources.length})
            </TabButton>
            <TabButton active={tab === 'services'} onClick={() => setTab('services')}>
              Prestations ({worktypeSources.length})
            </TabButton>
            <TabButton active={tab === 'products'} onClick={() => setTab('products')}>
              Produits ({productSources.length})
            </TabButton>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {grouped.length === 0 ? (
            <p className="m-0 py-10 text-center text-sm text-(--color-muted)">
              Aucun résultat pour « {query} ».
            </p>
          ) : (
            grouped.map(([category, items]) => (
              <section key={category} className="mb-3">
                <h3 className="m-0 mb-1.5 text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
                  {category}
                </h3>
                <ul className="m-0 list-none space-y-1 p-0">
                  {items.map((s) => (
                    <li key={`${s.kind}:${s.id}`}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(s);
                          onClose();
                        }}
                        className={[
                          'flex w-full items-start gap-3 rounded-(--radius-sm) border bg-(--color-surface) px-3 py-2.5 text-left transition-colors',
                          isCurrent(s)
                            ? 'border-(--color-primary) bg-(--color-primary)/5'
                            : 'border-(--color-border) hover:border-(--color-primary) hover:bg-[#fbfbf9]',
                        ].join(' ')}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{s.label}</span>
                            <span
                              className={[
                                'inline-flex shrink-0 items-center rounded-(--radius-pill) px-1.5 py-0.5 text-[10px] font-medium',
                                s.kind === 'worktype'
                                  ? 'bg-(--color-primary)/10 text-(--color-primary)'
                                  : 'bg-[#fef3c7] text-[#92400e]',
                              ].join(' ')}
                            >
                              {s.kind === 'worktype' ? 'Prestation' : 'Produit'}
                            </span>
                          </div>
                          {s.description && (
                            <p className="m-0 mt-0.5 truncate text-[11px] text-(--color-muted)">
                              {s.description}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 rounded-(--radius-sm) bg-[#f1f1ee] px-2 py-0.5 text-[11px] font-mono tabular-nums text-(--color-muted)">
                          {s.unit}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
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
      className={[
        'inline-flex h-8 items-center rounded-(--radius-sm) px-3 text-xs font-medium transition-colors',
        active
          ? 'bg-(--color-primary) text-white'
          : 'border border-(--color-border) bg-(--color-surface) hover:bg-[#f1f1ee]',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

/** Ordre stable : Prestations d'abord (catégorie) puis Produits. */
function sortCategoryKeys(a: string, b: string): number {
  const orderOf = (s: string) => {
    for (let i = 0; i < PRODUCT_TYPE_ORDER.length; i++) {
      if (s.startsWith(PRODUCT_TYPE_LABELS[PRODUCT_TYPE_ORDER[i]!] ?? '')) return 1000 + i;
    }
    return 0;
  };
  const da = orderOf(a);
  const db = orderOf(b);
  if (da !== db) return da - db;
  return a.localeCompare(b);
}
