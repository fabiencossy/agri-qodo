"use client";

import {
  BarChart3,
  Beef,
  BookOpen,
  ClipboardList,
  Clock,
  Cog,
  FlaskConical,
  Handshake,
  Home,
  Layers,
  LogOut,
  type LucideIcon,
  MapPin,
  Package,
  Tractor,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useCurrentTenant, useLogout } from "@/lib/auth";
import { useOdooConnected } from "@/lib/odoo-config";
import { TenantSwitcher } from "./tenant-switcher";

interface NavLink {
  href: Route;
  label: string;
  icon: LucideIcon;
  /** Visible uniquement si Odoo est connecté (les data sont poussées vers Odoo). */
  requiresOdoo?: boolean;
}

const NAVIGATION: NavLink[] = [
  { href: "/app", label: "Accueil", icon: Home },
  { href: "/parcelles", label: "Parcelles", icon: MapPin },
  { href: "/activites", label: "Activités", icon: Tractor },
  { href: "/mes-heures", label: "Mes heures", icon: Clock },
  { href: "/animaux", label: "Cheptel", icon: Beef },
  { href: "/srpa", label: "SRPA — sorties pâturage", icon: ClipboardList },
];

const PILOTAGE: NavLink[] = [
  { href: "/assolement", label: "Plan d'assolement", icon: Layers },
  { href: "/suisse-bilanz", label: "Suisse-Bilanz", icon: FlaskConical },
  { href: "/stats", label: "Statistiques", icon: BarChart3 },
  { href: "/veille", label: "Veille réglementaire", icon: BookOpen },
];

const ADMINISTRATION: NavLink[] = [
  { href: "/utilisateurs", label: "Utilisateurs", icon: Users },
  { href: "/partenaires", label: "Partenaires", icon: Handshake },
  { href: "/produits", label: "Catalogue produits", icon: Package },
  { href: "/materiels", label: "Catalogue matériel", icon: Wrench },
  { href: "/parametres", label: "Paramètres", icon: Cog },
];

/**
 * Contenu de navigation partagé entre la sidebar desktop (lg+) et le
 * drawer hamburger (mobile/tablet).
 */
export function NavContent() {
  const pathname = usePathname();
  const tenant = useCurrentTenant();
  const logout = useLogout();
  const odoo = useOdooConnected();
  const visible = (link: NavLink) => !link.requiresOdoo || odoo.connected;

  return (
    <>
      <div className="border-b border-border p-3">
        <TenantSwitcher />
        {tenant.data && (
          <div className="mt-1.5 px-2 font-mono text-xs text-foreground/50">{tenant.data.code}</div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <NavSection title="Navigation">
          {NAVIGATION.filter(visible).map((link) => (
            <NavItem key={link.href} link={link} pathname={pathname} />
          ))}
        </NavSection>
        <NavSection title="Pilotage">
          {PILOTAGE.map((link) => (
            <NavItem key={link.href} link={link} pathname={pathname} />
          ))}
        </NavSection>
        <NavSection title="Administration">
          {ADMINISTRATION.map((link) => (
            <NavItem key={link.href} link={link} pathname={pathname} />
          ))}
        </NavSection>
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
    </>
  );
}

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-foreground/40">
        {title}
      </h3>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function NavItem({ link, pathname }: { link: NavLink; pathname: string }) {
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
