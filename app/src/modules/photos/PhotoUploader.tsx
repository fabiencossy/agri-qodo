import { useRef, useState } from 'react';
import { addPhoto } from './photo.store';
import type { PhotoEntityType } from './photo.types';

interface Props {
  entityType: PhotoEntityType;
  entityId: string;
  /** Désactivé tant que l'entité n'a pas d'id (ex. création) */
  disabled?: boolean;
}

/**
 * Bouton "+ Ajouter photo". Input file caché avec capture=environment (mobile
 * = caméra arrière directe). Multi-fichiers supportés. Upload séquentiel,
 * progress feedback simple.
 */
export function PhotoUploader({ entityType, entityId, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(files.length);
    let processed = 0;
    for (const file of Array.from(files)) {
      try {
        await addPhoto(file, entityType, entityId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Échec sur ${file.name} : ${msg}`);
      }
      processed += 1;
      setBusy(files.length - processed);
    }
    setBusy(0);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled || busy > 0}
          onClick={() => inputRef.current?.click()}
          className="inline-flex h-9 items-center gap-1.5 rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 text-sm font-medium hover:bg-[#fbfbf9] disabled:cursor-not-allowed disabled:opacity-50"
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
            aria-hidden="true"
          >
            <path d="M3 8h4l2-3h6l2 3h4v12H3z" />
            <circle cx="12" cy="14" r="4" />
          </svg>
          {busy > 0 ? `Compression... (${busy} restant${busy > 1 ? 's' : ''})` : 'Ajouter photo'}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && <p className="m-0 text-[11px] text-(--color-error)">{error}</p>}
    </div>
  );
}
