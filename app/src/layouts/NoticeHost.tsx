import { useState } from 'react';
import { dismiss, useNotices } from './notice.store';

/**
 * Host global de toasts notifications. Monté dans AppLayout.
 * - Position : bas-droite, fixed
 * - Largeur : max 360px (toujours rectangle compact, pas une bande qui prend la largeur)
 * - Long messages : line-clamp 3 lignes, bouton "Détails" si plus long
 */
export function NoticeHost() {
  const notices = useNotices();
  if (notices.length === 0) return null;
  return (
    <div className="pointer-events-none fixed right-4 bottom-24 z-[1300] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {notices.map((n) => (
        <NoticeCard key={n.id} id={n.id} text={n.text} kind={n.kind} />
      ))}
    </div>
  );
}

function NoticeCard({
  id,
  text,
  kind,
}: {
  id: string;
  text: string;
  kind: 'info' | 'success' | 'error';
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 180;

  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={[
        'pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2 text-sm shadow-md',
        kind === 'success'
          ? 'border-(--color-success) bg-(--color-success-bg) text-(--color-success-fg)'
          : kind === 'error'
            ? 'border-(--color-error) bg-(--color-error-bg) text-(--color-error-fg)'
            : 'border-(--color-border) bg-(--color-surface) text-(--color-fg)',
      ].join(' ')}
    >
      <div className="min-w-0 flex-1">
        <p
          className={[
            'm-0 break-words whitespace-pre-line',
            !expanded && isLong ? 'line-clamp-3' : '',
          ].join(' ')}
        >
          {text}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-[11px] font-medium underline hover:opacity-80"
          >
            {expanded ? 'Réduire' : 'Voir détails'}
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="Fermer"
        onClick={() => dismiss(id)}
        className="shrink-0 rounded p-0.5 text-(--color-fg-muted) hover:bg-(--color-surface-2) hover:text-(--color-fg)"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 6 18 18M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}
