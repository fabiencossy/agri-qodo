"use client";

import { MoreVertical, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface PageMenuAction {
  label: string;
  icon?: LucideIcon;
  /** Soit un href, soit un onClick — pas les deux. */
  href?: Route;
  onClick?: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
}

export interface PageHeaderProps {
  /** Titre principal de la page (h1). */
  title: string;
  /** Icône à gauche du titre. */
  icon?: LucideIcon;
  /** Sous-titre court (compteur, info contextuelle). */
  subtitle?: React.ReactNode;
  /** Actions secondaires accessibles via menu kebab top-right. */
  menuActions?: PageMenuAction[];
  /** Slot custom à droite (toggle Liste/Carte par exemple). */
  rightSlot?: React.ReactNode;
}

/**
 * Header de page unifié — pattern Odoo/iOS :
 * - Titre + sous-titre à gauche
 * - Slot custom (ex: toggle vue) en haut à droite
 * - Menu kebab pour actions secondaires (Importer, Dupliquer, Sélectionner…)
 * L'action principale (Créer X) reste dans le FAB en bas à droite.
 */
export function PageHeader({
  title,
  icon: Icon,
  subtitle,
  menuActions,
  rightSlot,
}: PageHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const hasMenu = menuActions && menuActions.length > 0;

  return (
    <div className="mb-4 flex items-start justify-between gap-3 sm:mb-6">
      <div className="min-w-0 flex-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          {Icon && <Icon className="h-6 w-6 text-green sm:h-7 sm:w-7" />}
          <span className="truncate">{title}</span>
        </h1>
        {subtitle && <p className="mt-1 text-sm text-foreground/70">{subtitle}</p>}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {rightSlot}
        {hasMenu && (
          <div ref={ref} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Plus d'actions"
              aria-expanded={menuOpen}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground/70 transition-colors hover:bg-muted active:scale-95"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
                <ul className="py-1">
                  {menuActions.map((action, i) => {
                    const ItemIcon = action.icon;
                    const className = cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                      action.disabled
                        ? "cursor-not-allowed opacity-40"
                        : action.variant === "danger"
                          ? "text-red-700 hover:bg-red-50"
                          : "hover:bg-muted",
                    );
                    return (
                      <li key={i}>
                        {action.href && !action.disabled ? (
                          <Link
                            href={action.href}
                            onClick={() => setMenuOpen(false)}
                            className={className}
                          >
                            {ItemIcon && <ItemIcon className="h-4 w-4 flex-shrink-0" />}
                            <span>{action.label}</span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            disabled={action.disabled}
                            onClick={() => {
                              action.onClick?.();
                              setMenuOpen(false);
                            }}
                            className={cn(className, "w-full")}
                          >
                            {ItemIcon && <ItemIcon className="h-4 w-4 flex-shrink-0" />}
                            <span>{action.label}</span>
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
