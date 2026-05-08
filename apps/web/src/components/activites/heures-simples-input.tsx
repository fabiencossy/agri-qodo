"use client";

/**
 * Bloc heures style qodo-clock : DÉBUT / FIN larges + bloc Pause
 * optionnel + durée effective auto. Mono-utilisateur (l'auteur).
 */
import { Coffee, X } from "lucide-react";
import { useState } from "react";

export interface HeuresSimplesValue {
  heureDebut: string; // "HH:MM"
  heureFin: string; // "HH:MM"
  /** Heure de début de la pause si l'agriculteur en a pris une. */
  heureDebutPause: string;
  /** Durée de la pause en minutes (déduite de la durée effective). */
  dureePauseMinutes: number;
  /** Durée nette = (fin - début) - pause, recalculée à chaque change. */
  dureeMinutes: number;
}

const EMPTY: HeuresSimplesValue = {
  heureDebut: "",
  heureFin: "",
  heureDebutPause: "",
  dureePauseMinutes: 0,
  dureeMinutes: 0,
};

function minutesEntre(debut: string, fin: string): number {
  if (!debut || !fin) return 0;
  const [hd = "0", md = "0"] = debut.split(":");
  const [hf = "0", mf = "0"] = fin.split(":");
  return Math.max(
    0,
    parseInt(hf, 10) * 60 + parseInt(mf, 10) - (parseInt(hd, 10) * 60 + parseInt(md, 10)),
  );
}

function dureeNette(v: HeuresSimplesValue): number {
  const brute = minutesEntre(v.heureDebut, v.heureFin);
  return Math.max(0, brute - (v.dureePauseMinutes || 0));
}

function formatDuree(min: number): string {
  if (min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export function HeuresSimplesInput({
  value,
  onChange,
}: {
  value?: HeuresSimplesValue;
  onChange: (next: HeuresSimplesValue) => void;
}) {
  const v = value ?? EMPTY;
  const [pauseActive, setPauseActive] = useState(!!(v.heureDebutPause || v.dureePauseMinutes));

  function update(patch: Partial<HeuresSimplesValue>) {
    const next: HeuresSimplesValue = { ...v, ...patch };
    next.dureeMinutes = dureeNette(next);
    onChange(next);
  }
  function togglePause(active: boolean) {
    setPauseActive(active);
    if (!active) update({ heureDebutPause: "", dureePauseMinutes: 0 });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <TimeFieldQc
          label="Début"
          value={v.heureDebut}
          onChange={(s) => update({ heureDebut: s })}
        />
        <TimeFieldQc label="Fin" value={v.heureFin} onChange={(s) => update({ heureFin: s })} />
      </div>

      {/* Pause optionnelle */}
      {!pauseActive ? (
        <button
          type="button"
          onClick={() => togglePause(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 py-2 text-xs font-medium text-foreground/60 hover:bg-muted/40"
        >
          <Coffee className="h-3.5 w-3.5" />
          Ajouter une pause
        </button>
      ) : (
        <div className="rounded-xl border border-border p-3">
          <header className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground/60">
              <Coffee className="h-3.5 w-3.5" />
              Pause
            </span>
            <button
              type="button"
              onClick={() => togglePause(false)}
              aria-label="Retirer la pause"
              className="rounded-full p-1 text-foreground/60 hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </header>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                Début pause
              </span>
              <input
                type="time"
                value={v.heureDebutPause}
                onChange={(e) => update({ heureDebutPause: e.target.value })}
                className="h-12 w-full rounded-lg border border-border bg-background px-3 text-center font-mono text-lg font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                Durée
              </span>
              <PauseDureeInput
                value={v.dureePauseMinutes}
                onChange={(m) => update({ dureePauseMinutes: m })}
              />
            </label>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
          Durée effective
        </span>
        <span className="font-mono text-xl font-bold tabular-nums text-green">
          {formatDuree(dureeNette(v))}
        </span>
      </div>
    </div>
  );
}

/**
 * Champ heure custom (HH:MM). On n'utilise plus type="time" parce
 * que l'input natif laisse un état partiel "HH:--" si l'utilisateur
 * tape juste les heures et quitte — ce qui se traduit en value vide
 * côté JS et fait perdre la saisie.
 *
 * Comportement :
 * - input text avec masque progressif (digits autorisés, ":" auto)
 * - onBlur auto-fill : "7" → "07:00", "07" → "07:00", "07:5" → "07:05"
 *   (HH/MM toujours sur 2 chiffres, modulo 24h/60min)
 */
function TimeFieldQc({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  // Synchronise le draft local quand la value parent change (ex: reset).
  if (value !== draft && document.activeElement?.tagName !== "INPUT") {
    setDraft(value);
  }

  function normalize(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    if (!digits) return "";
    let hh = digits.slice(0, 2);
    let mm = digits.slice(2, 4);
    // Pad heures à 2 chiffres (utilisateur tape "7" → "07").
    if (hh.length === 1) hh = `0${hh}`;
    // Borne 0-23 / 0-59. Tout ce qui dépasse → on clip à 23/59.
    const hNum = Math.min(23, parseInt(hh, 10));
    hh = String(hNum).padStart(2, "0");
    if (mm.length === 0) mm = "00";
    else if (mm.length === 1) mm = `${mm}0`;
    const mNum = Math.min(59, parseInt(mm, 10));
    mm = String(mNum).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function handleChange(raw: string) {
    // Pendant la frappe : on accepte les états intermédiaires (HH, HH:M…)
    // et on insère le ":" automatiquement après 2 chiffres.
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    let next = digits;
    if (digits.length >= 3) next = `${digits.slice(0, 2)}:${digits.slice(2)}`;
    else if (digits.length === 2) next = `${digits}:`;
    setDraft(next);
    // On ne propage pas tant que c'est incomplet — onBlur s'en charge.
    if (digits.length === 4) onChange(`${digits.slice(0, 2)}:${digits.slice(2)}`);
    if (digits.length === 0) onChange("");
  }

  function handleBlur() {
    if (!draft) {
      onChange("");
      return;
    }
    const normalized = normalize(draft);
    setDraft(normalized);
    onChange(normalized);
  }

  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-foreground/60">
        {label}
      </span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder="--:--"
        maxLength={5}
        className="h-14 w-full rounded-xl border border-border bg-background px-4 text-center font-mono text-2xl font-semibold tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
      />
    </label>
  );
}

const PRESETS = [15, 30, 45, 60];

function PauseDureeInput({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  return (
    <div className="flex h-12 items-center gap-1">
      {PRESETS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(value === p ? 0 : p)}
          className={`flex-1 rounded-lg border px-1 py-1 text-xs font-semibold transition-colors ${
            value === p
              ? "border-green bg-green/10 text-green"
              : "border-border bg-background text-foreground/60 hover:text-foreground"
          }`}
        >
          {p}min
        </button>
      ))}
    </div>
  );
}
