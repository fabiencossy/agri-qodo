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
import { Check, Crosshair, Loader2, MapPin, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  type AccessibleParcelle,
  useCreateQuickParcelle,
  useParcellesAccessibles,
} from "@/lib/parcelles";

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
        <QuickCreatePanel onCreated={onSelect} onClose={onClose} />
        <Link
          href="/parcelles/new"
          onClick={onClose}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground/60 transition-colors hover:bg-muted"
        >
          Créer avec géométrie cadastrale (GeoJSON / carte) →
        </Link>
      </div>
    </div>
  );
}

/**
 * Mini formulaire inline de création rapide de parcelle (nom + surface
 * + point GPS). Pour les clients Odoo non-partenaires qui n'ont pas
 * dessiné leurs parcelles. Le polygone précis sera ajouté plus tard
 * via la fiche /parcelles/[id].
 */
function QuickCreatePanel({
  onCreated,
  onClose,
}: {
  onCreated: (p: AccessibleParcelle) => void;
  onClose: () => void;
}) {
  const create = useCreateQuickParcelle();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    nom: "",
    surfaceHa: "",
    lat: "",
    lng: "",
  });
  const [geoLoading, setGeoLoading] = useState(false);

  function locate() {
    if (!navigator.geolocation) {
      alert("Géolocalisation indisponible sur ce navigateur.");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDraft((d) => ({
          ...d,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        }));
        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
        alert("Impossible de récupérer ta position.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function submit() {
    const surfaceHa = Number(draft.surfaceHa);
    if (!draft.nom.trim() || !(surfaceHa > 0)) {
      alert("Renseigne un nom et une surface en hectares.");
      return;
    }
    try {
      const created = await create.mutateAsync({
        nom: draft.nom.trim(),
        surfaceM2: Math.round(surfaceHa * 10_000),
        ...(draft.lat ? { centreLat: Number(draft.lat) } : {}),
        ...(draft.lng ? { centreLng: Number(draft.lng) } : {}),
      });
      // Adapter en AccessibleParcelle (le hook renvoie Parcelle, on
      // fabrique la forme attendue côté caller — les champs absents sont
      // récupérés au prochain refetch de useParcellesAccessibles).
      onCreated({
        id: created.id,
        nom: created.nom,
        surfaceM2: String(created.surfaceM2),
        zone: created.zone,
        identifiantCadastral: created.identifiantCadastral ?? null,
        isOwn: true,
        tenant: { id: "", nom: "", code: "", canton: "" },
      } as unknown as AccessibleParcelle);
      setDraft({ nom: "", surfaceHa: "", lat: "", lng: "" });
      setOpen(false);
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Création échouée.");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-green bg-background px-3 py-2 text-sm font-semibold text-green transition-colors hover:bg-green/10"
      >
        <Plus className="h-4 w-4" />
        Créer une parcelle rapide (surface + GPS)
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">
          Nouvelle parcelle
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Annuler"
          className="rounded-full p-1 text-foreground/50 hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <input
        autoFocus
        value={draft.nom}
        onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
        placeholder="Nom de la parcelle *"
        className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
      />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={draft.surfaceHa}
          onChange={(e) => setDraft({ ...draft, surfaceHa: e.target.value })}
          placeholder="Surface (ha) *"
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
        />
        <span className="flex h-9 items-center justify-center rounded-md border border-border bg-muted/30 px-2 text-xs font-medium text-foreground/60">
          ha
        </span>
      </div>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <input
          type="number"
          step="0.000001"
          inputMode="decimal"
          value={draft.lat}
          onChange={(e) => setDraft({ ...draft, lat: e.target.value })}
          placeholder="Latitude"
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
        />
        <input
          type="number"
          step="0.000001"
          inputMode="decimal"
          value={draft.lng}
          onChange={(e) => setDraft({ ...draft, lng: e.target.value })}
          placeholder="Longitude"
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
        />
        <button
          type="button"
          onClick={locate}
          disabled={geoLoading}
          aria-label="Utiliser ma position GPS"
          title="Utiliser ma position GPS actuelle"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background hover:bg-muted disabled:opacity-50"
        >
          {geoLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Crosshair className="h-4 w-4" />
          )}
        </button>
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={create.isPending || !draft.nom.trim() || !draft.surfaceHa}
        className="flex w-full items-center justify-center gap-1.5 rounded-md bg-green py-2 text-sm font-semibold text-white hover:bg-green-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Créer et sélectionner
      </button>
    </div>
  );
}
