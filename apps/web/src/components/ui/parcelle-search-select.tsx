"use client";

/**
 * Sélecteur de parcelle avec recherche full-text.
 *
 * Même UX que ProduitSearchSelect (popover desktop / bottom sheet mobile)
 * mais sans création inline : créer une parcelle nécessite une géométrie
 * GeoJSON (import ou dessin), donc on redirige vers `/parcelles/new`.
 *
 * Filtre sur nom + identifiant cadastral + zone agricole.
 */
import { Check, Loader2, MapPin, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { type AccessibleParcelle, useParcellesAccessibles } from "@/lib/parcelles";

interface ParcelleSearchSelectProps {
  value: string;
  onChange: (parcelleId: string, parcelle: AccessibleParcelle | null) => void;
  placeholder?: string;
  required?: boolean;
  /** Si true, désactive le sélecteur (ex: pas de parcelle disponible). */
  disabled?: boolean;
  /** Filtre les parcelles à celles d'un tenant précis (= un client choisi en amont). */
  filtreTenantId?: string;
}

export function ParcelleSearchSelect({
  value,
  onChange,
  placeholder = "Choisir une parcelle…",
  required: _required,
  disabled,
  filtreTenantId,
}: ParcelleSearchSelectProps) {
  const parcelles = useParcellesAccessibles();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null!);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open || isMobile) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, isMobile]);

  useEffect(() => {
    if (!open || !isMobile) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = orig;
    };
  }, [open, isMobile]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const selected = useMemo(
    () => parcelles.data?.find((p) => p.id === value) ?? null,
    [parcelles.data, value],
  );

  const filtered = useMemo(() => {
    let list = parcelles.data ?? [];
    if (filtreTenantId) {
      list = list.filter((p) => p.tenantId === filtreTenantId);
    }
    const q = query.trim().toLowerCase();
    if (!q) return list.slice().sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    return list
      .filter((p) =>
        [p.nom, p.identifiantCadastral ?? "", p.zone].join(" ").toLowerCase().includes(q),
      )
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }, [parcelles.data, query, filtreTenantId]);

  const handleSelect = (p: AccessibleParcelle) => {
    onChange(p.id, p);
    setOpen(false);
    setQuery("");
  };

  const triggerLabel = selected ? selected.nom : value ? "Chargement…" : placeholder;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={`flex h-11 w-full items-center justify-between rounded-lg border border-border bg-background px-3 text-left text-base transition-colors ${
          disabled ? "cursor-not-allowed opacity-50" : "hover:bg-muted"
        }`}
      >
        <span className="flex items-center gap-2 truncate">
          {selected && <MapPin className="h-4 w-4 flex-shrink-0 text-foreground/50" />}
          <span className={`truncate ${selected ? "" : "text-foreground/40"}`}>{triggerLabel}</span>
          {selected?.identifiantCadastral && (
            <span className="ml-1 hidden truncate font-mono text-xs text-foreground/40 sm:inline">
              {selected.identifiantCadastral}
            </span>
          )}
        </span>
        <Search className="ml-2 h-4 w-4 flex-shrink-0 text-foreground/40" />
      </button>

      {open &&
        (isMobile ? (
          <BottomSheet
            onClose={() => setOpen(false)}
            children={
              <Panel
                query={query}
                onQueryChange={setQuery}
                inputRef={inputRef}
                filtered={filtered}
                isLoading={parcelles.isLoading}
                selectedId={value}
                onSelect={handleSelect}
                onClose={() => setOpen(false)}
              />
            }
          />
        ) : (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[420px] overflow-hidden rounded-xl border border-border bg-background shadow-xl">
            <Panel
              query={query}
              onQueryChange={setQuery}
              inputRef={inputRef}
              filtered={filtered}
              isLoading={parcelles.isLoading}
              selectedId={value}
              onSelect={handleSelect}
              onClose={() => setOpen(false)}
            />
          </div>
        ))}
    </div>
  );
}

function BottomSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full flex-col bg-background sm:hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
            Choisir une parcelle
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-muted"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

function Panel({
  query,
  onQueryChange,
  inputRef,
  filtered,
  isLoading,
  selectedId,
  onSelect,
  onClose,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  filtered: AccessibleParcelle[];
  isLoading: boolean;
  selectedId: string;
  onSelect: (p: AccessibleParcelle) => void;
  onClose: () => void;
}) {
  const trimmed = query.trim();
  return (
    <div className="flex h-full max-h-[80vh] flex-col">
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            ref={inputRef}
            className="pl-9"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Nom, EGRID, zone agricole…"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement des parcelles…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-foreground/60">
              {trimmed
                ? `Aucune parcelle ne correspond à "${trimmed}".`
                : "Pas encore de parcelle dans ton exploitation."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((p) => {
              const surfaceHa = Number(p.surfaceM2) / 10000;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(p)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted ${
                      p.id === selectedId ? "bg-green/5" : ""
                    }`}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground/50" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {p.nom}
                        {!p.isOwn && (
                          <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                            chez {p.tenant.nom}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-foreground/60">
                        {surfaceHa.toFixed(2)} ha · {p.zone}
                        {p.identifiantCadastral ? ` · ${p.identifiantCadastral}` : ""}
                      </p>
                    </div>
                    {p.id === selectedId && (
                      <Check className="mt-1 h-4 w-4 flex-shrink-0 text-green" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-border bg-muted/30 p-3">
        <Link
          href="/parcelles/new"
          onClick={onClose}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
          Créer une nouvelle parcelle
        </Link>
        <p className="mt-2 text-center text-xs text-foreground/50">
          Une parcelle nécessite une géométrie cadastrale (import GeoJSON ou dessin sur carte).
        </p>
      </div>
    </div>
  );
}
