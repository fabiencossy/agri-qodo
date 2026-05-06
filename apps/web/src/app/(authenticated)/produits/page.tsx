"use client";

import {
  Loader2,
  type LucideIcon,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
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
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
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

  const filteredProduits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (produits.data ?? []).filter((p) => {
      if (!q) return true;
      return [p.libelle, p.marque, p.fournisseur, p.especeCode, p.code]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [produits.data, search]);

  const filteredMateriels = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (materiels.data ?? []).filter((m) => {
      if (!q) return true;
      return [m.libelle, m.notes, m.code].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [materiels.data, search]);

  const currentList: Array<Produit | Materiel> =
    onglet === "biens" ? filteredProduits : filteredMateriels;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === currentList.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(currentList.map((x) => x.id)));
    }
  }

  // Reset sélection au changement d'onglet pour éviter le mélange.
  function setOngletAndReset(o: Onglet) {
    setOnglet(o);
    setSelected(new Set());
  }

  async function pushSelectedOdoo() {
    const ids = Array.from(selected);
    let ok = 0;
    let ko = 0;
    for (const id of ids) {
      try {
        if (onglet === "biens") {
          await pushProduit.mutateAsync(id);
        } else {
          await pushMateriel.mutateAsync(id);
        }
        ok++;
      } catch {
        ko++;
      }
    }
    setSelected(new Set());
    alert(`Push Odoo terminé : ${ok} OK${ko > 0 ? `, ${ko} échecs` : ""}.`);
  }

  async function deleteSelected() {
    const ids = Array.from(selected);
    if (!confirm(`Supprimer ${ids.length} élément${ids.length > 1 ? "s" : ""} ?`)) return;
    let ok = 0;
    let ko = 0;
    for (const id of ids) {
      try {
        if (onglet === "biens") {
          await deleteProduit.mutateAsync(id);
        } else {
          await deleteMateriel.mutateAsync(id);
        }
        ok++;
      } catch {
        ko++;
      }
    }
    setSelected(new Set());
    if (ko > 0) alert(`Supprimés : ${ok} OK, ${ko} échecs (probablement globaux).`);
  }

  const onDeleteProduit = (p: Produit) => {
    if (p.tenantId === null) return;
    if (!confirm(`Supprimer "${p.libelle}" ?`)) return;
    deleteProduit.mutate(p.id);
  };
  const onDeleteMateriel = (m: Materiel) => {
    if (m.tenantId === null) return;
    if (!confirm(`Supprimer "${m.libelle}" ?`)) return;
    deleteMateriel.mutate(m.id);
  };

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Produits" }]} />
      <div className="mx-auto max-w-5xl px-2 py-4 sm:px-4 sm:py-8">
        <PageHeader
          title="Produits"
          icon={Package}
          subtitle="Biens (semences, engrais, phytos…) et prestations facturables (labour, semis, ensilage). Synchronisable avec Odoo."
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
                {onglet === "prestations" ? "de type service" : ""} depuis ton instance Odoo.
              </p>
            </div>
            <Button
              onClick={handleSyncAllOdoo}
              disabled={syncProduitsOdoo.isPending || syncMaterielsOdoo.isPending}
              size="sm"
              className="bg-amber-600 hover:bg-amber-700"
            >
              <RefreshCw
                className={`mr-1 h-4 w-4 ${syncProduitsOdoo.isPending || syncMaterielsOdoo.isPending ? "animate-spin" : ""}`}
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
            onClick={() => setOngletAndReset("biens")}
            icon={Package}
            label="Biens"
            count={(produits.data ?? []).length}
          />
          <OngletButton
            active={onglet === "prestations"}
            onClick={() => setOngletAndReset("prestations")}
            icon={Wrench}
            label="Prestations"
            count={(materiels.data ?? []).length}
          />
        </div>

        <div className="mb-4 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              onglet === "biens"
                ? "Rechercher (libellé, marque, fournisseur, espèce…)"
                : "Rechercher une prestation…"
            }
            className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
          />
        </div>

        {(produits.isLoading || materiels.isLoading) && (
          <div className="flex items-center gap-2 text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        )}

        {currentList.length === 0 && !produits.isLoading && !materiels.isLoading && (
          <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-foreground/60">
            {search.trim()
              ? `Rien ne correspond à "${search.trim()}".`
              : onglet === "biens"
                ? "Pas encore de produit. Crée-en un ou synchronise depuis Odoo."
                : "Pas encore de prestation. Crée-en une ou synchronise depuis Odoo."}
          </div>
        )}

        {currentList.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border bg-background">
            <table className="w-full text-sm">
              <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-foreground/60">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.size > 0 && selected.size === currentList.length}
                      onChange={toggleSelectAll}
                      aria-label="Tout sélectionner"
                    />
                  </th>
                  <th className="px-3 py-2">Libellé</th>
                  <th className="px-3 py-2">Catégorie</th>
                  <th className="px-3 py-2">Unité</th>
                  <th className="px-3 py-2 text-right">Tarif</th>
                  <th className="px-3 py-2 text-right">Odoo</th>
                  <th className="w-24 px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {onglet === "biens"
                  ? filteredProduits.map((p) => (
                      <ProduitRow
                        key={p.id}
                        produit={p}
                        selected={selected.has(p.id)}
                        onToggle={() => toggleSelect(p.id)}
                        onPushOdoo={() => pushProduit.mutate(p.id)}
                        onDelete={() => onDeleteProduit(p)}
                        pushPending={pushProduit.isPending}
                      />
                    ))
                  : filteredMateriels.map((m) => (
                      <MaterielRow
                        key={m.id}
                        materiel={m}
                        selected={selected.has(m.id)}
                        onToggle={() => toggleSelect(m.id)}
                        onPushOdoo={() => pushMateriel.mutate(m.id)}
                        onDelete={() => onDeleteMateriel(m)}
                        pushPending={pushMateriel.isPending}
                      />
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Barre flottante d'actions bulk */}
      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-border bg-background px-4 py-2 shadow-2xl">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
            </span>
            <Button
              size="sm"
              onClick={pushSelectedOdoo}
              disabled={pushProduit.isPending || pushMateriel.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              Pousser vers Odoo
            </Button>
            <Button
              size="sm"
              onClick={deleteSelected}
              disabled={deleteProduit.isPending || deleteMateriel.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Supprimer
            </Button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs text-foreground/60 hover:text-foreground"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

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

function ProduitRow({
  produit: p,
  selected,
  onToggle,
  onPushOdoo,
  onDelete,
  pushPending,
}: {
  produit: Produit;
  selected: boolean;
  onToggle: () => void;
  onPushOdoo: () => void;
  onDelete: () => void;
  pushPending: boolean;
}) {
  const isGlobal = p.tenantId === null;
  return (
    <tr className={`border-t border-border align-middle ${selected ? "bg-green/5" : ""}`}>
      <td className="px-3 py-2">
        <input type="checkbox" checked={selected} onChange={onToggle} />
      </td>
      <td className="px-3 py-2">
        <div className="font-medium">{p.libelle}</div>
        {p.marque && <div className="text-xs text-foreground/60">{p.marque}</div>}
      </td>
      <td className="px-3 py-2 text-foreground/70">{CATEGORIE_LABEL[p.categorie]}</td>
      <td className="px-3 py-2 text-foreground/70">{UNITE_LABEL[p.unite]}</td>
      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
        {p.prixVenteCHF ? (
          formatCHF(Number(p.prixVenteCHF))
        ) : (
          <span className="text-foreground/30">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {p.odooProductId ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
            #{p.odooProductId}
          </span>
        ) : (
          <button
            type="button"
            onClick={onPushOdoo}
            disabled={pushPending}
            className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            title="Pousser vers Odoo"
          >
            <RefreshCw className="h-3 w-3" />
            Pousser
          </button>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {!isGlobal && (
          <button
            onClick={onDelete}
            className="text-foreground/50 hover:text-red-600"
            aria-label="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        {isGlobal && (
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] text-foreground/60">
            global
          </span>
        )}
      </td>
    </tr>
  );
}

function MaterielRow({
  materiel: m,
  selected,
  onToggle,
  onPushOdoo,
  onDelete,
  pushPending,
}: {
  materiel: Materiel;
  selected: boolean;
  onToggle: () => void;
  onPushOdoo: () => void;
  onDelete: () => void;
  pushPending: boolean;
}) {
  const isGlobal = m.tenantId === null;
  const unite = MATERIEL_UNITE_LABEL[m.unite];
  return (
    <tr className={`border-t border-border align-middle ${selected ? "bg-green/5" : ""}`}>
      <td className="px-3 py-2">
        <input type="checkbox" checked={selected} onChange={onToggle} />
      </td>
      <td className="px-3 py-2">
        <div className="font-medium">{m.libelle}</div>
        {m.notes && <div className="text-xs text-foreground/60">{m.notes}</div>}
      </td>
      <td className="px-3 py-2 text-foreground/70">{MATERIEL_CATEGORIE_LABEL[m.categorie]}</td>
      <td className="px-3 py-2 text-foreground/70">{unite}</td>
      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
        {m.prixUnitaireCHF ? (
          <>
            {formatCHF(Number(m.prixUnitaireCHF))}
            <span className="text-foreground/40">/{unite}</span>
          </>
        ) : (
          <span className="text-foreground/30">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {m.odooProductId ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
            #{m.odooProductId}
          </span>
        ) : (
          <button
            type="button"
            onClick={onPushOdoo}
            disabled={pushPending}
            className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            title="Pousser vers Odoo"
          >
            <RefreshCw className="h-3 w-3" />
            Pousser
          </button>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {!isGlobal && (
          <button
            onClick={onDelete}
            className="text-foreground/50 hover:text-red-600"
            aria-label="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        {isGlobal && (
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] text-foreground/60">
            global
          </span>
        )}
      </td>
    </tr>
  );
}
