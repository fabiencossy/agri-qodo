"use client";

import { Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type Animal, useAnimaux, useDeleteAnimal, useIdentifierBovin } from "@/lib/animaux";
import { type AnimalCategorie, emojiCategorie, libelleCategorie } from "@/lib/srpa";

interface Props {
  categorie: AnimalCategorie;
  totalActifs: number;
  open: boolean;
  onClose: () => void;
}

export function IdentifierBovinDialog({ categorie, totalActifs, open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const identifies = useAnimaux({ categorie, identified: true });
  const identifier = useIdentifierBovin();
  const remove = useDeleteAnimal();

  const [numeroBoucle, setNumeroBoucle] = useState("");
  const [nom, setNom] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  // Pas d'effet : reset des champs quand on ferme via la prop.
  useEffect(() => {
    if (!open) {
      setNumeroBoucle("");
      setNom("");
      setDateNaissance("");
      setError(null);
    }
  }, [open]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!numeroBoucle.trim()) {
      setError("Le n° de boucle BDTA est requis.");
      return;
    }
    const payload: Parameters<typeof identifier.mutate>[0] = {
      categorie,
      numeroBoucle: numeroBoucle.trim(),
    };
    const nomTrim = nom.trim();
    if (nomTrim) payload.nom = nomTrim;
    if (dateNaissance) payload.dateNaissance = dateNaissance;
    identifier.mutate(payload, {
      onSuccess: () => {
        setNumeroBoucle("");
        setNom("");
        setDateNaissance("");
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Impossible d'identifier ce bovin.";
        setError(msg);
      },
    });
  };

  const nbIdentifies = identifies.data?.length ?? 0;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Click sur le backdrop (pas le contenu) ferme la dialog.
        if (e.target === ref.current) onClose();
      }}
      className="rounded-2xl border border-border bg-background p-0 backdrop:bg-black/40 max-w-lg w-full"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{emojiCategorie(categorie)}</span>
          <div>
            <h2 className="text-lg font-semibold">{libelleCategorie(categorie)}</h2>
            <p className="text-xs text-foreground/60">
              {nbIdentifies} identifié{nbIdentifies > 1 ? "s" : ""} sur {totalActifs} actif
              {totalActifs > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 hover:bg-muted"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
        {identifies.isLoading ? (
          <p className="text-sm text-foreground/60">Chargement…</p>
        ) : nbIdentifies === 0 ? (
          <p className="text-sm text-foreground/60">
            Aucun bovin identifié pour le moment. Saisis un n° de boucle BDTA pour commencer.
          </p>
        ) : (
          <ul className="space-y-2">
            {identifies.data?.map((a) => (
              <BovinRow key={a.id} animal={a} onDelete={remove.mutate} />
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-3 border-t border-border bg-muted/30 px-5 py-4">
        <h3 className="text-sm font-semibold">Identifier un bovin</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-foreground/70">N° de boucle BDTA *</span>
            <Input
              value={numeroBoucle}
              onChange={(e) => setNumeroBoucle(e.target.value)}
              placeholder="CH 12.345.6789.0"
              maxLength={20}
              required
              autoFocus
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-foreground/70">Nom (optionnel)</span>
            <Input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Marguerite"
              maxLength={80}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-foreground/70">Date de naissance (optionnel)</span>
            <Input
              type="date"
              value={dateNaissance}
              onChange={(e) => setDateNaissance(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
            />
            <span className="mt-1 block text-xs text-foreground/50">
              Si renseignée, le coefficient UGB s'affine selon la tranche d'âge OPD.
            </span>
          </label>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          <Button type="submit" disabled={identifier.isPending}>
            {identifier.isPending ? "…" : "Ajouter"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}

function BovinRow({ animal, onDelete }: { animal: Animal; onDelete: (id: string) => void }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="font-medium tabular-nums">{animal.numeroBoucle ?? "—"}</div>
        <div className="truncate text-xs text-foreground/60">
          {animal.nom ? animal.nom : <span className="italic">sans nom</span>}
          {animal.dateNaissance && (
            <>
              {" · "}
              né{animal.dateNaissance && new Date(animal.dateNaissance).getMonth() < 6
                ? "e"
                : ""}{" "}
              le {new Date(animal.dateNaissance).toLocaleDateString("fr-CH")}
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          if (confirm(`Supprimer ${animal.numeroBoucle ?? "ce bovin"} ?`)) onDelete(animal.id);
        }}
        className="rounded-lg p-2 text-foreground/60 hover:bg-red-50 hover:text-red-600"
        aria-label="Supprimer"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
