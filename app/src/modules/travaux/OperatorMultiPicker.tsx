import { useMemo, useState } from 'react';
import type { AppUser } from '../users/users.types';

interface OperatorMultiPickerProps {
  users: ReadonlyArray<AppUser>;
  selectedIds: ReadonlyArray<string>;
  onConfirm: (ids: ReadonlyArray<string>) => void;
  onClose: () => void;
  title?: string;
}

/**
 * Picker multi-sélection d'opérateurs — mêmes ergonomie que ParcelMultiPicker.
 *
 * Bottom-sheet plein écran sur mobile, modal centré sur desktop. Recherche
 * libre par nom/email. Au moins 0 opérateur acceptés (un bon peut n'avoir
 * personne d'assigné côté planification, l'opérateur effectif sera saisi via
 * les saisies de temps).
 */
export function OperatorMultiPicker({
  users,
  selectedIds,
  onConfirm,
  onClose,
  title = 'Sélectionner les opérateurs assignés',
}: OperatorMultiPickerProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));

  const active = useMemo(() => users.filter((u) => u.active), [users]);
  const filtered = useMemo(() => {
    if (!query.trim()) return active;
    const q = query.toLowerCase();
    return active.filter((u) => {
      const hay =
        `${u.displayName} ${u.fullName} ${u.email ?? ''} ${u.jobTitle ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [active, query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirm = () => {
    // Préserve l'ordre original users pour stabilité
    const ordered = active.filter((u) => selected.has(u.id)).map((u) => u.id);
    onConfirm(ordered);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center md:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-(--radius-lg) border border-(--color-border) bg-(--color-surface) shadow-(--shadow-popup) md:max-w-md md:rounded-(--radius-lg)"
      >
        <header className="flex items-center gap-2 border-b border-(--color-border) px-4 py-3">
          <h2 className="m-0 text-sm font-semibold">{title}</h2>
          <span className="text-[11px] text-(--color-muted)">
            {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
          </span>
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

        <div className="border-b border-(--color-border) bg-[#fbfbf9] px-4 py-2.5">
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (nom, email, fonction)…"
            className="h-10 w-full rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 text-sm focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/15"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="m-0 py-10 text-center text-sm text-(--color-muted)">
              Aucun opérateur ne correspond à « {query} ».
            </p>
          ) : (
            <ul className="m-0 list-none space-y-1 p-0">
              {filtered.map((u) => {
                const isSelected = selected.has(u.id);
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => toggle(u.id)}
                      aria-pressed={isSelected}
                      className={[
                        'flex w-full items-center gap-2.5 rounded-(--radius-sm) border px-3 py-2 text-left transition-colors',
                        isSelected
                          ? 'border-(--color-primary) bg-(--color-primary)/8'
                          : 'border-(--color-border) bg-(--color-surface) hover:bg-[#fbfbf9]',
                      ].join(' ')}
                    >
                      <span
                        aria-hidden
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius-pill) text-xs font-semibold text-white"
                        style={{ background: u.color }}
                      >
                        {u.initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{u.displayName}</div>
                        <div className="truncate text-[11px] text-(--color-muted)">
                          {u.jobTitle ?? u.email ?? '—'}
                        </div>
                      </div>
                      <span
                        aria-hidden
                        className={[
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-(--radius-sm) border',
                          isSelected
                            ? 'border-(--color-primary) bg-(--color-primary) text-white'
                            : 'border-(--color-border) bg-(--color-surface)',
                        ].join(' ')}
                      >
                        {isSelected && (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            width={12}
                            height={12}
                          >
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex items-center gap-2 border-t border-(--color-border) p-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-4 text-sm font-medium hover:bg-[#f8f8f5]"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={confirm}
            className="ml-auto inline-flex h-10 items-center rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-5 text-sm font-medium text-white hover:bg-(--color-primary-hover)"
          >
            Confirmer
          </button>
        </footer>
      </div>
    </div>
  );
}
