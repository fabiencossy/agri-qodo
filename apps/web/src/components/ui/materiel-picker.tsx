"use client";

/**
 * Sélecteur de matériel "gros doigts" — grille de cartes filtrées par
 * la catégorie correspondant au type d'intervention. Au lieu d'un
 * dropdown étriqué, l'agriculteur voit directement ses options visuellement.
 *
 * En cas B (parcelle d'un partenaire), le matériel sélectionné servira
 * à générer la ligne sale.order Odoo facturée au client (qty = surfaceHa,
 * prix = prixUnitaireCHF).
 */
import { Check, Wrench } from "lucide-react";
import { useMemo } from "react";
import type { InterventionType } from "@/lib/interventions";
import {
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

function formatCHF(n: number): string {
  return n.toLocaleString("fr-CH", { style: "currency", currency: "CHF" });
}

export interface MaterielPickerProps {
  /** Type d'intervention courant — filtre les matériels affichés. */
  interventionType: InterventionType;
  /** ID Matériel sélectionné, ou vide. */
  value: string;
  onChange: (materielId: string, materiel: Materiel | null) => void;
}

export function MaterielPicker({ interventionType, value, onChange }: MaterielPickerProps) {
  const categorie = TYPE_TO_CATEGORIE[interventionType];
  const materiels = useMateriels(categorie ?? undefined);

  const list = useMemo<Materiel[]>(() => {
    if (!materiels.data) return [];
    return [...materiels.data]
      .filter((m) => m.actif)
      .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
  }, [materiels.data]);

  if (materiels.isLoading) {
    return <div className="text-sm text-foreground/60">Chargement du catalogue matériel…</div>;
  }

  if (list.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-foreground/60">
        <Wrench className="mx-auto mb-2 h-8 w-8 opacity-40" />
        <p>Aucun matériel disponible pour ce type d&apos;opération.</p>
        <p className="mt-1 text-xs">
          Demande à un OWNER d&apos;ajouter du matériel au catalogue ou de synchroniser depuis Odoo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onChange("", null)}
        className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-colors ${
          value === ""
            ? "border-foreground/30 bg-muted font-medium"
            : "border-border bg-background hover:bg-muted/50"
        }`}
      >
        <span className="text-sm text-foreground/70">Aucun matériel précis</span>
        {value === "" && <Check className="h-5 w-5 text-foreground/60" />}
      </button>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {list.map((m) => {
          const isSelected = value === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id, m)}
              className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-all active:scale-95 ${
                isSelected
                  ? "border-green bg-green/10 shadow-sm"
                  : "border-border bg-background hover:border-foreground/20 hover:shadow-sm"
              }`}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Wrench className="h-4 w-4" />
                </span>
                {isSelected && <Check className="h-4 w-4 text-green" />}
              </div>
              <span className="text-sm font-medium leading-tight">{m.libelle}</span>
              {m.prixUnitaireCHF ? (
                <span className="font-mono text-xs tabular-nums text-foreground/60">
                  {formatCHF(Number(m.prixUnitaireCHF))}
                  <span className="text-foreground/40">/{MATERIEL_UNITE_LABEL[m.unite]}</span>
                </span>
              ) : (
                <span className="text-xs text-foreground/40">tarif libre</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
