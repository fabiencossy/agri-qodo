"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useCurrentTenant } from "@/lib/auth";

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const tenant = useCurrentTenant();
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-full max-w-5xl items-center gap-3 px-4">
        <button
          onClick={onMenuClick}
          aria-label="Ouvrir le menu"
          className="rounded-md p-1.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/" className="text-lg font-bold text-green">
          🌱 Agri Qodo
        </Link>
        {tenant.data && (
          <span className="hidden truncate text-sm text-foreground/60 md:inline">
            · {tenant.data.nom}
          </span>
        )}
      </div>
    </header>
  );
}
