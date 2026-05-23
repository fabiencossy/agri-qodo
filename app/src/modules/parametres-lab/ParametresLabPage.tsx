/**
 * Paramètres Lab — exploration mises en page module Paramètres.
 *
 * Page temporaire `/parametres-lab` (hors prod). Aucune logique métier réelle :
 * uniquement maquettes statiques pour comparer 4 patterns d'agencement.
 *
 * Variantes :
 *   A. Sticky toolbar fusion         — un seul header, SearchBar + ViewSwitcher + bouton inline
 *   B. Compact dense                 — sidebar étroite (icônes seules au repos), zéro padding gaspillé
 *   C. Tabs horizontales             — sidebar remplacée par tabs scroll horizontaux en top
 *   D. Sidebar accordion + zero head — groupes collapsibles, zone centrale = toolbar + table direct
 */
import { Link } from 'react-router-dom';
import { useState, type ReactNode } from 'react';

const SECTIONS = [
  { group: 'Général', items: ['Exploitation', 'Utilisateurs & accès', 'Préférences'] },
  { group: 'Données', items: ['Cultures', 'Catalogue', 'Cheptel'] },
  { group: 'Intégrations', items: ['Intégration Odoo', 'MétéoSuisse'] },
];

const MOCK_ROWS: Array<{ type: string; name: string; mfr: string; detail: string; ref: string }> = [
  { type: 'PHYTO', name: 'Adexar', mfr: 'BASF', detail: 'fungicide · délai 35j', ref: 'W-7239' },
  {
    type: 'PHYTO',
    name: 'Moddus Evo',
    mfr: 'Syngenta',
    detail: 'growth-regulator · délai 0j',
    ref: 'W-6789',
  },
  {
    type: 'PHYTO',
    name: 'Axial One',
    mfr: 'Syngenta',
    detail: 'herbicide · délai 0j',
    ref: 'W-7012',
  },
  {
    type: 'ENGRAIS',
    name: 'Landor 12-12-17',
    mfr: 'Landor',
    detail: 'NPK · 600 kg/ha',
    ref: 'LANDOR-001',
  },
  { type: 'SEMENCE', name: 'Wiwa', mfr: 'DSP', detail: 'blé · printemps', ref: 'DSP-WIWA' },
];

export default function ParametresLabPage() {
  return (
    <div className="min-h-screen bg-(--color-bg) px-6 py-8">
      <header className="mx-auto mb-8 max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="m-0 text-2xl font-semibold">Paramètres — Lab</h1>
            <p className="m-0 mt-1 text-sm text-(--color-muted)">
              4 maquettes comparatives pour repenser l'agencement.
            </p>
          </div>
          <Link
            to="/parametres/produits"
            className="rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-xs font-medium hover:bg-[#f8f8f5]"
          >
            ← Retour Paramètres
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-10">
        <VariantBlock
          letter="A"
          title="Sticky toolbar fusion"
          description="Un seul header. SearchBar + ViewSwitcher + bouton dans la même row. Zéro double-titre."
          best="Meilleur ratio info/espace. Toolbar reste collée en scroll."
        >
          <VariantA />
        </VariantBlock>

        <VariantBlock
          letter="B"
          title="Compact dense (sidebar icônes)"
          description="Sidebar 56px icônes seules → libelles au hover. Header inline, table pleine largeur."
          best="Max d'espace écran. Bon pour écrans 13″ MacBook."
        >
          <VariantB />
        </VariantBlock>

        <VariantBlock
          letter="C"
          title="Tabs horizontales (Odoo-like)"
          description="Sidebar virée. Tabs scroll horizontal en top → toute la largeur disponible pour la table."
          best="Style Odoo. Mobile-first naturel (tabs = swipe)."
        >
          <VariantC />
        </VariantBlock>

        <VariantBlock
          letter="D"
          title="Accordion sidebar + zero header"
          description="Sidebar avec groupes collapsibles. Zone centrale = directement toolbar + table, plus aucun titre."
          best="Le plus minimaliste. Le titre est dans la sidebar (section active surlignée)."
        >
          <VariantD />
        </VariantBlock>
      </div>
    </div>
  );
}

function VariantBlock({
  letter,
  title,
  description,
  best,
  children,
}: {
  letter: string;
  title: string;
  description: string;
  best: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-5 shadow-sm">
      <header className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius) bg-(--color-primary) text-sm font-bold text-white">
          {letter}
        </span>
        <div>
          <h2 className="m-0 text-base font-semibold">{title}</h2>
          <p className="m-0 mt-0.5 text-sm text-(--color-muted)">{description}</p>
          <p className="m-0 mt-1 text-xs text-(--color-primary)">★ {best}</p>
        </div>
      </header>
      <div className="overflow-hidden rounded-(--radius) border border-(--color-border) bg-(--color-bg)">
        {children}
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────────────
   VARIANT A — Sticky toolbar fusion (responsive natif)
   ─────────────────────────────────────────────────────────────────────── */

function VariantA() {
  const [drawer, setDrawer] = useState(false);
  return (
    <div className="relative flex">
      {/* Sidebar visible md+, drawer mobile via bouton */}
      <div className="hidden md:block">
        <MockSidebar activeLabel="Catalogue" />
      </div>

      <main className="min-w-0 flex-1">
        {/* Strip mobile : bouton section drawer + bouton "+" */}
        <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-(--color-border) bg-(--color-surface) px-2 py-1.5 md:hidden">
          <button
            onClick={() => setDrawer(true)}
            className="flex h-8 items-center gap-1 rounded-(--radius) border border-(--color-border) px-2 text-xs font-medium"
          >
            Catalogue
            <svg
              viewBox="0 0 24 24"
              width={12}
              height={12}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <div className="flex-1" />
          <button className="flex h-8 items-center gap-1 rounded-(--radius) bg-(--color-primary) px-2.5 text-xs font-semibold text-white">
            <svg
              viewBox="0 0 24 24"
              width={14}
              height={14}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nouveau
          </button>
        </div>

        {/* Toolbar desktop : titre + SearchBar + ViewSwitcher + bouton inline */}
        <div className="sticky top-0 z-10 hidden items-center gap-2 border-b border-(--color-border) bg-(--color-surface) px-4 py-2.5 md:flex">
          <div>
            <h2 className="m-0 text-sm font-semibold">Catalogue</h2>
            <span className="text-[11px] text-(--color-muted)">25 produits · 20 prestations</span>
          </div>
          <div className="ml-3 min-w-0 flex-1">
            <MockSearchBar />
          </div>
          <MockViewSwitcher />
          <button className="shrink-0 rounded-(--radius) bg-(--color-primary) px-3 py-1.5 text-xs font-semibold text-white">
            + Nouveau produit
          </button>
        </div>

        {/* SearchBar pleine largeur (mobile uniquement) */}
        <div className="border-b border-(--color-border) bg-(--color-surface) px-2 py-1.5 md:hidden">
          <MockSearchBar />
        </div>

        {/* Sous-toolbar mobile : compteurs + ViewSwitcher */}
        <div className="flex items-center justify-between border-b border-(--color-border) bg-(--color-surface)/60 px-3 py-1 md:hidden">
          <span className="text-[10px] text-(--color-muted)">25 produits · 20 prestations</span>
          <MockViewSwitcher />
        </div>

        {/* Liste cards mobile, table desktop */}
        <div className="md:hidden">
          <ul className="m-0 list-none space-y-1.5 p-2">
            {MOCK_ROWS.map((r) => (
              <li
                key={r.ref}
                className="flex items-start gap-2 rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-2"
              >
                <input type="checkbox" readOnly className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-(--radius-pill) bg-(--color-primary)/10 px-1.5 py-0.5 text-[8px] font-semibold tracking-wider text-(--color-primary) uppercase">
                      {r.type}
                    </span>
                    <span className="truncate text-xs font-medium">{r.name}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[10px] text-(--color-muted)">
                    {r.mfr} · {r.detail}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-(--color-muted)">{r.ref}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="hidden md:block">
          <MockTable />
        </div>
      </main>

      {/* Drawer sections mobile */}
      {drawer && (
        <div onClick={() => setDrawer(false)} className="fixed inset-0 z-50 bg-black/40 md:hidden">
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-y-0 left-0 w-3/4 max-w-xs overflow-y-auto bg-(--color-surface) p-3"
          >
            <header className="mb-2 flex items-center justify-between">
              <h3 className="m-0 text-sm font-semibold">Sections</h3>
              <button onClick={() => setDrawer(false)} className="text-xs text-(--color-muted)">
                ✕
              </button>
            </header>
            {SECTIONS.map((g) => (
              <div key={g.group} className="mb-2">
                <h4 className="m-0 mb-0.5 px-1 text-[9px] font-semibold tracking-wider text-(--color-muted) uppercase">
                  {g.group}
                </h4>
                <ul className="m-0 list-none space-y-0.5 p-0">
                  {g.items.map((label) => (
                    <li key={label}>
                      <button
                        onClick={() => setDrawer(false)}
                        className={[
                          'block w-full rounded-(--radius-sm) px-2 py-1.5 text-left text-xs',
                          label === 'Catalogue'
                            ? 'bg-(--color-primary)/10 font-medium text-(--color-primary)'
                            : 'text-(--color-text) hover:bg-[#f5f5f1]',
                        ].join(' ')}
                      >
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────
   VARIANT B — Sidebar icônes compactes
   ─────────────────────────────────────────────────────────────────────── */

function VariantB() {
  return (
    <div className="flex">
      <aside className="flex w-12 shrink-0 flex-col border-r border-(--color-border) bg-(--color-surface) py-2 sm:w-14">
        {SECTIONS.flatMap((g) => g.items).map((label, i) => (
          <button
            key={label}
            title={label}
            className={[
              'mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-(--radius) sm:h-10 sm:w-10',
              label === 'Catalogue'
                ? 'bg-(--color-primary)/10 text-(--color-primary)'
                : 'text-(--color-muted) hover:bg-[#f5f5f1]',
            ].join(' ')}
          >
            <IconDot index={i} />
          </button>
        ))}
      </aside>
      <main className="min-w-0 flex-1">
        {/* Toolbar — sur mobile 2 rows, desktop 1 row */}
        <div className="border-b border-(--color-border) bg-(--color-surface) px-2 py-1.5 sm:px-4 sm:py-2">
          <div className="flex items-center gap-2">
            <h2 className="m-0 text-sm font-semibold">Catalogue</h2>
            <span className="text-[11px] text-(--color-muted)">25+20</span>
            <div className="ml-auto sm:hidden">
              <button className="rounded-(--radius) bg-(--color-primary) px-2.5 py-1 text-xs font-semibold text-white">
                +
              </button>
            </div>
            <div className="ml-3 hidden min-w-0 flex-1 sm:block">
              <MockSearchBar />
            </div>
            <div className="hidden sm:block">
              <MockViewSwitcher />
            </div>
            <button className="hidden shrink-0 rounded-(--radius) bg-(--color-primary) px-3 py-1.5 text-xs font-semibold text-white sm:inline-flex">
              + Nouveau
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-2 sm:hidden">
            <div className="min-w-0 flex-1">
              <MockSearchBar />
            </div>
            <MockViewSwitcher />
          </div>
        </div>
        <MobileCards className="sm:hidden" />
        <div className="hidden sm:block">
          <MockTable />
        </div>
      </main>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────
   VARIANT C — Tabs horizontales
   ─────────────────────────────────────────────────────────────────────── */

function VariantC() {
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-1 overflow-x-auto border-b border-(--color-border) bg-(--color-surface) px-2 py-1 sm:px-3">
        {SECTIONS.flatMap((g) => g.items).map((label) => (
          <button
            key={label}
            className={[
              'shrink-0 rounded-t-(--radius) border-b-2 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap sm:px-3 sm:py-2',
              label === 'Catalogue'
                ? 'border-(--color-primary) text-(--color-primary)'
                : 'border-transparent text-(--color-muted) hover:text-(--color-text)',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 border-b border-(--color-border) bg-(--color-surface) px-2 py-1.5 sm:px-4 sm:py-2">
        <div className="min-w-0 flex-1">
          <MockSearchBar />
        </div>
        <MockViewSwitcher />
        <button className="shrink-0 rounded-(--radius) bg-(--color-primary) px-2.5 py-1.5 text-xs font-semibold text-white sm:px-3">
          <span className="hidden sm:inline">+ Nouveau produit</span>
          <span className="sm:hidden">+</span>
        </button>
      </div>
      <MobileCards className="sm:hidden" />
      <div className="hidden sm:block">
        <MockTable />
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────
   VARIANT D — Accordion sidebar + zero header
   ─────────────────────────────────────────────────────────────────────── */

function VariantD() {
  const [open, setOpen] = useState<Record<string, boolean>>({
    Général: true,
    Données: true,
    Intégrations: false,
  });
  const [drawer, setDrawer] = useState(false);

  const Accordion = (
    <>
      {SECTIONS.map((g) => (
        <div key={g.group}>
          <button
            onClick={() => setOpen((o) => ({ ...o, [g.group]: !o[g.group] }))}
            className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase hover:bg-[#f5f5f1]"
          >
            <span>{g.group}</span>
            <span>{open[g.group] ? '−' : '+'}</span>
          </button>
          {open[g.group] && (
            <ul className="m-0 list-none p-0">
              {g.items.map((label) => (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => setDrawer(false)}
                    className={[
                      'block w-full px-4 py-1.5 text-left text-xs',
                      label === 'Catalogue'
                        ? 'bg-(--color-primary)/10 font-medium text-(--color-primary)'
                        : 'text-(--color-text) hover:bg-[#f5f5f1]',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </>
  );

  return (
    <div className="relative flex">
      <aside className="hidden w-52 shrink-0 border-r border-(--color-border) bg-(--color-surface) py-2 sm:block">
        {Accordion}
      </aside>
      <main className="min-w-0 flex-1">
        {/* Mobile : bouton drawer + + */}
        <div className="flex items-center gap-1.5 border-b border-(--color-border) bg-(--color-surface) px-2 py-1.5 sm:hidden">
          <button
            onClick={() => setDrawer(true)}
            className="flex h-8 items-center gap-1 rounded-(--radius) border border-(--color-border) px-2 text-xs font-medium"
          >
            Sections
            <svg
              viewBox="0 0 24 24"
              width={12}
              height={12}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <div className="flex-1" />
          <button className="flex h-8 items-center gap-1 rounded-(--radius) bg-(--color-primary) px-2.5 text-xs font-semibold text-white">
            <svg
              viewBox="0 0 24 24"
              width={14}
              height={14}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nouveau
          </button>
        </div>

        {/* Toolbar desktop + SearchBar mobile pleine largeur */}
        <div className="border-b border-(--color-border) bg-(--color-surface) px-2 py-1.5 sm:px-4 sm:py-2">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <MockSearchBar />
            </div>
            <div className="hidden sm:block">
              <MockViewSwitcher />
            </div>
            <button className="hidden shrink-0 rounded-(--radius) bg-(--color-primary) px-3 py-1.5 text-xs font-semibold text-white sm:inline-flex">
              + Nouveau produit
            </button>
          </div>
        </div>

        {/* Sous-toolbar mobile : ViewSwitcher */}
        <div className="flex items-center justify-between border-b border-(--color-border) bg-(--color-surface)/60 px-3 py-1 sm:hidden">
          <span className="text-[10px] text-(--color-muted)">25 produits · 20 prestations</span>
          <MockViewSwitcher />
        </div>

        <MobileCards className="sm:hidden" />
        <div className="hidden sm:block">
          <MockTable />
        </div>
      </main>

      {drawer && (
        <div onClick={() => setDrawer(false)} className="fixed inset-0 z-50 bg-black/40 sm:hidden">
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-y-0 left-0 w-3/4 max-w-xs overflow-y-auto bg-(--color-surface) py-2"
          >
            <header className="mb-1 flex items-center justify-between px-3 py-1.5">
              <h3 className="m-0 text-sm font-semibold">Paramètres</h3>
              <button onClick={() => setDrawer(false)} className="text-xs text-(--color-muted)">
                ✕
              </button>
            </header>
            {Accordion}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────
   Bricks réutilisables
   ─────────────────────────────────────────────────────────────────────── */

function MockSidebar({ activeLabel }: { activeLabel: string }) {
  return (
    <aside className="w-56 shrink-0 border-r border-(--color-border) bg-(--color-surface) p-3">
      {SECTIONS.map((g) => (
        <div key={g.group} className="mb-3">
          <h3 className="m-0 mb-1 px-2 text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
            {g.group}
          </h3>
          <ul className="m-0 list-none space-y-0.5 p-0">
            {g.items.map((label) => (
              <li key={label}>
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className={[
                    'block rounded-(--radius-sm) px-2 py-1.5 text-xs',
                    label === activeLabel
                      ? 'bg-(--color-primary)/10 font-medium text-(--color-primary)'
                      : 'text-(--color-text) hover:bg-[#f5f5f1]',
                  ].join(' ')}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}

function MockSearchBar() {
  return (
    <div className="flex h-8 items-center gap-1.5 rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-2.5">
      <svg
        viewBox="0 0 24 24"
        width={14}
        height={14}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        className="text-(--color-muted)"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        readOnly
        placeholder="Rechercher…"
        className="h-full flex-1 border-0 bg-transparent text-xs outline-none"
      />
      <svg
        viewBox="0 0 24 24"
        width={12}
        height={12}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        className="text-(--color-muted)"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

function MockViewSwitcher() {
  const icons = [
    <path key="t" d="M3 6h18M3 12h18M3 18h18" />,
    <>
      <rect key="g1" x="3" y="3" width="7" height="7" />
      <rect key="g2" x="14" y="3" width="7" height="7" />
      <rect key="g3" x="3" y="14" width="7" height="7" />
      <rect key="g4" x="14" y="14" width="7" height="7" />
    </>,
  ];
  return (
    <div className="flex h-8 shrink-0 overflow-hidden rounded-(--radius) border border-(--color-border)">
      {icons.map((p, i) => (
        <button
          key={i}
          className={[
            'flex h-full w-8 items-center justify-center',
            i === 0
              ? 'bg-(--color-primary)/10 text-(--color-primary)'
              : 'text-(--color-muted) hover:bg-[#f5f5f1]',
          ].join(' ')}
        >
          <svg
            viewBox="0 0 24 24"
            width={14}
            height={14}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            {p}
          </svg>
        </button>
      ))}
    </div>
  );
}

function MobileCards({ className = '' }: { className?: string }) {
  return (
    <ul className={`m-0 list-none space-y-1.5 p-2 ${className}`}>
      {MOCK_ROWS.map((r) => (
        <li
          key={r.ref}
          className="flex items-start gap-2 rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-2"
        >
          <input type="checkbox" readOnly className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="rounded-(--radius-pill) bg-(--color-primary)/10 px-1.5 py-0.5 text-[8px] font-semibold tracking-wider text-(--color-primary) uppercase">
                {r.type}
              </span>
              <span className="truncate text-xs font-medium">{r.name}</span>
            </div>
            <div className="mt-0.5 truncate text-[10px] text-(--color-muted)">
              {r.mfr} · {r.detail}
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-(--color-muted)">{r.ref}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function MockTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-[#fbfbf9]">
          <tr className="text-[10px] tracking-wider text-(--color-muted) uppercase">
            <th className="w-8 px-3 py-1.5"></th>
            <th className="px-3 py-1.5 text-left font-medium">Type</th>
            <th className="px-3 py-1.5 text-left font-medium">Nom</th>
            <th className="px-3 py-1.5 text-left font-medium">Détail</th>
            <th className="px-3 py-1.5 text-left font-medium">Réf</th>
          </tr>
        </thead>
        <tbody>
          {MOCK_ROWS.map((r) => (
            <tr key={r.ref} className="border-t border-(--color-border)">
              <td className="px-3 py-2">
                <input type="checkbox" readOnly className="h-3.5 w-3.5" />
              </td>
              <td className="px-3 py-2">
                <span className="rounded-(--radius-pill) bg-(--color-primary)/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-(--color-primary) uppercase">
                  {r.type}
                </span>
              </td>
              <td className="px-3 py-2">
                <div className="font-medium">{r.name}</div>
                <div className="text-[10px] text-(--color-muted)">{r.mfr}</div>
              </td>
              <td className="px-3 py-2 text-(--color-muted)">{r.detail}</td>
              <td className="px-3 py-2 font-mono text-[10px]">{r.ref}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IconDot({ index }: { index: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      {index % 3 === 0 && <rect x="4" y="4" width="16" height="16" rx="2" />}
      {index % 3 === 1 && <circle cx="12" cy="12" r="7" />}
      {index % 3 === 2 && <path d="M3 12h18M12 3v18" />}
    </svg>
  );
}
