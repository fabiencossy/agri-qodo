import { useEffect, useState } from 'react';
import { removePhoto, updatePhotoCaption, useFullPhotoUrl, formatBytes } from './photo.store';
import type { PhotoMeta } from './photo.types';

interface Props {
  photos: ReadonlyArray<PhotoMeta>;
  /** Index actif. -1 = fermé */
  index: number;
  onClose: () => void;
  onChange: (index: number) => void;
  canEdit?: boolean;
}

/**
 * Visionneuse plein écran (lightbox). Navigation flèches gauche/droite + Esc,
 * affichage métadonnées (date, taille, GPS) + édition légende + suppression.
 */
export function PhotoLightbox({ photos, index, onClose, onChange, canEdit = true }: Props) {
  const photo = index >= 0 && index < photos.length ? photos[index] : null;
  const fullUrl = useFullPhotoUrl(photo);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');

  // Reset caption editing quand on navigue
  useEffect(() => {
    setEditingCaption(false);
    setCaptionDraft(photo?.caption ?? '');
  }, [photo?.id, photo?.caption]);

  useEffect(() => {
    if (!photo) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && index > 0) onChange(index - 1);
      else if (e.key === 'ArrowRight' && index < photos.length - 1) onChange(index + 1);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [photo, index, photos.length, onClose, onChange]);

  if (!photo) return null;

  const handleDelete = async () => {
    if (!confirm('Supprimer cette photo ? Action irréversible.')) return;
    await removePhoto(photo.id);
    // Si on supprime la dernière, ferme. Sinon avance.
    if (photos.length <= 1) onClose();
    else if (index >= photos.length - 1) onChange(index - 1);
  };

  const saveCaption = async () => {
    await updatePhotoCaption(photo.id, captionDraft);
    setEditingCaption(false);
  };

  return (
    <div
      className="fixed inset-0 z-[1300] flex flex-col bg-black/90"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Visionneuse photo"
    >
      {/* Header */}
      <header
        className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-medium tabular-nums">
          {index + 1} / {photos.length}
        </span>
        <span className="flex-1 text-[11px] text-white/60">
          {new Date(photo.takenAt ?? photo.createdAt).toLocaleString('fr-CH', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
          {' · '}
          {photo.width}×{photo.height}
          {' · '}
          {formatBytes(photo.compressedBytes)}
          {photo.lat !== undefined && photo.lng !== undefined && (
            <>
              {' · '}
              <a
                href={`https://www.google.com/maps?q=${photo.lat},${photo.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white"
                onClick={(e) => e.stopPropagation()}
              >
                GPS
              </a>
            </>
          )}
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex h-9 items-center gap-1.5 rounded-(--radius) bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/20"
          >
            <svg
              viewBox="0 0 24 24"
              width={14}
              height={14}
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
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="inline-flex h-9 w-9 items-center justify-center rounded-(--radius) bg-white/10 text-white hover:bg-white/20"
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
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* Image */}
      <div
        className="flex flex-1 items-center justify-center overflow-hidden p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {fullUrl ? (
          <img
            src={fullUrl}
            alt={photo.caption ?? `Photo ${index + 1}`}
            className="max-h-full max-w-full object-contain"
            style={{ background: 'transparent' }}
          />
        ) : (
          <div className="text-sm text-white/60">Chargement…</div>
        )}
      </div>

      {/* Nav prev/next */}
      {index > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(index - 1);
          }}
          aria-label="Précédente"
          className="absolute top-1/2 left-2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <svg
            viewBox="0 0 24 24"
            width={24}
            height={24}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      )}
      {index < photos.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(index + 1);
          }}
          aria-label="Suivante"
          className="absolute top-1/2 right-2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <svg
            viewBox="0 0 24 24"
            width={24}
            height={24}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      )}

      {/* Footer caption */}
      <footer
        className="shrink-0 border-t border-white/10 px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {editingCaption && canEdit ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={captionDraft}
              onChange={(e) => setCaptionDraft(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveCaption();
                if (e.key === 'Escape') setEditingCaption(false);
              }}
              placeholder="Légende…"
              className="h-9 flex-1 rounded-(--radius) border border-white/30 bg-white/10 px-3 text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={saveCaption}
              className="rounded-(--radius) bg-white/20 px-3 py-1.5 text-sm font-medium hover:bg-white/30"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => setEditingCaption(false)}
              className="rounded-(--radius) px-3 py-1.5 text-sm text-white/60 hover:text-white"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => canEdit && setEditingCaption(true)}
            disabled={!canEdit}
            className="block w-full text-left text-sm text-white/90 disabled:cursor-default"
          >
            {photo.caption ||
              (canEdit ? <span className="text-white/40">+ Ajouter légende</span> : '—')}
          </button>
        )}
      </footer>
    </div>
  );
}
