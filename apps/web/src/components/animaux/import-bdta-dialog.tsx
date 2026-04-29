"use client";

import { Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { type ImportBdtaResult, useImportBdta } from "@/lib/animaux";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportBdtaDialog({ open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importer = useImportBdta();

  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<ImportBdtaResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setCsv("");
      setResult(null);
      setError(null);
    }
  }, [open]);

  const onPickFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      setCsv(text);
    } catch {
      setError("Impossible de lire le fichier.");
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (csv.trim().length < 10) {
      setError("Colle ou choisis un fichier CSV avant de lancer l'import.");
      return;
    }
    importer.mutate(csv, {
      onSuccess: (r) => setResult(r),
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Échec de l'import.";
        setError(msg);
      },
    });
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="rounded-2xl border border-border bg-background p-0 backdrop:bg-black/40 max-w-2xl w-full"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-green" />
          <h2 className="text-lg font-semibold">Importer le cheptel depuis la BDTA</h2>
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

      <form onSubmit={onSubmit} className="space-y-4 px-5 py-4">
        <p className="text-sm text-foreground/70">
          Télécharge l'extraction de ton cheptel depuis le portail{" "}
          <a href="https://agatehome.ch" target="_blank" rel="noreferrer" className="underline">
            Agate / BDTA
          </a>{" "}
          au format CSV, puis dépose le fichier ici (ou colle son contenu).
        </p>

        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onPickFile(file);
            }}
            className="hidden"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" />
              Choisir un fichier CSV
            </Button>
            {csv && (
              <span className="text-sm text-foreground/60 tabular-nums">
                {csv.split(/\r?\n/).filter((l) => l.trim()).length} ligne(s) chargée(s)
              </span>
            )}
          </div>
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-foreground/70">
            …ou colle le contenu CSV directement
          </summary>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={6}
            placeholder={
              "Marque auriculaire;Sexe;Date de naissance;Race\nCH 12.345.6789.0;F;15.03.2022;Holstein"
            }
            className="mt-2 w-full rounded-lg border border-border bg-background p-3 font-mono text-xs"
          />
        </details>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {result && (
          <div className="space-y-2 rounded-xl border border-green/30 bg-green/5 p-4 text-sm">
            <p className="font-semibold">Import terminé</p>
            <ul className="grid grid-cols-2 gap-1 tabular-nums sm:grid-cols-4">
              <li>
                <span className="text-foreground/60">Créés</span> : {result.created}
              </li>
              <li>
                <span className="text-foreground/60">Promus</span> : {result.promoted}
              </li>
              <li>
                <span className="text-foreground/60">Mis à jour</span> : {result.updated}
              </li>
              <li>
                <span className="text-foreground/60">Ignorés</span> : {result.skipped}
              </li>
            </ul>
            {result.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-foreground/70">
                  {result.errors.length} erreur(s) — détail
                </summary>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
                  {result.errors.slice(0, 50).map((err) => (
                    <li key={`${err.ligne}-${err.raison}`}>
                      <span className="font-mono">L{err.ligne}</span> — {err.raison}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          <Button type="submit" disabled={importer.isPending || !csv}>
            {importer.isPending ? "Import en cours…" : "Lancer l'import"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
