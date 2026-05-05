"use client";

/**
 * Picker produit en overlay plein écran. Conçu pour les gros catalogues
 * où le dropdown est trop étroit. Click sur le bouton → modal full-screen
 * avec recherche large + chips de filtre catégorie + liste défilante.
 */
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORIE_LABEL,
  type Produit,
  type ProduitCategorie,
  UNITE_LABEL,
  useProduits,
} from "@/lib/produits";

const CATEGORIES_ORDER: ProduitCategorie[] = [
  "SEMENCE",
  "ENGRAIS_MINERAL",
  "ENGRAIS_ORGANIQUE",
  "PHYTO",
  "AUTRE",
];

export function ProduitFullscreenPicker({
  value,
  onChange,
  placeholder = "Choisir un produit…",
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const allProduits = useProduits();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filtreCat, setFiltreCat] = useState<ProduitCategorie | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const choisi: Produit | undefined = (allProduits.data ?? []).find((p) => p.id === value);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (allProduits.data ?? [])
      .filter((p) => (filtreCat ? p.categorie === filtreCat : true))
      .filter((p) =>
        !q
          ? true
          : [p.libelle, p.marque, p.fournisseur, p.especeCode, p.code]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(q),
      )
      .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
  }, [allProduits.data, query, filtreCat]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
      >
        <span className={`min-w-0 truncate ${choisi ? "" : "text-foreground/50"}`}>
          {choisi
            ? `${choisi.libelle} (${UNITE_LABEL[choisi.unite] ?? choisi.unite})`
            : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-foreground/50" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[8000] flex flex-col bg-background"
          role="dialog"
          aria-label="Choisir un produit"
        >
          {/* Header sticky */}
          <header className="border-b border-border bg-background p-3 sm:p-4">
            <div className="mx-auto flex max-w-3xl items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher par nom, marque, espèce, code…"
                  className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
                />
              </div>
            </div>
            <div className="mx-auto mt-2 flex max-w-3xl flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFiltreCat(null)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  filtreCat === null
                    ? "border-green bg-green text-white"
                    : "border-border bg-background text-foreground/60 hover:text-foreground"
                }`}
              >
                Toutes
              </button>
              {CATEGORIES_ORDER.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFiltreCat(filtreCat === c ? null : c)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    filtreCat === c
                      ? "border-green bg-green text-white"
                      : "border-border bg-background text-foreground/60 hover:text-foreground"
                  }`}
                >
                  {CATEGORIE_LABEL[c]}
                </button>
              ))}
            </div>
          </header>

          {/* Body scrollable */}
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-3 py-3 sm:px-4">
              {allProduits.isLoading ? (
                <p className="py-8 text-center text-sm text-foreground/60">Chargement…</p>
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
                  <p className="text-sm text-foreground/60">
                    {query ? `Aucun produit ne correspond à « ${query} ».` : "Catalogue vide."}
                  </p>
                  <p className="mt-1 text-xs text-foreground/50">
                    Crée des produits dans Paramètres → Catalogue produits.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border rounded-2xl border border-border bg-background">
                  {filtered.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(p.id);
                          setOpen(false);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold">{p.libelle}</span>
                            {p.id === value && (
                              <Check
                                className="h-4 w-4 shrink-0 text-green"
                                aria-label="Sélectionné"
                              />
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-foreground/60">
                            <span>{CATEGORIE_LABEL[p.categorie]}</span>
                            {p.marque && <span>· {p.marque}</span>}
                            {p.fournisseur && <span>· {p.fournisseur}</span>}
                            {p.especeCode && <span>· {p.especeCode}</span>}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-foreground/70">
                          {UNITE_LABEL[p.unite] ?? p.unite}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-center text-[11px] text-foreground/50">
                {filtered.length} produit{filtered.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
