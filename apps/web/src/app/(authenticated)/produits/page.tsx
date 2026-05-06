"use client";

import { Package, Plus, RefreshCw, Trash2, Wrench, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { type FilterOption, type ListColumn, ResourceView } from "@/components/ui/resource-view";
import { useCurrentUser } from "@/lib/auth";
import {
  MATERIEL_CATEGORIE_LABEL,
  MATERIEL_UNITE_LABEL,
  type Materiel,
  useDeleteMateriel,
  useMateriels,
  usePushMaterielOdoo,
  useSyncMaterielsOdoo,
} from "@/lib/materiels";
import { useOdooConnected } from "@/lib/odoo-config";
import {
  CATEGORIE_LABEL,
  type Produit,
  type SyncOdooProduitsResult,
  UNITE_LABEL,
  useDeleteProduit,
  useProduits,
  usePushProduitOdoo,
  useSyncProduitsOdoo,
} from "@/lib/produits";
import { NewMaterielDialog } from "./new-materiel-dialog";
import { NewProduitDialog } from "./new-produit-dialog";

/**
 * Item unifié du catalogue : un Produit (= bien) ou un Matériel (=
 * prestation), wrappés avec un discriminant `kind` pour pouvoir les
 * lister ensemble dans une même ResourceView (demande Fabien
 * 2026-05-06 : "supprime les deux boutons au-dessus de la barre" =
 * onglets Biens/Prestations remplacés par filtres dans la search bar).
 */
type CatalogueItem = { kind: "bien"; data: Produit } | { kind: "prestation"; data: Materiel };

function formatCHF(n: number): string {
  return n.toLocaleString("fr-CH", { style: "currency", currency: "CHF" });
}

function libelle(item: CatalogueItem): string {
  return item.data.libelle;
}

function categorieLabel(item: CatalogueItem): string {
  return item.kind === "bien"
    ? CATEGORIE_LABEL[item.data.categorie]
    : MATERIEL_CATEGORIE_LABEL[item.data.categorie];
}

function uniteLabel(item: CatalogueItem): string {
  return item.kind === "bien"
    ? UNITE_LABEL[item.data.unite]
    : MATERIEL_UNITE_LABEL[item.data.unite];
}

function tarif(item: CatalogueItem): number | null {
  const raw = item.kind === "bien" ? item.data.prixVenteCHF : item.data.prixUnitaireCHF;
  return raw ? Number(raw) : null;
}

export default function ProduitsPage() {
  const [dialogProduit, setDialogProduit] = useState(false);
  const [dialogMateriel, setDialogMateriel] = useState(false);
  const [chooseTypeOpen, setChooseTypeOpen] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncOdooProduitsResult | null>(null);

  const produits = useProduits();
  const materiels = useMateriels();
  const deleteProduit = useDeleteProduit();
  const deleteMateriel = useDeleteMateriel();
  const pushProduit = usePushProduitOdoo();
  const pushMateriel = usePushMaterielOdoo();
  const syncProduitsOdoo = useSyncProduitsOdoo();
  const syncMaterielsOdoo = useSyncMaterielsOdoo();
  const me = useCurrentUser();
  const odoo = useOdooConnected();
  const isAdmin = me.data?.role === "OWNER" || me.data?.role === "COMPTABLE";

  const handleSyncAllOdoo = () => {
    setSyncResult(null);
    syncProduitsOdoo.mutate(undefined, {
      onSuccess: (r) => setSyncResult(r),
    });
    syncMaterielsOdoo.mutate(undefined);
  };

  // Liste combinée : un seul tableau d'items, discriminés par `kind`.
  // Tri : par libellé (les deux types mélangés alphabétiquement).
  const items = useMemo<CatalogueItem[]>(() => {
    const all: CatalogueItem[] = [];
    for (const p of produits.data ?? []) all.push({ kind: "bien", data: p });
    for (const m of materiels.data ?? []) all.push({ kind: "prestation", data: m });
    all.sort((a, b) => libelle(a).localeCompare(libelle(b), "fr"));
    return all;
  }, [produits.data, materiels.data]);

  const onPush = (item: CatalogueItem) => {
    if (item.kind === "bien") pushProduit.mutate(item.data.id);
    else pushMateriel.mutate(item.data.id);
  };

  const onDelete = (item: CatalogueItem) => {
    if (item.data.tenantId === null) return;
    if (!confirm(`Supprimer "${item.data.libelle}" ?`)) return;
    if (item.kind === "bien") deleteProduit.mutate(item.data.id);
    else deleteMateriel.mutate(item.data.id);
  };

  const columns: ListColumn<CatalogueItem>[] = [
    {
      key: "libelle",
      header: "Libellé",
      cell: (item) => (
        <div className="flex items-center gap-2">
          {item.kind === "bien" ? (
            <Package className="h-4 w-4 flex-shrink-0 text-foreground/40" />
          ) : (
            <Wrench className="h-4 w-4 flex-shrink-0 text-foreground/40" />
          )}
          <div className="min-w-0">
            <div className="truncate font-medium">{item.data.libelle}</div>
            {item.kind === "bien" && item.data.marque && (
              <div className="truncate text-xs text-foreground/60">{item.data.marque}</div>
            )}
            {item.kind === "prestation" && item.data.notes && (
              <div className="truncate text-xs text-foreground/60">{item.data.notes}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (item) =>
        item.kind === "bien" ? (
          <span className="rounded-full bg-green/10 px-2 py-0.5 text-[11px] font-medium text-green">
            Bien
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
            Prestation
          </span>
        ),
      hideBelow: "sm",
    },
    {
      key: "categorie",
      header: "Catégorie",
      cell: (item) => categorieLabel(item),
      hideBelow: "md",
    },
    {
      key: "unite",
      header: "Unité",
      cell: (item) => uniteLabel(item),
      hideBelow: "sm",
    },
    {
      key: "prix",
      header: "Tarif",
      cell: (item) => {
        const t = tarif(item);
        if (t === null) return <span className="text-foreground/30">—</span>;
        return (
          <span className="font-mono tabular-nums">
            {formatCHF(t)}
            {item.kind === "prestation" && (
              <span className="text-foreground/40">/{uniteLabel(item)}</span>
            )}
          </span>
        );
      },
      className: "text-right",
    },
    {
      key: "odoo",
      header: "Odoo",
      cell: (item) =>
        item.data.odooProductId ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
            #{item.data.odooProductId}
          </span>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPush(item);
            }}
            disabled={pushProduit.isPending || pushMateriel.isPending}
            className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" />
            Pousser
          </button>
        ),
      className: "text-right",
    },
    {
      key: "actions",
      header: "",
      cell: (item) =>
        item.data.tenantId === null ? (
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] text-foreground/60">
            global
          </span>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
            className="text-foreground/50 hover:text-red-600"
            aria-label="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ),
      className: "text-right",
    },
  ];

  const filters: FilterOption<CatalogueItem>[] = [
    { key: "biens", label: "Biens", predicate: (i) => i.kind === "bien" },
    { key: "prestations", label: "Prestations", predicate: (i) => i.kind === "prestation" },
  ];

  const renderCard = (item: CatalogueItem) => (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 font-medium">
          {item.kind === "bien" ? (
            <Package className="h-4 w-4 text-foreground/40" />
          ) : (
            <Wrench className="h-4 w-4 text-foreground/40" />
          )}
          {item.data.libelle}
        </div>
        {item.data.odooProductId && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
            #{item.data.odooProductId}
          </span>
        )}
      </div>
      <div className="text-xs text-foreground/60">
        {categorieLabel(item)} · {uniteLabel(item)}
      </div>
      {tarif(item) !== null && (
        <div className="font-mono text-sm tabular-nums">
          {formatCHF(tarif(item) as number)}
          {item.kind === "prestation" && (
            <span className="text-foreground/40">/{uniteLabel(item)}</span>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Produits" }]} />
      <div className="mx-auto max-w-6xl px-2 py-4 sm:px-4 sm:py-8">
        <PageHeader
          title="Produits"
          icon={Package}
          subtitle="Biens (semences, engrais, phytos…) et prestations facturables. Synchronisable avec Odoo."
          rightSlot={
            <Button onClick={() => setChooseTypeOpen(true)} size="sm">
              <Plus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Nouveau</span>
            </Button>
          }
        />

        {isAdmin && odoo.connected && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 sm:px-5">
            <RefreshCw className="h-5 w-5 flex-shrink-0 text-amber-700" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-amber-900">Synchronisation Odoo</p>
              <p className="mt-0.5 text-xs text-foreground/70">
                Importe tous les <code className="font-mono">product.product</code> (biens et
                services) depuis ton instance Odoo.
              </p>
            </div>
            <Button
              onClick={handleSyncAllOdoo}
              disabled={syncProduitsOdoo.isPending || syncMaterielsOdoo.isPending}
              size="sm"
              className="bg-amber-600 hover:bg-amber-700"
            >
              <RefreshCw
                className={`mr-1 h-4 w-4 ${
                  syncProduitsOdoo.isPending || syncMaterielsOdoo.isPending ? "animate-spin" : ""
                }`}
              />
              {syncProduitsOdoo.isPending || syncMaterielsOdoo.isPending
                ? "Sync…"
                : "Synchroniser tout"}
            </Button>
          </div>
        )}

        {syncResult && (
          <div className="mb-4 rounded-xl border border-green/30 bg-green/5 p-4 text-sm">
            <p className="font-medium text-green-dark">
              ✓ Sync Odoo terminée : {syncResult.created} créés · {syncResult.updated} mis à jour ·{" "}
              {syncResult.skipped} ignorés
              {syncResult.total > 0 && ` (sur ${syncResult.total} entrées Odoo)`}
            </p>
          </div>
        )}

        <ResourceView<CatalogueItem>
          storageKey="produits-catalogue"
          defaultView="list"
          data={items}
          columns={columns}
          renderKanbanCard={renderCard}
          renderCard={renderCard}
          searchFields={(item) => {
            if (item.kind === "bien") {
              const p = item.data;
              return [
                p.libelle,
                p.marque ?? "",
                p.fournisseur ?? "",
                p.especeCode ?? "",
                p.code,
                p.notes ?? "",
              ].join(" ");
            }
            const m = item.data;
            return [m.libelle, m.notes ?? "", m.code].join(" ");
          }}
          filters={filters}
          getKey={(item) => `${item.kind}-${item.data.id}`}
          searchPlaceholder="Rechercher un bien ou une prestation…"
          availableViews={["list", "kanban", "card"]}
          emptyState={
            <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-foreground/60">
              Catalogue vide. Crée un bien/prestation ou synchronise depuis Odoo.
            </div>
          }
        />
      </div>

      {chooseTypeOpen && (
        <ChooseTypeDialog
          onClose={() => setChooseTypeOpen(false)}
          onChoose={(kind) => {
            setChooseTypeOpen(false);
            if (kind === "bien") setDialogProduit(true);
            else setDialogMateriel(true);
          }}
        />
      )}
      <NewProduitDialog open={dialogProduit} onClose={() => setDialogProduit(false)} />
      <NewMaterielDialog open={dialogMateriel} onClose={() => setDialogMateriel(false)} />
    </>
  );
}

/**
 * Petit dialog de choix Bien / Prestation au clic sur "+ Nouveau".
 * Cohérent avec la fusion : on ne montre plus l'onglet pour faire le
 * choix, donc il faut le demander au moment de la création.
 */
function ChooseTypeDialog({
  onClose,
  onChoose,
}: {
  onClose: () => void;
  onChoose: (kind: "bien" | "prestation") => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Que veux-tu créer ?</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-1 text-foreground/60 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onChoose("bien")}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-border bg-background p-4 text-center transition-colors hover:border-green hover:bg-green/5"
          >
            <Package className="h-6 w-6 text-green" />
            <div className="font-semibold">Bien</div>
            <div className="text-xs text-foreground/60">
              Semences, engrais, phytos, consommables…
            </div>
          </button>
          <button
            type="button"
            onClick={() => onChoose("prestation")}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-border bg-background p-4 text-center transition-colors hover:border-amber-600 hover:bg-amber-50"
          >
            <Wrench className="h-6 w-6 text-amber-700" />
            <div className="font-semibold">Prestation</div>
            <div className="text-xs text-foreground/60">
              Travaux facturables : labour, semis, ensilage…
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
