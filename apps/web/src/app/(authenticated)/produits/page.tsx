"use client";

import { Package, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  CATEGORIE_LABEL,
  CATEGORIES_ORDER,
  type Produit,
  type ProduitCategorie,
  UNITE_LABEL,
  useDeleteProduit,
  useProduits,
} from "@/lib/produits";
import { NewProduitDialog } from "./new-produit-dialog";

export default function ProduitsPage() {
  const [filtre, setFiltre] = useState<ProduitCategorie | "ALL">("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const produits = useProduits(filtre === "ALL" ? undefined : filtre);
  const deleteMut = useDeleteProduit();

  const grouped = useMemo(() => {
    const map = new Map<ProduitCategorie, Produit[]>();
    for (const p of produits.data ?? []) {
      const arr = map.get(p.categorie) ?? [];
      arr.push(p);
      map.set(p.categorie, arr);
    }
    return CATEGORIES_ORDER.map((c) => [c, map.get(c) ?? []] as const).filter(
      ([, list]) => list.length > 0,
    );
  }, [produits.data]);

  const onDelete = (p: Produit) => {
    if (p.tenantId === null) return; // global non supprimable
    if (!confirm(`Supprimer le produit "${p.libelle}" ?`)) return;
    deleteMut.mutate(p.id);
  };

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Catalogue produits" }]} />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <Package className="h-7 w-7 text-green" />
              Catalogue produits
            </h1>
            <p className="mt-1 text-foreground/70">
              Semences, engrais et phytos disponibles à la saisie. Crée tes propres références pour
              des variétés spécifiques ou mélanges maison.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau produit perso
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <FiltreChip active={filtre === "ALL"} onClick={() => setFiltre("ALL")} label="Tous" />
          {CATEGORIES_ORDER.map((c) => (
            <FiltreChip
              key={c}
              active={filtre === c}
              onClick={() => setFiltre(c)}
              label={CATEGORIE_LABEL[c]}
            />
          ))}
        </div>

        {produits.isLoading && <div className="text-sm text-foreground/60">Chargement…</div>}
        {produits.isError && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Impossible de charger le catalogue.
          </div>
        )}

        {grouped.length === 0 && produits.data && (
          <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-foreground/60">
            Aucun produit dans cette catégorie.
          </div>
        )}

        <div className="space-y-8">
          {grouped.map(([categorie, list]) => (
            <section key={categorie}>
              <h2 className="mb-3 text-lg font-semibold">{CATEGORIE_LABEL[categorie]}</h2>
              <div className="overflow-hidden rounded-xl border border-border bg-background">
                <table className="w-full text-sm">
                  <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-foreground/60">
                    <tr>
                      <th className="px-4 py-2">Libellé</th>
                      <th className="px-4 py-2">Fournisseur</th>
                      <th className="px-4 py-2">Espèce / Teneurs</th>
                      <th className="px-4 py-2">Unité</th>
                      <th className="px-4 py-2 text-right">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((p) => (
                      <tr key={p.id} className="border-t border-border align-top">
                        <td className="px-4 py-2">
                          <div className="font-medium">{p.libelle}</div>
                          {p.marque && <div className="text-xs text-foreground/60">{p.marque}</div>}
                        </td>
                        <td className="px-4 py-2 text-foreground/70">{p.fournisseur ?? "—"}</td>
                        <td className="px-4 py-2">
                          {p.especeCode && (
                            <span className="rounded-full bg-green/10 px-2 py-0.5 font-mono text-xs text-green">
                              {p.especeCode}
                            </span>
                          )}
                          {!p.especeCode && (p.tauxN || p.tauxP || p.tauxK) && (
                            <span className="text-xs tabular-nums text-foreground/70">
                              {p.tauxN ? `N ${Number(p.tauxN)}%` : ""}
                              {p.tauxP ? ` · P ${Number(p.tauxP)}%` : ""}
                              {p.tauxK ? ` · K ${Number(p.tauxK)}%` : ""}
                            </span>
                          )}
                          {!p.especeCode && !p.tauxN && !p.tauxP && !p.tauxK && (
                            <span className="text-foreground/40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-foreground/70">{UNITE_LABEL[p.unite]}</td>
                        <td className="px-4 py-2 text-right">
                          {p.tenantId === null ? (
                            <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs">
                              global
                            </span>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <span className="rounded-full bg-green/10 px-2 py-0.5 text-xs text-green">
                                perso
                              </span>
                              <button
                                onClick={() => onDelete(p)}
                                className="text-foreground/50 hover:text-red-600"
                                aria-label="Supprimer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </div>
      <NewProduitDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}

function FiltreChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        active ? "border-green bg-green/10 font-medium text-green" : "border-border hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}
