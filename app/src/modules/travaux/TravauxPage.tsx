import { useMemo, useState } from 'react';
import { SearchBar, type FieldDescriptor, type SearchState } from '../../components/SearchBar';
import { ViewSwitcher, type ViewKey } from '../../components/ViewSwitcher';
import { CalendarShowcase } from '../composants/ComposantsPage';
import { ExportButton, type ExportColumn } from '../../components/ExportButton';
import { useFabActions, useHideFab } from '../../layouts/useFab';
import { useStandardFabActions } from '../../layouts/useStandardFabActions';
import { useClients, useWorkOrders } from './travaux.store';
import { useParcels } from '../parcellaire/parcellaire.store';
import { WorkOrderModal } from './WorkOrderModal';
import { QuickWorkOrderModal } from './QuickWorkOrderModal';
import { useCurrentFarm } from '../farms/farms.store';
import { findClientForFarm, useIsCurrentFarmInvitee } from '../farms/farms.helpers';
import { getWorkType, WORK_CATEGORY_LABELS } from './travaux.catalog';
import {
  computeWorkOrderTotal,
  computeWorkOrderDuration,
  computeWorkOrderSurface,
  type WorkOrder,
  type WorkOrderStatus,
} from './travaux.types';
import { useCan } from '../users/permissions';

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  planned: 'Planifié',
  'in-progress': 'En cours',
  done: 'Réalisé',
  invoiced: 'Validé',
  cancelled: 'Annulé',
};

/** Statuts visibles dans /travaux. Les bons planifiés vont dans la vue
 * Planning (à venir), pas dans la liste des travaux réalisés. */
const TRAVAUX_VISIBLE_STATUSES: ReadonlyArray<WorkOrderStatus> = ['done', 'invoiced'];

const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  planned: 'bg-[#f1f1ee] text-(--color-text)',
  'in-progress': 'bg-[#fef3c7] text-[#92400e]',
  done: 'bg-[#dcfce7] text-[#166534]',
  invoiced: 'bg-(--color-primary)/15 text-(--color-primary)',
  cancelled: 'bg-[#fee2e2] text-[#991b1b]',
};

type TravauxView = Extract<ViewKey, 'table' | 'calendar' | 'timeline' | 'dashboard'>;

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'date', label: 'Date' },
  { key: 'clientName', label: 'Client' },
  { key: 'prestations', label: 'Prestations' },
  { key: 'durationHours', label: 'Durée (h)' },
  { key: 'surfaceHa', label: 'Surface (ha)' },
  { key: 'totalChf', label: 'Total HT (CHF)' },
  { key: 'status', label: 'Statut' },
  { key: 'invoiceRef', label: 'Facture' },
];

export default function TravauxPage() {
  const orders = useWorkOrders();
  const clients = useClients();
  const parcels = useParcels();
  const canWrite = useCan('travaux', 'write');
  const [editing, setEditing] = useState<Partial<WorkOrder> | null>(null);
  const [quickCreating, setQuickCreating] = useState(false);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [view, setView] = useState<TravauxView>('table');

  // Mode invité : on pré-coche le filtre client au client correspondant à la
  // current farm — l'utilisateur ne voit que ses bons chez ce client.
  const currentFarm = useCurrentFarm();
  const isInvitee = useIsCurrentFarmInvitee();
  const matchedClient = isInvitee ? findClientForFarm(currentFarm, clients) : undefined;
  const inviteeClientId = matchedClient?.id ?? null;

  const [searchState, setSearchState] = useState<SearchState>({
    facets: [],
    groupBy: [],
  });

  // Mode invité : on injecte le filtre client de force dans le searchState
  // affiché à la SearchBar (et utilisé pour le filtrage), sans toucher au
  // state. Pas de setState pendant le render → pas de boucle infinie. L'user
  // peut quand même ajouter/retirer ses propres facets, le filtre invité
  // reste persistant tant que la current farm est invitée.
  const effectiveSearchState: SearchState = inviteeClientId
    ? {
        ...searchState,
        facets: [
          ...searchState.facets.filter((f) => f.fieldId !== 'client'),
          {
            id: `facet-client-${inviteeClientId}`,
            fieldId: 'client',
            operator: 'eq' as const,
            values: [inviteeClientId],
            customLabel: `Client : ${matchedClient?.name ?? inviteeClientId}`,
          },
        ],
      }
    : searchState;

  // ─── FAB ───────────────────────────────────────────────────────────────
  const onAddWorkOrder = useMemo(() => () => setQuickCreating(true), []);
  const extraActions = useMemo(
    () =>
      canWrite
        ? [
            {
              id: 'add-work-order',
              label: 'Nouveau bon de travail',
              variant: 'primary' as const,
              onClick: onAddWorkOrder,
            },
          ]
        : [],
    [canWrite, onAddWorkOrder],
  );
  const standardActions = useStandardFabActions({ extraActions });
  useFabActions(standardActions);
  useHideFab(editing !== null || quickCreating);

  // ─── SearchBar fields ──────────────────────────────────────────────────
  const fields: FieldDescriptor[] = useMemo(
    () => [
      {
        id: 'client',
        label: 'Client',
        type: 'select',
        options: clients.filter((c) => c.active).map((c) => ({ label: c.name, value: c.id })),
        groupable: true,
      },
      {
        id: 'workType',
        label: 'Prestation',
        type: 'text',
      },
      {
        id: 'status',
        label: 'Statut',
        type: 'select',
        // Seuls Réalisé + Validé sont sélectionnables ici — les autres statuts
        // (Planifié, En cours, Annulé) ne sont pas visibles dans /travaux.
        options: TRAVAUX_VISIBLE_STATUSES.map((s) => ({
          label: STATUS_LABELS[s],
          value: s,
        })),
        groupable: true,
      },
      {
        id: 'category',
        label: 'Catégorie',
        type: 'select',
        options: Object.entries(WORK_CATEGORY_LABELS).map(([k, v]) => ({
          label: v,
          value: k,
        })),
      },
    ],
    [clients],
  );

  // ─── Filtrage ──────────────────────────────────────────────────────────
  // NB : les bons "Planifié" ont leur propre page /planning (PlanningPage).
  const filtered = useMemo(() => {
    return orders
      .filter((o) => {
        // Page Travaux = uniquement les bons réalisés ou validés.
        // Les bons planifiés sont visibles dans la vue Planning (à venir).
        if (!TRAVAUX_VISIBLE_STATUSES.includes(o.status)) return false;
        if (year && !o.date.startsWith(String(year))) return false;
        if (effectiveSearchState.query) {
          const q = effectiveSearchState.query.toLowerCase();
          const client = clients.find((c) => c.id === o.clientId)?.name ?? '';
          const types = o.lines.map((l) => getWorkType(l.workType)?.label ?? '').join(' ');
          const hay = `${client} ${types} ${o.description ?? ''} ${o.machine ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        for (const facet of effectiveSearchState.facets) {
          if (facet.values.length === 0) continue;
          if (facet.fieldId === 'client') {
            if (!facet.values.includes(o.clientId)) return false;
          } else if (facet.fieldId === 'status') {
            if (!facet.values.includes(o.status)) return false;
          } else if (facet.fieldId === 'category') {
            const cats = o.lines
              .map((l) => getWorkType(l.workType)?.category)
              .filter((c): c is NonNullable<typeof c> => Boolean(c));
            const catStrings = cats as ReadonlyArray<string>;
            if (!facet.values.some((v) => catStrings.includes(String(v)))) return false;
          } else if (facet.fieldId === 'workType') {
            const labels = o.lines
              .map((l) => (getWorkType(l.workType)?.label ?? '').toLowerCase())
              .join(' ');
            if (!facet.values.some((v) => labels.includes(String(v).toLowerCase()))) return false;
          }
        }
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [orders, clients, year, effectiveSearchState]);

  // ─── KPIs ──────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let count = 0;
    let totalChf = 0;
    let invoicedChf = 0;
    let hours = 0;
    for (const o of filtered) {
      count++;
      const t = computeWorkOrderTotal(o);
      totalChf += t;
      if (o.status === 'invoiced') invoicedChf += t;
      hours += computeWorkOrderDuration(o);
    }
    return { count, totalChf, invoicedChf, hours: Math.round(hours * 10) / 10 };
  }, [filtered]);

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    for (const o of orders) set.add(Number(o.date.slice(0, 4)));
    set.add(new Date().getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [orders]);

  const exportData = useMemo(() => {
    return filtered.map((o) => {
      const client = clients.find((c) => c.id === o.clientId);
      const prestations = o.lines
        .map((l) => getWorkType(l.workType)?.label ?? l.workType)
        .join(' + ');
      return {
        date: formatDate(o.date),
        clientName: client?.name ?? '—',
        prestations,
        durationHours: computeWorkOrderDuration(o),
        surfaceHa: computeWorkOrderSurface(o),
        totalChf: computeWorkOrderTotal(o),
        status: STATUS_LABELS[o.status],
        invoiceRef: o.invoiceRef ?? '',
      } as unknown as Record<string, unknown>;
    });
  }, [filtered, clients]);

  const summary = `${totals.count} bon${totals.count > 1 ? 's' : ''} · ${totals.hours} h · ${totals.totalChf.toLocaleString('fr-CH')} CHF`;

  const topBar = (
    <div className="flex w-full items-center gap-2">
      <div className="hidden shrink-0 items-baseline gap-2 md:flex">
        <h1 className="m-0 truncate text-base font-semibold">Travaux pour tiers</h1>
        <span className="truncate text-xs text-(--color-muted)">{summary}</span>
      </div>
      <div className="min-w-0 flex-1">
        <SearchBar
          fields={fields}
          value={effectiveSearchState}
          onChange={setSearchState}
          ariaLabel="Rechercher dans les bons de travaux"
        />
      </div>
      <div className="shrink-0">
        <select
          aria-label="Année"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="h-9 rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-2 text-sm font-medium text-(--color-text) hover:bg-[#f8f8f5]"
        >
          {availableYears.map((y) => (
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
          onChange={(v) => setView(v as TravauxView)}
          layout="dropdown"
          display="icon-only"
        />
      </div>
      <div className="hidden shrink-0 md:block">
        <ViewSwitcher
          views={['table', 'calendar', 'timeline', 'dashboard']}
          activeView={view}
          onChange={(v) => setView(v as TravauxView)}
          layout="segmented"
          display="icon-only"
        />
      </div>
      <div className="shrink-0">
        <ExportButton
          data={exportData}
          columns={EXPORT_COLUMNS}
          filenameBase={`travaux-${year}`}
          pdfMeta={{ title: `Travaux pour tiers ${year} — Domaine Darval` }}
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
          {view === 'table' && (
            <WorkOrderTable
              orders={filtered}
              clients={clients}
              parcels={parcels}
              onEdit={setEditing}
            />
          )}
          {view === 'timeline' && (
            <TimelineView orders={filtered} clients={clients} onEdit={setEditing} />
          )}
          {view === 'dashboard' && (
            <DashboardView orders={filtered} totals={totals} clients={clients} />
          )}
        </div>
      )}

      {editing && <WorkOrderModal initial={editing} onClose={() => setEditing(null)} />}
      {quickCreating && (
        <QuickWorkOrderModal
          // Sur une farm invitée, préremplit automatiquement le client lié.
          // L'utilisateur n'a pas à le re-sélectionner manuellement.
          initialClientId={inviteeClientId ?? undefined}
          onClose={() => setQuickCreating(false)}
          onSwitchToFull={(draft) => {
            setQuickCreating(false);
            setEditing(draft);
          }}
        />
      )}
    </div>
  );
}

/* ─── Vue Table ────────────────────────────────────────────────────────── */

function WorkOrderTable({
  orders,
  clients,
  parcels,
  onEdit,
}: {
  orders: ReadonlyArray<WorkOrder>;
  clients: ReadonlyArray<{ id: string; name: string; city?: string }>;
  parcels: ReadonlyArray<{ id: string; name: string }>;
  onEdit: (wo: WorkOrder) => void;
}) {
  /** Résume les parcelles d'un bon en string lisible : "Nom1 + N autres" si plusieurs. */
  const parcelsLabel = (wo: WorkOrder): string => {
    const ids = wo.parcelIds ?? [];
    if (ids.length === 0) return '—';
    const names = ids.map((id) => parcels.find((p) => p.id === id)?.name ?? id);
    if (names.length === 1) return names[0]!;
    return `${names[0]} +${names.length - 1}`;
  };
  if (orders.length === 0) {
    return (
      <p className="m-0 py-10 text-center text-sm text-(--color-muted)">Aucun bon de travail.</p>
    );
  }
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-(--color-border) text-left text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
              <th className="py-2 pr-2">Date</th>
              <th className="py-2 pr-2">Client</th>
              <th className="py-2 pr-2">Prestation</th>
              <th className="py-2 pr-2">Parcelle</th>
              <th className="px-2 py-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((wo) => {
              const client = clients.find((c) => c.id === wo.clientId);
              const first = wo.lines[0];
              const firstLabel = first
                ? (getWorkType(first.workType)?.label ?? first.workType ?? '—')
                : '—';
              return (
                <tr
                  key={wo.id}
                  onClick={() => onEdit(wo)}
                  className="cursor-pointer border-b border-(--color-border) hover:bg-[#fbfbf9]"
                >
                  <td className="py-2 pr-2 tabular-nums">{formatDate(wo.date)}</td>
                  <td className="py-2 pr-2">
                    <div className="font-medium">{client?.name ?? '—'}</div>
                  </td>
                  <td className="py-2 pr-2">
                    <div className="truncate">
                      {wo.lines.length > 1 ? `${firstLabel}…` : firstLabel}
                    </div>
                  </td>
                  <td className="py-2 pr-2 text-[12px] text-(--color-muted)">{parcelsLabel(wo)}</td>
                  <td className="px-2 py-2">
                    <span
                      className={[
                        'inline-flex items-center rounded-(--radius-pill) px-2 py-0.5 text-[10px] font-medium',
                        STATUS_COLORS[wo.status],
                      ].join(' ')}
                    >
                      {STATUS_LABELS[wo.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cards mobile : prestation + client + parcelle + statut. Pas d'heures
          ni prix ni surface — le PO ne veut que l'essentiel sur la liste. */}
      <ul className="m-0 list-none space-y-2 p-0 md:hidden">
        {orders.map((wo) => {
          const client = clients.find((c) => c.id === wo.clientId);
          const first = wo.lines[0];
          const firstLabel = first
            ? (getWorkType(first.workType)?.label ?? first.workType ?? '—')
            : '—';
          return (
            <li
              key={wo.id}
              role="button"
              tabIndex={0}
              onClick={() => onEdit(wo)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onEdit(wo);
                }
              }}
              aria-label={`Ouvrir le bon ${formatDate(wo.date)} — ${client?.name ?? ''}`}
              className="cursor-pointer rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) p-3 transition-colors hover:border-(--color-primary) hover:bg-[#fbfbf9] focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)/40"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {wo.lines.length > 1 ? `${firstLabel}…` : firstLabel}
                </span>
                <span className="shrink-0 text-xs tabular-nums">{formatDate(wo.date)}</span>
              </div>
              <div className="text-[11px] text-(--color-muted)">{client?.name ?? '—'}</div>
              <div className="text-[11px] text-(--color-muted)">{parcelsLabel(wo)}</div>
              <div className="mt-1">
                <span
                  className={[
                    'inline-flex items-center rounded-(--radius-pill) px-2 py-0.5 text-[10px] font-medium',
                    STATUS_COLORS[wo.status],
                  ].join(' ')}
                >
                  {STATUS_LABELS[wo.status]}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/* ─── Vue Timeline (groupé par mois) ───────────────────────────────────── */

function TimelineView({
  orders,
  clients,
  onEdit,
}: {
  orders: ReadonlyArray<WorkOrder>;
  clients: ReadonlyArray<{ id: string; name: string }>;
  onEdit: (wo: WorkOrder) => void;
}) {
  const months = useMemo(() => {
    const map = new Map<string, WorkOrder[]>();
    for (const wo of orders) {
      const k = wo.date.slice(0, 7);
      const arr = map.get(k) ?? [];
      arr.push(wo);
      map.set(k, arr);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [orders]);

  if (orders.length === 0) {
    return (
      <p className="m-0 py-10 text-center text-sm text-(--color-muted)">
        Aucun bon dans cette période.
      </p>
    );
  }

  const fmtMonth = (key: string) => {
    const [y, m] = key.split('-');
    const date = new Date(Number(y), Number(m) - 1, 1);
    return date.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="space-y-5">
      {months.map(([month, wos]) => (
        <section key={month}>
          <h2 className="m-0 mb-2 text-[11px] font-semibold tracking-wider text-(--color-muted) uppercase">
            {fmtMonth(month)} · {wos.length} bon{wos.length > 1 ? 's' : ''}
          </h2>
          <ul className="m-0 list-none space-y-2 p-0">
            {wos.map((wo) => {
              const client = clients.find((c) => c.id === wo.clientId);
              const total = computeWorkOrderTotal(wo);
              return (
                <li
                  key={wo.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onEdit(wo)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onEdit(wo);
                    }
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) p-3 transition-colors hover:border-(--color-primary) hover:bg-[#fbfbf9] focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)/40"
                >
                  <div className="shrink-0 text-xs tabular-nums text-(--color-muted)">
                    {wo.date.slice(8, 10)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{client?.name ?? '—'}</div>
                    <div className="truncate text-[11px] text-(--color-muted)">
                      {wo.lines.map((l) => getWorkType(l.workType)?.label).join(' · ')}
                    </div>
                  </div>
                  <span
                    className={[
                      'inline-flex shrink-0 items-center rounded-(--radius-pill) px-2 py-0.5 text-[10px] font-medium',
                      STATUS_COLORS[wo.status],
                    ].join(' ')}
                  >
                    {STATUS_LABELS[wo.status]}
                  </span>
                  <div className="shrink-0 text-sm tabular-nums font-medium">
                    {total.toLocaleString('fr-CH')} CHF
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ─── Vue Dashboard ────────────────────────────────────────────────────── */

function DashboardView({
  orders,
  totals,
  clients,
}: {
  orders: ReadonlyArray<WorkOrder>;
  totals: { count: number; totalChf: number; invoicedChf: number; hours: number };
  clients: ReadonlyArray<{ id: string; name: string }>;
}) {
  // Stats par catégorie
  const byCategory = useMemo(() => {
    const map = new Map<string, { count: number; totalChf: number; hours: number }>();
    for (const o of orders) {
      for (const l of o.lines) {
        const cat = getWorkType(l.workType)?.category ?? 'autre';
        const cur = map.get(cat) ?? { count: 0, totalChf: 0, hours: 0 };
        cur.count++;
        cur.totalChf += Math.round(l.totalChf ?? 0);
        cur.hours += l.durationHours ?? 0;
        map.set(cat, cur);
      }
    }
    return [...map.entries()].sort((a, b) => b[1].totalChf - a[1].totalChf);
  }, [orders]);

  const byClient = useMemo(() => {
    const map = new Map<string, { count: number; totalChf: number }>();
    for (const o of orders) {
      const cur = map.get(o.clientId) ?? { count: 0, totalChf: 0 };
      cur.count++;
      cur.totalChf += computeWorkOrderTotal(o);
      map.set(o.clientId, cur);
    }
    return [...map.entries()]
      .map(([cid, v]) => ({ client: clients.find((c) => c.id === cid)?.name ?? '—', ...v }))
      .sort((a, b) => b.totalChf - a.totalChf);
  }, [orders, clients]);

  const byStatus = useMemo(() => {
    const map = new Map<WorkOrderStatus, { count: number; totalChf: number }>();
    for (const o of orders) {
      const cur = map.get(o.status) ?? { count: 0, totalChf: 0 };
      cur.count++;
      cur.totalChf += computeWorkOrderTotal(o);
      map.set(o.status, cur);
    }
    return [...map.entries()];
  }, [orders]);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Bons" value={String(totals.count)} />
        <Kpi label="Heures" value={totals.hours.toFixed(1)} />
        <Kpi label="CA total" value={`${totals.totalChf.toLocaleString('fr-CH')} CHF`} />
        <Kpi
          label="Facturé"
          value={`${totals.invoicedChf.toLocaleString('fr-CH')} CHF`}
          hint={`${totals.totalChf > 0 ? Math.round((totals.invoicedChf / totals.totalChf) * 100) : 0}% du CA`}
        />
      </section>

      {/* Par catégorie */}
      <section className="rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-5">
        <h2 className="m-0 mb-3 text-sm font-semibold tracking-wider text-(--color-muted) uppercase">
          Par catégorie de prestation
        </h2>
        {byCategory.length === 0 ? (
          <p className="m-0 text-sm text-(--color-muted)">Aucune donnée.</p>
        ) : (
          <ul className="m-0 list-none space-y-1.5 p-0">
            {byCategory.map(([cat, v]) => (
              <li key={cat} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{WORK_CATEGORY_LABELS[cat] ?? cat}</span>
                <span className="shrink-0 text-[11px] text-(--color-muted)">
                  {v.count} lignes · {v.hours.toFixed(1)} h
                </span>
                <span className="shrink-0 tabular-nums font-medium">
                  {v.totalChf.toLocaleString('fr-CH')} CHF
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Par client */}
      <section className="rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-5">
        <h2 className="m-0 mb-3 text-sm font-semibold tracking-wider text-(--color-muted) uppercase">
          Par client
        </h2>
        {byClient.length === 0 ? (
          <p className="m-0 text-sm text-(--color-muted)">Aucune donnée.</p>
        ) : (
          <ul className="m-0 list-none space-y-1.5 p-0">
            {byClient.map((row) => (
              <li key={row.client} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{row.client}</span>
                <span className="shrink-0 text-[11px] text-(--color-muted)">{row.count} bons</span>
                <span className="shrink-0 tabular-nums font-medium">
                  {row.totalChf.toLocaleString('fr-CH')} CHF
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Par statut */}
      <section className="rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-5">
        <h2 className="m-0 mb-3 text-sm font-semibold tracking-wider text-(--color-muted) uppercase">
          Par statut
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {byStatus.map(([status, v]) => (
            <div
              key={status}
              className={['rounded-(--radius-sm) p-3', STATUS_COLORS[status]].join(' ')}
            >
              <div className="text-[10px] font-semibold tracking-wider uppercase">
                {STATUS_LABELS[status]}
              </div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">{v.count}</div>
              <div className="text-[11px] tabular-nums">
                {v.totalChf.toLocaleString('fr-CH')} CHF
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-4">
      <div className="text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-(--color-muted)">{hint}</div>}
    </div>
  );
}
