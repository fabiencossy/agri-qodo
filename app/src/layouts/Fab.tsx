import { useEffect, useState } from 'react';
import { useFab } from './useFab';

/**
 * FAB global — bouton rond `+` en bas à droite.
 * Au clic : bottom sheet qui slide depuis le bas, avec la liste des actions.
 * Permet d'afficher plusieurs actions rapides confortablement.
 * Si aucune action : caché.
 */
export function Fab() {
  const { actions, hidden } = useFab();
  const [open, setOpen] = useState(false);

  // Esc pour fermer
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Si la page masque le FAB (ex. bottom sheet ouverte), on dérive `open` à false
  // sans setState dans un effet (et on reset l'intent au moment du flip).
  const [prevHidden, setPrevHidden] = useState(hidden);
  if (hidden !== prevHidden) {
    setPrevHidden(hidden);
    if (hidden && open) setOpen(false);
  }

  if (actions.length === 0 || hidden) return null;

  return (
    <>
      {/* FAB rond en bas droite */}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu des actions'}
        onClick={() => setOpen((o) => !o)}
        className={[
          'fixed right-5 bottom-5 z-[1050] inline-flex h-14 w-14 items-center justify-center',
          'rounded-(--radius-pill) border border-(--color-highlight) bg-(--color-highlight) text-white',
          'shadow-(--shadow-fab) transition-all hover:scale-105',
          open ? 'rotate-45' : '',
        ].join(' ')}
        style={{ transition: 'transform 200ms ease-out, background 150ms' }}
      >
        <PlusIcon />
      </button>

      {/* Bottom sheet drawer */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[1100] animate-[fadeIn_180ms_ease-out] bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Sheet */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Actions rapides"
            className={[
              'fixed inset-x-0 bottom-0 z-[1110]',
              'mx-auto max-w-2xl',
              'rounded-t-(--radius-lg) border-t border-(--color-border)',
              'bg-(--color-surface) shadow-(--shadow-popup)',
              'animate-[slideUp_220ms_ease-out]',
            ].join(' ')}
          >
            {/* Handle */}
            <div className="flex justify-center pt-2 pb-1">
              <span
                className="block h-1 w-10 rounded-(--radius-pill) bg-(--color-border)"
                aria-hidden="true"
              />
            </div>

            {/* Header */}
            <header className="flex items-center px-4 pt-1 pb-2">
              <h2 className="m-0 text-xs font-medium tracking-wider text-(--color-muted) uppercase">
                Actions rapides
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-(--radius-sm) text-(--color-muted) hover:bg-[#f1f1ee] hover:text-(--color-text)"
              >
                <XIcon />
              </button>
            </header>

            {/* Actions list */}
            <ul
              role="menu"
              aria-label="Actions"
              className="m-0 list-none p-0 pb-[max(env(safe-area-inset-bottom),12px)]"
            >
              {actions.map((action) => {
                const isPrimary = action.variant === 'primary';
                const isDanger = action.variant === 'danger';
                return (
                  <li key={action.id} className="border-t border-(--color-border)/60">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        action.onClick();
                        setOpen(false);
                      }}
                      className={[
                        'flex w-full items-center gap-3 px-4 py-4 text-left text-sm',
                        isDanger
                          ? 'text-(--color-error) hover:bg-[#fef2f2]'
                          : isPrimary
                            ? 'bg-(--color-primary)/6 font-semibold text-(--color-primary) hover:bg-(--color-primary)/10'
                            : 'text-(--color-text) hover:bg-[#fbfbf9]',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius-pill)',
                          isDanger
                            ? 'bg-(--color-error)/10 text-(--color-error)'
                            : isPrimary
                              ? 'bg-(--color-primary) text-white'
                              : 'bg-[#f1f1ee] text-(--color-muted)',
                        ].join(' ')}
                      >
                        {action.icon ?? <PlusIcon size={16} />}
                      </span>
                      <span className="flex-1">{action.label}</span>
                      <span
                        className={isPrimary ? 'text-(--color-primary)' : 'text-(--color-muted)'}
                      >
                        <ChevronRightIcon />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </>
  );
}

function PlusIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function XIcon() {
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

function ChevronRightIcon() {
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
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
