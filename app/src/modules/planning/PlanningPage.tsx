import { useMemo, useState } from 'react';
import { SearchBar, type FieldDescriptor, type SearchState } from '../../components/SearchBar';
import { ViewSwitcher, type ViewKey } from '../../components/ViewSwitcher';
import { CalendarShowcase } from '../composants/ComposantsPage';
import { useParcels } from '../parcellaire/parcellaire.store';
import { ExportButton, type ExportColumn } from '../../components/ExportButton';
import { useFabActions } from '../../layouts/useFab';
import { useStandardFabActions } from '../../layouts/useStandardFabActions';
import { useCan } from '../users/permissions';
import { useClients, useWorkOrders } from '../travaux/travaux.store';
import { getWorkType, WORK_CATEGORY_LABELS } from '../travaux/travaux.catalog';
import { computeWorkOrderDuration, type WorkOrder } from '../travaux/travaux.types';
import { WorkOrderModal } from '../travaux/WorkOrderModal';
import { QuickWorkOrderModal } from '../travaux/QuickWorkOrderModal';
import { useCurrentFarm } from '../farms/farms.store';
import { findClientForFarm, useIsCurrentFarmInvitee } from '../farms/farms.helpers';

type PlanningView = Extract<ViewKey, 'table' | 'calendar'>;

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'date', label: 'Date' },
  { key: 'scheduledTime', label: 'Heure' },
  { key: 'clientName', label: 'Client' },
  { key: 'prestation', label: 'Prestation' },
  { key: 'durationHours', label: 'Durée prévue (h)' },
];

/**
 * Module Planning — liste verticale des bons "Planifié" groupés par jour.
 *
 * Distinct de /travaux qui n'affiche que les bons Réalisé/Validé. Le Planning
 * est l'inbox des tâches à venir ; cliquer une card ouvre le WorkOrderModal
 * complet où l'utilisateur peut replanifier (changer date) ou marquer comme
 * Réalisé / Terminé selon ses droits (cf. mémoire workflow-validation-travaux).
 *
 * Phase 2 : grille calendrier mensuelle, vue semaine (7 colonnes × heures),
 * vue jour (timeline 24h), drag & drop pour replanifier visuellement.
 */
export default function PlanningPage() {
  const orders = useWorkOrders();
  const clients = useClients();
  const parcels = useParcels();
  const canWrite = useCan('travaux', 'write');
  const currentFarm = useCurrentFarm();
  const isInvitee = useIsCurrentFarmInvitee();
  const matchedClient = isInvitee ? findClientForFarm(currentFarm, clients) : undefined;
  const inviteeClientId = matchedClient?.id ?? null;

  const [editing, setEditing] = useState<Partial<WorkOrder> | null>(null);
  const [quickCreating, setQuickCreating] = useState(false);
  const [view, setView] = useState<PlanningView>('table');
  const [searchState, setSearchState] = useState<SearchState>({
    facets: [],
    groupBy: [],
  });

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

  // ─── FAB ────────────────────────────────────────────────────────────────
  const onAddPlanned = useMemo(() => () => setQuickCreating(true), []);
  const extraActions = useMemo(
    () =>
      canWrite
        ? [
            {
              id: 'plan-new',
              label: 'Planifier un travail',
              variant: 'primary' as const,
              onClick: onAddPlanned,
            },
          ]
        : [],
    [canWrite, onAddPlanned],
  );
  useFabActions(
    useStandardFabActions({
      extraActions,
      onlyExtraActions: isInvitee,
    }),
  );

  // ─── SearchBar ──────────────────────────────────────────────────────────
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
        id: 'category',
        label: 'Catégorie',
        type: 'select',
        options: Object.entries(WORK_CATEGORY_LABELS).map(([k, v]) => ({ label: v, value: k })),
      },
    ],
    [clients],
  );

  // ─── Filtrage ───────────────────────────────────────────────────────────
  const plannedOrders = useMemo(() => {
    return orders
      .filter((o) => o.status === 'planned')
      .filter((o) => {
        if (effectiveSearchState.query) {
          const q = effectiveSearchState.query.toLowerCase();
          const client = clients.find((c) => c.id === o.clientId)?.name ?? '';
          const types = o.lines.map((l) => getWorkType(l.workType)?.label ?? '').join(' ');
          const hay = `${client} ${types} ${o.description ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        for (const facet of effectiveSearchState.facets) {
          if (facet.values.length === 0) continue;
          if (facet.fieldId === 'client') {
            if (!facet.values.includes(o.clientId)) return false;
          } else if (facet.fieldId === 'category') {
            const cats = o.lines
              .map((l) => getWorkType(l.workType)?.category)
              .filter((c): c is NonNullable<typeof c> => Boolean(c));
            const catStrings = cats as ReadonlyArray<string>;
            if (!facet.values.some((v) => catStrings.includes(String(v)))) return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        // Si même date, trie par heure prévue (vides à la fin)
        const ta = a.scheduledTime ?? 'zz';
        const tb = b.scheduledTime ?? 'zz';
        return ta < tb ? -1 : 1;
      });
  }, [orders, clients, effectiveSearchState]);

  const exportData = useMemo(() => {
    return plannedOrders.map((o) => {
      const client = clients.find((c) => c.id === o.clientId);
      const firstLine = o.lines[0];
      const workLabel = firstLine ? (getWorkType(firstLine.workType)?.label ?? '') : '';
      return {
        date: o.date,
        scheduledTime: o.scheduledTime ?? '',
        clientName: client?.name ?? '—',
        prestation: workLabel + (o.lines.length > 1 ? `…` : ''),
        durationHours: computeWorkOrderDuration(o),
      } as unknown as Record<string, unknown>;
    });
  }, [plannedOrders, clients]);

  const topBar = (
    <div className="flex w-full items-center gap-2">
      <div className="hidden shrink-0 items-baseline gap-2 md:flex">
        <h1 className="m-0 truncate text-base font-semibold">Planning</h1>
        <span className="truncate text-xs text-(--color-muted)">
          {plannedOrders.length} bon{plannedOrders.length > 1 ? 's' : ''} planifié
          {plannedOrders.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <SearchBar
          fields={fields}
          value={effectiveSearchState}
          onChange={setSearchState}
          ariaLabel="Rechercher dans le planning"
        />
      </div>
      <div className="shrink-0 md:hidden">
        <ViewSwitcher
          views={['table', 'calendar']}
          activeView={view}
          onChange={(v) => setView(v as PlanningView)}
          layout="dropdown"
          display="icon-only"
        />
      </div>
      <div className="hidden shrink-0 md:block">
        <ViewSwitcher
          views={['table', 'calendar']}
          activeView={view}
          onChange={(v) => setView(v as PlanningView)}
          layout="segmented"
          display="icon-only"
        />
      </div>
      <div className="shrink-0">
        <ExportButton
          data={exportData}
          columns={EXPORT_COLUMNS}
          filenameBase="planning"
          pdfMeta={{ title: 'Planning des travaux' }}
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
          {plannedOrders.length === 0 ? (
            <div className="mx-auto max-w-md rounded-(--radius) border border-dashed border-(--color-border) bg-[#fbfbf9] py-10 text-center">
              <p className="m-0 text-sm text-(--color-muted)">Aucun travail planifié.</p>
              <p className="m-0 mt-1 text-[11px] text-(--color-muted)">
                Créez-en un avec le bouton « + » et choisissez « Planifier ».
              </p>
            </div>
          ) : (
            <PlanningTable orders={plannedOrders} clients={clients} onEdit={setEditing} />
          )}
        </div>
      )}

      {editing && <WorkOrderModal initial={editing} onClose={() => setEditing(null)} />}
      {quickCreating && (
        <QuickWorkOrderModal
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

/* ─── Sous-composants ────────────────────────────────────────────────── */

/** Vue liste = tableau (cohérence avec /travaux et le reste de l'app). */
function PlanningTable({
  orders,
  clients,
  onEdit,
}: {
  orders: ReadonlyArray<WorkOrder>;
  clients: ReadonlyArray<{ id: string; name: string }>;
  onEdit: (wo: WorkOrder) => void;
}) {
  const fmtDate = (iso: string) => iso.split('-').reverse().join('.');
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <>
      {/* Desktop : table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-(--color-border) text-left text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
              <th className="py-2 pr-2">Date</th>
              <th className="px-2 py-2">Heure</th>
              <th className="px-2 py-2">Client</th>
              <th className="px-2 py-2">Prestation</th>
              <th className="px-2 py-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((wo) => {
              const client = clients.find((c) => c.id === wo.clientId);
              const firstLine = wo.lines[0];
              const workLabel = firstLine ? (getWorkType(firstLine.workType)?.label ?? '') : '';
              const displayLabel =
                workLabel || `${wo.lines.length} prestation${wo.lines.length > 1 ? 's' : ''}`;
              const isLate = wo.date < todayIso;
              const isToday = wo.date === todayIso;
              return (
                <tr
                  key={wo.id}
                  onClick={() => onEdit(wo)}
                  className="cursor-pointer border-b border-(--color-border) hover:bg-[#fbfbf9]"
                >
                  <td className="py-2 pr-2 tabular-nums">
                    <span
                      className={
                        isLate
                          ? 'text-(--color-error)'
                          : isToday
                            ? 'font-semibold text-(--color-primary)'
                            : ''
                      }
                    >
                      {fmtDate(wo.date)}
                    </span>
                  </td>
                  <td className="px-2 py-2 font-mono text-xs tabular-nums text-(--color-muted)">
                    {wo.scheduledTime ?? '—'}
                  </td>
                  <td className="px-2 py-2">
                    <div className="truncate font-medium">{client?.name ?? '—'}</div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="truncate text-sm">
                      {wo.lines.length > 1 ? `${displayLabel}…` : displayLabel}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <span className="inline-flex items-center rounded-(--radius-pill) bg-[#f1f1ee] px-2 py-0.5 text-[10px] font-medium">
                      Planifié
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile : cards verticales (structure fixe) */}
      <ul className="m-0 list-none space-y-2 p-0 md:hidden">
        {orders.map((wo) => {
          const client = clients.find((c) => c.id === wo.clientId);
          const firstLine = wo.lines[0];
          const workLabel = firstLine ? (getWorkType(firstLine.workType)?.label ?? '') : '';
          const displayLabel =
            workLabel || `${wo.lines.length} prestation${wo.lines.length > 1 ? 's' : ''}`;
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
              className="cursor-pointer rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) p-3 transition-colors hover:border-(--color-primary) hover:bg-[#fbfbf9] focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)/40"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {wo.lines.length > 1 ? `${displayLabel}…` : displayLabel}
                </span>
                <span className="shrink-0 text-xs tabular-nums">{fmtDate(wo.date)}</span>
              </div>
              <div className="truncate text-[11px] text-(--color-muted)">{client?.name ?? '—'}</div>
              <div className="text-[11px] text-(--color-muted)">{wo.scheduledTime ?? ''}</div>
              <div className="mt-1">
                <span className="inline-flex items-center rounded-(--radius-pill) bg-[#f1f1ee] px-2 py-0.5 text-[10px] font-medium">
                  Planifié
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
