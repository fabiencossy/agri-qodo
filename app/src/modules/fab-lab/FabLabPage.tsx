/**
 * FAB Lab — exploration des variantes d'affichage du FAB (Floating Action Button).
 *
 * Page temporaire de design : /fab-lab. Aucune intégration prod, sert juste à
 * comparer 5 patterns mobile-first :
 *   A. Drawer 2 niveaux (bottom sheet : secteurs → actions)
 *   B. Plein écran grid (cartes secteurs en mosaïque, expand sur tap)
 *   C. Speed dial vertical (colonne secteurs au-dessus du FAB, puis actions)
 *   D. Onglets bottom sheet (tabs secteurs en haut, list actions en bas)
 *   E. Radial bloom (éclatement en arc autour du FAB)
 *
 * Chaque variante est dans une "demo phone frame" (max 380px) → comparaison
 * côte à côte desktop, empilée mobile.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

/* ─────────────────────────────────────────────────────────────────────────
   Données : secteurs + actions
   ───────────────────────────────────────────────────────────────────────── */

type ActionDef = {
  id: string;
  label: string;
  icon: ReactNode;
};

type Sector = {
  id: string;
  label: string;
  color: string;
  icon: ReactNode;
  actions: ActionDef[];
};

const I = {
  pen: <path d="m4 20 4-1 11-11-3-3L5 16zM14 6l3 3" />,
  parcel: (
    <>
      <path d="M5 5 19 7l3 12-13 3L3 12z" />
      <circle cx="5" cy="5" r="1.3" fill="currentColor" />
      <circle cx="19" cy="7" r="1.3" fill="currentColor" />
      <circle cx="22" cy="19" r="1.3" fill="currentColor" />
      <circle cx="9" cy="22" r="1.3" fill="currentColor" />
      <circle cx="3" cy="12" r="1.3" fill="currentColor" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  cow: (
    <>
      <path d="M5 8c0-3 3-5 7-5s7 2 7 5v3c0 4-3 7-7 7s-7-3-7-7z" />
      <path d="M9 8h.01M15 8h.01" />
      <path d="M9 14c.5 1 1.5 2 3 2s2.5-1 3-2" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3h6M10 3v6L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-10V3" />
      <path d="M7 14h10" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  plant: (
    <>
      <path d="M12 21V11" />
      <path d="M12 11c-3 0-5-2-5-5 3 0 5 2 5 5z" />
      <path d="M12 11c3 0 5-2 5-5-3 0-5 2-5 5z" />
    </>
  ),
  truck: (
    <>
      <path d="M3 8h11v8H3zM14 11h4l3 3v2h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  hourglass: (
    <>
      <path d="M6 3h12M6 21h12" />
      <path d="M8 3c0 5 8 5 8 9s-8 4-8 9" />
    </>
  ),
  upload: (
    <>
      <path d="M12 4v12" />
      <path d="m6 10 6-6 6 6" />
      <path d="M4 20h16" />
    </>
  ),
  warn: (
    <>
      <path d="M12 4 2 20h20z" />
      <path d="M12 10v5M12 18v.01" />
    </>
  ),
};

const SECTORS: Sector[] = [
  {
    id: 'carnet',
    label: 'Travaux des champs',
    color: '#2E7D32',
    icon: I.plant,
    actions: [
      { id: 'c-intervention', label: 'Créer une intervention', icon: I.pen },
      { id: 'c-observation', label: 'Ajouter une observation', icon: I.eye },
      { id: 'c-alert', label: 'Signaler un danger', icon: I.warn },
    ],
  },
  {
    id: 'parcellaire',
    label: 'Parcellaire',
    color: '#0369a1',
    icon: I.parcel,
    actions: [
      { id: 'p-new', label: 'Nouvelle parcelle (dessin)', icon: I.parcel },
      { id: 'p-import', label: 'Importer GeoJSON', icon: I.upload },
      { id: 'p-assolement', label: "Ajouter un segment d'assolement", icon: I.calendar },
    ],
  },
  {
    id: 'cheptel',
    label: 'Cheptel',
    color: '#a16207',
    icon: I.cow,
    actions: [
      { id: 'a-add', label: 'Ajouter un animal', icon: I.cow },
      { id: 'a-weigh', label: 'Pesée', icon: I.hourglass },
      { id: 'a-health', label: 'Saisie santé', icon: I.flask },
    ],
  },
  {
    id: 'fumure',
    label: 'Bilan de fumure',
    color: '#7c3aed',
    icon: I.flask,
    actions: [
      { id: 'f-epandage', label: 'Saisir un épandage', icon: I.flask },
      { id: 'f-bilan', label: 'Calculer le bilan', icon: I.flask },
    ],
  },
  {
    id: 'travaux',
    label: 'Travaux agricoles',
    color: '#dc2626',
    icon: I.truck,
    actions: [
      { id: 't-bon', label: 'Nouveau bon de travail', icon: I.pen },
      { id: 't-planning', label: 'Planifier une tâche', icon: I.calendar },
    ],
  },
  {
    id: 'rh',
    label: 'RH & temps',
    color: '#0891b2',
    icon: I.clock,
    actions: [
      { id: 'r-presence', label: 'Saisir une présence', icon: I.clock },
      { id: 'r-conge', label: 'Demande de congé', icon: I.calendar },
    ],
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   Composants utilitaires
   ───────────────────────────────────────────────────────────────────────── */

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function FabButton({
  onClick,
  open,
  color = '#2E7D32',
  ariaLabel = 'Actions rapides',
}: {
  onClick: () => void;
  open: boolean;
  color?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={open}
      className="absolute right-4 bottom-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-transform active:scale-95"
      style={{ background: color, transform: open ? 'rotate(45deg)' : 'none' }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}

function PhoneFrame({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="flex flex-col">
      <h2 className="m-0 mb-2 text-sm font-semibold text-(--color-text)">{title}</h2>
      <div className="relative mx-auto w-full max-w-[380px] overflow-hidden rounded-(--radius-lg) border border-(--color-border) bg-(--color-bg) shadow-sm">
        <div className="h-[640px] bg-[url('https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/16/34125/22987.jpeg')] bg-cover bg-center relative">
          {children}
        </div>
      </div>
    </div>
  );
}

function Backdrop({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="absolute inset-0 z-20 bg-black/30 backdrop-blur-[1px]"
      role="presentation"
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Variante A — Drawer 2 niveaux (bottom sheet)
   ───────────────────────────────────────────────────────────────────────── */

function VariantA_DrawerTwoLevel() {
  const [open, setOpen] = useState(false);
  const [sectorId, setSectorId] = useState<string | null>(null);
  const sector = sectorId ? (SECTORS.find((s) => s.id === sectorId) ?? null) : null;

  const close = () => {
    setOpen(false);
    setSectorId(null);
  };

  return (
    <>
      <FabButton onClick={() => setOpen(!open)} open={open} />
      {open && <Backdrop onClick={close} />}
      <div
        className={[
          'absolute inset-x-0 bottom-0 z-30 rounded-t-2xl bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.15)] transition-transform duration-200',
          open ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
        style={{ maxHeight: '70%' }}
      >
        <div className="flex justify-center pt-2">
          <span className="h-1 w-10 rounded-full bg-neutral-300" />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          {sector ? (
            <button
              type="button"
              onClick={() => setSectorId(null)}
              className="inline-flex items-center gap-2 text-sm font-medium text-(--color-text)"
            >
              <Icon size={18}>
                <path d="m15 6-6 6 6 6" />
              </Icon>
              {sector.label}
            </button>
          ) : (
            <span className="text-[11px] font-semibold tracking-wider text-(--color-muted) uppercase">
              Secteur
            </span>
          )}
          <button
            type="button"
            onClick={close}
            aria-label="Fermer"
            className="text-(--color-muted)"
          >
            <Icon>
              <path d="M6 6l12 12M6 18l12-12" />
            </Icon>
          </button>
        </div>
        <ul className="m-0 list-none divide-y divide-neutral-100 p-0">
          {sector
            ? sector.actions.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={close}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left active:bg-neutral-50"
                  >
                    <span
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                      style={{ background: `${sector.color}1a`, color: sector.color }}
                    >
                      <Icon>{a.icon}</Icon>
                    </span>
                    <span className="flex-1 text-base font-medium">{a.label}</span>
                    <Icon size={18}>
                      <path d="m9 6 6 6-6 6" />
                    </Icon>
                  </button>
                </li>
              ))
            : SECTORS.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSectorId(s.id)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left active:bg-neutral-50"
                  >
                    <span
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                      style={{ background: `${s.color}1a`, color: s.color }}
                    >
                      <Icon>{s.icon}</Icon>
                    </span>
                    <span className="flex-1 text-base font-medium">{s.label}</span>
                    <Icon size={18}>
                      <path d="m9 6 6 6-6 6" />
                    </Icon>
                  </button>
                </li>
              ))}
        </ul>
        <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }} />
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Variante B — Plein écran grid (cartes secteurs)
   ───────────────────────────────────────────────────────────────────────── */

function VariantB_FullscreenGrid() {
  const [open, setOpen] = useState(false);
  const [sectorId, setSectorId] = useState<string | null>(null);
  const sector = sectorId ? (SECTORS.find((s) => s.id === sectorId) ?? null) : null;
  const close = () => {
    setOpen(false);
    setSectorId(null);
  };

  return (
    <>
      <FabButton onClick={() => setOpen(!open)} open={open} />
      {open && (
        <div className="absolute inset-0 z-30 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            {sector ? (
              <button
                type="button"
                onClick={() => setSectorId(null)}
                className="inline-flex items-center gap-2 text-sm font-medium"
              >
                <Icon size={18}>
                  <path d="m15 6-6 6 6 6" />
                </Icon>
                {sector.label}
              </button>
            ) : (
              <span className="text-base font-semibold">Que voulez-vous faire ?</span>
            )}
            <button type="button" onClick={close} aria-label="Fermer">
              <Icon>
                <path d="M6 6l12 12M6 18l12-12" />
              </Icon>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {sector ? (
              <ul className="m-0 list-none space-y-2 p-0">
                {sector.actions.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={close}
                      className="flex w-full items-center gap-4 rounded-(--radius-lg) border border-neutral-200 bg-white p-4 text-left active:bg-neutral-50"
                    >
                      <span
                        className="inline-flex h-12 w-12 items-center justify-center rounded-full"
                        style={{ background: `${sector.color}1a`, color: sector.color }}
                      >
                        <Icon size={22}>{a.icon}</Icon>
                      </span>
                      <span className="flex-1 text-base font-medium">{a.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {SECTORS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSectorId(s.id)}
                    className="flex aspect-square flex-col items-center justify-center gap-2 rounded-(--radius-lg) border border-neutral-200 bg-white p-3 text-center active:bg-neutral-50"
                  >
                    <span
                      className="inline-flex h-14 w-14 items-center justify-center rounded-full"
                      style={{ background: `${s.color}1a`, color: s.color }}
                    >
                      <Icon size={28}>{s.icon}</Icon>
                    </span>
                    <span className="text-sm font-medium leading-tight">{s.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Variante C — Speed dial vertical (colonne au-dessus du FAB)
   ───────────────────────────────────────────────────────────────────────── */

function VariantC_SpeedDialVertical() {
  const [open, setOpen] = useState(false);
  const [sectorId, setSectorId] = useState<string | null>(null);
  const sector = sectorId ? (SECTORS.find((s) => s.id === sectorId) ?? null) : null;
  const close = () => {
    setOpen(false);
    setSectorId(null);
  };

  return (
    <>
      <FabButton onClick={() => (open ? close() : setOpen(true))} open={open} />
      {open && <div onClick={close} className="absolute inset-0 z-20" role="presentation" />}
      {open && (
        <div className="absolute right-4 bottom-20 z-30 flex flex-col items-end gap-2">
          {(sector ? sector.actions : SECTORS).map((it, idx) => {
            const isAction = !!sector;
            const color = isAction ? sector!.color : (it as Sector).color;
            return (
              <div
                key={it.id}
                className="flex items-center gap-2"
                style={{
                  animation: `fab-pop 180ms cubic-bezier(.2,.8,.2,1) ${idx * 30}ms backwards`,
                }}
              >
                <span className="rounded-md bg-white/95 px-2.5 py-1 text-xs font-medium text-(--color-text) shadow">
                  {it.label}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (isAction) close();
                    else setSectorId(it.id);
                  }}
                  aria-label={it.label}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full text-white shadow-md active:scale-95"
                  style={{ background: color }}
                >
                  <Icon size={22}>{it.icon}</Icon>
                </button>
              </div>
            );
          })}
        </div>
      )}
      <style>{`
        @keyframes fab-pop {
          from { opacity: 0; transform: translateY(8px) scale(.85); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Variante D — Onglets bottom sheet (tabs secteurs en haut)
   ───────────────────────────────────────────────────────────────────────── */

function VariantD_TabbedBottomSheet() {
  const [open, setOpen] = useState(false);
  const [sectorId, setSectorId] = useState<string>(SECTORS[0]!.id);
  const sector = SECTORS.find((s) => s.id === sectorId)!;
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !tabsRef.current) return;
    const el = tabsRef.current.querySelector<HTMLElement>(`[data-tab="${sectorId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [sectorId, open]);

  return (
    <>
      <FabButton onClick={() => setOpen(!open)} open={open} />
      {open && <Backdrop onClick={() => setOpen(false)} />}
      <div
        className={[
          'absolute inset-x-0 bottom-0 z-30 rounded-t-2xl bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.15)] transition-transform duration-200',
          open ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
      >
        <div className="flex justify-center pt-2">
          <span className="h-1 w-10 rounded-full bg-neutral-300" />
        </div>
        <div
          ref={tabsRef}
          role="tablist"
          className="flex gap-1 overflow-x-auto border-b border-neutral-200 px-3 pt-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SECTORS.map((s) => {
            const active = s.id === sectorId;
            return (
              <button
                key={s.id}
                data-tab={s.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setSectorId(s.id)}
                className={[
                  'inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'text-white' : 'text-(--color-text)',
                ].join(' ')}
                style={{ background: active ? s.color : '#f3f4f6' }}
              >
                <Icon size={16}>{s.icon}</Icon>
                {s.label}
              </button>
            );
          })}
        </div>
        <ul className="m-0 list-none divide-y divide-neutral-100 p-0">
          {sector.actions.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left active:bg-neutral-50"
              >
                <span
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `${sector.color}1a`, color: sector.color }}
                >
                  <Icon>{a.icon}</Icon>
                </span>
                <span className="flex-1 text-base font-medium">{a.label}</span>
                <Icon size={18}>
                  <path d="m9 6 6 6-6 6" />
                </Icon>
              </button>
            </li>
          ))}
        </ul>
        <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }} />
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Variante E — Radial bloom (arc autour du FAB)
   ───────────────────────────────────────────────────────────────────────── */

function VariantE_RadialBloom() {
  const [open, setOpen] = useState(false);
  const [sectorId, setSectorId] = useState<string | null>(null);
  const sector = sectorId ? (SECTORS.find((s) => s.id === sectorId) ?? null) : null;
  const items = sector ? sector.actions : SECTORS;
  const close = () => {
    setOpen(false);
    setSectorId(null);
  };

  return (
    <>
      <FabButton onClick={() => (open ? close() : setOpen(true))} open={open} />
      {open && <div onClick={close} className="absolute inset-0 z-20" role="presentation" />}
      {open &&
        items.map((it, idx) => {
          const total = items.length;
          // Arc 180° (de gauche à haut) en partant du FAB bottom-right.
          const angleDeg = 180 + (idx / Math.max(1, total - 1)) * 90;
          const angleRad = (angleDeg * Math.PI) / 180;
          const r = 110;
          const dx = Math.cos(angleRad) * r;
          const dy = Math.sin(angleRad) * r;
          const isAction = !!sector;
          const color = isAction ? sector!.color : (it as Sector).color;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => {
                if (isAction) close();
                else setSectorId(it.id);
              }}
              aria-label={it.label}
              className="absolute z-30 inline-flex h-12 w-12 items-center justify-center rounded-full text-white shadow-md active:scale-95"
              style={{
                right: 24 - dx,
                bottom: 24 - dy,
                background: color,
                animation: `bloom 220ms cubic-bezier(.2,.8,.2,1) ${idx * 30}ms backwards`,
              }}
              title={it.label}
            >
              <Icon size={22}>{it.icon}</Icon>
            </button>
          );
        })}
      {open && items.length > 0 && (
        <div
          className="absolute right-20 bottom-4 z-30 max-w-[180px] rounded-md bg-white/95 px-2.5 py-1.5 text-xs text-(--color-text) shadow"
          style={{ animation: 'bloom 260ms ease-out 120ms backwards' }}
        >
          {sector ? `Action ${sector.label}` : 'Choisissez un secteur'}
        </div>
      )}
      <style>{`
        @keyframes bloom {
          from { opacity: 0; transform: scale(.4); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Page
   ───────────────────────────────────────────────────────────────────────── */

export default function FabLabPage() {
  return (
    <div className="min-h-screen bg-(--color-bg) p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <div className="flex items-center gap-3">
            <Link
              to="/parcellaire"
              className="inline-flex items-center gap-1 text-sm text-(--color-muted) hover:text-(--color-text)"
            >
              <Icon size={16}>
                <path d="m15 6-6 6 6 6" />
              </Icon>
              Retour
            </Link>
          </div>
          <h1 className="m-0 mt-2 text-2xl font-semibold text-(--color-text)">
            FAB Lab — 5 variantes
          </h1>
          <p className="m-0 mt-1 text-sm text-(--color-muted)">
            Page temporaire pour comparer plusieurs patterns d'accès aux actions rapides. Chaque
            variante hiérarchise par secteur (Travaux des champs, Parcellaire, Cheptel, Fumure,
            Travaux agricoles, RH) puis affiche les actions du secteur.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <PhoneFrame title="A · Drawer 2 niveaux (bottom sheet)">
            <VariantA_DrawerTwoLevel />
          </PhoneFrame>
          <PhoneFrame title="B · Plein écran grid">
            <VariantB_FullscreenGrid />
          </PhoneFrame>
          <PhoneFrame title="C · Speed dial vertical">
            <VariantC_SpeedDialVertical />
          </PhoneFrame>
          <PhoneFrame title="D · Onglets bottom sheet">
            <VariantD_TabbedBottomSheet />
          </PhoneFrame>
          <PhoneFrame title="E · Radial bloom (arc)">
            <VariantE_RadialBloom />
          </PhoneFrame>
          <div className="rounded-(--radius-lg) border border-dashed border-(--color-border) bg-(--color-surface) p-4 text-sm text-(--color-muted)">
            <p className="m-0 font-semibold text-(--color-text)">Critères de comparaison</p>
            <ul className="m-0 mt-2 list-disc space-y-1 pl-5">
              <li>Atteignable au pouce (zone bottom-right safe)</li>
              <li>Hiérarchie secteur → action visible d'un coup d'œil</li>
              <li>Retour arrière simple et évident</li>
              <li>Backdrop tap = fermeture</li>
              <li>Cibles tactiles ≥ 44×44 px</li>
              <li>Pas de scroll caché qui bloque sur mobile</li>
            </ul>
            <p className="m-0 mt-3 font-semibold text-(--color-text)">Recommandation</p>
            <p className="m-0 mt-1">
              <strong>A · Drawer 2 niveaux</strong> reste le standard mobile éprouvé (Material You).{' '}
              <strong>D · Onglets bottom sheet</strong> évite le aller-retour si l'utilisateur
              connaît bien les secteurs. <strong>E · Radial bloom</strong> est joli mais souffre dès
              5+ items.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
