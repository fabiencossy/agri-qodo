"use client";

import { useState } from "react";
import { Fab } from "./fab";
import { HamburgerDrawer } from "./hamburger-drawer";
import { NavTabs } from "./nav-tabs";
import { TopBar } from "./top-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <>
      <HamburgerDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="flex min-h-screen flex-col">
        <TopBar onMenuClick={() => setDrawerOpen(true)} />
        <NavTabs />
        <main className="flex-1">{children}</main>
        <Fab />
      </div>
    </>
  );
}
