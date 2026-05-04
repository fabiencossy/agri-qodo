"use client";

import {
  Beef,
  ClipboardList,
  Clock,
  type LucideIcon,
  MapPin,
  Plus,
  Sprout,
  Tractor,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";

interface FabAction {
  href: Route;
  label: string;
  description?: string;
  icon: LucideIcon;
}

/**
 * Quatre actions principales du module Activités (PRD fusion v0.2 §3.1) —
 * porte unique pour saisir une activité, identiques sur toutes les pages.
 * Tout le reste (parcelle, cheptel, SRPA) descend en accès secondaire
 * compact.
 */
const PRIMARY_INTERVENTION: FabAction = {
  href: "/interventions/new",
  label: "Carnet des champs",
  description: "Semis, fumure, phyto, récolte sur ma parcelle.",
  icon: Sprout,
};

const PRIMARY_TRAVAIL_TIERS: FabAction = {
  href: "/travaux/new?interne=false" as Route,
  label: "Travail pour tiers",
  description: "Prestation facturable chez un client.",
  icon: Tractor,
};

const PRIMARY_TRAVAIL_INTERNE: FabAction = {
  href: "/travaux/new?interne=true" as Route,
  label: "Travail interne",
  description: "Activité de mon exploitation à tracer (sans facturation).",
  icon: Wrench,
};

const PRIMARY_POINTAGE: FabAction = {
  href: "/presences",
  label: "Pointage simple",
  description: "Démarrer/arrêter un pointage horaire.",
  icon: Clock,
};

const SECONDARY_ACTIONS: FabAction[] = [
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
              <h2 className="text-lg font-bold">Que veux-tu saisir&nbsp;?</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 hover:bg-muted"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <PrimaryCard
                action={PRIMARY_INTERVENTION}
                accent="green"
                onClick={() => setOpen(false)}
              />
              <PrimaryCard
                action={PRIMARY_TRAVAIL_TIERS}
                accent="violet"
                onClick={() => setOpen(false)}
              />
              <PrimaryCard
                action={PRIMARY_TRAVAIL_INTERNE}
                accent="blue"
                onClick={() => setOpen(false)}
              />
              <PrimaryCard
                action={PRIMARY_POINTAGE}
                accent="amber"
                onClick={() => setOpen(false)}
              />
            </div>

            <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-foreground/50">
              Autres saisies
            </p>
            <div className="grid grid-cols-3 gap-2">
              {SECONDARY_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    onClick={() => setOpen(false)}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/30 p-3 text-center text-xs transition-all hover:border-foreground/20 hover:shadow-sm active:scale-95"
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

function PrimaryCard({
  action,
  accent,
  onClick,
}: {
  action: FabAction;
  accent: "green" | "violet" | "blue" | "amber";
  onClick: () => void;
}) {
  const Icon = action.icon;
  const stylesByAccent: Record<typeof accent, string> = {
    green: "border-green/30 bg-green/5 hover:border-green text-foreground",
    violet:
      "border-violet-300/60 bg-violet-50 hover:border-violet-500 text-foreground dark:bg-violet-950/30 dark:border-violet-800",
    blue: "border-blue-300/60 bg-blue-50 hover:border-blue-500 text-foreground dark:bg-blue-950/30 dark:border-blue-800",
    amber:
      "border-amber-300/60 bg-amber-50 hover:border-amber-500 text-foreground dark:bg-amber-950/30 dark:border-amber-800",
  };
  const iconBgByAccent: Record<typeof accent, string> = {
    green: "bg-green text-white",
    violet: "bg-violet-600 text-white",
    blue: "bg-blue-600 text-white",
    amber: "bg-amber-600 text-white",
  };
  const styles = stylesByAccent[accent];
  const iconBg = iconBgByAccent[accent];
  return (
    <Link
      href={action.href}
      onClick={onClick}
      className={`flex flex-col items-start gap-3 rounded-2xl border-2 p-5 transition-all hover:shadow-md active:scale-[0.99] ${styles}`}
    >
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm ${iconBg}`}
      >
        <Icon className="h-7 w-7" />
      </span>
      <span className="block">
        <span className="block text-base font-bold">{action.label}</span>
        {action.description && (
          <span className="mt-0.5 block text-xs text-foreground/70">{action.description}</span>
        )}
      </span>
    </Link>
  );
}
