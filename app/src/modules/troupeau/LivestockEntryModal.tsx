import { useMemo, useState } from 'react';
import { addLivestockEntry, updateLivestockEntry } from './livestock.store';
import { LIVESTOCK_CATALOG, SPECIES_LABELS, getCategory } from './livestock.catalog';
import type { LivestockCategoryKey, LivestockEntry, LivestockSpecies } from './livestock.types';

interface LivestockEntryModalProps {
  initial?: Partial<LivestockEntry>;
  onClose: () => void;
}

export function LivestockEntryModal({ initial, onClose }: LivestockEntryModalProps) {
  const isExisting = Boolean(initial?.id);
  const [draft, setDraft] = useState<Partial<LivestockEntry>>(() => ({
    count: 1,
    ...initial,
  }));

  const setField = <K extends keyof LivestockEntry>(k: K, v: LivestockEntry[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  // Groupes par espèce pour le selector
  const groups = useMemo(() => {
    const map = new Map<LivestockSpecies, (typeof LIVESTOCK_CATALOG)[number][]>();
    for (const c of LIVESTOCK_CATALOG) {
      const arr = map.get(c.species) ?? [];
      arr.push(c);
      map.set(c.species, arr);
    }
    return [...map.entries()];
  }, []);

  const selectedCat = draft.category ? getCategory(draft.category) : undefined;

  const submit = () => {
    if (!draft.category || !draft.count || draft.count <= 0) return;
    const entry: LivestockEntry = {
      id: draft.id ?? `LE-${Date.now()}`,
      category: draft.category,
      count: draft.count,
      notes: draft.notes,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    if (isExisting && draft.id) updateLivestockEntry(draft.id, entry);
    else addLivestockEntry(entry);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center md:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isExisting ? 'Modifier effectif' : 'Nouvel effectif'}
        className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-(--radius-lg) border border-(--color-border) bg-(--color-surface) shadow-(--shadow-popup) md:max-w-lg md:rounded-(--radius-lg)"
      >
        <header className="flex items-center gap-2 border-b border-(--color-border) px-4 py-3">
          <h2 className="m-0 text-sm font-semibold">
            {isExisting ? 'Modifier l’effectif' : 'Ajouter une catégorie d’animaux'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-(--radius-sm) text-(--color-muted) hover:bg-[#f1f1ee]"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <div>
            <label className="mb-1 block text-xs font-medium">Catégorie d’animaux</label>
            <select
              value={draft.category ?? ''}
              onChange={(e) => setField('category', e.target.value as LivestockCategoryKey)}
              className="h-10 w-full rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 text-sm"
            >
              <option value="">— Sélectionner —</option>
              {groups.map(([species, cats]) => (
                <optgroup key={species} label={SPECIES_LABELS[species] ?? species}>
                  {cats.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {selectedCat && (
            <div className="rounded-(--radius-sm) border border-(--color-border) bg-[#fbfbf9] p-3 text-[11px] text-(--color-muted)">
              <div className="mb-1 font-medium text-(--color-text)">{selectedCat.label}</div>
              {selectedCat.description && <div className="mb-1">{selectedCat.description}</div>}
              <div>
                Norme : {selectedCat.ugbPerHead} UGB · {selectedCat.nKgPerHeadYear} kg N ·{' '}
                {selectedCat.pKgPerHeadYear} kg P₂O₅ · {selectedCat.kKgPerHeadYear} kg K₂O / tête /
                an
              </div>
              <div>
                Effluents : {selectedCat.manureVolumePerHeadYear}{' '}
                {selectedCat.manureVolumeUnit === 'm3' ? 'm³' : 't'} de {selectedCat.manureType} /
                tête / an
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium">Effectif annuel moyen (têtes)</label>
            <input
              type="number"
              min="1"
              step="1"
              value={draft.count ?? ''}
              onChange={(e) => setField('count', e.target.value ? Number(e.target.value) : 0)}
              className="h-10 w-full rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 text-sm"
              autoFocus
            />
            {selectedCat && draft.count && draft.count > 0 && (
              <p className="m-0 mt-1 text-[11px] text-(--color-muted)">
                ≈ {(selectedCat.ugbPerHead * draft.count).toFixed(1)} UGB ·{' '}
                {Math.round(selectedCat.nKgPerHeadYear * draft.count)} kg N/an
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">Notes (optionnel)</label>
            <textarea
              value={draft.notes ?? ''}
              onChange={(e) => setField('notes', e.target.value || undefined)}
              placeholder="Étable, lot, race, etc."
              rows={3}
              className="w-full rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm"
            />
          </div>
        </div>

        <footer className="flex items-center gap-2 border-t border-(--color-border) p-3">
          <button
            type="button"
            onClick={onClose}
            className="ml-auto inline-flex h-10 items-center rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-4 text-sm font-medium hover:bg-[#f8f8f5]"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!draft.category || !draft.count || draft.count <= 0}
            className="inline-flex h-10 items-center rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-5 text-sm font-medium text-white hover:bg-(--color-primary-hover) disabled:opacity-50"
          >
            {isExisting ? 'Enregistrer' : 'Ajouter'}
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
      width={16}
      height={16}
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
