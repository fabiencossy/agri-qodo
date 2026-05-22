import { DataTable, type Column } from '../../components/DataTable';
import type { BulkAction } from '../../components/BulkActionsBar';
import type { Intervention } from './carnet.types';
import { CATEGORY_LABELS, subTypeLabel as labelizeSubType } from './carnet.helpers';
import { InterventionTypeIcon } from './InterventionTypeIcon';
import { removeInterventions } from './carnet.store';
import { ParcelLink } from '../../components/EntityLink/ParcelLink';

interface InterventionListProps {
  interventions: ReadonlyArray<Intervention>;
  onEdit?: (intervention: Intervention) => void;
  hideParcelColumn?: boolean;
}

export function InterventionList({
  interventions,
  onEdit,
  hideParcelColumn = false,
}: InterventionListProps) {
  const columns: Column<Intervention>[] = [
    {
      key: 'date',
      label: 'Date',
      render: (i) => (
        <span className="font-mono text-xs whitespace-nowrap tabular-nums">{fmtDate(i.date)}</span>
      ),
    },
    {
      key: 'category',
      label: 'Catégorie',
      render: (i) => (
        <span className="inline-flex items-center gap-2">
          <InterventionTypeIcon category={i.category} size={14} />
          <span className="font-medium">{CATEGORY_LABELS[i.category]}</span>
        </span>
      ),
    },
    ...(!hideParcelColumn
      ? [
          {
            key: 'parcel',
            label: 'Parcelle',
            render: (i: Intervention) => (
              <span onClick={(e) => e.stopPropagation()}>
                <ParcelLink parcelId={i.parcelId} variant="chip" />
              </span>
            ),
          } as Column<Intervention>,
        ]
      : []),
    {
      key: 'product',
      label: 'Produit / opération',
      render: (i) => (
        <span className="truncate font-medium">{i.productName ?? subTypeLabel(i)}</span>
      ),
    },
    {
      key: 'dose',
      label: 'Dose',
      align: 'right',
      render: (i) => (
        <span className="font-mono whitespace-nowrap tabular-nums">
          {i.doseValue !== undefined && i.doseUnit
            ? `${formatDose(i.doseValue)} ${i.doseUnit}`
            : i.yieldValue !== undefined && i.yieldUnit
              ? `${i.yieldValue} ${i.yieldUnit}`
              : '—'}
        </span>
      ),
    },
    {
      key: 'operator',
      label: 'Opérateur',
      render: (i) => (
        <span className="whitespace-nowrap text-(--color-muted)">{i.operator ?? '—'}</span>
      ),
    },
  ];

  const bulkActions: BulkAction[] = [
    {
      id: 'duplicate',
      label: 'Dupliquer',
      onClick: () => alert(`Dupliquer (Phase 3).`),
    },
    {
      id: 'export',
      label: 'Exporter la sélection',
      onClick: () => alert(`Exporter (Phase 3).`),
    },
    {
      id: 'delete',
      label: 'Supprimer',
      variant: 'danger',
      onClick: () => {
        if (confirm(`Supprimer les interventions sélectionnées ?`)) {
          // BulkActionsBar n'expose pas la sélection ici → géré par DataTable interne.
          // Pour suppression réelle : à brancher via callback ultérieurement.
          removeInterventions([]);
        }
      },
    },
  ];

  return (
    <DataTable<Intervention>
      rows={interventions}
      columns={columns}
      getId={(i) => i.id}
      onRowClick={onEdit}
      bulkActions={bulkActions}
      entityLabel="intervention"
      emptyMessage="Aucune intervention enregistrée."
      renderMobileCard={(i, { checkbox }) => {
        const measure =
          i.doseValue !== undefined && i.doseUnit
            ? `${formatDose(i.doseValue)} ${i.doseUnit}`
            : i.yieldValue !== undefined && i.yieldUnit
              ? `${i.yieldValue} ${i.yieldUnit}`
              : null;
        const title = i.productName ?? subTypeLabel(i);
        return (
          <>
            <div className="shrink-0 pt-0.5">{checkbox}</div>
            <div className="shrink-0 pt-0.5">
              <InterventionTypeIcon category={i.category} size={16} withBackground />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</span>
                <span className="shrink-0 font-mono text-[11px] text-(--color-muted)">
                  {fmtDate(i.date)}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 text-xs text-(--color-muted)">
                <span>{CATEGORY_LABELS[i.category]}</span>
                {!hideParcelColumn && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="min-w-0 flex-1 truncate" onClick={(e) => e.stopPropagation()}>
                      <ParcelLink parcelId={i.parcelId} variant="chip" />
                    </span>
                  </>
                )}
              </div>
              {(measure || i.operator) && (
                <div className="flex items-baseline gap-1.5 text-xs">
                  {measure ? (
                    <span className="font-mono tabular-nums text-(--color-text)">{measure}</span>
                  ) : (
                    <span className="text-(--color-muted)">—</span>
                  )}
                  <span aria-hidden className="text-(--color-muted)">
                    ·
                  </span>
                  <span className="min-w-0 flex-1 truncate text-(--color-muted)">
                    {i.operator ?? '—'}
                  </span>
                </div>
              )}
              {i.notes && (
                <div className="line-clamp-2 pt-0.5 text-[12px] italic text-(--color-muted)">
                  {i.notes}
                </div>
              )}
            </div>
          </>
        );
      }}
    />
  );
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y!.slice(2)}`;
}

function formatDose(v: number): string {
  if (v >= 1000) return v.toLocaleString('fr-CH');
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

function subTypeLabel(i: Intervention): string {
  return labelizeSubType(i.subType) ?? CATEGORY_LABELS[i.category];
}
