import { dismiss, useNotices } from './notice.store';

/** Host global de toasts notifications. Monté dans AppLayout. */
export function NoticeHost() {
  const notices = useNotices();
  if (notices.length === 0) return null;
  return (
    <div className="fixed right-4 bottom-24 z-[1300] flex max-w-[calc(100vw-2rem)] flex-col gap-2">
      {notices.map((n) => (
        <div
          key={n.id}
          role={n.kind === 'error' ? 'alert' : 'status'}
          className={[
            'pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2 text-sm shadow-md',
            n.kind === 'success'
              ? 'border-(--color-success) bg-(--color-success-bg) text-(--color-success-fg)'
              : n.kind === 'error'
                ? 'border-(--color-error) bg-(--color-error-bg) text-(--color-error-fg)'
                : 'border-(--color-border) bg-(--color-surface) text-(--color-fg)',
          ].join(' ')}
        >
          <span className="grow">{n.text}</span>
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => dismiss(n.id)}
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
      ))}
    </div>
  );
}
