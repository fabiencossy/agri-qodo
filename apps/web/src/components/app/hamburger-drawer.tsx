"use client";

import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Home,
  LogOut,
  type LucideIcon,
  MapPin,
  Sprout,
  X,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useCurrentTenant, useLogout } from "@/lib/auth";

interface DrawerLink {
  href: Route;
  label: string;
  icon: LucideIcon;
}

const NAVIGATION: DrawerLink[] = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/parcelles", label: "Parcelles", icon: MapPin },
  { href: "/interventions", label: "Carnet des champs", icon: Sprout },
  { href: "/srpa", label: "SRPA — sorties pâturage", icon: ClipboardList },
];

const PILOTAGE: DrawerLink[] = [
  { href: "/stats", label: "Statistiques", icon: BarChart3 },
  { href: "/veille", label: "Veille réglementaire", icon: BookOpen },
];

export function HamburgerDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const tenant = useCurrentTenant();
  const logout = useLogout();

  // Ferme automatiquement à chaque changement de route
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  // Échap pour fermer
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <button
          aria-label="Fermer le menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        />
      )}
      <aside
        aria-hidden={!open}
        className={`fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-border bg-background shadow-xl transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <Link href="/" className="text-lg font-bold text-green">
            🌱 Agri Qodo
          </Link>
          <button onClick={onClose} aria-label="Fermer" className="rounded-md p-1.5 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </header>

        {tenant.data && (
          <div className="border-b border-border px-4 py-3">
            <div className="text-sm font-medium">{tenant.data.nom}</div>
            <div className="font-mono text-xs text-foreground/50">{tenant.data.code}</div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-3">
          <DrawerSection title="Navigation">
            {NAVIGATION.map((link) => (
              <DrawerItem key={link.href} link={link} pathname={pathname} />
            ))}
          </DrawerSection>
          <DrawerSection title="Pilotage">
            {PILOTAGE.map((link) => (
              <DrawerItem key={link.href} link={link} pathname={pathname} />
            ))}
          </DrawerSection>
        </nav>

        <footer className="border-t border-border p-3">
          <button
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="flex w-full items-center gap-3 rounded-md p-2 text-sm text-foreground/70 hover:bg-muted disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            <span>{logout.isPending ? "Déconnexion…" : "Déconnexion"}</span>
          </button>
        </footer>
      </aside>
    </>
  );
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-foreground/40">
        {title}
      </h3>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function DrawerItem({ link, pathname }: { link: DrawerLink; pathname: string }) {
  const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
  const Icon = link.icon;
  return (
    <li>
      <Link
        href={link.href}
        className={`flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors ${
          isActive ? "bg-green/10 font-medium text-green" : "text-foreground/80 hover:bg-muted"
        }`}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span>{link.label}</span>
      </Link>
    </li>
  );
}
