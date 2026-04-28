"use client";

import { useState } from "react";
import { Fab } from "./fab";
import { HamburgerDrawer } from "./hamburger-drawer";
import { NavTabs } from "./nav-tabs";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

/**
 * Layout responsive :
 *  - Desktop (lg+ ≥1024px) : Sidebar permanente à gauche, pas de hamburger.
 *  - Mobile / tablet (<lg) : Top bar + onglets sticky + drawer hamburger.
 *  - FAB visible partout, en bas à droite.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <HamburgerDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setDrawerOpen(true)} />
        <NavTabs />
        <main className="flex-1">{children}</main>
        <Fab />
      </div>
    </div>
  );
}
