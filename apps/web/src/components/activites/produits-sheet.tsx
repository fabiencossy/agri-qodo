"use client";

import { Check, Loader2, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { FullscreenSheet } from "@/components/activites/fullscreen-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOdooConnected } from "@/lib/odoo-config";
import {
  CATEGORIE_LABEL,
  CATEGORIES_ORDER,
  type Produit,
  type ProduitCategorie,
  UNITE_LABEL,
  useProduits,
  useSyncProduitsOdoo,
} from "@/lib/produits";

export interface ProduitLigne {
  uid: string;
  produitId: string;
  quantite: string;
}

/**
 * Modal plein écran "Ajouter des produits" — affiche directement le
 * catalogue avec barre de recherche + chips de filtres catégories.
 *
 * Décision Fabien 2026-05-14 :
 * - Renommer "matériel" → "produits"
 * - Voir tous les produits dès l'ouverture (pas de placeholder vide)
 * - Recherche + filtres catégories sélectionnables
 * - Ajout multi : click sur un produit l'ajoute à la liste, click à
 *   nouveau le retire. La quantité est saisissable inline sous chaque
 *   produit sélectionné.
 */
export function ProduitsSheet({
  lignes,
  onChange,
  onClose,
}: {
  lignes: ProduitLigne[];
  onChange: (lignes: ProduitLigne[]) => void;
  onClose: () => void;
}) {
  const allProduits = useProduits();
  const odoo = useOdooConnected();
  const syncOdoo = useSyncProduitsOdoo();
  const [query, setQuery] = useState("");
  const [filtreCat, setFiltreCat] = useState<ProduitCategorie | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSyncOdoo = () => {
    setSyncMsg(null);
    syncOdoo.mutate(undefined, {
      onSuccess: (r) => {
        setSyncMsg(
          `${r.created} créé${r.created > 1 ? "s" : ""}, ${r.updated} mis à jour${
            r.skipped > 0 ? `, ${r.skipped} ignoré${r.skipped > 1 ? "s" : ""}` : ""
          }.`,
        );
      },
      onError: (err) => {
        setSyncMsg(err instanceof Error ? err.message : "Sync échouée.");
      },
    });
  };

  const filtered: Produit[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (allProduits.data ?? [])
      .filter((p) => p.actif !== false)
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

  const idxByProduit = useMemo(() => {
    const m = new Map<string, number>();
    lignes.forEach((l, i) => {
      if (l.produitId) m.set(l.produitId, i);
    });
    return m;
  }, [lignes]);

  function genUid(): string {
    return Math.random().toString(36).slice(2, 10);
  }

  function toggleProduit(p: Produit) {
    const existing = idxByProduit.get(p.id);
    if (existing != null) {
      onChange(lignes.filter((_, i) => i !== existing));
    } else {
      onChange([...lignes, { uid: genUid(), produitId: p.id, quantite: "" }]);
    }
  }

  function updateQuantite(produitId: string, quantite: string) {
    onChange(lignes.map((l) => (l.produitId === produitId ? { ...l, quantite } : l)));
  }

  const totalSelectionnes = lignes.filter((l) => l.produitId).length;

  return (
    <FullscreenSheet
      title={
        totalSelectionnes > 0
          ? `Ajouter des produits (${totalSelectionnes} sélectionné${totalSelectionnes > 1 ? "s" : ""})`
          : "Ajouter des produits"
      }
      onClose={onClose}
      footer={
        <Button type="button" onClick={onClose} className="h-11 px-6">
          OK
        </Button>
      }
    >
      <div className="space-y-3">
        {/* Barre de recherche */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par nom, marque, espèce, code…"
            className="h-12 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
          />
        </div>

        {/* Chips filtres catégories */}
        <div className="flex flex-wrap gap-1.5">
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

        {/* Bandeau Odoo (sync catalogue) */}
        {odoo.connected && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span>
              Catalogue Odoo connecté.{" "}
              {syncMsg ? (
                <span className="font-semibold">{syncMsg}</span>
              ) : (
                "Importer les nouveaux produits ?"
              )}
            </span>
            <button
              type="button"
              onClick={handleSyncOdoo}
              disabled={syncOdoo.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-background px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syncOdoo.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {syncOdoo.isPending ? "Sync…" : "Synchroniser"}
            </button>
          </div>
        )}

        {/* Liste catalogue */}
        {allProduits.isLoading ? (
          <p className="py-8 text-center text-sm text-foreground/60">Chargement…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
            <p className="text-sm text-foreground/60">
              {query ? `Aucun produit ne correspond à « ${query} ».` : "Catalogue vide."}
            </p>
            <p className="mt-1 text-xs text-foreground/50">
              {odoo.connected
                ? "Clique sur « Synchroniser » ci-dessus pour importer ton catalogue Odoo."
                : "Crée des produits dans Paramètres → Catalogue produits."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-background">
            {filtered.map((p) => {
              const idx = idxByProduit.get(p.id);
              const selected = idx != null;
              const ligne = selected ? lignes[idx as number] : undefined;
              return (
                <li key={p.id} className="p-0">
                  <button
                    type="button"
                    onClick={() => toggleProduit(p)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      selected ? "bg-green/5" : "hover:bg-muted/30"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                        selected
                          ? "border-green bg-green text-white"
                          : "border-border bg-background text-foreground/50"
                      }`}
                    >
                      {selected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{p.libelle}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-foreground/60">
                        <span>{CATEGORIE_LABEL[p.categorie]}</span>
                        {p.marque && <span>· {p.marque}</span>}
                        {p.especeCode && <span>· {p.especeCode}</span>}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-foreground/70">
                      {UNITE_LABEL[p.unite] ?? p.unite}
                    </span>
                  </button>
                  {selected && ligne && (
                    <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-t border-border bg-muted/10 px-4 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={ligne.quantite}
                        onChange={(e) => updateQuantite(p.id, e.target.value)}
                        placeholder="Quantité"
                        className="h-10"
                        autoFocus
                      />
                      <span className="flex h-10 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground/70">
                        {UNITE_LABEL[p.unite] ?? p.unite}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleProduit(p)}
                        aria-label="Retirer ce produit"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-center text-[11px] text-foreground/50">
          {filtered.length} produit{filtered.length > 1 ? "s" : ""}
        </p>
      </div>
    </FullscreenSheet>
  );
}
