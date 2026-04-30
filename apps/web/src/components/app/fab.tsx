"use client";

import {
  Beef,
  Briefcase,
  ClipboardList,
  Clock,
  type LucideIcon,
  MapPin,
  Plus,
  Sprout,
  X,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface FabAction {
  href: Route;
  label: string;
  description?: string;
  icon: LucideIcon;
  color?: string;
}

/**
 * Action principale par route. Affichée en grand carré au top de l'overlay.
 * Le préfixe le plus long match en priorité (ex: /animaux/[id] → /animaux).
 */
const PRIMARY_ACTION_BY_ROUTE: Record<string, FabAction> = {
  "/parcelles": {
    href: "/parcelles/new",
    label: "Nouvelle parcelle",
    description: "Dessiner une nouvelle parcelle sur la carte",
    icon: MapPin,
    color: "bg-emerald-100 text-emerald-700",
  },
  "/interventions": {
    href: "/interventions/new",
    label: "Saisir une intervention",
    description: "Semis, fumure, phyto, récolte…",
    icon: Sprout,
    color: "bg-green-100 text-green-700",
  },
  "/animaux": {
    href: "/animaux",
    label: "Importer BDTA",
    description: "Importer le CSV BDTA / Identitas",
    icon: Beef,
    color: "bg-amber-100 text-amber-700",
  },
  "/srpa": {
    href: "/srpa/new",
    label: "Saisir une sortie SRPA",
    description: "Pâturage du jour",
    icon: ClipboardList,
    color: "bg-sky-100 text-sky-700",
  },
  "/travaux": {
    href: "/travaux/new",
    label: "Saisir un travail",
    description: "Travail facturable ou interne",
    icon: Briefcase,
    color: "bg-violet-100 text-violet-700",
  },
  "/mes-heures": {
    href: "/travaux/new",
    label: "Saisir des heures",
    description: "Via un travail (timesheet)",
    icon: Clock,
    color: "bg-indigo-100 text-indigo-700",
  },
};

const ALL_ACTIONS: FabAction[] = [
  {
    href: "/interventions/new",
    label: "Intervention",
    icon: Sprout,
    color: "bg-green-100 text-green-700",
  },
  {
    href: "/parcelles/new",
    label: "Parcelle",
    icon: MapPin,
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    href: "/travaux/new",
    label: "Travail",
    icon: Briefcase,
    color: "bg-violet-100 text-violet-700",
  },
  {
    href: "/srpa/new",
    label: "Sortie SRPA",
    icon: ClipboardList,
    color: "bg-sky-100 text-sky-700",
  },
  {
    href: "/animaux",
    label: "Cheptel BDTA",
    icon: Beef,
    color: "bg-amber-100 text-amber-700",
  },
  { href: "/mes-heures", label: "Mes heures", icon: Clock, color: "bg-indigo-100 text-indigo-700" },
];

function findPrimary(pathname: string): FabAction | null {
  const matches = Object.entries(PRIMARY_ACTION_BY_ROUTE)
    .filter(([route]) => pathname.startsWith(route))
    .sort((a, b) => b[0].length - a[0].length);
  return matches[0]?.[1] ?? null;
}

export function Fab() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const primary = findPrimary(pathname);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const secondary = ALL_ACTIONS.filter((a) => a.href !== primary?.href);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-30">
        <button
          onClick={() => setOpen(!open)}
          aria-label={open ? "Fermer le menu d'actions" : "Ouvrir le menu d'actions"}
          aria-expanded={open}
          className={`flex h-16 w-16 items-center justify-center rounded-full bg-green text-white shadow-xl transition-transform duration-200 hover:bg-green-dark hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2 ${
            open ? "rotate-[135deg]" : "rotate-0"
          }`}
        >
          <Plus className="h-7 w-7" />
        </button>
      </div>

      {mounted && open && (
        <div
          className="fixed inset-0 z-[7500] flex items-end justify-center bg-black/50 backdrop-blur-sm lg:items-center"
          onClick={() => setOpen(false)}
          style={{ animation: "fadeIn 200ms ease-out" }}
        >
          <div
            className="w-full max-w-2xl rounded-t-3xl bg-background p-4 shadow-2xl sm:p-6 lg:rounded-3xl lg:mx-4"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "slideUp 250ms cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {primary ? "Action rapide" : "Que veux-tu créer ?"}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 hover:bg-muted"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {primary && (
              <Link
                href={primary.href}
                onClick={() => setOpen(false)}
                className={`mb-4 flex items-start gap-4 rounded-2xl border-2 border-green/30 ${primary.color ?? "bg-green/5"} p-5 transition-colors hover:border-green hover:brightness-95 active:scale-[0.99]`}
              >
                <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-background shadow-sm">
                  <primary.icon className="h-7 w-7" />
                </span>
                <span className="flex-1">
                  <span className="block text-lg font-bold">{primary.label}</span>
                  {primary.description && (
                    <span className="mt-0.5 block text-sm opacity-80">{primary.description}</span>
                  )}
                </span>
                <span className="self-center text-xl">→</span>
              </Link>
            )}

            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/50">
              {primary ? "Autres saisies" : "Toutes les saisies"}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {secondary.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={`${action.href}-${action.label}`}
                    href={action.href}
                    onClick={() => setOpen(false)}
                    className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-border ${action.color ?? "bg-muted/30"} p-4 text-center transition-all hover:border-foreground/20 hover:shadow-md active:scale-95`}
                  >
                    <Icon className="h-7 w-7" />
                    <span className="text-sm font-medium">{action.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
