"use client";

/**
 * Dialog d'édition d'un Bien (Produit) ou Prestation (Matériel) du
 * catalogue. Demande Fabien 2026-05-06 : "tjs pas la possibilité de
 * modifier les produits depuis Agri Qodo en cliquant dessus".
 *
 * Champs minimaux modifiables : libellé, prix, unité, notes. Le code
 * et la catégorie restent immuables (le code est utilisé en cascade
 * pour la traçabilité Odoo, la catégorie organise le filtre).
 */
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type Materiel,
  type MaterielUnite,
  MATERIEL_UNITE_LABEL,
  useUpdateMateriel,
} from "@/lib/materiels";
import { type Produit, type ProduitUnite, UNITE_LABEL, useUpdateProduit } from "@/lib/produits";

const PRODUIT_UNITES: ProduitUnite[] = ["KG", "T", "L", "M3", "DOSE"];
const MATERIEL_UNITES: MaterielUnite[] = ["HA", "M3", "T", "H", "FORFAIT"];

export type CatalogueItemForEdit =
  | { kind: "bien"; data: Produit }
  | { kind: "prestation"; data: Materiel };

export function EditCatalogueItemDialog({
  item,
  onClose,
}: {
  item: CatalogueItemForEdit | null;
  onClose: () => void;
}) {
  const [libelle, setLibelle] = useState("");
  const [prix, setPrix] = useState("");
  const [unite, setUnite] = useState("");
  const [notes, setNotes] = useState("");
  const updateProduit = useUpdateProduit();
  const updateMateriel = useUpdateMateriel();

  useEffect(() => {
    if (!item) return;
    setLibelle(item.data.libelle);
    setNotes(item.data.notes ?? "");
    if (item.kind === "bien") {
      setPrix(item.data.prixVenteCHF ? String(item.data.prixVenteCHF) : "");
      setUnite(item.data.unite);
    } else {
      setPrix(item.data.prixUnitaireCHF ? String(item.data.prixUnitaireCHF) : "");
      setUnite(item.data.unite);
    }
  }, [item]);

  if (!item) return null;
  const isGlobal = item.data.tenantId === null;

  async function submit() {
    if (!item) return;
    if (!libelle.trim()) {
      alert("Le libellé est obligatoire.");
      return;
    }
    try {
      if (item.kind === "bien") {
        await updateProduit.mutateAsync({
          id: item.data.id,
          libelle: libelle.trim(),
          unite: unite as ProduitUnite,
          ...(prix ? { prixVenteCHF: Number(prix) } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });
      } else {
        await updateMateriel.mutateAsync({
          id: item.data.id,
          libelle: libelle.trim(),
          unite: unite as MaterielUnite,
          ...(prix ? { prixUnitaireCHF: Number(prix) } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });
      }
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Modification échouée.");
    }
  }

  const isPending = updateProduit.isPending || updateMateriel.isPending;
  const uniteLabels =
    item.kind === "bien"
      ? PRODUIT_UNITES.map((u) => ({ value: u, label: UNITE_LABEL[u] }))
      : MATERIEL_UNITES.map((u) => ({ value: u, label: MATERIEL_UNITE_LABEL[u] }));

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
          <h2 className="text-lg font-semibold">
            Modifier {item.kind === "bien" ? "le bien" : "la prestation"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-1 text-foreground/60 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isGlobal && (
          <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Cet item appartient au catalogue global et n&apos;est pas modifiable. Pousse-le vers
            Odoo pour en faire une copie perso modifiable.
          </div>
        )}

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground/60">
              Libellé *
            </span>
            <Input
              autoFocus
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              disabled={isGlobal}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground/60">
                Unité
              </span>
              <select
                value={unite}
                onChange={(e) => setUnite(e.target.value)}
                disabled={isGlobal}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-50"
              >
                {uniteLabels.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground/60">
                Prix CHF / {uniteLabels.find((u) => u.value === unite)?.label ?? unite}
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={prix}
                onChange={(e) => setPrix(e.target.value)}
                disabled={isGlobal}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground/60">
              Notes (optionnel)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              disabled={isGlobal}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
            />
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          {!isGlobal && (
            <Button onClick={submit} disabled={isPending} className="flex-1">
              {isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} className="flex-1">
            {isGlobal ? "Fermer" : "Annuler"}
          </Button>
        </div>
      </div>
    </div>
  );
}
