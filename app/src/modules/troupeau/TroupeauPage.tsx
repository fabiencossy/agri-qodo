import { useMemo, useState } from 'react';
import { SearchBar, type FieldDescriptor, type SearchState } from '../../components/SearchBar';
import { ViewSwitcher, type ViewKey } from '../../components/ViewSwitcher';
import { DataTable } from '../../components/DataTable';
import { ExportButton, type ExportColumn } from '../../components/ExportButton';
import { useFabActions, useHideFab } from '../../layouts/useFab';
import { useStandardFabActions } from '../../layouts/useStandardFabActions';
import { useLivestockEntries, removeLivestockEntry } from './livestock.store';
import {
  balanceForFarm,
  manureProducedByType,
  ugbHaLegalLimit,
  ugbPerHectare,
} from './livestock.helpers';
import { LIVESTOCK_CATALOG, SPECIES_LABELS, getCategory } from './livestock.catalog';
import { LivestockEntryModal } from './LivestockEntryModal';
import type { LivestockEntry, LivestockSpecies } from './livestock.types';
import { useCurrentFarm } from '../farms/farms.store';
import { useCan } from '../users/permissions';

type TroupeauView = Extract<ViewKey, 'table' | 'dashboard'>;

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'category', label: 'Catégorie' },
  { key: 'species', label: 'Espèce' },
  { key: 'count', label: 'Têtes' },
  { key: 'ugb', label: 'UGB' },
  { key: 'nKgYear', label: 'N (kg/an)' },
  { key: 'pKgYear', label: 'P₂O₅ (kg/an)' },
  { key: 'kKgYear', label: 'K₂O (kg/an)' },
  { key: 'manureVolume', label: 'Effluents/an' },
  { key: 'manureType', label: 'Type effluents' },
  { key: 'notes', label: 'Notes' },
];

export default function TroupeauPage() {
  const entries = useLivestockEntries();
  const farm = useCurrentFarm();
  const canWrite = useCan('troupeau', 'write');
  const [editing, setEditing] = useState<Partial<LivestockEntry> | null>(null);
  const [view, setView] = useState<TroupeauView>('table');
  const [searchState, setSearchState] = useState<SearchState>({ facets: [], groupBy: [] });

  // ─── FAB ───────────────────────────────────────────────────────────────
  const onAddLivestock = useMemo(() => () => setEditing({}), []);
  const extraActions = useMemo(
    () =>
      canWrite
        ? [
            {
              id: 'add-livestock',
              label: 'Ajouter une catégorie d’animaux',
              variant: 'primary' as const,
              onClick: onAddLivestock,
            },
          ]
        : [],
    [canWrite, onAddLivestock],
  );
  const standardActions = useStandardFabActions({ extraActions });
  useFabActions(standardActions);
  useHideFab(editing !== null);

  // ─── SearchBar fields ──────────────────────────────────────────────────
  const fields: FieldDescriptor[] = useMemo(
    () => [
      {
        id: 'species',
        label: 'Espèce',
        type: 'select',
        options: Object.entries(SPECIES_LABELS).map(([k, v]) => ({ label: v, value: k })),
        groupable: true,
      },
      {
        id: 'manureType',
        label: 'Type d’effluent',
        type: 'select',
        options: [
          { label: 'Lisier', value: 'lisier' },
          { label: 'Fumier frais', value: 'fumier-frais' },
          { label: 'Fumier composté', value: 'fumier-composté' },
          { label: 'Fientes', value: 'fientes' },
        ],
      },
    ],
    [],
  );

  // ─── Filtrage ──────────────────────────────────────────────────────────
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const cat = getCategory(e.category);
      if (!cat) return false;
      if (searchState.query) {
        const q = searchState.query.toLowerCase();
        const hay = `${cat.label} ${cat.description ?? ''} ${e.notes ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      for (const facet of searchState.facets) {
        if (facet.values.length === 0) continue;
        if (facet.fieldId === 'species') {
          if (!facet.values.includes(cat.species)) return false;
        } else if (facet.fieldId === 'manureType') {
          if (!facet.values.includes(cat.manureType)) return false;
        }
      }
      return true;
    });
  }, [entries, searchState]);

  const balance = useMemo(() => balanceForFarm(filteredEntries), [filteredEntries]);
  const allBalance = useMemo(() => balanceForFarm(entries), [entries]);
  const manure = useMemo(() => manureProducedByType(allBalance), [allBalance]);
  const ugbHa = useMemo(
    () => ugbPerHectare(allBalance, farm?.surfaceTotalHa ?? 0),
    [allBalance, farm?.surfaceTotalHa],
  );
  const ugbLimit = ugbHaLegalLimit();
  const ugbHaStatus: 'ok' | 'alert' = ugbHa <= ugbLimit ? 'ok' : 'alert';

  const exportData = useMemo(() => {
    return filteredEntries.map((e) => {
      const cat = getCategory(e.category);
      if (!cat) return {};
      return {
        category: cat.label,
        species: SPECIES_LABELS[cat.species] ?? cat.species,
        count: e.count,
        ugb: Math.round(cat.ugbPerHead * e.count * 100) / 100,
        nKgYear: Math.round(cat.nKgPerHeadYear * e.count),
        pKgYear: Math.round(cat.pKgPerHeadYear * e.count),
        kKgYear: Math.round(cat.kKgPerHeadYear * e.count),
        manureVolume: `${(cat.manureVolumePerHeadYear * e.count).toFixed(1)} ${cat.manureVolumeUnit === 'm3' ? 'm³' : 't'}`,
        manureType: cat.manureType,
        notes: e.notes ?? '',
      } as unknown as Record<string, unknown>;
    });
  }, [filteredEntries]);

  const handleDelete = (entry: LivestockEntry) => {
    const cat = getCategory(entry.category);
    if (confirm(`Supprimer ${entry.count} ${cat?.label ?? entry.category} ?`)) {
      removeLivestockEntry(entry.id);
    }
  };

  const summary = `${balance.totalHeadCount} têtes · ${balance.totalUgb} UGB`;

  const topBar = (
    <div className="flex w-full items-center gap-2">
      <div className="hidden shrink-0 items-baseline gap-2 md:flex">
        <h1 className="m-0 truncate text-base font-semibold">Troupeau</h1>
        <span className="truncate text-xs text-(--color-muted)">{summary}</span>
      </div>
      <div className="min-w-0 flex-1">
        <SearchBar
          fields={fields}
          value={searchState}
          onChange={setSearchState}
          ariaLabel="Rechercher dans le cheptel"
        />
      </div>
      <div className="shrink-0 md:hidden">
        <ViewSwitcher
          views={['table', 'dashboard']}
          activeView={view}
          onChange={(v) => setView(v as TroupeauView)}
          layout="dropdown"
          display="icon-only"
        />
      </div>
      <div className="hidden shrink-0 md:block">
        <ViewSwitcher
          views={['table', 'dashboard']}
          activeView={view}
          onChange={(v) => setView(v as TroupeauView)}
          layout="segmented"
          display="icon-only"
        />
      </div>
      <div className="shrink-0">
        <ExportButton
          data={exportData}
          columns={EXPORT_COLUMNS}
          filenameBase={`troupeau-${new Date().getFullYear()}`}
          pdfMeta={{
            title: `Cheptel — ${farm?.name ?? 'Exploitation'} (${new Date().getFullYear()})`,
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-(--color-border) bg-(--color-surface) px-3 py-2">
        {topBar}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {view === 'dashboard' ? (
          <DashboardView
            balance={allBalance}
            manure={manure}
            ugbHa={ugbHa}
            ugbLimit={ugbLimit}
            ugbHaStatus={ugbHaStatus}
            sauHa={farm?.surfaceTotalHa ?? 0}
          />
        ) : (
          <LivestockTable
            entries={filteredEntries}
            canWrite={canWrite}
            onEdit={setEditing}
            onDelete={handleDelete}
            onAdd={onAddLivestock}
          />
        )}
      </div>

      {editing && <LivestockEntryModal initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/* ─── Vue Table ────────────────────────────────────────────────────────── */

function LivestockTable({
  entries,
  canWrite,
  onEdit,
  onDelete,
  onAdd,
}: {
  entries: ReadonlyArray<LivestockEntry>;
  canWrite: boolean;
  onEdit: (e: LivestockEntry) => void;
  onDelete: (e: LivestockEntry) => void;
  onAdd: () => void;
}) {
  // Group by species (toujours appelé en haut — règle des hooks)
  const groups = useMemo(() => {
    const map = new Map<LivestockSpecies, LivestockEntry[]>();
    for (const e of entries) {
      const cat = getCategory(e.category);
      if (!cat) continue;
      const arr = map.get(cat.species) ?? [];
      arr.push(e);
      map.set(cat.species, arr);
    }
    return [...map.entries()];
  }, [entries]);

  if (entries.length === 0) {
    return (
      <p className="m-0 py-10 text-center text-sm text-(--color-muted)">
        Aucun effectif enregistré.
        {canWrite && (
          <>
            {' '}
            <button type="button" onClick={onAdd} className="text-(--color-primary) underline">
              Ajouter une catégorie
            </button>
          </>
        )}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map(([species, items]) => (
        <section key={species}>
          <h2 className="m-0 mb-2 text-[11px] font-semibold tracking-wider text-(--color-muted) uppercase">
            {SPECIES_LABELS[species] ?? species} ({items.length})
          </h2>

          <DataTable<LivestockEntry>
            rows={items}
            getId={(e) => e.id}
            onRowClick={onEdit}
            entityLabel="catégorie"
            emptyMessage="Aucune catégorie."
            columns={[
              {
                key: 'category',
                label: 'Catégorie',
                render: (entry) => {
                  const cat = getCategory(entry.category);
                  return (
                    <div>
                      <div className="font-medium">{cat?.label ?? entry.category}</div>
                      {entry.notes && (
                        <div className="text-[11px] text-(--color-muted)">{entry.notes}</div>
                      )}
                    </div>
                  );
                },
              },
              {
                key: 'count',
                label: 'Têtes',
                align: 'right',
                render: (entry) => <span className="tabular-nums">{entry.count}</span>,
              },
              {
                key: 'ugb',
                label: 'UGB',
                align: 'right',
                render: (entry) => {
                  const cat = getCategory(entry.category);
                  return (
                    <span className="tabular-nums">
                      {cat ? (cat.ugbPerHead * entry.count).toFixed(1) : '—'}
                    </span>
                  );
                },
              },
              {
                key: 'n',
                label: 'N (kg/an)',
                align: 'right',
                render: (entry) => {
                  const cat = getCategory(entry.category);
                  return (
                    <span className="tabular-nums">
                      {cat ? Math.round(cat.nKgPerHeadYear * entry.count) : '—'}
                    </span>
                  );
                },
              },
              {
                key: 'p',
                label: 'P₂O₅ (kg/an)',
                align: 'right',
                render: (entry) => {
                  const cat = getCategory(entry.category);
                  return (
                    <span className="tabular-nums">
                      {cat ? Math.round(cat.pKgPerHeadYear * entry.count) : '—'}
                    </span>
                  );
                },
              },
              {
                key: 'k',
                label: 'K₂O (kg/an)',
                align: 'right',
                render: (entry) => {
                  const cat = getCategory(entry.category);
                  return (
                    <span className="tabular-nums">
                      {cat ? Math.round(cat.kKgPerHeadYear * entry.count) : '—'}
                    </span>
                  );
                },
              },
              {
                key: 'manure',
                label: 'Effluents',
                align: 'right',
                render: (entry) => {
                  const cat = getCategory(entry.category);
                  if (!cat) return '—';
                  return (
                    <span className="tabular-nums">
                      {(cat.manureVolumePerHeadYear * entry.count).toFixed(1)}{' '}
                      {cat.manureVolumeUnit === 'm3' ? 'm³' : 't'}
                    </span>
                  );
                },
              },
            ]}
            renderMobileCard={(entry, { checkbox }) => {
              const cat = getCategory(entry.category);
              if (!cat) return null;
              return (
                <>
                  <div className="shrink-0 pt-0.5">{checkbox}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{cat.label}</span>
                      <span className="shrink-0 font-mono text-[11px] text-(--color-muted) tabular-nums">
                        {entry.count} têtes
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs text-(--color-muted)">
                      <span className="tabular-nums">
                        {(cat.ugbPerHead * entry.count).toFixed(1)} UGB
                      </span>
                      <span aria-hidden>·</span>
                      <span className="tabular-nums">
                        {Math.round(cat.nKgPerHeadYear * entry.count)} kg N/an
                      </span>
                      <span aria-hidden>·</span>
                      <span className="tabular-nums">
                        {(cat.manureVolumePerHeadYear * entry.count).toFixed(1)}{' '}
                        {cat.manureVolumeUnit === 'm3' ? 'm³' : 't'}
                      </span>
                    </div>
                    {entry.notes && (
                      <div className="mt-0.5 truncate text-[11px] italic text-(--color-muted)">
                        {entry.notes}
                      </div>
                    )}
                  </div>
                </>
              );
            }}
            bulkActions={
              canWrite
                ? [
                    {
                      id: 'delete',
                      label: 'Supprimer',
                      variant: 'danger',
                      onClick: () => {
                        if (confirm('Supprimer les catégories sélectionnées ?')) {
                          items.forEach(onDelete);
                        }
                      },
                    },
                  ]
                : []
            }
          />
        </section>
      ))}

      <p className="m-0 text-[11px] text-(--color-muted)">
        {LIVESTOCK_CATALOG.length} catégories disponibles selon DBF Agroscope 2017 / OEngrais 2024.
        Phase 3 : import BDTA (animaux individuels avec ID éléctronique et événements de vie).
      </p>
    </div>
  );
}

/* ─── Vue Dashboard ────────────────────────────────────────────────────── */

function DashboardView({
  balance,
  manure,
  ugbHa,
  ugbLimit,
  ugbHaStatus,
  sauHa,
}: {
  balance: ReturnType<typeof balanceForFarm>;
  manure: ReturnType<typeof manureProducedByType>;
  ugbHa: number;
  ugbLimit: number;
  ugbHaStatus: 'ok' | 'alert';
  sauHa: number;
}) {
  return (
    <div className="space-y-5">
      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Têtes totales"
          value={balance.totalHeadCount.toString()}
          hint="Effectif annuel moyen"
        />
        <Kpi label="UGB total" value={balance.totalUgb.toString()} hint="Équivalent grand bétail" />
        <Kpi
          label="UGB / ha SAU"
          value={ugbHa.toString()}
          hint={`Limite OPD : ${ugbLimit} · SAU : ${sauHa.toFixed(1)} ha`}
          status={ugbHaStatus}
        />
        <Kpi
          label="Azote excrété (brut)"
          value={`${balance.totalNKg.toLocaleString('fr-CH')} kg N`}
          hint="Avant pertes stockage/épandage"
        />
      </section>

      {/* Production effluents */}
      <section className="rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-5">
        <h2 className="m-0 mb-3 text-sm font-semibold tracking-wider text-(--color-muted) uppercase">
          Production annuelle d'effluents
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Lisier"
            value={`${manure.lisierM3.toLocaleString('fr-CH')} m³`}
            sub={`dont ${manure.nByTypeKg.lisier} kg N`}
          />
          <Stat
            label="Fumier frais"
            value={`${manure.fumierFraisT.toLocaleString('fr-CH')} t`}
            sub={`dont ${manure.nByTypeKg.fumier} kg N`}
          />
          <Stat
            label="Fientes volailles"
            value={`${manure.fientesT.toLocaleString('fr-CH')} t`}
            sub={`dont ${manure.nByTypeKg.fientes} kg N`}
          />
        </div>
        <p className="m-0 mt-3 text-[11px] text-(--color-muted)">
          Valeurs brutes selon DBF 2017 Agroscope / OEngrais 2024. Le bilan disponible 1re année
          (coefficients d'efficacité) est calculé dans le module Plan de fumure.
        </p>
      </section>

      {/* Total minéraux */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Azote total" value={`${balance.totalNKg.toLocaleString('fr-CH')} kg N/an`} />
        <Stat
          label="Phosphore total"
          value={`${balance.totalPKg.toLocaleString('fr-CH')} kg P₂O₅/an`}
        />
        <Stat
          label="Potasse totale"
          value={`${balance.totalKKg.toLocaleString('fr-CH')} kg K₂O/an`}
        />
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  status,
}: {
  label: string;
  value: string;
  hint?: string;
  status?: 'ok' | 'alert';
}) {
  return (
    <div
      className={[
        'rounded-(--radius) border bg-(--color-surface) p-4',
        status === 'alert' ? 'border-(--color-error)/30 bg-[#fef2f2]' : 'border-(--color-border)',
      ].join(' ')}
    >
      <div className="text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-(--color-muted)">{hint}</div>}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) p-3">
      <div className="text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-(--color-muted)">{sub}</div>}
    </div>
  );
}
