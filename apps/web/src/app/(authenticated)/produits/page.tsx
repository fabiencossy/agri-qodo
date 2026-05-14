"use client";

import { Package, Plus, RefreshCw, Trash2, Upload, Wrench, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  type FilterOption,
  type GroupByOption,
  type ListColumn,
  ResourceView,
} from "@/components/ui/resource-view";
import { useCurrentUser } from "@/lib/auth";
import {
  MATERIEL_CATEGORIE_LABEL,
  MATERIEL_UNITE_LABEL,
  type Materiel,
  type PushAllMaterielsResult,
  useDeleteMateriel,
  useMateriels,
  usePushAllMaterielsOdoo,
  usePushMaterielOdoo,
  useSyncMaterielsOdoo,
} from "@/lib/materiels";
import { useOdooConnected } from "@/lib/odoo-config";
import {
  CATEGORIE_LABEL,
  type Produit,
  type PushAllProduitsResult,
  type SyncOdooProduitsResult,
  UNITE_LABEL,
  useDeleteProduit,
  useProduits,
  usePushAllProduitsOdoo,
  usePushProduitOdoo,
  useSyncProduitsOdoo,
} from "@/lib/produits";
import { type CatalogueItemForEdit, EditCatalogueItemDialog } from "./edit-catalogue-item-dialog";
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
  const [pushAllResult, setPushAllResult] = useState<{
    produits: PushAllProduitsResult | null;
    materiels: PushAllMaterielsResult | null;
  } | null>(null);
  const [editing, setEditing] = useState<CatalogueItemForEdit | null>(null);

  const produits = useProduits();
  const materiels = useMateriels();
  const deleteProduit = useDeleteProduit();
  const deleteMateriel = useDeleteMateriel();
  const pushProduit = usePushProduitOdoo();
  const pushMateriel = usePushMaterielOdoo();
  const syncProduitsOdoo = useSyncProduitsOdoo();
  const syncMaterielsOdoo = useSyncMaterielsOdoo();
  const pushAllProduits = usePushAllProduitsOdoo();
  const pushAllMateriels = usePushAllMaterielsOdoo();
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

  const handlePushAllOdoo = async () => {
    if (
      !confirm(
        "Pousser tout le catalogue (produits + prestations) vers Odoo ?\n\n" +
          "Cette opération peut prendre plusieurs minutes selon la taille du catalogue. " +
          "Les produits déjà liés à Odoo seront mis à jour, ceux qui n'existent plus côté " +
          "Odoo seront recréés.",
      )
    )
      return;
    setPushAllResult(null);
    try {
      const [p, m] = await Promise.all([
        pushAllProduits.mutateAsync(),
        pushAllMateriels.mutateAsync(),
      ]);
      setPushAllResult({ produits: p, materiels: m });
    } catch (err) {
      alert(`Erreur push vers Odoo : ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Liste combinée + dédup full. Stratégie pour chaque type :
  //   1. Grouper par clé (libellé+catégorie, lowercase).
  //   2. Garder UN SEUL item par groupe :
  //      - priorité au perso mappé Odoo (odooProductId posé)
  //      - sinon perso (modifiable)
  //      - sinon global (read-only)
  // Couvre les doublons inter-perso créés par re-runs du script de
  // sync (image 131 — Abricotier × 2, Algues × 2, Ammonitrate × 4).
  const items = useMemo<CatalogueItem[]>(() => {
    // Dédup par libellé seul. Les versions sync depuis Odoo arrivent
    // souvent en catégorie "Autres" (faute de mapping côté Odoo) alors
    // que la version globale a la vraie catégorie ("Semences", "Engrais
    // organiques"…). Une dédup par libellé+catégorie laissait passer
    // ces doublons. Demande Fabien 2026-05-06 : "tjs des doublons" ×3.
    function dedupBiens(list: Produit[]): Produit[] {
      const groups = new Map<string, Produit[]>();
      for (const p of list) {
        const key = p.libelle.toLowerCase().trim();
        const arr = groups.get(key) ?? [];
        arr.push(p);
        groups.set(key, arr);
      }
      const result: Produit[] = [];
      for (const arr of groups.values()) {
        // Tri : perso mappé Odoo (avec vraie catégorie si possible) >
        // global (vraie catégorie) > perso mappé Odoo "Autres" (issue
        // de sync) > perso non-mappé > autres.
        arr.sort((a, b) => {
          const score = (p: Produit) => {
            const isPersoMapped = p.tenantId !== null && p.odooProductId !== null;
            const isReal = p.categorie !== "AUTRE";
            if (isPersoMapped && isReal) return 0;
            if (p.tenantId === null && isReal) return 1;
            if (isPersoMapped) return 2;
            if (p.tenantId !== null) return 3;
            return 4;
          };
          return score(a) - score(b);
        });
        if (arr[0]) result.push(arr[0]);
      }
      return result;
    }
    function dedupPrestations(list: Materiel[]): Materiel[] {
      const groups = new Map<string, Materiel[]>();
      for (const m of list) {
        const key = m.libelle.toLowerCase().trim();
        const arr = groups.get(key) ?? [];
        arr.push(m);
        groups.set(key, arr);
      }
      const result: Materiel[] = [];
      for (const arr of groups.values()) {
        arr.sort((a, b) => {
          const score = (m: Materiel) => {
            const isPersoMapped = m.tenantId !== null && m.odooProductId !== null;
            const isReal = m.categorie !== "AUTRE";
            if (isPersoMapped && isReal) return 0;
            if (m.tenantId === null && isReal) return 1;
            if (isPersoMapped) return 2;
            if (m.tenantId !== null) return 3;
            return 4;
          };
          return score(a) - score(b);
        });
        if (arr[0]) result.push(arr[0]);
      }
      return result;
    }
    const all: CatalogueItem[] = [];
    for (const p of dedupBiens(produits.data ?? [])) all.push({ kind: "bien", data: p });
    for (const m of dedupPrestations(materiels.data ?? []))
      all.push({ kind: "prestation", data: m });
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

  const itemKey = (item: CatalogueItem) => `${item.kind}-${item.data.id}`;

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
          <span className="truncate font-medium">{item.data.libelle}</span>
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
    {
      key: "with-odoo",
      label: "Synchronisés Odoo",
      predicate: (i) => i.data.odooProductId !== null,
    },
    {
      key: "without-odoo",
      label: "Non synchronisés",
      predicate: (i) => i.data.odooProductId === null,
    },
    { key: "perso", label: "Perso (modifiables)", predicate: (i) => i.data.tenantId !== null },
    { key: "global", label: "Globaux (lecture seule)", predicate: (i) => i.data.tenantId === null },
    { key: "with-price", label: "Avec tarif", predicate: (i) => tarif(i) !== null },
    { key: "without-price", label: "Sans tarif", predicate: (i) => tarif(i) === null },
  ];

  const groupBys: GroupByOption<CatalogueItem>[] = [
    {
      key: "type",
      label: "Type (Bien / Prestation)",
      groupKey: (i) => i.kind,
      groupLabel: (k) => (k === "bien" ? "Biens" : "Prestations"),
      order: ["bien", "prestation"],
    },
    {
      key: "categorie",
      label: "Catégorie",
      groupKey: (i) => `${i.kind}:${categorieLabel(i)}`,
      groupLabel: (k) => k.split(":").slice(1).join(":"),
    },
    {
      key: "source",
      label: "Source (perso / global)",
      groupKey: (i) => (i.data.tenantId === null ? "global" : "perso"),
      groupLabel: (k) => (k === "global" ? "Globaux (catalogue Agridea)" : "Perso (mes entrées)"),
      order: ["perso", "global"],
    },
    {
      key: "odoo",
      label: "Sync Odoo",
      groupKey: (i) => (i.data.odooProductId ? "synced" : "not-synced"),
      groupLabel: (k) => (k === "synced" ? "Synchronisés Odoo" : "Non synchronisés"),
      order: ["synced", "not-synced"],
    },
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
      <div className="mx-auto w-full px-2 py-4 sm:px-4 sm:py-8">
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
                Sync auto toutes les 6h. Synchroniser = importer depuis Odoo. Pousser tout = envoyer
                le catalogue Agri Qodo vers Odoo (utile si Odoo a été vidé).
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleSyncAllOdoo}
                disabled={
                  syncProduitsOdoo.isPending ||
                  syncMaterielsOdoo.isPending ||
                  pushAllProduits.isPending ||
                  pushAllMateriels.isPending
                }
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
                  : "Synchroniser"}
              </Button>
              <Button
                onClick={handlePushAllOdoo}
                disabled={
                  syncProduitsOdoo.isPending ||
                  syncMaterielsOdoo.isPending ||
                  pushAllProduits.isPending ||
                  pushAllMateriels.isPending
                }
                size="sm"
                variant="secondary"
                className="border border-amber-700/40 bg-white text-amber-900 hover:bg-amber-100"
                title="Pousse tout le catalogue Agri Qodo vers Odoo (utile après reset Odoo)."
              >
                <Upload
                  className={`mr-1 h-4 w-4 ${
                    pushAllProduits.isPending || pushAllMateriels.isPending ? "animate-pulse" : ""
                  }`}
                />
                {pushAllProduits.isPending || pushAllMateriels.isPending ? "Push…" : "Pousser tout"}
              </Button>
            </div>
          </div>
        )}

        {pushAllResult && (
          <div className="mb-4 rounded-xl border border-green/30 bg-green/5 p-4 text-sm">
            <p className="font-medium text-green-dark">
              ✓ Push Odoo terminé : {pushAllResult.produits?.pushed ?? 0} produits ·{" "}
              {pushAllResult.materiels?.pushed ?? 0} prestations
              {(pushAllResult.produits?.errors.length ?? 0) +
                (pushAllResult.materiels?.errors.length ?? 0) >
                0 &&
                ` (${(pushAllResult.produits?.errors.length ?? 0) + (pushAllResult.materiels?.errors.length ?? 0)} erreurs — voir logs serveur)`}
            </p>
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
          groupBys={groupBys}
          getKey={itemKey}
          onItemClick={(item) => setEditing(item)}
          searchPlaceholder="Rechercher un bien ou une prestation…"
          availableViews={["list", "kanban", "card"]}
          selectable
          bulkActions={[
            {
              key: "push",
              label: "Pousser vers Odoo",
              icon: RefreshCw,
              className: "bg-amber-600 hover:bg-amber-700",
              handler: async (selectedItems) => {
                let ok = 0;
                let ko = 0;
                for (const item of selectedItems) {
                  try {
                    if (item.kind === "bien") await pushProduit.mutateAsync(item.data.id);
                    else await pushMateriel.mutateAsync(item.data.id);
                    ok++;
                  } catch {
                    ko++;
                  }
                }
                alert(`Push Odoo : ${ok} OK${ko > 0 ? `, ${ko} échecs` : ""}.`);
              },
            },
            {
              key: "delete",
              label: "Supprimer",
              icon: Trash2,
              className: "bg-red-600 hover:bg-red-700",
              confirm: "Supprimer {n} entrée(s) ?",
              handler: async (selectedItems) => {
                let ok = 0;
                let ko = 0;
                for (const item of selectedItems) {
                  if (item.data.tenantId === null) {
                    ko++;
                    continue;
                  }
                  try {
                    if (item.kind === "bien") await deleteProduit.mutateAsync(item.data.id);
                    else await deleteMateriel.mutateAsync(item.data.id);
                    ok++;
                  } catch {
                    ko++;
                  }
                }
                if (ko > 0)
                  alert(`Supprimés : ${ok} OK, ${ko} ignorés (globaux non supprimables).`);
              },
            },
          ]}
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
      <EditCatalogueItemDialog item={editing} onClose={() => setEditing(null)} />
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
