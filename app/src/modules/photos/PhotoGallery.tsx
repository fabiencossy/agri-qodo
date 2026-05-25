import { useState } from 'react';
import { usePhotosFor } from './photo.store';
import { PhotoUploader } from './PhotoUploader';
import { PhotoLightbox } from './PhotoLightbox';
import type { PhotoEntityType } from './photo.types';

interface Props {
  entityType: PhotoEntityType;
  entityId: string | undefined;
  /** Titre de la section. Défaut "Photos". */
  title?: string;
  /** Affiche bouton upload (false = lecture seule, ex. mode invité). */
  canEdit?: boolean;
  /** Compact = thumbs plus petits, sans titre. */
  compact?: boolean;
}

/**
 * Galerie photos pour une entité. Thumbs cliquables → Lightbox plein écran.
 * Si pas de photos et canEdit=false : ne rend rien.
 * Si pas de photos et canEdit=true : affiche juste le bouton upload.
 */
export function PhotoGallery({
  entityType,
  entityId,
  title = 'Photos',
  canEdit = true,
  compact = false,
}: Props) {
  const photos = usePhotosFor(entityType, entityId);
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  if (!entityId) return null;
  if (photos.length === 0 && !canEdit) return null;

  const thumbSize = compact ? 56 : 80;

  return (
    <div className="flex flex-col gap-2">
      {!compact && (
        <div className="flex items-center justify-between gap-2">
          <h3 className="m-0 text-xs font-semibold tracking-wider text-(--color-muted) uppercase">
            {title}
            {photos.length > 0 && (
              <span className="ml-1.5 normal-case text-(--color-muted)">— {photos.length}</span>
            )}
          </h3>
          {canEdit && <PhotoUploader entityType={entityType} entityId={entityId} />}
        </div>
      )}

      {photos.length > 0 && (
        <ul className="m-0 flex flex-wrap gap-2 p-0">
          {photos.map((p, i) => (
            <li key={p.id} className="list-none">
              <button
                type="button"
                onClick={() => setLightboxIndex(i)}
                aria-label={p.caption ?? `Photo ${i + 1}`}
                className="relative block overflow-hidden rounded-(--radius) border border-(--color-border) bg-(--color-surface) transition-transform hover:scale-105"
                style={{ width: thumbSize, height: thumbSize }}
              >
                <img
                  src={p.thumbDataUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {p.caption && (
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[9px] text-white">
                    {p.caption}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {compact && canEdit && <PhotoUploader entityType={entityType} entityId={entityId} />}

      {lightboxIndex >= 0 && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(-1)}
          onChange={setLightboxIndex}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
