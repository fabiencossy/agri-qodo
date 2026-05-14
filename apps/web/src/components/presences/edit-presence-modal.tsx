/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { HhmmTimeInput } from "@/components/ui/hhmm-time-input";
import { Input } from "@/components/ui/input";
import { extractApiErrorMessage } from "@/lib/api-client";
import { type Presence, useUpdatePresence } from "@/lib/presences";

interface EditPresenceModalProps {
  presence: Presence;
  onClose: () => void;
}

function combineDateTime(date: string, time: string): string | null {
  if (!date || !time) return null;
  const iso = `${date}T${time}:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function isoToDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function isoToHm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Modal d'édition d'une présence existante. Permet de corriger Date,
 * Heure de début, Heure de fin et notes. La durée est recalculée
 * automatiquement côté backend.
 *
 * Utilise <HhmmTimeInput> pour la saisie compacte qodo-clock
 * (720 → 07:20). Esc ferme la modal, clic backdrop aussi.
 */
export function EditPresenceModal({ presence, onClose }: EditPresenceModalProps) {
  const [date, setDate] = useState(isoToDate(presence.dateDebut));
  const [heureDebut, setHeureDebut] = useState(isoToHm(presence.dateDebut));
  const [heureFin, setHeureFin] = useState(presence.dateFin ? isoToHm(presence.dateFin) : "");
  const [notes, setNotes] = useState(presence.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const update = useUpdatePresence();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const dateDebut = combineDateTime(date, heureDebut);
    if (!dateDebut) {
      setError("Date et heure de début obligatoires.");
      return;
    }
    const dateFin = heureFin ? combineDateTime(date, heureFin) : "";
    if (heureFin && !dateFin) {
      setError("Heure de fin invalide.");
      return;
    }
    if (dateFin && new Date(dateFin) <= new Date(dateDebut)) {
      setError("L'heure de fin doit être après l'heure de début.");
      return;
    }
    update.mutate(
      {
        id: presence.id,
        dateDebut,
        ...(dateFin ? { dateFin } : {}),
        notes,
      },
      {
        onSuccess: () => onClose(),
        onError: (err) =>
          setError(
            extractApiErrorMessage(err) ??
              "Modification impossible. Vérifie tes heures et réessaie.",
          ),
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-[9200] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold">Modifier la présence</h2>
            <p className="mt-0.5 text-xs text-foreground/60">
              Tape <code className="rounded bg-muted px-1">720</code> pour 7h20,{" "}
              <code className="rounded bg-muted px-1">7</code> pour 7h pile.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-md p-1.5 text-foreground/50 hover:bg-muted hover:text-foreground/80"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-foreground/70">Date</span>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="h-12 w-full"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground/70">Heure de début</span>
              <HhmmTimeInput
                value={heureDebut}
                onChange={setHeureDebut}
                ariaLabel="Heure de début"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground/70">Heure de fin</span>
              <HhmmTimeInput value={heureFin} onChange={setHeureFin} ariaLabel="Heure de fin" />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-foreground/70">Notes (optionnel)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
              placeholder="Conditions, remarques…"
              maxLength={500}
            />
          </label>

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
