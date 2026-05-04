/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
"use client";

/**
 * Input HHMM compact pour saisir une heure du jour à la qodo-clock.
 *
 * Accepte au blur :
 * - "720"   → "07:20"
 * - "7"     → "07:00"
 * - "12"    → "12:00"
 * - "1430"  → "14:30"
 * - "7h20"  → "07:20"
 * - "7:20"  → "07:20"
 * - "7.5"   → "07:30"  (décimal pour les heures)
 *
 * Émet une chaîne au format `HH:MM` (ou "" si vide / invalide). Le
 * format de sortie est compatible avec un `<input type="time">` standard
 * et avec les helpers existants `combineDateTime(date, time)`.
 *
 * On ne reformate qu'au blur pour ne pas perturber la frappe en cours.
 */
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export interface HhmmTimeInputProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

/** Convertit une saisie libre en "HH:MM" valide ou "" si non parsable. */
export function parseHhmmTime(input: string): string {
  const s = input.trim().toLowerCase();
  if (!s) return "";

  // 7h20 / 7h
  const hMatch = /^(\d{1,2})\s*h\s*(\d{1,2})?$/.exec(s);
  if (hMatch) {
    const h = parseInt(hMatch[1] ?? "0", 10);
    const m = hMatch[2] ? parseInt(hMatch[2], 10) : 0;
    if (h < 24 && m < 60) return formatHm(h, m);
  }

  // 7:20
  const cMatch = /^(\d{1,2}):(\d{1,2})$/.exec(s);
  if (cMatch) {
    const h = parseInt(cMatch[1] ?? "0", 10);
    const m = parseInt(cMatch[2] ?? "0", 10);
    if (h < 24 && m < 60) return formatHm(h, m);
  }

  // 7.5 / 7,5 décimal (heures)
  const dMatch = /^(\d{1,2})[.,](\d{1,2})$/.exec(s);
  if (dMatch) {
    const v = parseFloat(s.replace(",", "."));
    if (Number.isFinite(v) && v >= 0 && v < 24) {
      const h = Math.floor(v);
      const m = Math.round((v - h) * 60);
      if (m < 60) return formatHm(h, m);
    }
  }

  // Pure number : "7", "12", "720", "1430"
  const nMatch = /^(\d{1,4})$/.exec(s);
  if (nMatch) {
    const n = parseInt(nMatch[1] ?? "0", 10);
    if (s.length <= 2) {
      // 1-2 chiffres : c'est l'heure pleine
      if (n < 24) return formatHm(n, 0);
    } else {
      // 3-4 chiffres : HHMM compact (les 2 derniers = minutes)
      const m = n % 100;
      const h = Math.floor(n / 100);
      if (h < 24 && m < 60) return formatHm(h, m);
    }
  }

  return "";
}

function formatHm(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function HhmmTimeInput({
  value,
  onChange,
  placeholder = "ex : 720, 7h20, 7:20",
  disabled,
  className,
  ariaLabel,
}: HhmmTimeInputProps) {
  // État local pour permettre la frappe libre. On sync avec `value`
  // quand le parent change (ex : reset du formulaire).
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    if (draft === value) return;
    if (!draft.trim()) {
      onChange("");
      return;
    }
    const parsed = parseHhmmTime(draft);
    if (parsed) {
      onChange(parsed);
      setDraft(parsed);
    } else {
      // Saisie non parsable — on rollback au dernier value valide.
      setDraft(value);
    }
  };

  return (
    <div
      className={cn(
        "flex h-12 items-center rounded-lg border border-border bg-background px-3",
        "focus-within:outline-none focus-within:ring-2 focus-within:ring-green",
        disabled ? "opacity-60" : "",
        className,
      )}
    >
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        className="min-w-0 flex-1 bg-transparent font-mono text-base tabular-nums outline-none disabled:cursor-not-allowed"
      />
      <Clock className="ml-2 h-4 w-4 flex-shrink-0 text-foreground/40" aria-hidden />
    </div>
  );
}
