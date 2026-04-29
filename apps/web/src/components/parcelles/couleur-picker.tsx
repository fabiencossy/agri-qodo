"use client";

import { COULEUR_PARCELLE_DEFAUT, COULEURS_PARCELLE } from "@/lib/parcelles";

export function CouleurPicker({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (next: string) => void;
}) {
  const current = value || COULEUR_PARCELLE_DEFAUT;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {COULEURS_PARCELLE.map((c) => {
          const selected = current.toLowerCase() === c.value.toLowerCase();
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => onChange(c.value)}
              title={c.label}
              className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-transform hover:scale-110 ${
                selected ? "border-foreground ring-2 ring-foreground/20" : "border-border"
              }`}
              style={{ backgroundColor: c.value }}
              aria-label={c.label}
              aria-pressed={selected}
            >
              {selected && <span className="text-base font-bold text-white drop-shadow-sm">✓</span>}
            </button>
          );
        })}
        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-foreground/70 hover:bg-muted">
          <input
            type="color"
            value={current}
            onChange={(e) => onChange(e.target.value)}
            className="h-6 w-6 cursor-pointer rounded"
          />
          <span>Personnalisée</span>
        </label>
      </div>
      <p className="text-xs text-foreground/50">
        Cette couleur s'affichera sur la carte des parcelles. Bleu, rouge ou orange permettent de
        différencier rapidement plusieurs zones.
      </p>
    </div>
  );
}
