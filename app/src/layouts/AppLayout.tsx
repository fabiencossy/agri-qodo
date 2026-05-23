import { useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { Fab } from './Fab';
import { FabProvider } from './FabContext';
import { InterventionFormProvider } from './InterventionFormProvider';
import { NoticeHost } from './NoticeHost';
import { NAV_ITEMS, type NavItem } from './nav-items';
import { FarmSwitcher } from '../modules/farms/FarmSwitcher';
import { isInviteeAllowedPath, useIsCurrentFarmInvitee } from '../modules/farms/farms.helpers';
import { logout, useAuth } from '../modules/auth/auth.store';

const BASE_SVG = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function MenuIcon() {
  return (
    <svg {...BASE_SVG} width={20} height={20} aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg {...BASE_SVG} width={20} height={20} aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function AppLayout() {
  const isDesktop = useIsDesktop();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const isInvitee = useIsCurrentFarmInvitee();

  // Trouver l'item actif pour le titre header mobile
  const activeItem = NAV_ITEMS.find((i) => location.pathname.startsWith(i.path));

  // Route guard mode invité : redirige vers /travaux si on tente d'accéder
  // à un module non autorisé (carnet, fumure, troupeau, paramètres, rh).
  if (isInvitee && !isInviteeAllowedPath(location.pathname)) {
    return <Navigate to="/travaux" replace />;
  }

  return (
    <FabProvider>
      <InterventionFormProvider>
        <div className="grid h-screen grid-cols-1 md:grid-cols-[256px_1fr]">
          {/* Sidebar desktop (toujours visible) */}
          {isDesktop && <Sidebar />}

          {/* Drawer mobile (overlay) — z-[1100] pour passer au-dessus de Leaflet (panes ~700). */}
          {!isDesktop && drawerOpen && (
            <div className="fixed inset-0 z-[1100] flex">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setDrawerOpen(false)}
                aria-hidden="true"
              />
              <div className="relative h-full w-64 bg-(--color-surface) shadow-(--shadow-popup)">
                <Sidebar onNavigate={() => setDrawerOpen(false)} />
              </div>
            </div>
          )}

          <div className="flex h-screen flex-col overflow-hidden">
            {/* Header mobile (avec burger) */}
            {!isDesktop && (
              <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-(--color-border) bg-(--color-surface) px-4">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Ouvrir le menu"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-(--radius-sm) text-(--color-text) hover:bg-[#f1f1ee]"
                >
                  <MenuIcon />
                </button>
                <h1 className="m-0 flex-1 text-base font-semibold">
                  {activeItem?.label ?? 'AgriQodo'}
                </h1>
                <img src="/agriqodo-mark.svg" alt="Qodo" className="h-7 w-7" />
              </header>
            )}

            {/* Contenu principal */}
            <main className="flex-1 overflow-y-auto bg-(--color-bg)">
              <Outlet />
            </main>
          </div>

          {/* FAB global (speed dial) — key au pathname pour reset à chaque navigation */}
          <Fab key={location.pathname} />
          <NoticeHost />
        </div>
      </InterventionFormProvider>
    </FabProvider>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const isInvitee = useIsCurrentFarmInvitee();
  const visibleItems = isInvitee ? NAV_ITEMS.filter((i) => i.inviteeAllowed !== false) : NAV_ITEMS;
  return (
    <nav
      aria-label="Navigation principale"
      className="flex h-full flex-col border-r border-(--color-border) bg-(--color-surface)"
    >
      {/* Logo header */}
      <div className="flex h-16 items-center gap-2.5 border-b border-(--color-border) px-4">
        <img src="/agriqodo-mark.svg" alt="" className="h-9 w-9" />
        <span className="wordmark-agriqodo text-lg text-(--color-text)">AgriQodo</span>
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Fermer le menu"
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-(--radius-sm) text-(--color-muted) hover:bg-[#f1f1ee] hover:text-(--color-text)"
          >
            <XIcon />
          </button>
        )}
      </div>

      {/* Items — filtrés selon le rôle (invitee voit moins de modules) */}
      <ul className="m-0 flex-1 list-none space-y-0.5 overflow-y-auto p-3">
        {isInvitee && (
          <li className="mb-2 rounded-(--radius-sm) bg-[#fef3c7] px-3 py-2 text-[10px] font-medium text-[#92400e]">
            Mode invité — vous voyez uniquement la carte et vos travaux pour tiers.
          </li>
        )}
        {visibleItems.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  'flex h-10 items-center gap-2.5 rounded-(--radius-sm) px-3 text-sm font-medium',
                  'transition-colors',
                  isActive
                    ? 'bg-(--color-primary)/10 text-(--color-primary)'
                    : 'text-(--color-text) hover:bg-[#f5f5f0]',
                ].join(' ')
              }
            >
              <ItemIcon item={item} />
              <span>{item.label}</span>
              {item.badge && (
                <span className="ml-auto rounded-(--radius-pill) bg-(--color-accent)/12 px-1.5 py-0.5 text-[10px] font-semibold text-(--color-accent)">
                  {item.badge}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Footer : sélecteur d'exploitation + bouton déconnexion */}
      <div className="border-t border-(--color-border) p-3">
        <FarmSwitcher />
        <LogoutButton />
      </div>
    </nav>
  );
}

function LogoutButton() {
  const { mode, email } = useAuth();
  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };
  if (mode === 'demo') {
    return (
      <button
        type="button"
        onClick={handleLogout}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-xs font-medium text-(--color-muted) hover:bg-(--color-bg) hover:text-(--color-text)"
        title="Quitter la démo et revenir à l'écran de connexion"
      >
        <svg {...BASE_SVG} width={14} height={14} aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Quitter la démo
      </button>
    );
  }
  if (mode === 'authenticated') {
    return (
      <button
        type="button"
        onClick={handleLogout}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-xs font-medium text-(--color-muted) hover:bg-(--color-bg) hover:text-(--color-text)"
        title={email ? `Déconnecter ${email}` : 'Se déconnecter'}
      >
        <svg {...BASE_SVG} width={14} height={14} aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Se déconnecter
      </button>
    );
  }
  return null;
}

function ItemIcon({ item }: { item: NavItem }) {
  return (
    <svg {...BASE_SVG} width={18} height={18} aria-hidden="true">
      {item.icon}
    </svg>
  );
}
