"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/lib/auth";
import {
  CATEGORIE_LABEL,
  CATEGORIES_ORDER,
  type ProduitCategorie,
  type ProduitUnite,
  UNITE_LABEL,
  useCreateProduit,
} from "@/lib/produits";

const UNITES_ORDER: ProduitUnite[] = ["KG", "L", "T", "M3", "DOSE"];

export function NewProduitDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [categorie, setCategorie] = useState<ProduitCategorie>("SEMENCE");
  const [libelle, setLibelle] = useState("");
  const [fournisseur, setFournisseur] = useState("");
  const [marque, setMarque] = useState("");
  const [especeCode, setEspeceCode] = useState("");
  const [tauxN, setTauxN] = useState("");
  const [tauxP, setTauxP] = useState("");
  const [tauxK, setTauxK] = useState("");
  const [unite, setUnite] = useState<ProduitUnite>("KG");
  const [prixVente, setPrixVente] = useState("");
  const [notes, setNotes] = useState("");
  const create = useCreateProduit();
  const me = useCurrentUser();
  const isAdmin = me.data?.role === "OWNER" || me.data?.role === "COMPTABLE";

  if (!open) return null;

  const isSemence = categorie === "SEMENCE";
  const isEngrais = categorie === "ENGRAIS_MINERAL" || categorie === "ENGRAIS_ORGANIQUE";

  const reset = () => {
    setLibelle("");
    setFournisseur("");
    setMarque("");
    setEspeceCode("");
    setTauxN("");
    setTauxP("");
    setTauxK("");
    setPrixVente("");
    setNotes("");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!libelle.trim()) return;
    create.mutate(
      {
        categorie,
        libelle: libelle.trim(),
        ...(fournisseur.trim() ? { fournisseur: fournisseur.trim() } : {}),
        ...(marque.trim() ? { marque: marque.trim() } : {}),
        ...(isSemence && especeCode.trim() ? { especeCode: especeCode.trim() } : {}),
        ...(isEngrais && tauxN ? { tauxN: Number(tauxN) } : {}),
        ...(isEngrais && tauxP ? { tauxP: Number(tauxP) } : {}),
        ...(isEngrais && tauxK ? { tauxK: Number(tauxK) } : {}),
        unite,
        ...(isAdmin && prixVente ? { prixVenteCHF: Number(prixVente) } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-xl font-bold">Nouveau produit perso</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Catégorie">
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value as ProduitCategorie)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-base"
            >
              {CATEGORIES_ORDER.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIE_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Libellé *">
            <Input
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="Ex: Mon mélange prairie maison"
              required
              maxLength={120}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fournisseur">
              <Input
                value={fournisseur}
                onChange={(e) => setFournisseur(e.target.value)}
                placeholder="Ex: Coop locale"
                maxLength={80}
              />
            </Field>
            <Field label="Marque / variété">
              <Input
                value={marque}
                onChange={(e) => setMarque(e.target.value)}
                placeholder="Ex: Variété ferme"
                maxLength={80}
              />
            </Field>
          </div>

          {isSemence && (
            <Field label="Code espèce (pour Suisse-Bilanz)">
              <Input
                value={especeCode}
                onChange={(e) => setEspeceCode(e.target.value)}
                placeholder="Ex: ble_panifiable, mais_grain, prairie_temporaire"
                maxLength={60}
              />
              <p className="mt-1 text-xs text-foreground/60">
                Doit matcher une clé du rule engine pour que la culture soit reconnue.
              </p>
            </Field>
          )}

          {isEngrais && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="N (%)">
                <Input
                  type="number"
                  step="0.01"
                  value={tauxN}
                  onChange={(e) => setTauxN(e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="P (%)">
                <Input
                  type="number"
                  step="0.01"
                  value={tauxP}
                  onChange={(e) => setTauxP(e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="K (%)">
                <Input
                  type="number"
                  step="0.01"
                  value={tauxK}
                  onChange={(e) => setTauxK(e.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>
          )}

          <div className={`grid gap-3 ${isAdmin ? "grid-cols-2" : ""}`}>
            <Field label="Unité">
              <select
                value={unite}
                onChange={(e) => setUnite(e.target.value as ProduitUnite)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-base"
              >
                {UNITES_ORDER.map((u) => (
                  <option key={u} value={u}>
                    {UNITE_LABEL[u]}
                  </option>
                ))}
              </select>
            </Field>

            {isAdmin && (
              <Field label="Prix vente CHF/u">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={prixVente}
                  onChange={(e) => setPrixVente(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            )}
          </div>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full rounded-lg border border-border bg-background p-2 text-sm"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={create.isPending || !libelle.trim()}>
              Créer
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
