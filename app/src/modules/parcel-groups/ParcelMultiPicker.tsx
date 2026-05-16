import { useMemo, useState } from 'react';
import type { ParcelDetail } from '../parcellaire/parcellaire.mocks';
import { useParcelGroups } from './parcel-groups.store';

interface ParcelMultiPickerProps {
  parcels: ReadonlyArray<ParcelDetail>;
  /** Ids initialement sélectionnés (parcelle principale + additionnelles confondues). */
  selectedIds: ReadonlyArray<string>;
  /** Au moins 1 parcelle est obligatoire (la première du tableau retourné = principale). */
  onConfirm: (ids: ReadonlyArray<string>) => void;
  onClose: () => void;
  /** Autorise une sélection vide (défaut : false, ≥1 parcelle requise). */
  allowEmpty?: boolean;
  /** Titre du picker (défaut : "Sélectionner les parcelles"). */
  title?: string;
}

const TODAY = new Date().toISOString().slice(0, 10);

/**
 * Picker multi-sélection de parcelles avec **groupes pré-définis**.
 *
 * - Section "Groupes" en tête : 1 clic = sélection de toutes les parcelles du groupe
 * - Section "Toutes les parcelles" avec recherche
 * - Affiche les ids sélectionnés en chips removables
 * - Au moins 1 parcelle requise (1ère = principale dans le formulaire)
 *
 * Remplace l'ancien `<select>` natif + bouton "+ Appliquer à d'autres parcelles".
 */
export function ParcelMultiPicker({
  parcels,
  selectedIds,
  onConfirm,
  onClose,
  allowEmpty = false,
  title = 'Sélectionner les parcelles',
}: ParcelMultiPickerProps) {
  const groups = useParcelGroups();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));

  // Groupes actifs aujourd'hui (date dans [start, end])
  const activeGroups = useMemo(
    () => groups.filter((g) => g.startDate <= TODAY && g.endDate >= TODAY),
    [groups],
  );

  const filteredParcels = useMemo(() => {
    if (!query.trim()) return parcels;
    const q = query.toLowerCase();
    return parcels.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.culture ?? '').toLowerCase().includes(q),
    );
  }, [parcels, query]);

  const toggleParcel = (id: string) => {
    setSelected((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectGroup = (groupId: string) => {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;
    setSelected((curr) => {
      const next = new Set(curr);
      for (const pid of g.parcelIds) next.add(pid);
      return next;
    });
  };

  const isGroupFullySelected = (groupId: string): boolean => {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return false;
    return g.parcelIds.every((pid) => selected.has(pid));
  };

  const selectedCount = selected.size;
  const totalSurfaceHa = useMemo(() => {
    return parcels.filter((p) => selected.has(p.id)).reduce((sum, p) => sum + p.surfaceHa, 0);
  }, [parcels, selected]);

  return (
    <div className="fixed inset-0 z-[1300] flex flex-col bg-(--color-surface) md:items-center md:justify-center md:bg-black/40 md:p-6 md:backdrop-blur-sm">
      <div className="flex h-full w-full flex-col overflow-hidden bg-(--color-surface) md:h-[88vh] md:max-w-[640px] md:rounded-(--radius-lg) md:border md:border-(--color-border) md:shadow-(--shadow-popup)">
        <header className="flex items-center gap-2 border-b border-(--color-border) px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-sm font-semibold">{title}</h2>
            <p className="m-0 mt-0.5 text-xs text-(--color-muted)">
              {selectedCount} sélectionnée{selectedCount > 1 ? 's' : ''}
              {selectedCount > 0 && ` · ${totalSurfaceHa.toFixed(2)} ha total`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-(--radius-sm) text-(--color-muted) hover:bg-[#f1f1ee] hover:text-(--color-text)"
          >
            <CloseIcon />
          </button>
        </header>

        {/* Recherche */}
        <div className="border-b border-(--color-border) p-3">
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (nom, code, culture…)"
            className="h-10 w-full rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 text-sm focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/15"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Groupes pré-définis (actifs aujourd'hui) */}
          {activeGroups.length > 0 && !query.trim() && (
            <section>
              <h3 className="sticky top-0 z-10 m-0 border-b border-(--color-border) bg-[#fbfbf9] px-4 py-2 text-[11px] font-semibold tracking-wider text-(--color-muted) uppercase">
                Groupes · {activeGroups.length}
              </h3>
              <ul className="m-0 list-none p-0">
                {activeGroups.map((g) => {
                  const fullSelected = isGroupFullySelected(g.id);
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => selectGroup(g.id)}
                        className={[
                          'flex w-full items-start gap-3 border-b border-(--color-border) px-4 py-3 text-left hover:bg-[#fbfbf9]',
                          fullSelected ? 'bg-(--color-primary)/6' : '',
                        ].join(' ')}
                      >
                        <span
                          aria-hidden
                          className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded-(--radius-pill)"
                          style={{ background: g.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="truncate text-sm font-semibold">{g.name}</span>
                            <span className="shrink-0 text-[11px] text-(--color-muted)">
                              {g.parcelIds.length} parcelle{g.parcelIds.length > 1 ? 's' : ''}
                            </span>
                          </div>
                          {g.description && (
                            <div className="mt-0.5 truncate text-[11px] text-(--color-muted)">
                              {g.description}
                            </div>
                          )}
                        </div>
                        {fullSelected && (
                          <span
                            className="shrink-0 text-(--color-primary)"
                            aria-label="Sélectionné"
                          >
                            <CheckIcon />
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Toutes les parcelles */}
          <section>
            <h3 className="sticky top-0 z-10 m-0 border-b border-(--color-border) bg-[#fbfbf9] px-4 py-2 text-[11px] font-semibold tracking-wider text-(--color-muted) uppercase">
              Parcelles · {filteredParcels.length}
            </h3>
            {filteredParcels.length === 0 ? (
              <p className="m-0 py-8 text-center text-sm text-(--color-muted)">
                Aucune parcelle ne correspond à la recherche.
              </p>
            ) : (
              <ul className="m-0 list-none p-0">
                {filteredParcels.map((p) => {
                  const isSelected = selected.has(p.id);
                  return (
                    <li key={p.id}>
                      <label
                        className={[
                          'flex cursor-pointer items-center gap-3 border-b border-(--color-border) px-4 py-3 text-sm hover:bg-[#fbfbf9]',
                          isSelected ? 'bg-(--color-primary)/5' : '',
                        ].join(' ')}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleParcel(p.id)}
                          className="h-4 w-4 accent-(--color-primary)"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{p.name}</div>
                          <div className="font-mono text-[11px] text-(--color-muted)">
                            {p.id} · {p.surfaceHa.toFixed(2)} ha
                            {p.culture ? ` · ${p.culture}` : ''}
                          </div>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
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
            onClick={() => onConfirm([...selected])}
            disabled={!allowEmpty && selectedCount === 0}
            className="ml-auto inline-flex h-10 items-center rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-5 text-sm font-medium text-white hover:bg-(--color-primary-hover) disabled:opacity-50"
          >
            Confirmer ({selectedCount})
          </button>
        </footer>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={18}
      height={18}
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
