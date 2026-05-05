"use client";

/**
 * Menu kebab (3 points) affiché en mode édition d'une activité.
 * Propose les actions transverses : "Marquer comme terminé" et
 * "Supprimer" avec confirmation. Conçu pour être placé en haut à droite
 * du formulaire de saisie en mode édition.
 */
import { CheckCircle2, Loader2, MoreVertical, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function EditActionsMenu({
  onComplete,
  onDelete,
  completeLabel = "Marquer comme terminé",
  completing,
  deleting,
  showComplete = true,
  showDelete = true,
}: {
  onComplete?: () => void;
  onDelete: () => void;
  completeLabel?: string;
  completing?: boolean;
  deleting?: boolean;
  showComplete?: boolean;
  showDelete?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Plus d'actions"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background hover:bg-muted"
      >
        <MoreVertical className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-background shadow-xl">
          {showComplete && onComplete && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onComplete();
              }}
              disabled={completing}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
            >
              {completing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {completeLabel}
            </button>
          )}
          {showDelete && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                if (confirm("Supprimer cette saisie ? Cette action est irréversible.")) {
                  onDelete();
                }
              }}
              disabled={deleting}
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-900/20"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
