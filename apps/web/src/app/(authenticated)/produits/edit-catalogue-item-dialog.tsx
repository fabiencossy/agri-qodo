"use client";

/**
 * Dialog d'édition d'un Bien (Produit) ou Prestation (Matériel) du
 * catalogue. Demande Fabien 2026-05-06 : "tjs pas la possibilité de
 * modifier les produits depuis Agri Qodo en cliquant dessus" — étendu
 * 2026-05-07 avec Catégorie et Taux TVA pour faciliter la facturation
 * suisse 2026 (poussé en taxes_id côté Odoo).
 */
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type Materiel,
  type MaterielCategorie,
  type MaterielUnite,
  MATERIEL_CATEGORIE_LABEL,
  MATERIEL_CATEGORIES_ORDER,
  MATERIEL_UNITE_LABEL,
  useUpdateMateriel,
} from "@/lib/materiels";
import {
  CATEGORIE_LABEL,
  CATEGORIES_ORDER,
  type Produit,
  type ProduitCategorie,
  type ProduitUnite,
  UNITE_LABEL,
  useUpdateProduit,
} from "@/lib/produits";

const PRODUIT_UNITES: ProduitUnite[] = ["KG", "T", "L", "M3", "DOSE"];
const MATERIEL_UNITES: MaterielUnite[] = ["HA", "M3", "T", "H", "FORFAIT"];

// Taux TVA suisse 2024+ (AFC). "" = ne rien envoyer (héritage du
// défaut Odoo). "custom" = saisie libre (cas marginaux).
const TVA_PRESETS: Array<{ value: string; label: string }> = [
  { value: "", label: "Non défini" },
  { value: "8.1", label: "8.1 % — Normal" },
  { value: "3.8", label: "3.8 % — Hébergement" },
  { value: "2.6", label: "2.6 % — Réduit" },
  { value: "0", label: "0 % — Exonéré" },
  { value: "custom", label: "Autre…" },
];

function tvaToPresetValue(taux: string | null): string {
  if (taux === null) return "";
  const n = Number(taux);
  if (Number.isNaN(n)) return "custom";
  if (n === 8.1) return "8.1";
  if (n === 3.8) return "3.8";
  if (n === 2.6) return "2.6";
  if (n === 0) return "0";
  return "custom";
}

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
  const [categorie, setCategorie] = useState("");
  const [tvaPreset, setTvaPreset] = useState("");
  const [tvaCustom, setTvaCustom] = useState("");
  const [notes, setNotes] = useState("");
  const updateProduit = useUpdateProduit();
  const updateMateriel = useUpdateMateriel();

  useEffect(() => {
    if (!item) return;
    setLibelle(item.data.libelle);
    setNotes(item.data.notes ?? "");
    setCategorie(item.data.categorie);
    const preset = tvaToPresetValue(item.data.tauxTvaPercent);
    setTvaPreset(preset);
    setTvaCustom(preset === "custom" ? (item.data.tauxTvaPercent ?? "") : "");
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

  function resolveTvaPayload(): { tauxTvaPercent: number | null } | null {
    if (tvaPreset === "") return { tauxTvaPercent: null };
    if (tvaPreset === "custom") {
      const trimmed = tvaCustom.trim();
      if (!trimmed) return { tauxTvaPercent: null };
      const n = Number(trimmed.replace(",", "."));
      if (Number.isNaN(n) || n < 0 || n > 100) {
        alert("Taux TVA invalide (entre 0 et 100, ex : 8.1).");
        return null;
      }
      return { tauxTvaPercent: n };
    }
    return { tauxTvaPercent: Number(tvaPreset) };
  }

  async function submit() {
    if (!item) return;
    if (!libelle.trim()) {
      alert("Le libellé est obligatoire.");
      return;
    }
    const tva = resolveTvaPayload();
    if (!tva) return;
    try {
      if (item.kind === "bien") {
        await updateProduit.mutateAsync({
          id: item.data.id,
          libelle: libelle.trim(),
          unite: unite as ProduitUnite,
          categorie: categorie as ProduitCategorie,
          ...(prix ? { prixVenteCHF: Number(prix) } : {}),
          ...(tva.tauxTvaPercent !== null ? { tauxTvaPercent: tva.tauxTvaPercent } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });
      } else {
        await updateMateriel.mutateAsync({
          id: item.data.id,
          libelle: libelle.trim(),
          unite: unite as MaterielUnite,
          categorie: categorie as MaterielCategorie,
          ...(prix ? { prixUnitaireCHF: Number(prix) } : {}),
          ...(tva.tauxTvaPercent !== null ? { tauxTvaPercent: tva.tauxTvaPercent } : {}),
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
  const categorieOptions =
    item.kind === "bien"
      ? CATEGORIES_ORDER.map((c) => ({ value: c, label: CATEGORIE_LABEL[c] }))
      : MATERIEL_CATEGORIES_ORDER.map((c) => ({ value: c, label: MATERIEL_CATEGORIE_LABEL[c] }));

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
            Cet item vient du catalogue global. En enregistrant, on crée une copie perso pour ton
            exploitation que tu pourras ensuite pousser vers Odoo.
          </div>
        )}

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground/60">
              Libellé *
            </span>
            <Input autoFocus value={libelle} onChange={(e) => setLibelle(e.target.value)} />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground/60">
              Catégorie
            </span>
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            >
              {categorieOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground/60">
                Unité
              </span>
              <select
                value={unite}
                onChange={(e) => setUnite(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
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
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground/60">
                Taux TVA
              </span>
              <select
                value={tvaPreset}
                onChange={(e) => setTvaPreset(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                {TVA_PRESETS.map((t) => (
                  <option key={t.value || "none"} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            {tvaPreset === "custom" && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground/60">
                  Taux % (custom)
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  inputMode="decimal"
                  value={tvaCustom}
                  onChange={(e) => setTvaCustom(e.target.value)}
                  placeholder="ex : 7.7"
                />
              </label>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground/60">
              Notes (optionnel)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          <Button onClick={submit} disabled={isPending} className="flex-1">
            {isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Annuler
          </Button>
        </div>
      </div>
    </div>
  );
}
