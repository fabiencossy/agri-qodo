"use client";

/**
 * Sélecteur de produit avec recherche full-text + création inline.
 *
 * Comportement :
 * - **Desktop** : popover dropdown sous le champ de recherche.
 * - **Mobile** (<sm) : bottom sheet plein écran pour profiter de l'espace
 *   tactile (un dropdown étriqué sur mobile, c'est inutilisable).
 * - **Recherche** : filtre `libelle + marque + fournisseur + especeCode`
 *   en local (les produits du tenant + catalogue global rentrent dans
 *   un seul fetch React Query, < 200 entrées en MVP).
 * - **Création inline** : si la recherche ne matche aucun produit,
 *   un bouton "Créer ‹requête› comme nouveau produit" apparaît en bas
 *   de la liste. Au clic → POST /api/produits puis sélection auto.
 *
 * Conçu réutilisable : on prend une `categorie` cible (SEMENCE, ENGRAIS_*,
 * PHYTO) qui filtre côté serveur ET pré-remplit la création.
 */
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CATEGORIE_LABEL,
  type CreateProduitInput,
  type Produit,
  type ProduitCategorie,
  type ProduitUnite,
  UNITE_LABEL,
  useCreateProduit,
  useProduits,
} from "@/lib/produits";

interface ProduitSearchSelectProps {
  /** Catégorie filtrée (recherche + création). */
  categorie: ProduitCategorie;
  /** ID Produit sélectionné, ou vide. */
  value: string;
  onChange: (produitId: string, produit: Produit | null) => void;
  /** Placeholder de la barre de recherche (ex "Choisir une semence…"). */
  placeholder?: string;
  /** Si true, toggle requis avant clic pour ne pas perdre la valeur. */
  required?: boolean;
  /** Si fourni, restreint l'unité par défaut à la création (ex KG pour semences). */
  defaultUnite?: ProduitUnite;
}

export function ProduitSearchSelect({
  categorie,
  value,
  onChange,
  placeholder = "Rechercher un produit…",
  required: _required,
  defaultUnite,
}: ProduitSearchSelectProps) {
  const produits = useProduits(categorie);
  const createMutation = useCreateProduit();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null!);

  // Détection mobile via media query (Tailwind sm = 640px). Un état React
  // plutôt qu'un className conditionnel pour pouvoir piloter le focus +
  // empêcher le scroll body en mode bottom sheet.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Click outside pour fermer (desktop uniquement).
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

  // Bloquer scroll body quand bottom sheet ouvert.
  useEffect(() => {
    if (!open || !isMobile) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = orig;
    };
  }, [open, isMobile]);

  // Auto-focus l'input à l'ouverture.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const selected = useMemo(
    () => produits.data?.find((p) => p.id === value) ?? null,
    [produits.data, value],
  );

  const filtered = useMemo(() => {
    const list = produits.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list.slice().sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
    return list
      .filter((p) => {
        const haystack = [p.libelle, p.marque ?? "", p.fournisseur ?? "", p.especeCode ?? ""]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
  }, [produits.data, query]);

  const handleSelect = (p: Produit) => {
    onChange(p.id, p);
    setOpen(false);
    setQuery("");
  };

  const handleCreate = async () => {
    const libelle = query.trim();
    if (!libelle) return;
    const input: CreateProduitInput = {
      categorie,
      libelle,
      ...(defaultUnite ? { unite: defaultUnite } : {}),
    };
    try {
      const created = await createMutation.mutateAsync(input);
      handleSelect(created);
    } catch {
      // L'erreur reste affichée par le mutation state ; on ne ferme pas
      // pour que l'utilisateur puisse retry / corriger.
    }
  };

  const triggerLabel = selected ? selected.libelle : value ? "Chargement…" : placeholder;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center justify-between rounded-lg border border-border bg-background px-3 text-left text-base transition-colors hover:bg-muted"
      >
        <span className={`flex-1 truncate ${selected ? "" : "text-foreground/40"}`}>
          {triggerLabel}
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
                isLoading={produits.isLoading}
                selectedId={value}
                onSelect={handleSelect}
                onCreate={handleCreate}
                createPending={createMutation.isPending}
                createError={
                  createMutation.isError
                    ? createMutation.error instanceof Error
                      ? createMutation.error.message
                      : "Création échouée"
                    : null
                }
                categorieLabel={CATEGORIE_LABEL[categorie]}
                {...(defaultUnite ? { defaultUnite } : {})}
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
              isLoading={produits.isLoading}
              selectedId={value}
              onSelect={handleSelect}
              onCreate={handleCreate}
              createPending={createMutation.isPending}
              createError={
                createMutation.isError
                  ? createMutation.error instanceof Error
                    ? createMutation.error.message
                    : "Création échouée"
                  : null
              }
              categorieLabel={CATEGORIE_LABEL[categorie]}
              {...(defaultUnite ? { defaultUnite } : {})}
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
            Choisir un produit
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
  onCreate,
  createPending,
  createError,
  categorieLabel,
  defaultUnite,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  filtered: Produit[];
  isLoading: boolean;
  selectedId: string;
  onSelect: (p: Produit) => void;
  onCreate: () => void;
  createPending: boolean;
  createError: string | null;
  categorieLabel: string;
  defaultUnite?: ProduitUnite;
}) {
  const trimmed = query.trim();
  const noMatch = trimmed.length > 0 && filtered.length === 0;
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
            placeholder={`Rechercher dans ${categorieLabel.toLowerCase()}…`}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement du catalogue…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-foreground/60">
              {trimmed
                ? `Aucun produit ne correspond à "${trimmed}".`
                : "Le catalogue est vide pour cette catégorie."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted ${
                    p.id === selectedId ? "bg-green/5" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.libelle}</p>
                    <p className="mt-0.5 truncate text-xs text-foreground/60">
                      {[p.marque, p.fournisseur, p.especeCode].filter(Boolean).join(" · ") ||
                        UNITE_LABEL[p.unite]}
                    </p>
                  </div>
                  {p.id === selectedId && (
                    <Check className="mt-1 h-4 w-4 flex-shrink-0 text-green" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(noMatch || trimmed.length > 0) && (
        <div className="border-t border-border bg-muted/30 p-3">
          {createError && (
            <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {createError}
            </p>
          )}
          <Button
            type="button"
            onClick={onCreate}
            disabled={createPending || !trimmed}
            className="w-full"
          >
            {createPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Créer "{trimmed}" comme nouveau {categorieLabel.toLowerCase().replace(/s$/, "")}
            {defaultUnite ? ` (${UNITE_LABEL[defaultUnite]})` : ""}
          </Button>
          <p className="mt-2 text-center text-xs text-foreground/50">
            Tu pourras compléter la fiche (marque, taux N/P/K, fournisseur) plus tard depuis
            Catalogue produits.
          </p>
        </div>
      )}
    </div>
  );
}
