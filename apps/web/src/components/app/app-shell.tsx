"use client";

import { useCallback, useState } from "react";
import { Fab } from "./fab";
import { HamburgerDrawer } from "./hamburger-drawer";
import { NavTabs } from "./nav-tabs";
import { Sidebar } from "./sidebar";
import { PartnerTenantBanner } from "./tenant-switcher";
import { TopBar } from "./top-bar";

/**
 * Layout responsive :
 *  - Desktop (lg+ ≥1024px) : Sidebar permanente à gauche, pas de hamburger.
 *  - Mobile / tablet (<lg) : Top bar + onglets sticky + drawer hamburger.
 *  - FAB visible partout, en bas à droite.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  // useCallback obligatoire : HamburgerDrawer a un useEffect dépendant de
  // onClose qui se ré-exécute à chaque render. Sans stabilité de la ref,
  // le drawer se referme immédiatement après ouverture.
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <HamburgerDrawer open={drawerOpen} onClose={closeDrawer} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={openDrawer} />
        <PartnerTenantBanner />
        <NavTabs />
        <main className="flex-1">{children}</main>
        <Fab />
      </div>
    </div>
  );
}
