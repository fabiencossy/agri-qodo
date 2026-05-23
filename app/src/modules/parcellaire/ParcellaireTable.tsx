import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BulkActionsBar, TableCheckbox, type BulkAction } from '../../components/BulkActionsBar';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import type { ParcelDetail } from './parcellaire.mocks';
import { updateParcel, removeParcel } from './parcellaire.store';
import { notify } from '../../layouts/notice.store';

const STATUS_LABELS: Record<NonNullable<ParcelDetail['status']>, string> = {
  active: 'Actif',
  fallow: 'Jachère',
  archived: 'Archivé',
};

const STATUS_STYLES: Record<NonNullable<ParcelDetail['status']>, string> = {
  active: 'bg-(--color-success)/12 text-[#166534]',
  fallow: 'bg-(--color-warning)/12 text-[#92400e]',
  archived: 'bg-[#e5e5e5] text-(--color-muted)',
};

interface ParcellaireTableProps {
  parcels: ReadonlyArray<ParcelDetail>;
  /** Sélection courante (depuis la map). Conservée pour highlight de ligne. */
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export function ParcellaireTable({ parcels, selectedId }: ParcellaireTableProps) {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());

  const allChecked = parcels.length > 0 && parcels.every((p) => checked.has(p.id));
  const someChecked = !allChecked && checked.size > 0;

  const toggleAll = () => {
    setChecked(allChecked ? new Set() : new Set(parcels.map((p) => p.id)));
  };
  const toggleOne = (id: string, next: boolean) => {
    setChecked((curr) => {
      const c = new Set(curr);
      if (next) c.add(id);
      else c.delete(id);
      return c;
    });
  };

  const ids = Array.from(checked);

  const doGroup = async () => {
    const raw = prompt('Nom du groupe / îlot (vide = retirer du groupe) :');
    if (raw === null) return;
    const groupId = raw.trim() || undefined;
    await Promise.all(ids.map((id) => updateParcel(id, { groupId })));
    notify(
      groupId
        ? `${ids.length} parcelle(s) regroupées dans "${groupId}".`
        : `${ids.length} parcelle(s) retirées de leur groupe.`,
      'success',
    );
    setChecked(new Set());
  };

  const doArchive = async () => {
    await Promise.all(ids.map((id) => updateParcel(id, { status: 'archived' })));
    notify(`${ids.length} parcelle(s) archivées.`, 'success');
    setChecked(new Set());
  };

  const doDelete = async () => {
    if (!confirm(`Supprimer ${ids.length} parcelle(s) ? Action irréversible.`)) return;
    await Promise.all(ids.map((id) => removeParcel(id)));
    notify(`${ids.length} parcelle(s) supprimées.`, 'success');
    setChecked(new Set());
  };

  const bulkActions: BulkAction[] = [
    {
      id: 'group',
      label: 'Grouper en îlot',
      onClick: doGroup,
    },
    {
      id: 'archive',
      label: 'Archiver',
      onClick: doArchive,
    },
    {
      id: 'delete',
      label: 'Supprimer',
      variant: 'danger',
      onClick: doDelete,
    },
  ];

  if (parcels.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-(--color-muted)">
        Aucune parcelle ne correspond aux filtres.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {!isDesktop && (
        <div className="flex items-center justify-between gap-2 px-1 pb-2">
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center gap-2 text-xs font-medium text-(--color-text)"
          >
            <TableCheckbox
              checked={allChecked}
              indeterminate={someChecked}
              onChange={toggleAll}
              ariaLabel="Tout sélectionner"
            />
            Tout sélectionner
          </button>
          <span className="text-[11px] text-(--color-muted)">
            {parcels.length} parcelle{parcels.length > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {isDesktop ? (
        <div className="overflow-x-auto rounded-(--radius) border border-(--color-border) bg-(--color-surface)">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] tracking-wider text-(--color-muted) uppercase">
                <th className="w-10 border-b border-(--color-border) px-3 py-2 text-center">
                  <TableCheckbox
                    checked={allChecked}
                    indeterminate={someChecked}
                    onChange={toggleAll}
                    ariaLabel="Tout sélectionner"
                  />
                </th>
                <Th>Code</Th>
                <Th>Nom</Th>
                <Th align="right">Surface</Th>
                <Th>Culture</Th>
                <Th>Variété</Th>
                <Th>Statut</Th>
                <Th align="right">Année</Th>
              </tr>
            </thead>
            <tbody>
              {parcels.map((p) => {
                const isChecked = checked.has(p.id);
                const isHighlighted = selectedId === p.id;
                return (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/parcellaire/${p.id}`)}
                    className={[
                      'cursor-pointer border-b border-(--color-border) last:border-b-0 hover:bg-[#fbfbf9]',
                      isChecked ? 'bg-(--color-primary)/5' : '',
                      isHighlighted ? 'ring-1 ring-(--color-primary) ring-inset' : '',
                    ].join(' ')}
                  >
                    <td className="w-10 px-3 py-2 text-center whitespace-nowrap">
                      <TableCheckbox
                        checked={isChecked}
                        onChange={(next) => toggleOne(p.id, next)}
                        ariaLabel={`Sélectionner ${p.name}`}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{p.id}</td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      {p.name}
                      {p.groupId && (
                        <span className="ml-2 inline-flex items-center rounded-(--radius-pill) bg-(--color-primary)/12 px-1.5 py-0.5 text-[10px] font-medium text-(--color-primary)">
                          {p.groupId}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                      {p.surfaceHa.toFixed(2)} ha
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.culture}</td>
                    <td className="px-3 py-2 text-(--color-muted) whitespace-nowrap">
                      {p.varietyName ?? '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {p.status && (
                        <span
                          className={[
                            'inline-flex items-center rounded-(--radius-pill) px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase',
                            STATUS_STYLES[p.status],
                          ].join(' ')}
                        >
                          {STATUS_LABELS[p.status]}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {p.year}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Mobile : cards verticales */
        <ul className="m-0 list-none space-y-2 p-0">
          {parcels.map((p) => {
            const isChecked = checked.has(p.id);
            const isHighlighted = selectedId === p.id;
            return (
              <li key={p.id}>
                <div
                  onClick={() => navigate(`/parcellaire/${p.id}`)}
                  className={[
                    'flex cursor-pointer gap-3 rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-3 active:bg-[#fbfbf9]',
                    isChecked ? 'border-(--color-primary) bg-(--color-primary)/5' : '',
                    isHighlighted ? 'ring-1 ring-(--color-primary) ring-inset' : '',
                  ].join(' ')}
                >
                  <div className="shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                    <TableCheckbox
                      checked={isChecked}
                      onChange={(next) => toggleOne(p.id, next)}
                      ariaLabel={`Sélectionner ${p.name}`}
                    />
                  </div>
                  {p.color && (
                    <div
                      aria-hidden="true"
                      className="mt-1 inline-block h-3 w-3 shrink-0 rounded-(--radius-pill)"
                      style={{ background: p.color }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-semibold">{p.name}</span>
                      <span className="ml-auto shrink-0 font-mono text-[11px] text-(--color-muted)">
                        {p.surfaceHa.toFixed(2)} ha
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs text-(--color-muted)">
                      <span className="font-mono">{p.id}</span>
                      {p.culture && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="truncate text-(--color-text)">{p.culture}</span>
                        </>
                      )}
                      {p.varietyName && (
                        <>
                          <span aria-hidden>·</span>
                          <span>{p.varietyName}</span>
                        </>
                      )}
                      {p.status && (
                        <>
                          <span aria-hidden>·</span>
                          <span
                            className={[
                              'inline-flex items-center rounded-(--radius-pill) px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase',
                              STATUS_STYLES[p.status],
                            ].join(' ')}
                          >
                            {STATUS_LABELS[p.status]}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <BulkActionsBar
        count={checked.size}
        total={parcels.length}
        onClear={() => setChecked(new Set())}
        actions={bulkActions}
        entityLabel="parcelle"
      />
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={[
        'border-b border-(--color-border) px-3 py-2 font-medium whitespace-nowrap',
        align === 'right' ? 'text-right' : 'text-left',
      ].join(' ')}
    >
      {children}
    </th>
  );
}
