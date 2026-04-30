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
import { useEffect, useRef, useState } from "react";

interface Action {
  href: Route;
  label: string;
  icon: LucideIcon;
}

const ACTIONS: Action[] = [
  { href: "/interventions/new", label: "Saisir une intervention", icon: Sprout },
  { href: "/parcelles/new", label: "Nouvelle parcelle", icon: MapPin },
  { href: "/travaux/new", label: "Saisir un travail", icon: Briefcase },
  { href: "/mes-heures", label: "Mes heures", icon: Clock },
  { href: "/srpa/new", label: "Saisir une sortie SRPA", icon: ClipboardList },
  { href: "/animaux", label: "Cheptel / Importer BDTA", icon: Beef },
];

export function Fab() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Ferme au clic extérieur
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-3">
      {open &&
        ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-full border border-border bg-background py-2 pl-3 pr-5 shadow-md transition-colors hover:bg-muted"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green/10 text-green">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">{action.label}</span>
            </Link>
          );
        })}

      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? "Fermer le menu d'actions" : "Ouvrir le menu d'actions"}
        aria-expanded={open}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-green text-white shadow-lg transition-all hover:bg-green-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2"
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  );
}
