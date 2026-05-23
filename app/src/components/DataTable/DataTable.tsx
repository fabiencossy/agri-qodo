/**
 * DataTable — composant générique reproduisant le pattern ParcellaireTable.
 *
 * Référence visuelle locked : `app/src/modules/parcellaire/ParcellaireTable.tsx`.
 * - Desktop : table tabulaire avec checkbox header + checkbox rows + colonnes
 *   header uppercase small-caps muted, row click = action principale.
 * - Mobile  : list de cards verticales avec checkbox + (color dot) + label
 *   + meta inline + status pill.
 * - BulkActionsBar pinned bottom quand `count > 0`.
 *
 * Toutes les pages liste doivent utiliser ce composant (carnet, planning,
 * travaux, troupeau, fumure...) pour garantir parité visuelle.
 */
import { useState } from 'react';
import { BulkActionsBar, TableCheckbox, type BulkAction } from '../BulkActionsBar';
import { useIsDesktop } from '../../hooks/useMediaQuery';

export type Column<T> = {
  /** Identifiant unique de la colonne. */
  key: string;
  /** Libellé affiché dans le header desktop (uppercase small-caps). */
  label: string;
  /** Alignement de la cellule (default left). */
  align?: 'left' | 'right' | 'center';
  /** Render personnalisé d'une cellule. */
  render: (row: T) => React.ReactNode;
  /** Largeur fixe optionnelle (ex. 'w-32', 'w-10'). */
  width?: string;
};

export type DataTableProps<T> = {
  rows: ReadonlyArray<T>;
  columns: ReadonlyArray<Column<T>>;
  getId: (row: T) => string;
  /** Clic sur une ligne (desktop) ou une card (mobile). */
  onRowClick?: (row: T) => void;
  /** ID surligné (sélection externe — ex. depuis Map). */
  highlightedId?: string;
  /** Actions de masse appliquées à la sélection. */
  bulkActions?: BulkAction[];
  /** Libellé entité singulier (pour la BulkActionsBar). */
  entityLabel: string;
  /** Message si aucune ligne. */
  emptyMessage?: string;
  /** Render mobile d'une card. Si absent : fallback minimal. */
  renderMobileCard?: (
    row: T,
    helpers: { checkbox: React.ReactNode; checked: boolean; highlighted: boolean },
  ) => React.ReactNode;
  /**
   * Regroupement optionnel par champ. Si fourni, les rows sont regroupées en
   * sections avec un header par groupe. Trié alphabétiquement par label.
   */
  groupBy?: {
    getKey: (row: T) => string;
    getLabel?: (key: string) => string;
  };
};

export function DataTable<T>({
  rows,
  columns,
  getId,
  onRowClick,
  highlightedId,
  bulkActions,
  entityLabel,
  emptyMessage,
  renderMobileCard,
  groupBy,
}: DataTableProps<T>) {
  const isDesktop = useIsDesktop();
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());

  const allChecked = rows.length > 0 && rows.every((r) => checked.has(getId(r)));
  const someChecked = !allChecked && checked.size > 0;

  // Groupement : si groupBy fourni, on partitionne rows en sections.
  const groups: ReadonlyArray<{ key: string; label: string; rows: ReadonlyArray<T> }> = groupBy
    ? (() => {
        const map = new Map<string, T[]>();
        for (const row of rows) {
          const k = groupBy.getKey(row);
          const arr = map.get(k) ?? [];
          arr.push(row);
          map.set(k, arr);
        }
        return [...map.entries()]
          .map(([key, rs]) => ({
            key,
            label: groupBy.getLabel?.(key) ?? key,
            rows: rs as ReadonlyArray<T>,
          }))
          .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
      })()
    : [{ key: '__all', label: '', rows }];

  const toggleAll = () => {
    setChecked(allChecked ? new Set() : new Set(rows.map(getId)));
  };
  const toggleOne = (id: string, next: boolean) => {
    setChecked((curr) => {
      const c = new Set(curr);
      if (next) c.add(id);
      else c.delete(id);
      return c;
    });
  };

  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-(--color-muted)">
        {emptyMessage ?? `Aucun élément ne correspond aux filtres.`}
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
            {rows.length} {entityLabel}
            {rows.length > 1 ? 's' : ''}
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
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={[
                      'border-b border-(--color-border) px-3 py-2 font-medium whitespace-nowrap',
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                          ? 'text-center'
                          : 'text-left',
                      col.width ?? '',
                    ].join(' ')}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <>
                  {groupBy && (
                    <tr key={`hdr-${group.key}`} className="bg-[#fbfbf9]">
                      <td
                        colSpan={columns.length + 1}
                        className="border-b border-(--color-border) px-3 py-1.5 text-[11px] font-semibold tracking-wider text-(--color-muted) uppercase"
                      >
                        {group.label} ({group.rows.length})
                      </td>
                    </tr>
                  )}
                  {group.rows.map((row) => {
                    const id = getId(row);
                    const isChecked = checked.has(id);
                    const isHighlighted = highlightedId === id;
                    return (
                      <tr
                        key={id}
                        onClick={() => onRowClick?.(row)}
                        className={[
                          'border-b border-(--color-border) last:border-b-0',
                          onRowClick ? 'cursor-pointer hover:bg-[#fbfbf9]' : '',
                          isChecked ? 'bg-(--color-primary)/5' : '',
                          isHighlighted ? 'ring-1 ring-(--color-primary) ring-inset' : '',
                        ].join(' ')}
                      >
                        <td
                          className="w-10 px-3 py-2 text-center whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <TableCheckbox
                            checked={isChecked}
                            onChange={(next) => toggleOne(id, next)}
                            ariaLabel={`Sélectionner ligne`}
                          />
                        </td>
                        {columns.map((col) => (
                          <td
                            key={col.key}
                            className={[
                              'px-3 py-2 whitespace-nowrap',
                              col.align === 'right'
                                ? 'text-right'
                                : col.align === 'center'
                                  ? 'text-center'
                                  : '',
                            ].join(' ')}
                          >
                            {col.render(row)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Mobile : cards verticales (groupées si groupBy) */
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.key}>
              {groupBy && (
                <h3 className="m-0 mb-2 px-1 text-[11px] font-semibold tracking-wider text-(--color-muted) uppercase">
                  {group.label} ({group.rows.length})
                </h3>
              )}
              <ul className="m-0 list-none space-y-2 p-0">
                {group.rows.map((row) => {
                  const id = getId(row);
                  const isChecked = checked.has(id);
                  const isHighlighted = highlightedId === id;
                  const checkboxNode = (
                    <div onClick={(e) => e.stopPropagation()}>
                      <TableCheckbox
                        checked={isChecked}
                        onChange={(next) => toggleOne(id, next)}
                        ariaLabel={`Sélectionner ligne`}
                      />
                    </div>
                  );
                  return (
                    <li key={id}>
                      <div
                        onClick={() => onRowClick?.(row)}
                        className={[
                          'flex gap-3 rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-3 active:bg-[#fbfbf9]',
                          onRowClick ? 'cursor-pointer' : '',
                          isChecked ? 'border-(--color-primary) bg-(--color-primary)/5' : '',
                          isHighlighted ? 'ring-1 ring-(--color-primary) ring-inset' : '',
                        ].join(' ')}
                      >
                        {renderMobileCard ? (
                          renderMobileCard(row, {
                            checkbox: checkboxNode,
                            checked: isChecked,
                            highlighted: isHighlighted,
                          })
                        ) : (
                          <>
                            <div className="shrink-0 pt-0.5">{checkboxNode}</div>
                            <div className="min-w-0 flex-1 space-y-1">
                              {columns.map((col) => (
                                <div key={col.key} className="text-sm">
                                  <span className="text-[11px] uppercase tracking-wider text-(--color-muted)">
                                    {col.label}{' '}
                                  </span>
                                  {col.render(row)}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {bulkActions && bulkActions.length > 0 && (
        <BulkActionsBar
          count={checked.size}
          total={rows.length}
          onClear={() => setChecked(new Set())}
          actions={bulkActions}
          entityLabel={entityLabel}
        />
      )}
    </div>
  );
}

/* ─── Helper : pill statut (réutilisable) ─────────────────────────── */
export function StatusPill({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-(--radius-pill) px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase',
        className,
      ].join(' ')}
    >
      {label}
    </span>
  );
}
