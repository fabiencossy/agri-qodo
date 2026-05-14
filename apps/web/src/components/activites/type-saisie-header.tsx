"use client";

import { Sprout, Tractor, Wrench, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type TypeSaisie = "carnet" | "tiers" | "interne";

interface Onglet {
  type: Exclude<TypeSaisie, "carnet">;
  href: string;
  label: string;
  icon: typeof Sprout;
}

const ONGLETS_TRAVAIL: Onglet[] = [
  { type: "tiers", href: "/travaux/new?interne=false", label: "Tiers", icon: Tractor },
  { type: "interne", href: "/travaux/new?interne=true", label: "Interne", icon: Wrench },
];

/**
 * Header de saisie au-dessus des formulaires Carnet (`/interventions/new`)
 * et Travail (`/travaux/new`).
 *
 * - `active="carnet"` : affiche juste un libellé statique "Carnet des champs"
 *   (pas de toggle — il n'y a qu'un seul type de saisie côté Carnet).
 * - `active="tiers" | "interne"` : affiche un toggle Tiers / Interne pour
 *   basculer entre les deux variantes de Travail.
 *
 * Décision Fabien 2026-05-14 : pas de toggle global Carnet ↔ Travail — la
 * séparation se fait au niveau de la nav et du FAB.
 */
export function TypeSaisieHeader({
  active,
  closeHref = "/activites",
}: {
  active: TypeSaisie;
  closeHref?: string;
}) {
  const router = useRouter();

  if (active === "carnet") {
    return (
      <div className="relative mb-6 flex items-center justify-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-green/10 px-4 py-2 text-sm font-semibold text-green-dark">
          <Sprout className="h-4 w-4" />
          Carnet des champs
        </span>
        <Link
          href={closeHref}
          aria-label="Fermer"
          className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full p-2 text-foreground/60 hover:bg-muted hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="relative mb-6 flex items-center justify-center">
      <div
        role="tablist"
        aria-label="Type de travail"
        className="flex items-center gap-1 rounded-full bg-muted p-1"
      >
        {ONGLETS_TRAVAIL.map((o) => {
          const Icon = o.icon;
          const isActive = o.type === active;
          return (
            <button
              key={o.type}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                if (!isActive) router.push(o.href);
              }}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-green text-white shadow-sm"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>
      <Link
        href={closeHref}
        aria-label="Fermer"
        className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full p-2 text-foreground/60 hover:bg-muted hover:text-foreground"
      >
        <X className="h-5 w-5" />
      </Link>
    </div>
  );
}
