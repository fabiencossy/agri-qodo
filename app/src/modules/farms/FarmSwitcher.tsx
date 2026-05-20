import { useEffect, useMemo, useRef, useState } from 'react';
import { setCurrentFarmId, useCurrentFarmId, useFarms } from './farms.store';
import { NewFarmModal } from './NewFarmModal';
import { filterInvitedFarms, filterOwnedFarms, getFarmRole } from './farms.helpers';
import { useCurrentUser } from '../users/permissions';
import type { Farm } from './farms.types';

const INVITED_SEARCH_THRESHOLD = 5;

/**
 * Dropdown de sélection d'exploitation. Placé dans le footer de la sidebar
 * (ou le header mobile). Le clic ouvre une liste des exploitations
 * disponibles avec sélection en surbrillance.
 *
 * 2 sections distinctes :
 *  - "Mes exploitations" (propriétaire, payantes selon plan Solo/Multi)
 *  - "Invité dans" (lecture seule + droit cross-farm Travaux, gratuit)
 *
 * Bouton "+ Nouvelle exploitation" en bas — affiche un modal qui gère le
 * gating de facturation (cf. NewFarmModal + farms.helpers#canCreateNewFarm).
 *
 * En Phase 3, le switch déclenche un refetch des données filtrées par
 * `currentFarmId` côté Odoo. Pour l'instant, multi-tenancy visuelle seule.
 */
export function FarmSwitcher({ compact = false }: { compact?: boolean }) {
  const farms = useFarms();
  const currentId = useCurrentFarmId();
  const current = farms.find((f) => f.id === currentId);
  const currentUser = useCurrentUser();
  const ownedFarms = filterOwnedFarms(farms, currentUser?.id);
  const invitedFarms = filterInvitedFarms(farms, currentUser?.id);
  const currentRole = current ? getFarmRole(current, currentUser?.id) : 'owner';

  const [open, setOpen] = useState(false);
  const [newFarmOpen, setNewFarmOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Ferme le popover ET reset la recherche. Préféré à setOpen(false) seul.
  const closeMenu = () => {
    setOpen(false);
    setQuery('');
  };

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current?.contains(e.target as Node)) return;
      closeMenu();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMenu();
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const showInvitedSearch = invitedFarms.length >= INVITED_SEARCH_THRESHOLD;
  const filteredInvited = useMemo(() => {
    if (!query.trim()) return invitedFarms;
    const q = query.toLowerCase();
    return invitedFarms.filter((f) => {
      const hay = `${f.name} ${f.location ?? ''} ${f.cantonalNumber ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, invitedFarms]);

  if (!current) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          'flex w-full items-center gap-2 rounded-(--radius-sm) px-2 py-1.5 text-left transition-colors hover:bg-[#f1f1ee]',
          open ? 'bg-[#f1f1ee]' : '',
        ].join(' ')}
      >
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius-pill) text-sm font-semibold text-white"
          style={{ background: current.color }}
        >
          {current.initials}
        </span>
        {!compact && (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium">{current.name}</span>
              {currentRole === 'invitee' && <InviteeBadge />}
            </div>
            <div className="truncate text-xs text-(--color-muted)">{current.location ?? '—'}</div>
          </div>
        )}
        <span aria-hidden className="shrink-0 text-(--color-muted)">
          <ChevronDownIcon />
        </span>
      </button>

      {open && (
        <>
          {/* Backdrop mobile uniquement — clic ferme le menu. Sur desktop, on
              s'appuie sur le mousedown listener du useEffect. */}
          <button
            type="button"
            aria-label="Fermer le sélecteur"
            onClick={closeMenu}
            className="fixed inset-0 z-[1199] bg-black/40 md:hidden"
          />
          <div
            role="listbox"
            aria-label="Sélectionner une exploitation"
            className={[
              // Mobile : bottom-sheet plein écran avec marges, scroll interne
              'fixed inset-x-2 top-4 bottom-4 z-[1200] flex flex-col overflow-hidden rounded-(--radius) border border-(--color-border) bg-(--color-surface) shadow-(--shadow-popup)',
              // Desktop : popover ancré au bouton (comportement précédent)
              'md:absolute md:inset-x-0 md:top-auto md:bottom-full md:mb-2 md:max-h-[70vh]',
            ].join(' ')}
          >
            {/* Header mobile uniquement — fermeture explicite */}
            <div className="flex items-center justify-between border-b border-(--color-border) px-4 py-3 md:hidden">
              <h2 className="m-0 text-sm font-semibold">Mes exploitations</h2>
              <button
                type="button"
                onClick={closeMenu}
                aria-label="Fermer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-(--radius-sm) text-(--color-muted) hover:bg-[#f1f1ee]"
              >
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
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {ownedFarms.length > 0 && (
                <FarmSection
                  label="Mes exploitations"
                  farms={ownedFarms}
                  currentId={currentId}
                  onPick={(id) => {
                    setCurrentFarmId(id);
                    closeMenu();
                  }}
                />
              )}

              {invitedFarms.length > 0 && (
                <div className="border-b border-(--color-border) last:border-b-0">
                  <div className="flex items-baseline justify-between gap-2 px-3 pt-2 pb-1">
                    <span className="text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
                      Invité dans
                    </span>
                    <span className="text-[10px] text-(--color-muted)">
                      {invitedFarms.length} exploitation{invitedFarms.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="px-3 pb-1.5 text-[10px] text-(--color-muted)">
                    Lecture seule · sélection cross-farm possible dans Travaux pour tiers
                  </div>
                  {showInvitedSearch && (
                    <div className="px-3 pb-2">
                      <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Rechercher (nom, commune)…"
                        aria-label="Rechercher dans mes invitations"
                        className="h-8 w-full rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) px-2 text-[12px] focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/15"
                      />
                    </div>
                  )}
                  <div className="max-h-[40vh] overflow-y-auto">
                    {filteredInvited.length === 0 ? (
                      <p className="m-0 px-3 py-4 text-center text-[11px] text-(--color-muted)">
                        Aucun résultat pour « {query} ».
                      </p>
                    ) : (
                      <ul role="group" aria-label="Invité dans" className="m-0 list-none p-0">
                        {filteredInvited.map((f) => {
                          const isSelected = f.id === currentId;
                          return (
                            <li key={f.id} role="option" aria-selected={isSelected}>
                              <button
                                type="button"
                                onClick={() => {
                                  setCurrentFarmId(f.id);
                                  closeMenu();
                                }}
                                className={[
                                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-[#fbfbf9]',
                                  isSelected ? 'bg-(--color-primary)/6' : '',
                                ].join(' ')}
                              >
                                <span
                                  aria-hidden
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-(--radius-pill) text-xs font-semibold text-white"
                                  style={{ background: f.color }}
                                >
                                  {f.initials}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="truncate font-medium">{f.name}</span>
                                    <InviteeBadge compact />
                                  </div>
                                  <div className="truncate text-[11px] text-(--color-muted)">
                                    {f.location ?? '—'}
                                    {f.surfaceTotalHa ? ` · ${f.surfaceTotalHa} ha` : ''}
                                  </div>
                                </div>
                                {isSelected && (
                                  <span
                                    className="shrink-0 text-(--color-primary)"
                                    aria-label="Sélectionnée"
                                  >
                                    <CheckIcon />
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-(--color-border) p-2">
              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  setNewFarmOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-(--radius-sm) border border-(--color-primary) bg-(--color-primary)/10 px-3 py-2 text-left text-sm font-medium text-(--color-primary) hover:bg-(--color-primary)/20"
              >
                <PlusIcon />
                Nouvelle exploitation
              </button>
            </div>
          </div>
        </>
      )}

      {newFarmOpen && <NewFarmModal onClose={() => setNewFarmOpen(false)} />}
    </div>
  );
}

/* ─── Sous-composants ──────────────────────────────────────────────────── */

function FarmSection({
  label,
  hint,
  farms,
  currentId,
  variant = 'owner',
  onPick,
}: {
  label: string;
  hint?: string;
  farms: ReadonlyArray<Farm>;
  currentId: string;
  variant?: 'owner' | 'invitee';
  onPick: (id: string) => void;
}) {
  return (
    <div className="border-b border-(--color-border) last:border-b-0">
      <div className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
        {label}
      </div>
      {hint && <div className="px-3 pb-1.5 text-[10px] text-(--color-muted)">{hint}</div>}
      <ul role="group" aria-label={label} className="m-0 list-none p-0">
        {farms.map((f) => {
          const isSelected = f.id === currentId;
          return (
            <li key={f.id} role="option" aria-selected={isSelected}>
              <button
                type="button"
                onClick={() => onPick(f.id)}
                className={[
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-[#fbfbf9]',
                  isSelected ? 'bg-(--color-primary)/6' : '',
                ].join(' ')}
              >
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-(--radius-pill) text-xs font-semibold text-white"
                  style={{ background: f.color }}
                >
                  {f.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{f.name}</span>
                    {variant === 'invitee' && <InviteeBadge compact />}
                  </div>
                  <div className="truncate text-[11px] text-(--color-muted)">
                    {f.location ?? '—'}
                    {f.surfaceTotalHa ? ` · ${f.surfaceTotalHa} ha` : ''}
                  </div>
                </div>
                {isSelected && (
                  <span className="shrink-0 text-(--color-primary)" aria-label="Sélectionnée">
                    <CheckIcon />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function InviteeBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-(--radius-pill) bg-[#fef3c7] px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-[#92400e] uppercase"
      title="Vous êtes invité dans cette exploitation (lecture seule)"
    >
      {compact ? 'Invité' : 'Invité'}
    </span>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={14}
      height={14}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
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

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={14}
      height={14}
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
