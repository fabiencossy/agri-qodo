"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MATERIEL_CATEGORIE_LABEL,
  MATERIEL_CATEGORIES_ORDER,
  MATERIEL_UNITE_LABEL,
  type MaterielCategorie,
  type MaterielUnite,
  useCreateMateriel,
} from "@/lib/materiels";

const UNITES_ORDER: MaterielUnite[] = ["HA", "M3", "T", "H", "FORFAIT"];

export function NewMaterielDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [categorie, setCategorie] = useState<MaterielCategorie>("TRAVAIL_DU_SOL");
  const [libelle, setLibelle] = useState("");
  const [unite, setUnite] = useState<MaterielUnite>("HA");
  const [prix, setPrix] = useState("");
  const [notes, setNotes] = useState("");
  const create = useCreateMateriel();

  if (!open) return null;

  function reset() {
    setCategorie("TRAVAIL_DU_SOL");
    setLibelle("");
    setUnite("HA");
    setPrix("");
    setNotes("");
  }

  async function submit() {
    if (!libelle.trim()) {
      alert("Le libellé est obligatoire.");
      return;
    }
    try {
      await create.mutateAsync({
        libelle: libelle.trim(),
        categorie,
        unite,
        ...(prix ? { prixUnitaireCHF: Number(prix) } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      reset();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Création échouée.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">Nouvelle prestation</h2>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground/60">
              Libellé *
            </span>
            <Input
              autoFocus
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="Ex : Labour à la charrue"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground/60">
              Catégorie
            </span>
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value as MaterielCategorie)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            >
              {MATERIEL_CATEGORIES_ORDER.map((c) => (
                <option key={c} value={c}>
                  {MATERIEL_CATEGORIE_LABEL[c]}
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
                onChange={(e) => setUnite(e.target.value as MaterielUnite)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                {UNITES_ORDER.map((u) => (
                  <option key={u} value={u}>
                    {MATERIEL_UNITE_LABEL[u]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground/60">
                Tarif CHF/{MATERIEL_UNITE_LABEL[unite]}
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={prix}
                onChange={(e) => setPrix(e.target.value)}
                placeholder="Ex : 220"
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
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Charrue 4 socs, ~25-30 cm…"
            />
          </label>
        </div>
        <div className="mt-5 flex gap-2">
          <Button onClick={submit} disabled={create.isPending} className="flex-1">
            {create.isPending ? "Création…" : "Créer"}
          </Button>
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Annuler
          </Button>
        </div>
      </div>
    </div>
  );
}
