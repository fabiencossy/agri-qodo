"use client";

import { Package, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth";
import { useOdooConnected } from "@/lib/odoo-config";
import {
  CATEGORIE_LABEL,
  CATEGORIES_ORDER,
  type Produit,
  type ProduitCategorie,
  type SyncOdooProduitsResult,
  UNITE_LABEL,
  useDeleteProduit,
  useProduits,
  useSyncProduitsOdoo,
} from "@/lib/produits";
import { NewProduitDialog } from "./new-produit-dialog";

function formatCHF(n: number): string {
  return n.toLocaleString("fr-CH", { style: "currency", currency: "CHF" });
}

export default function ProduitsPage() {
  const [filtre, setFiltre] = useState<ProduitCategorie | "ALL">("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncOdooProduitsResult | null>(null);
  const produits = useProduits(filtre === "ALL" ? undefined : filtre);
  const deleteMut = useDeleteProduit();
  const syncOdoo = useSyncProduitsOdoo();
  const me = useCurrentUser();
  const odoo = useOdooConnected();
  const isAdmin = me.data?.role === "OWNER" || me.data?.role === "COMPTABLE";

  const handleSyncOdoo = () => {
    syncOdoo.mutate(undefined, {
      onSuccess: (r) => setSyncResult(r),
    });
  };

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
      <div className="mx-auto max-w-5xl px-2 py-4 sm:px-4 sm:py-8">
        <PageHeader
          title="Catalogue produits"
          icon={Package}
          subtitle="Semences, engrais, phytos. Crée tes références ou synchronise depuis Odoo."
          rightSlot={
            <Button onClick={() => setDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Nouveau</span>
            </Button>
          }
          menuActions={
            isAdmin && odoo.connected
              ? [
                  {
                    label: syncOdoo.isPending
                      ? "Synchronisation en cours…"
                      : "Synchroniser depuis Odoo",
                    icon: RefreshCw,
                    disabled: syncOdoo.isPending,
                    onClick: handleSyncOdoo,
                  },
                ]
              : []
          }
        />

        {syncResult && (
          <div className="mb-4 rounded-xl border border-green/30 bg-green/5 p-4 text-sm">
            <p className="font-medium text-green-dark">
              ✓ Sync Odoo terminée : {syncResult.created} créés · {syncResult.updated} mis à jour ·{" "}
              {syncResult.skipped} ignorés
              {syncResult.total > 0 && ` (sur ${syncResult.total} produits Odoo)`}
            </p>
            {syncResult.errors.length > 0 && (
              <details className="mt-2 text-xs text-foreground/70">
                <summary className="cursor-pointer">{syncResult.errors.length} erreur(s)</summary>
                <ul className="mt-1 list-disc pl-5">
                  {syncResult.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>
                      Odoo #{e.odooId} : {e.raison}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {syncOdoo.isError && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Sync Odoo échouée. Vérifie la config dans Paramètres → Odoo.
          </div>
        )}

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
                      {isAdmin && <th className="px-4 py-2 text-right">Prix CHF/u</th>}
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
                        {isAdmin && (
                          <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">
                            {p.prixVenteCHF ? (
                              formatCHF(Number(p.prixVenteCHF))
                            ) : (
                              <span className="text-foreground/30">—</span>
                            )}
                          </td>
                        )}
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
