"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { usePartnerLinks } from "@/lib/partner-links";

interface Option {
  id: string;
  nom: string;
  code: string;
  canton: string;
}

export interface PartenaireSelectProps {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Dropdown searchable des partenaires (= clients potentiels) liés activement
 * à l'exploitation courante. Si aucun partenaire actif → CTA vers /partenaires.
 */
export function PartenaireSelect({
  value,
  onChange,
  placeholder,
  disabled,
}: PartenaireSelectProps) {
  const links = usePartnerLinks();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Partenaires actifs côté "owner" et "partner" (toutes les exploitations
  // avec qui on a un lien actif sont candidats clients).
  const options: Option[] = useMemo(() => {
    return (links.data ?? [])
      .filter((l) => l.status === "ACTIVE")
      .map((l) => ({
        id: l.partner.id,
        nom: l.partner.nom,
        code: l.partner.code,
        canton: l.partner.canton,
      }));
  }, [links.data]);

  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.nom.toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q) ||
        o.canton.toLowerCase().includes(q),
    );
  }, [options, search]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const labelText = selected
    ? `${selected.nom} (${selected.code})`
    : (placeholder ?? "Choisir un client…");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span className={cn("truncate text-left", !selected && "text-foreground/40")}>
          {labelText}
        </span>
        <ChevronDown className="h-4 w-4 flex-shrink-0 text-foreground/60" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-hidden rounded-lg border border-border bg-background shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 text-foreground/40" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un client…"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground/60 hover:bg-muted"
              >
                — Aucun client (interne) —
              </button>
            )}
            {links.isLoading ? (
              <p className="p-3 text-sm text-foreground/50">Chargement…</p>
            ) : filtered.length === 0 ? (
              <div className="p-3 text-sm">
                {options.length === 0 ? (
                  <>
                    <p className="mb-2 text-foreground/60">Aucun client actif lié.</p>
                    <Link
                      href="/partenaires"
                      className="inline-flex items-center text-sm text-green underline"
                    >
                      Inviter un partenaire →
                    </Link>
                  </>
                ) : (
                  <p className="text-foreground/50">Aucun résultat.</p>
                )}
              </div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                    value === o.id && "bg-green/5",
                  )}
                >
                  <span>
                    <span className="block font-medium">{o.nom}</span>
                    <span className="block font-mono text-xs text-foreground/50">
                      {o.code} · {o.canton}
                    </span>
                  </span>
                  {value === o.id && <Check className="h-4 w-4 text-green" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
