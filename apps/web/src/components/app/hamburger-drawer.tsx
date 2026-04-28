"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { NavContent } from "./nav-content";

export function HamburgerDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  // Ferme automatiquement à chaque changement de route
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  // Échap pour fermer
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <button
          aria-label="Fermer le menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside
        aria-hidden={!open}
        className={`fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-border bg-background shadow-xl transition-transform duration-200 lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <Link href="/" className="text-lg font-bold text-green">
            🌱 Agri Qodo
          </Link>
          <button onClick={onClose} aria-label="Fermer" className="rounded-md p-1.5 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </header>
        <NavContent />
      </aside>
    </>
  );
}
