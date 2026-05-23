import { useMemo, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { PARAMETRES_SECTIONS, SECTION_GROUPS } from './parametres.sections';
import { ParametresMobileSelectorProvider } from './parametres.context';
import { useCan } from '../users/permissions';
import { useCurrentFarm } from '../farms/farms.store';

export type ParametresOutletContext = {
  /** Engrenage à monter dans toolbar mobile (Produits/Cultures) ou consommé
   *  automatiquement par SectionCard via useParametresMobileSelector(). */
  mobileSelector: ReactNode;
};

export default function ParametresLayout() {
  const canReadParametres = useCan('parametres', 'read');
  const canAdminParametres = useCan('parametres', 'admin');
  const farm = useCurrentFarm();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleSections = useMemo(() => {
    return PARAMETRES_SECTIONS.filter((s) => {
      const level = s.requiredLevel ?? 'read';
      if (level === 'admin') return canAdminParametres;
      return canReadParametres;
    });
  }, [canReadParametres, canAdminParametres]);

  const activeSection = useMemo(() => {
    const slug = location.pathname.split('/parametres/')[1]?.split('/')[0] ?? '';
    return visibleSections.find((s) => s.slug === slug);
  }, [location.pathname, visibleSections]);

  const mobileSelectorButton: ReactNode = (
    <button
      type="button"
      onClick={() => setMobileOpen(true)}
      aria-label={`Changer de section (actuelle : ${activeSection?.label ?? 'Sections'})`}
      title={activeSection?.label ?? 'Sections'}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius) border border-(--color-border) bg-(--color-surface) hover:bg-[#f8f8f5]"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        width="16"
        height="16"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  );

  return (
    <ParametresMobileSelectorProvider value={mobileSelectorButton}>
      <div className="mx-auto flex max-w-7xl flex-col gap-0 px-3 py-0 sm:px-6 md:flex-row md:gap-6 md:py-6">
        {/* Sidebar gauche : visible md+ ; sur mobile remplacée par un bouton */}
        <aside className="hidden w-64 shrink-0 md:block">
          <SidebarContent
            activeSlug={activeSection?.slug}
            farmName={farm?.name ?? 'Mon exploitation'}
          />
        </aside>

        {mobileOpen && (
          <div
            className="fixed inset-0 z-[1200] bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-(--color-surface) p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <SidebarContent
                activeSlug={activeSection?.slug}
                farmName={farm?.name ?? 'Mon exploitation'}
                onItemClick={() => setMobileOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Zone centrale. Sections avec toolbar (Produits/Cultures) consomment l'engrenage
            via useOutletContext. Sections avec SectionCard l'injectent dans le header
            via useParametresMobileSelector(). pt-2 mobile pour aérer le bloc sous topbar. */}
        <main className="min-w-0 flex-1 pt-2 md:pt-0">
          <Outlet
            context={{ mobileSelector: mobileSelectorButton } satisfies ParametresOutletContext}
          />
        </main>
      </div>
    </ParametresMobileSelectorProvider>
  );
}

function SidebarContent({
  activeSlug,
  farmName,
  onItemClick,
}: {
  activeSlug: string | undefined;
  farmName: string;
  onItemClick?: () => void;
}) {
  return (
    <nav className="space-y-5">
      <div className="hidden md:block">
        <h1 className="m-0 text-xl font-semibold">Paramètres</h1>
        <p className="m-0 mt-0.5 text-xs text-(--color-muted)">{farmName}</p>
      </div>

      {SECTION_GROUPS.map((group) => {
        const sections = PARAMETRES_SECTIONS.filter((s) => s.group === group.key);
        if (sections.length === 0) return null;
        return (
          <div key={group.key}>
            <h2 className="m-0 mb-1.5 px-2 text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
              {group.label}
            </h2>
            <ul className="m-0 list-none space-y-0.5 p-0">
              {sections.map((s) => (
                <li key={s.slug}>
                  <NavLink
                    to={`/parametres/${s.slug}`}
                    onClick={onItemClick}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-2.5 rounded-(--radius-sm) px-2.5 py-2 text-sm transition-colors',
                        isActive || s.slug === activeSlug
                          ? 'bg-(--color-primary)/10 text-(--color-primary) font-medium'
                          : 'text-(--color-text) hover:bg-[#f5f5f1]',
                      ].join(' ')
                    }
                  >
                    <span className="shrink-0">{s.icon}</span>
                    <span className="truncate">{s.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
