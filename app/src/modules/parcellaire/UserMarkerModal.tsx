import { useEffect, useState } from 'react';
import {
  USER_MARKER_KIND_COLORS,
  USER_MARKER_KIND_LABELS,
  removeUserMarker,
  updateUserMarker,
  type UserMarker,
  type UserMarkerKind,
} from './userMarkers.store';
import { useParcels } from './parcellaire.store';
import { PhotoGallery } from '../photos/PhotoGallery';

const KIND_ORDER: UserMarkerKind[] = ['observation', 'danger', 'note'];

interface Props {
  marker: UserMarker;
  onClose: () => void;
}

/**
 * Modal d'édition d'une balise GPS posée sur la carte. Type, label, notes,
 * suppression. Persistance immédiate via le store useSyncExternalStore.
 */
export function UserMarkerModal({ marker, onClose }: Props) {
  const [kind, setKind] = useState<UserMarkerKind>(marker.kind);
  const [label, setLabel] = useState(marker.label ?? '');
  const [notes, setNotes] = useState(marker.notes ?? '');
  const parcels = useParcels();
  const linkedParcel = marker.parcelId ? parcels.find((p) => p.id === marker.parcelId) : undefined;

  // Note : le composant est monté avec key={marker.id} côté parent, donc un switch
  // de marqueur démonte/remonte et initialise correctement les états depuis les props.

  // Esc pour fermer
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = () => {
    updateUserMarker(marker.id, {
      kind,
      label: label.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  const del = () => {
    if (!confirm('Supprimer cette balise ?')) return;
    removeUserMarker(marker.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Modifier la balise"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-(--radius-lg) bg-(--color-surface) shadow-(--shadow-popup) sm:rounded-(--radius-lg)"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-(--color-border) px-4 py-3">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-(--radius-pill)"
            style={{
              background: `${USER_MARKER_KIND_COLORS[kind]}1a`,
              color: USER_MARKER_KIND_COLORS[kind],
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={18}
              height={18}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          </span>
          <h2 className="m-0 flex-1 text-base font-semibold text-(--color-text)">Balise GPS</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-(--radius-sm) text-(--color-muted) hover:bg-[#f1f1ee] hover:text-(--color-text)"
          >
            <svg
              viewBox="0 0 24 24"
              width={18}
              height={18}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold tracking-wider text-(--color-muted) uppercase">
              Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {KIND_ORDER.map((k) => {
                const active = k === kind;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={[
                      'flex flex-col items-center gap-1 rounded-(--radius) border px-2 py-2 text-xs font-medium transition-colors',
                      active
                        ? 'border-(--color-text) text-(--color-text)'
                        : 'border-(--color-border) text-(--color-muted) hover:border-(--color-text)/40',
                    ].join(' ')}
                    style={{
                      background: active ? `${USER_MARKER_KIND_COLORS[k]}1a` : 'transparent',
                    }}
                  >
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full"
                      style={{ background: USER_MARKER_KIND_COLORS[k] }}
                    />
                    {USER_MARKER_KIND_LABELS[k]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="marker-label"
              className="mb-1.5 block text-[11px] font-semibold tracking-wider text-(--color-muted) uppercase"
            >
              Libellé
            </label>
            <input
              id="marker-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ex. Captage, Borne 4, Pente raide…"
              className="w-full rounded-(--radius) border border-(--color-border) bg-white px-3 py-2 text-sm focus:border-(--color-primary) focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="marker-notes"
              className="mb-1.5 block text-[11px] font-semibold tracking-wider text-(--color-muted) uppercase"
            >
              Notes
            </label>
            <textarea
              id="marker-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Détails additionnels (optionnel)…"
              className="w-full rounded-(--radius) border border-(--color-border) bg-white px-3 py-2 text-sm focus:border-(--color-primary) focus:outline-none"
            />
          </div>

          <PhotoGallery entityType="marker" entityId={marker.id} title="Photos" />

          <div className="space-y-1 text-[11px] text-(--color-muted)">
            {linkedParcel && (
              <div className="text-(--color-text)">
                <span className="text-(--color-muted)">Rattaché à </span>
                <span className="font-semibold">{linkedParcel.name}</span>
                {linkedParcel.culture && (
                  <span className="text-(--color-muted)"> · {linkedParcel.culture}</span>
                )}
              </div>
            )}
            {!linkedParcel && marker.parcelId && (
              <div>Parcelle introuvable : {marker.parcelId}</div>
            )}
            {!marker.parcelId && <div>Hors parcelle (zone libre)</div>}
            <div className="font-mono">
              {marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 items-center gap-2 border-t border-(--color-border) px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)]">
          <button
            type="button"
            onClick={del}
            className="inline-flex items-center gap-1.5 rounded-(--radius) px-3 py-2 text-sm font-medium text-(--color-error) hover:bg-[#fef2f2]"
          >
            <svg
              viewBox="0 0 24 24"
              width={16}
              height={16}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
            </svg>
            Supprimer
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-(--radius) px-3 py-2 text-sm font-medium text-(--color-muted) hover:text-(--color-text)"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-(--radius) bg-(--color-primary) px-3 py-2 text-sm font-semibold text-white hover:bg-(--color-primary)/90"
          >
            Enregistrer
          </button>
        </footer>
      </div>
    </div>
  );
}
