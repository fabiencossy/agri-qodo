import { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { PARAMETRES_SECTIONS, SECTION_GROUPS } from './parametres.sections';
import { useCan } from '../users/permissions';
import { useCurrentFarm } from '../farms/farms.store';

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

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8 md:flex-row md:gap-6">
      {/* Sidebar gauche : visible md+ ; sur mobile remplacée par un bouton */}
      <aside className="hidden w-64 shrink-0 md:block">
        <SidebarContent
          activeSlug={activeSection?.slug}
          farmName={farm?.name ?? 'Mon exploitation'}
        />
      </aside>

      {/* Mobile : bouton Sections + drawer */}
      <div className="flex items-center justify-between md:hidden">
        <div>
          <h1 className="m-0 text-xl font-semibold">Paramètres</h1>
          <p className="m-0 mt-0.5 text-xs text-(--color-muted)">{farm?.name ?? 'Exploitation'}</p>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 text-xs font-medium hover:bg-[#f8f8f5]"
        >
          {activeSection?.label ?? 'Sections'}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            width="14"
            height="14"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

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

      {/* Zone centrale */}
      <main className="min-w-0 flex-1">
        <header className="mb-5 hidden md:block">
          <h1 className="m-0 text-xl font-semibold">{activeSection?.label ?? 'Paramètres'}</h1>
          {activeSection?.description && (
            <p className="m-0 mt-0.5 text-sm text-(--color-muted)">{activeSection.description}</p>
          )}
        </header>
        <Outlet />
      </main>
    </div>
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
