"use client";

import { ArrowLeft, MoreVertical, Pencil, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface DetailMenuAction {
  label: string;
  icon?: LucideIcon;
  href?: Route;
  onClick?: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
}

export interface DetailHeaderProps {
  /** Titre principal — nom de la ressource (ex: "Champ du Bas", "Marguerite"). */
  title: string;
  /** Sous-titre court (ex: "3.84 ha · ZA · CH 120.1304.5689"). */
  subtitle?: React.ReactNode;
  /** URL de retour (back button). Si absent, utilise router.back(). */
  backHref?: Route;
  /** Icône / emoji devant le titre. */
  icon?: LucideIcon;
  /** Emoji ou ReactNode custom (priorité sur icon). */
  emoji?: React.ReactNode;
  /** Action principale "Modifier" — déclenche le mode édition. */
  onEdit?: () => void;
  /** Bouton custom à droite (remplace "Modifier"). */
  primaryAction?: React.ReactNode;
  /** Actions secondaires dans le menu kebab (Supprimer, Dupliquer, etc.). */
  menuActions?: DetailMenuAction[];
  /** Badges sous le titre (ex: statut, mort/vivant, BVD). */
  badges?: React.ReactNode;
}

/**
 * Header compact pour les pages détail. Pattern iOS/Material :
 * - Bouton back à gauche (collé au titre, pas une ligne séparée)
 * - Titre + sous-titre / badges en colonne
 * - Bouton "Modifier" et menu kebab à droite, alignés au titre
 *
 * Mobile-first : prend ~70px de haut au lieu des ~140px du header
 * "h1 + p + boutons en row sous le titre" qu'on avait avant.
 */
export function DetailHeader({
  title,
  subtitle,
  backHref,
  icon: Icon,
  emoji,
  onEdit,
  primaryAction,
  menuActions,
  badges,
}: DetailHeaderProps) {
  const router = useRouter();
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
    <div className="mb-4 flex items-start gap-2 sm:mb-6 sm:gap-3">
      {backHref ? (
        <Link
          href={backHref}
          aria-label="Retour"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-muted hover:text-foreground active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Retour"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-muted hover:text-foreground active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <h1 className="flex items-center gap-2 text-xl font-bold leading-tight sm:text-2xl">
          {emoji && (
            <span aria-hidden className="flex-shrink-0 text-2xl">
              {emoji}
            </span>
          )}
          {!emoji && Icon && <Icon className="h-5 w-5 flex-shrink-0 text-green sm:h-6 sm:w-6" />}
          <span className="truncate">{title}</span>
        </h1>
        {subtitle && <p className="mt-0.5 truncate text-sm text-foreground/60">{subtitle}</p>}
        {badges && <div className="mt-1.5 flex flex-wrap gap-1.5">{badges}</div>}
      </div>

      <div className="flex flex-shrink-0 items-center gap-1.5">
        {primaryAction ??
          (onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label="Modifier"
              className="flex h-10 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted active:scale-95"
            >
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Modifier</span>
            </button>
          ))}
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
