import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFab } from './useFab';
import { FAB_SECTORS, type FabSector } from './fab-catalog';

/**
 * FAB global — bouton rond `+` en bas à droite.
 * Drawer 2 niveaux :
 *   - Niveau 1 : actions contextuelles à la page (si présentes) + secteurs globaux
 *   - Niveau 2 : actions du secteur sélectionné, avec retour arrière
 * Esc / backdrop / X = ferme.
 */
export function Fab() {
  const { actions, hidden } = useFab();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [sectorId, setSectorId] = useState<string | null>(null);
  const sector: FabSector | null = sectorId
    ? (FAB_SECTORS.find((s) => s.id === sectorId) ?? null)
    : null;

  const close = () => {
    setOpen(false);
    setSectorId(null);
  };

  // Esc pour fermer
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (sectorId) setSectorId(null);
        else setOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, sectorId]);

  // Si la page masque le FAB, on ferme aussi le menu.
  useEffect(() => {
    if (hidden && open) close();
  }, [hidden, open]);

  // Reset navigation interne quand on (re)ferme.
  useEffect(() => {
    if (!open && sectorId) setSectorId(null);
  }, [open, sectorId]);

  if (hidden) return null;

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
            onClick={close}
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
              'flex max-h-[85vh] flex-col',
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
            <header className="flex items-center gap-2 px-4 pt-1 pb-2">
              {sector ? (
                <button
                  type="button"
                  onClick={() => setSectorId(null)}
                  className="inline-flex items-center gap-2 text-sm font-medium text-(--color-text) hover:text-(--color-primary)"
                  aria-label="Retour aux secteurs"
                >
                  <ChevronLeftIcon />
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-(--radius-pill)"
                    style={{ background: `${sector.color}1a`, color: sector.color }}
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
                      {sector.icon}
                    </svg>
                  </span>
                  <span>{sector.label}</span>
                </button>
              ) : (
                <h2 className="m-0 text-xs font-medium tracking-wider text-(--color-muted) uppercase">
                  Actions rapides
                </h2>
              )}
              <button
                type="button"
                onClick={close}
                aria-label="Fermer"
                className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-(--radius-sm) text-(--color-muted) hover:bg-[#f1f1ee] hover:text-(--color-text)"
              >
                <XIcon />
              </button>
            </header>

            {/* Body scrollable */}
            <div className="flex-1 overflow-y-auto pb-[max(env(safe-area-inset-bottom),12px)]">
              {sector ? (
                /* ───── Niveau 2 : actions d'un secteur ───── */
                <ul role="menu" aria-label={sector.label} className="m-0 list-none p-0">
                  {sector.actions.map((a) => (
                    <li key={a.id} className="border-t border-(--color-border)/60">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          a.run(navigate);
                          close();
                        }}
                        className="flex w-full items-center gap-3 px-4 py-4 text-left text-sm text-(--color-text) hover:bg-[#fbfbf9]"
                      >
                        <span
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius-pill)"
                          style={{ background: `${sector.color}1a`, color: sector.color }}
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
                            aria-hidden="true"
                          >
                            {a.icon}
                          </svg>
                        </span>
                        <span className="flex-1">{a.label}</span>
                        <span className="text-(--color-muted)">
                          <ChevronRightIcon />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                /* ───── Niveau 1 : actions page (si présentes) + secteurs ───── */
                <>
                  {actions.length > 0 && (
                    <>
                      <div className="px-4 pt-3 pb-1 text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
                        Cette page
                      </div>
                      <ul role="menu" aria-label="Actions de la page" className="m-0 list-none p-0">
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
                                  close();
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
                                  className={
                                    isPrimary ? 'text-(--color-primary)' : 'text-(--color-muted)'
                                  }
                                >
                                  <ChevronRightIcon />
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}

                  <div className="px-4 pt-3 pb-1 text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
                    Tous les secteurs
                  </div>
                  <ul role="menu" aria-label="Secteurs" className="m-0 list-none p-0">
                    {FAB_SECTORS.map((s) => (
                      <li key={s.id} className="border-t border-(--color-border)/60">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            if (s.directRun) {
                              s.directRun(navigate);
                              close();
                              return;
                            }
                            setSectorId(s.id);
                          }}
                          className="flex w-full items-center gap-3 px-4 py-4 text-left text-sm text-(--color-text) hover:bg-[#fbfbf9]"
                        >
                          <span
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius-pill)"
                            style={{ background: `${s.color}1a`, color: s.color }}
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
                              aria-hidden="true"
                            >
                              {s.icon}
                            </svg>
                          </span>
                          <span className="flex-1">{s.label}</span>
                          {!s.directRun && (
                            <span className="text-[10px] text-(--color-muted)">
                              {s.actions.length}
                            </span>
                          )}
                          <span className="text-(--color-muted)">
                            <ChevronRightIcon />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
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

function ChevronLeftIcon() {
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
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}
