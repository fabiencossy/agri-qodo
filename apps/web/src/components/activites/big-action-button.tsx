"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";

/**
 * Gros bouton "+ Ajouter …" avec icône, libellé et résumé compact
 * du contenu actuel. Utilisé pour ouvrir les sheets plein écran
 * (TempsSheet, ProduitsSheet) dans les formulaires Carnet et Travaux.
 */
export function BigActionButton({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/20 p-4 text-left transition-colors hover:border-green hover:bg-green/5"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background text-foreground/70">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{label}</span>
        <span className="mt-0.5 block truncate text-xs text-foreground/60">{hint}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-foreground/40" />
    </button>
  );
}
