import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { SearchBar, type FieldDescriptor, type SearchState } from '../../components/SearchBar';
import { ViewSwitcher, type ViewKey } from '../../components/ViewSwitcher';
import { CalendarShowcase } from '../composants/ComposantsPage';
import { ExportButton, type ExportColumn } from '../../components/ExportButton';
import { useFabActions, useHideFab } from '../../layouts/useFab';
import { useStandardFabActions } from '../../layouts/useStandardFabActions';
import { useParcels } from '../parcellaire/parcellaire.store';
import {
  addInterventions,
  removeIntervention,
  updateIntervention,
  useInterventions,
} from './carnet.store';
import { InterventionList } from './InterventionList';
import { InterventionForm } from './InterventionForm';
import { InterventionTypeIcon } from './InterventionTypeIcon';
import { CATEGORY_LABELS, getInterventionYears, sortByDateDesc } from './carnet.helpers';
import type { Intervention, InterventionCategory } from './carnet.types';

const FIELDS: FieldDescriptor[] = [
  { id: 'product', label: 'Produit', type: 'text' },
  { id: 'operator', label: 'Opérateur', type: 'text' },
  {
    id: 'category',
    label: 'Catégorie',
    type: 'select',
    options: (Object.keys(CATEGORY_LABELS) as InterventionCategory[]).map((c) => ({
      label: CATEGORY_LABELS[c],
      value: c,
    })),
    groupable: true,
  },
];

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'date', label: 'Date' },
  { key: 'parcelId', label: 'Parcelle' },
  { key: 'category', label: 'Catégorie' },
  { key: 'subType', label: 'Type' },
  { key: 'productName', label: 'Produit' },
  { key: 'doseValue', label: 'Dose' },
  { key: 'doseUnit', label: 'Unité' },
  { key: 'nKgPerHa', label: 'N (kg/ha)' },
  { key: 'pKgPerHa', label: 'P (kg/ha)' },
  { key: 'kKgPerHa', label: 'K (kg/ha)' },
  { key: 'yieldValue', label: 'Rendement' },
  { key: 'yieldUnit', label: 'Unité rdt' },
  { key: 'operator', label: 'Opérateur' },
  { key: 'notes', label: 'Notes' },
];

type CarnetView = Extract<ViewKey, 'table' | 'calendar' | 'timeline' | 'dashboard'>;

export default function CarnetPage() {
  const isDesktop = useIsDesktop();
  const [searchParams] = useSearchParams();
  const interventions = useInterventions();
  const parcels = useParcels();

  const years = useMemo(
    () =>
      [new Date().getFullYear(), ...getInterventionYears(interventions)].filter(
        (v, i, a) => a.indexOf(v) === i,
      ),
    [interventions],
  );

  const [year, setYear] = useState<number>(years[0] ?? new Date().getFullYear());
  const [view, setView] = useState<CarnetView>('table');
  const [searchState, setSearchState] = useState<SearchState>({ facets: [], groupBy: [] });
  // Permet l'arrivée depuis ParcelleDetailPage (?parcel=PF-001)
  const initialParcelId = searchParams.get('parcel') ?? undefined;
  // editing peut être :
  //   - null : form fermé
  //   - Intervention complète (avec id) : édition d'une entrée existante
  //   - Partial<Intervention> (sans id) : création d'une nouvelle entrée,
  //     éventuellement pré-remplie avec une catégorie spécifique.
  const [editing, setEditing] = useState<Intervention | Partial<Intervention> | null>(null);
  const isEditingExisting = editing !== null && 'id' in editing && Boolean(editing.id);

  // Index parcelles par id (pour affichage du nom dans la liste)
  const parcelsById = useMemo(() => new Map(parcels.map((p) => [p.id, p])), [parcels]);

  // Filtrage : année + SearchBar (catégorie, produit, opérateur)
  const filtered = useMemo(() => {
    const yearStr = String(year);
    return sortByDateDesc(
      interventions.filter((i) => {
        if (!i.date.startsWith(yearStr)) return false;
        if (searchState.query) {
          const q = searchState.query.toLowerCase();
          const hay = [i.productName, i.operator, i.notes, i.subType]
            .filter(Boolean)
            .map((s) => (s as string).toLowerCase());
          if (!hay.some((s) => s.includes(q))) return false;
        }
        for (const facet of searchState.facets) {
          if (facet.values.length === 0) continue;
          if (facet.fieldId === 'category') {
            if (!facet.values.includes(i.category)) return false;
          } else if (facet.fieldId === 'product') {
            const productLc = (i.productName ?? '').toLowerCase();
            if (!facet.values.some((v) => productLc.includes(String(v).toLowerCase())))
              return false;
          } else if (facet.fieldId === 'operator') {
            const opLc = (i.operator ?? '').toLowerCase();
            if (!facet.values.some((v) => opLc.includes(String(v).toLowerCase()))) return false;
          }
        }
        return true;
      }),
    );
  }, [interventions, year, searchState]);

  // Masque le FAB quand le formulaire est ouvert
  useHideFab(editing !== null);

  // FAB : nouvelle intervention
  // FAB unifié — la page Carnet met en avant "Créer une intervention".
  // Override : ouvre le formulaire inline (modal local) plutôt que naviguer.
  const onAddIntervention = useMemo(
    () => () => setEditing({ parcelId: initialParcelId }),
    [initialParcelId],
  );
  const onAddObservation = useMemo(
    () => () => setEditing({ parcelId: initialParcelId, category: 'observation' }),
    [initialParcelId],
  );
  useFabActions(
    useStandardFabActions({
      highlight: 'intervention',
      parcelId: initialParcelId,
      onAddIntervention,
      onAddObservation,
    }),
  );

  const totalCount = filtered.length;
  const summary = `${totalCount} intervention${totalCount > 1 ? 's' : ''} · ${year}`;

  const handleSave = (intervention: Intervention) => {
    if (isEditingExisting && (editing as Intervention).id === intervention.id) {
      updateIntervention(intervention.id, intervention);
    } else {
      addInterventions([intervention]);
    }
    setEditing(null);
  };

  const handleDelete = () => {
    if (isEditingExisting) {
      removeIntervention((editing as Intervention).id);
    }
    setEditing(null);
  };

  // Topbar standard (cf. squelette page)
  const topBar = (
    <div className="flex w-full items-center gap-2">
      <div className="hidden shrink-0 items-baseline gap-2 md:flex">
        <h1 className="m-0 truncate text-base font-semibold">Carnet des champs</h1>
        <span className="truncate text-xs text-(--color-muted)">{summary}</span>
      </div>
      <div className="min-w-0 flex-1">
        <SearchBar
          fields={FIELDS}
          value={searchState}
          onChange={setSearchState}
          ariaLabel="Rechercher dans le carnet"
        />
      </div>
      <div className="shrink-0">
        <select
          aria-label="Année"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="h-9 rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-2 text-sm font-medium text-(--color-text) hover:bg-[#f8f8f5]"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div className="shrink-0 md:hidden">
        <ViewSwitcher
          views={['table', 'calendar', 'timeline', 'dashboard']}
          activeView={view}
          onChange={(v) => setView(v as CarnetView)}
          layout="dropdown"
          display="icon-only"
        />
      </div>
      <div className="hidden shrink-0 md:block">
        <ViewSwitcher
          views={['table', 'calendar', 'timeline', 'dashboard']}
          activeView={view}
          onChange={(v) => setView(v as CarnetView)}
          layout="segmented"
          display="icon-only"
        />
      </div>
      <div className="shrink-0">
        <ExportButton
          data={filtered as unknown as ReadonlyArray<Record<string, unknown>>}
          columns={EXPORT_COLUMNS}
          filenameBase={`carnet-${year}`}
          pdfMeta={{ title: `Carnet des champs ${year} — Domaine Darval` }}
        />
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-(--color-border) bg-(--color-surface) px-3 py-2">
        {topBar}
      </div>

      {view === 'calendar' ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
          <CalendarShowcase parcels={parcels} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {view === 'table' ? (
            <InterventionList interventions={filtered} onEdit={setEditing} />
          ) : view === 'timeline' ? (
            <TimelineView interventions={filtered} parcelsById={parcelsById} onEdit={setEditing} />
          ) : (
            <CarnetDashboard interventions={filtered} />
          )}
        </div>
      )}

      {editing && (
        <InterventionForm
          initial={editing}
          parcels={parcels}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
          onDelete={isEditingExisting ? handleDelete : undefined}
        />
      )}

      {/* Pas d'overlay sur mobile pour le FAB form trigger */}
      {!isDesktop && null}
    </div>
  );
}

/* ============ Vue Timeline (groupée par mois) ============ */

function TimelineView({
  interventions,
  parcelsById,
  onEdit,
}: {
  interventions: ReadonlyArray<Intervention>;
  parcelsById: ReadonlyMap<string, ReturnType<typeof useParcels>[number]>;
  onEdit: (i: Intervention) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, Intervention[]>();
    for (const i of interventions) {
      const key = i.date.slice(0, 7); // YYYY-MM
      const list = map.get(key);
      if (list) list.push(i);
      else map.set(key, [i]);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [interventions]);

  if (interventions.length === 0) {
    return (
      <div className="rounded-(--radius) border border-dashed border-(--color-border) bg-(--color-surface) py-10 text-center text-sm text-(--color-muted)">
        Aucune intervention pour cette période.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {grouped.map(([month, items]) => (
        <section key={month}>
          <h3 className="m-0 mb-2 text-xs font-semibold tracking-wider text-(--color-muted) uppercase">
            {fmtMonth(month)} · {items.length} intervention{items.length > 1 ? 's' : ''}
          </h3>
          <ul className="m-0 space-y-1.5 list-none p-0">
            {items.map((i) => {
              const parcel = parcelsById.get(i.parcelId);
              return (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => onEdit(i)}
                    className="flex w-full items-center gap-3 rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-left text-sm hover:bg-[#fbfbf9]"
                  >
                    <InterventionTypeIcon category={i.category} size={16} withBackground />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium">
                          {i.productName ?? CATEGORY_LABELS[i.category]}
                        </span>
                        <span className="font-mono text-[11px] text-(--color-muted)">
                          {fmtDate(i.date)}
                        </span>
                      </div>
                      <div className="truncate text-xs text-(--color-muted)">
                        {parcel?.name ?? i.parcelId}
                        {i.doseValue !== undefined && i.doseUnit
                          ? ` · ${i.doseValue} ${i.doseUnit}`
                          : ''}
                        {i.operator ? ` · ${i.operator}` : ''}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

const MONTHS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

function fmtMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-');
  return `${MONTHS_FR[Number(m) - 1]} ${y}`;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y!.slice(2)}`;
}

/* ============ Dashboard Carnet : KPI + bar chart par type ============ */
function CarnetDashboard({ interventions }: { interventions: ReadonlyArray<Intervention> }) {
  const byType = interventions.reduce<Record<string, number>>((acc, i) => {
    acc[i.type] = (acc[i.type] ?? 0) + 1;
    return acc;
  }, {});
  const total = interventions.length;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonth = interventions.filter((i) => i.date.startsWith(currentMonth)).length;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-5">
        <div className="text-xs tracking-wider text-(--color-muted) uppercase">
          Total interventions
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{total}</div>
      </div>
      <div className="rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-5">
        <div className="text-xs tracking-wider text-(--color-muted) uppercase">Ce mois</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{thisMonth}</div>
      </div>
      <div className="rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-5">
        <div className="text-xs tracking-wider text-(--color-muted) uppercase">Types distincts</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{Object.keys(byType).length}</div>
      </div>
      <div className="col-span-full rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-5">
        <h3 className="m-0 mb-3 text-sm font-semibold">Par type d'intervention</h3>
        <ul className="m-0 list-none space-y-2 p-0">
          {Object.entries(byType)
            .sort(([, a], [, b]) => b - a)
            .map(([type, n]) => (
              <li key={type}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span>{type}</span>
                  <span className="font-mono tabular-nums text-(--color-muted)">
                    {n} · {total > 0 ? ((n / total) * 100).toFixed(0) : 0} %
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-(--radius-pill) bg-[#f1f1ee]">
                  <div
                    className="h-full bg-(--color-primary)"
                    style={{ width: `${total > 0 ? (n / total) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
