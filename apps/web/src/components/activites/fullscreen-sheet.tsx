"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

/**
 * Wrapper plein écran réutilisable pour les "sheets" de saisie
 * (Ajouter du temps, Ajouter des produits, …). Pattern : header avec
 * X + titre, body scrollable, footer optionnel.
 */
export function FullscreenSheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[8000] flex flex-col bg-background"
      role="dialog"
      aria-label={title}
    >
      <header className="border-b border-border bg-background p-3 sm:p-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h2>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>
      </div>
      {footer && (
        <footer className="border-t border-border bg-background p-3 sm:p-4">
          <div className="mx-auto flex max-w-3xl justify-end gap-2">{footer}</div>
        </footer>
      )}
    </div>
  );
}
