"use client";

/**
 * Sélecteur de matériel/prestation en overlay plein écran avec
 * recherche live. Conçu pour les gros catalogues (113 prestations
 * Agridea + persos). Pattern identique à ProduitFullscreenPicker pour
 * cohérence d'UX.
 *
 * En cas B (parcelle d'un partenaire), le matériel sélectionné servira
 * à générer la ligne sale.order Odoo facturée au client (qty = surfaceHa,
 * prix = prixUnitaireCHF).
 *
 * Demande Fabien 2026-05-06 : "il faut pouvoir rechercher donc
 * ouverture en pleine page des matériaux utilisés".
 */
import { Check, ChevronDown, Search, Wrench, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { InterventionType } from "@/lib/interventions";
import {
  MATERIEL_CATEGORIE_LABEL,
  type Materiel,
  type MaterielCategorie,
  MATERIEL_UNITE_LABEL,
  useMateriels,
} from "@/lib/materiels";

const TYPE_TO_CATEGORIE: Record<InterventionType, MaterielCategorie | null> = {
  SEMIS: "SEMIS",
  FUMURE_ORGANIQUE: "FERTILISATION",
  FUMURE_MINERALE: "FERTILISATION",
  PHYTO: "PROTECTION",
  RECOLTE: "RECOLTE",
  TRAVAIL_DU_SOL: "TRAVAIL_DU_SOL",
  IRRIGATION: "IRRIGATION",
  AUTRE: null,
};

const CATEGORIES_ORDER: MaterielCategorie[] = [
  "TRAVAIL_DU_SOL",
  "SEMIS",
  "FERTILISATION",
  "PROTECTION",
  "RECOLTE",
  "IRRIGATION",
  "TRANSPORT",
  "AUTRE",
];

function formatCHF(n: number): string {
  return n.toLocaleString("fr-CH", { style: "currency", currency: "CHF" });
}

export interface MaterielPickerProps {
  /** Type d'intervention courant — pré-filtre les matériels affichés. */
  interventionType: InterventionType;
  /** ID Matériel sélectionné, ou vide. */
  value: string;
  onChange: (materielId: string, materiel: Materiel | null) => void;
}

export function MaterielPicker({ interventionType, value, onChange }: MaterielPickerProps) {
  // Pré-filtre par catégorie correspondant au type d'intervention.
  // L'utilisateur peut basculer en "Toutes" dans le panel pour voir
  // tous les matériels.
  const presetCategorie = TYPE_TO_CATEGORIE[interventionType];
  const allMateriels = useMateriels();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filtreCat, setFiltreCat] = useState<MaterielCategorie | null>(presetCategorie);
  const inputRef = useRef<HTMLInputElement>(null);

  // Resync filtreCat quand le type d'intervention change (ex SEMIS → PHYTO).
  useEffect(() => {
    setFiltreCat(presetCategorie);
  }, [presetCategorie]);

  const choisi: Materiel | undefined = (allMateriels.data ?? []).find((m) => m.id === value);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo<Materiel[]>(() => {
    const q = query.trim().toLowerCase();
    return (allMateriels.data ?? [])
      .filter((m) => m.actif)
      .filter((m) => (filtreCat ? m.categorie === filtreCat : true))
      .filter((m) =>
        !q
          ? true
          : [m.libelle, m.notes ?? "", m.code].filter(Boolean).join(" ").toLowerCase().includes(q),
      )
      .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
  }, [allMateriels.data, query, filtreCat]);

  const triggerLabel = choisi
    ? `${choisi.libelle}${choisi.prixUnitaireCHF ? ` · ${formatCHF(Number(choisi.prixUnitaireCHF))}/${MATERIEL_UNITE_LABEL[choisi.unite]}` : ""}`
    : "Aucun matériel précis";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
      >
        <span
          className={`flex min-w-0 items-center gap-2 truncate ${choisi ? "" : "text-foreground/50"}`}
        >
          {choisi && <Wrench className="h-4 w-4 flex-shrink-0 text-foreground/50" />}
          <span className="truncate">{triggerLabel}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-foreground/50" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[8000] flex flex-col bg-background"
          role="dialog"
          aria-label="Choisir un matériel"
        >
          <header className="border-b border-border bg-background p-3 sm:p-4">
            <div className="mx-auto flex max-w-3xl items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher par libellé, notes…"
                  className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
                />
              </div>
            </div>
            <div className="mx-auto mt-2 flex max-w-3xl flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFiltreCat(null)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  filtreCat === null
                    ? "border-green bg-green text-white"
                    : "border-border bg-background text-foreground/60 hover:text-foreground"
                }`}
              >
                Toutes
              </button>
              {CATEGORIES_ORDER.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFiltreCat(filtreCat === c ? null : c)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    filtreCat === c
                      ? "border-green bg-green text-white"
                      : "border-border bg-background text-foreground/60 hover:text-foreground"
                  }`}
                >
                  {MATERIEL_CATEGORIE_LABEL[c]}
                </button>
              ))}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-3 py-3 sm:px-4">
              {/* Option "Aucun matériel" en tête */}
              <button
                type="button"
                onClick={() => {
                  onChange("", null);
                  setOpen(false);
                }}
                className={`mb-2 flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                  value === ""
                    ? "border-foreground/30 bg-muted font-medium"
                    : "border-dashed border-border bg-background hover:bg-muted/50"
                }`}
              >
                <span className="text-sm text-foreground/70">Aucun matériel précis</span>
                {value === "" && <Check className="h-5 w-5 text-foreground/60" />}
              </button>

              {allMateriels.isLoading ? (
                <p className="py-8 text-center text-sm text-foreground/60">Chargement…</p>
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
                  <p className="text-sm text-foreground/60">
                    {query
                      ? `Aucun matériel ne correspond à « ${query} ».`
                      : "Aucun matériel dans cette catégorie."}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border rounded-2xl border border-border bg-background">
                  {filtered.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(m.id, m);
                          setOpen(false);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                      >
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Wrench className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold">{m.libelle}</span>
                            {m.id === value && (
                              <Check
                                className="h-4 w-4 shrink-0 text-green"
                                aria-label="Sélectionné"
                              />
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-foreground/60">
                            <span>{MATERIEL_CATEGORIE_LABEL[m.categorie]}</span>
                            {m.notes && <span>· {m.notes}</span>}
                          </div>
                        </div>
                        {m.prixUnitaireCHF ? (
                          <span className="shrink-0 font-mono text-xs tabular-nums text-foreground/70">
                            {formatCHF(Number(m.prixUnitaireCHF))}
                            <span className="text-foreground/40">
                              /{MATERIEL_UNITE_LABEL[m.unite]}
                            </span>
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs text-foreground/40">tarif libre</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-center text-[11px] text-foreground/50">
                {filtered.length} matériel{filtered.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
