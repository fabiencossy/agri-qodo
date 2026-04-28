"use client";

import { BarChart3, Home, type LucideIcon, MapPin, Sprout } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

interface Tab {
  href: Route;
  label: string;
  icon: LucideIcon;
}

const TABS: Tab[] = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/parcelles", label: "Parcelles", icon: MapPin },
  { href: "/interventions", label: "Carnet", icon: Sprout },
  { href: "/stats", label: "Stats", icon: BarChart3 },
];

/**
 * Onglets sticky visibles sur mobile/tablet.
 * Sur desktop (lg+), la sidebar fournit la navigation complète.
 */
export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-14 z-20 border-b border-border bg-background lg:hidden">
      <div className="flex">
        {TABS.map((tab) => {
          const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? "border-green text-green"
                  : "border-transparent text-foreground/60 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
