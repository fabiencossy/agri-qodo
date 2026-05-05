"use client";

import { Beef, ClipboardList, Clock, type LucideIcon, MapPin, Plus, Sprout, X } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";

interface SecondaryAction {
  href: Route;
  label: string;
  icon: LucideIcon;
}

/**
 * FAB porte unique (PRD fusion v0.2 §3.1).
 *
 * Click + → bottom-sheet avec :
 *   - 1 bouton primaire dominant : Nouvelle activité → /interventions/new
 *     (le choix Carnet / Tiers / Interne se fait via les onglets en haut
 *     de la page de saisie)
 *   - 4 boutons secondaires compacts : Pointage, Parcelle, SRPA, Cheptel
 */
const SECONDARY_ACTIONS: SecondaryAction[] = [
  { href: "/presences", label: "Pointage", icon: Clock },
  { href: "/parcelles/new", label: "Parcelle", icon: MapPin },
  { href: "/srpa/new", label: "Sortie SRPA", icon: ClipboardList },
  { href: "/animaux", label: "Cheptel BDTA", icon: Beef },
];

export function Fab() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

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

  return (
    <>
      <div className="fixed bottom-6 right-6 z-30">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Fermer le menu d'actions" : "Ouvrir le menu d'actions"}
          aria-expanded={open}
          className={`flex h-16 w-16 items-center justify-center rounded-full bg-green text-white shadow-xl transition-transform duration-200 hover:scale-105 hover:bg-green-dark active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2 ${
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
            className="w-full max-w-md rounded-t-3xl bg-background p-4 shadow-2xl sm:p-5 lg:rounded-3xl lg:mx-4"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "slideUp 250ms cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold">Que veux-tu saisir&nbsp;?</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 hover:bg-muted"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Action primaire dominante */}
            <Link
              href="/interventions/new"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-2xl border-2 border-green bg-green/5 p-4 transition-all hover:bg-green/10 hover:shadow-md active:scale-[0.99]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green text-white shadow-sm">
                <Sprout className="h-6 w-6" />
              </span>
              <span className="block">
                <span className="block text-base font-bold">Nouvelle activité</span>
                <span className="mt-0.5 block text-xs text-foreground/70">
                  Carnet, travail pour tiers ou interne — tu choisis sur la page suivante.
                </span>
              </span>
            </Link>

            <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
              Autres saisies
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SECONDARY_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    onClick={() => setOpen(false)}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/30 p-3 text-center text-xs font-medium transition-all hover:border-foreground/20 hover:bg-muted/50 active:scale-95"
                  >
                    <Icon className="h-5 w-5" />
                    <span>{action.label}</span>
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
