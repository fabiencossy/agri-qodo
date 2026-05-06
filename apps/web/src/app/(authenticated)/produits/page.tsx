"use client";

import { type LucideIcon, Package, Plus, RefreshCw, Trash2, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { type ListColumn, ResourceView } from "@/components/ui/resource-view";
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

type Onglet = "biens" | "prestations";

function formatCHF(n: number): string {
  return n.toLocaleString("fr-CH", { style: "currency", currency: "CHF" });
}

export default function ProduitsPage() {
  const [onglet, setOnglet] = useState<Onglet>("biens");
  const [dialogProduit, setDialogProduit] = useState(false);
  const [dialogMateriel, setDialogMateriel] = useState(false);
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
    if (onglet === "biens") {
      syncProduitsOdoo.mutate(undefined, {
        onSuccess: (r) => setSyncResult(r),
      });
    } else {
      syncMaterielsOdoo.mutate(undefined);
    }
  };

  const produitsData = useMemo(() => produits.data ?? [], [produits.data]);
  const materielsData = useMemo(() => materiels.data ?? [], [materiels.data]);

  // ---------- Colonnes Biens ------------------------------------------------
  const produitColumns: ListColumn<Produit>[] = [
    {
      key: "libelle",
      header: "Libellé",
      cell: (p) => (
        <div>
          <div className="font-medium">{p.libelle}</div>
          {p.marque && <div className="text-xs text-foreground/60">{p.marque}</div>}
        </div>
      ),
    },
    {
      key: "categorie",
      header: "Catégorie",
      cell: (p) => CATEGORIE_LABEL[p.categorie],
      hideBelow: "md",
    },
    { key: "unite", header: "Unité", cell: (p) => UNITE_LABEL[p.unite], hideBelow: "sm" },
    {
      key: "prix",
      header: "Tarif",
      cell: (p) =>
        p.prixVenteCHF ? (
          <span className="font-mono tabular-nums">{formatCHF(Number(p.prixVenteCHF))}</span>
        ) : (
          <span className="text-foreground/30">—</span>
        ),
      className: "text-right",
    },
    {
      key: "odoo",
      header: "Odoo",
      cell: (p) =>
        p.odooProductId ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
            #{p.odooProductId}
          </span>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              pushProduit.mutate(p.id);
            }}
            disabled={pushProduit.isPending}
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
      cell: (p) =>
        p.tenantId === null ? (
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] text-foreground/60">
            global
          </span>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Supprimer "${p.libelle}" ?`)) deleteProduit.mutate(p.id);
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

  const renderProduitCard = (p: Produit) => (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium">{p.libelle}</div>
        {p.odooProductId && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
            #{p.odooProductId}
          </span>
        )}
      </div>
      <div className="text-xs text-foreground/60">
        {CATEGORIE_LABEL[p.categorie]} · {UNITE_LABEL[p.unite]}
      </div>
      {p.prixVenteCHF && (
        <div className="font-mono text-sm tabular-nums">{formatCHF(Number(p.prixVenteCHF))}</div>
      )}
    </div>
  );

  // ---------- Colonnes Prestations ------------------------------------------
  const materielColumns: ListColumn<Materiel>[] = [
    {
      key: "libelle",
      header: "Libellé",
      cell: (m) => (
        <div>
          <div className="font-medium">{m.libelle}</div>
          {m.notes && <div className="text-xs text-foreground/60">{m.notes}</div>}
        </div>
      ),
    },
    {
      key: "categorie",
      header: "Catégorie",
      cell: (m) => MATERIEL_CATEGORIE_LABEL[m.categorie],
      hideBelow: "md",
    },
    { key: "unite", header: "Unité", cell: (m) => MATERIEL_UNITE_LABEL[m.unite], hideBelow: "sm" },
    {
      key: "prix",
      header: "Tarif",
      cell: (m) =>
        m.prixUnitaireCHF ? (
          <span className="font-mono tabular-nums">
            {formatCHF(Number(m.prixUnitaireCHF))}
            <span className="text-foreground/40">/{MATERIEL_UNITE_LABEL[m.unite]}</span>
          </span>
        ) : (
          <span className="text-foreground/30">—</span>
        ),
      className: "text-right",
    },
    {
      key: "odoo",
      header: "Odoo",
      cell: (m) =>
        m.odooProductId ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
            #{m.odooProductId}
          </span>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              pushMateriel.mutate(m.id);
            }}
            disabled={pushMateriel.isPending}
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
      cell: (m) =>
        m.tenantId === null ? (
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] text-foreground/60">
            global
          </span>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Supprimer "${m.libelle}" ?`)) deleteMateriel.mutate(m.id);
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

  const renderMaterielCard = (m: Materiel) => {
    const unite = MATERIEL_UNITE_LABEL[m.unite];
    return (
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium">{m.libelle}</div>
          {m.odooProductId && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
              #{m.odooProductId}
            </span>
          )}
        </div>
        <div className="text-xs text-foreground/60">
          {MATERIEL_CATEGORIE_LABEL[m.categorie]} · {unite}
        </div>
        {m.prixUnitaireCHF && (
          <div className="font-mono text-sm tabular-nums">
            {formatCHF(Number(m.prixUnitaireCHF))}/{unite}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Produits" }]} />
      <div className="mx-auto max-w-6xl px-2 py-4 sm:px-4 sm:py-8">
        <PageHeader
          title="Produits"
          icon={Package}
          subtitle="Biens (semences, engrais, phytos…) et prestations facturables. Synchronisable avec Odoo."
          rightSlot={
            <Button
              onClick={() =>
                onglet === "biens" ? setDialogProduit(true) : setDialogMateriel(true)
              }
              size="sm"
            >
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
                Importe tous les <code className="font-mono">product.product</code>{" "}
                {onglet === "prestations" ? "de type service" : "de type bien"} depuis ton instance
                Odoo.
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

        <div className="mb-4 flex flex-wrap gap-2">
          <OngletButton
            active={onglet === "biens"}
            onClick={() => setOnglet("biens")}
            icon={Package}
            label="Biens"
            count={produitsData.length}
          />
          <OngletButton
            active={onglet === "prestations"}
            onClick={() => setOnglet("prestations")}
            icon={Wrench}
            label="Prestations"
            count={materielsData.length}
          />
        </div>

        {onglet === "biens" ? (
          <ResourceView<Produit>
            storageKey="produits-biens"
            defaultView="list"
            data={produitsData}
            columns={produitColumns}
            renderKanbanCard={renderProduitCard}
            renderCard={renderProduitCard}
            searchFields={(p) =>
              [
                p.libelle,
                p.marque ?? "",
                p.fournisseur ?? "",
                p.especeCode ?? "",
                p.code,
                p.notes ?? "",
              ].join(" ")
            }
            getKey={(p) => p.id}
            searchPlaceholder="Rechercher (libellé, marque, fournisseur, espèce…)"
            availableViews={["list", "kanban", "card"]}
            emptyState={
              <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-foreground/60">
                Pas encore de bien. Crée-en un ou synchronise depuis Odoo.
              </div>
            }
          />
        ) : (
          <ResourceView<Materiel>
            storageKey="produits-prestations"
            defaultView="list"
            data={materielsData}
            columns={materielColumns}
            renderKanbanCard={renderMaterielCard}
            renderCard={renderMaterielCard}
            searchFields={(m) => [m.libelle, m.notes ?? "", m.code].join(" ")}
            getKey={(m) => m.id}
            searchPlaceholder="Rechercher une prestation…"
            availableViews={["list", "kanban", "card"]}
            emptyState={
              <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-foreground/60">
                Pas encore de prestation. Crée-en une ou synchronise depuis Odoo.
              </div>
            }
          />
        )}
      </div>

      <NewProduitDialog open={dialogProduit} onClose={() => setDialogProduit(false)} />
      <NewMaterielDialog open={dialogMateriel} onClose={() => setDialogMateriel(false)} />
    </>
  );
}

function OngletButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-green bg-green text-white"
          : "border-border bg-background text-foreground/70 hover:bg-muted"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          active ? "bg-white/20 text-white" : "bg-foreground/10 text-foreground/70"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
