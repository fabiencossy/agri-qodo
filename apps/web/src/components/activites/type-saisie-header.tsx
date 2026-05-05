"use client";

import { Sprout, Tractor, Wrench, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type TypeSaisie = "carnet" | "tiers" | "interne";

interface Onglet {
  type: TypeSaisie;
  href: string;
  label: string;
  icon: typeof Sprout;
}

const ONGLETS: Onglet[] = [
  { type: "carnet", href: "/interventions/new", label: "Carnet", icon: Sprout },
  { type: "tiers", href: "/travaux/new?interne=false", label: "Tiers", icon: Tractor },
  { type: "interne", href: "/travaux/new?interne=true", label: "Interne", icon: Wrench },
];

export function TypeSaisieHeader({
  active,
  closeHref = "/activites",
}: {
  active: TypeSaisie;
  closeHref?: string;
}) {
  const router = useRouter();
  return (
    <div className="relative mb-6 flex items-center justify-center">
      <div
        role="tablist"
        aria-label="Type de saisie"
        className="flex items-center gap-1 rounded-full bg-muted p-1"
      >
        {ONGLETS.map((o) => {
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
