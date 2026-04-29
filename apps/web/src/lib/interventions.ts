"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export type InterventionType =
  | "SEMIS"
  | "FUMURE_ORGANIQUE"
  | "FUMURE_MINERALE"
  | "PHYTO"
  | "RECOLTE"
  | "TRAVAIL_DU_SOL"
  | "IRRIGATION"
  | "AUTRE";

export type TechniqueEpandage =
  | "EPANDEUR_CLASSIQUE"
  | "RAMPE_PENDILLARDE"
  | "TRAINEE_SOUPLE"
  | "INJECTION"
  | "FUMIER_SOLIDE";

export const TECHNIQUE_LABEL: Record<TechniqueEpandage, string> = {
  EPANDEUR_CLASSIQUE: "Épandeur classique (~30% pertes NH3)",
  RAMPE_PENDILLARDE: "Rampe pendillarde (~15%)",
  TRAINEE_SOUPLE: "Traînée souple / sabots (~10%)",
  INJECTION: "Injection sol (~5%)",
  FUMIER_SOLIDE: "Fumier solide, incorporé < 4h (~25%)",
};

export const TECHNIQUES_ORDER: TechniqueEpandage[] = [
  "RAMPE_PENDILLARDE",
  "TRAINEE_SOUPLE",
  "INJECTION",
  "FUMIER_SOLIDE",
  "EPANDEUR_CLASSIQUE",
];

export type ValidationStatus = "SELF" | "PENDING" | "VALIDATED" | "REJECTED";

export interface Intervention {
  id: string;
  clientUuid: string;
  parcelleId: string;
  parcelle: { id: string; nom: string };
  ownerTenantId: string;
  authorTenantId: string;
  type: InterventionType;
  dateOperation: string;
  produitId: string | null;
  produit: string | null;
  produitRef: {
    id: string;
    libelle: string;
    categorie: string;
    especeCode: string | null;
  } | null;
  quantite: string | null;
  unite: string | null;
  surfaceTravailleeM2: string | null;
  notes: string | null;
  cultureId: string | null;
  culture: { id: string; espece: string; variete: string | null; campagne: number } | null;
  validationStatus: ValidationStatus;
  createdAt: string;
}

export interface CreateInterventionInput {
  parcelleId: string;
  type: InterventionType;
  dateOperation: string;
  produitId?: string;
  produit?: string;
  quantite?: number;
  unite?: string;
  surfaceTravailleeM2?: number;
  techniqueEpandage?: TechniqueEpandage;
  notes?: string;
}

const QUERY_KEY = ["interventions"] as const;

export function useInterventions() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api<Intervention[]>("/api/interventions"),
  });
}

export function useCreateIntervention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInterventionInput) =>
      api<Intervention>("/api/interventions", { method: "POST", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteIntervention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/interventions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

const TYPE_META: Record<InterventionType, { label: string; emoji: string; color: string }> = {
  SEMIS: { label: "Semis", emoji: "🌱", color: "bg-green-100 text-green-800" },
  FUMURE_ORGANIQUE: {
    label: "Fumure organique",
    emoji: "💩",
    color: "bg-amber-100 text-amber-800",
  },
  FUMURE_MINERALE: {
    label: "Fumure minérale",
    emoji: "⚗️",
    color: "bg-blue-100 text-blue-800",
  },
  PHYTO: {
    label: "Traitement phyto",
    emoji: "🧪",
    color: "bg-purple-100 text-purple-800",
  },
  RECOLTE: {
    label: "Récolte",
    emoji: "🌾",
    color: "bg-yellow-100 text-yellow-800",
  },
  TRAVAIL_DU_SOL: {
    label: "Travail du sol",
    emoji: "🚜",
    color: "bg-orange-100 text-orange-800",
  },
  IRRIGATION: {
    label: "Irrigation",
    emoji: "💧",
    color: "bg-sky-100 text-sky-800",
  },
  AUTRE: { label: "Autre", emoji: "📋", color: "bg-gray-100 text-gray-800" },
};

export const TYPES_ORDER: InterventionType[] = [
  "SEMIS",
  "FUMURE_ORGANIQUE",
  "FUMURE_MINERALE",
  "PHYTO",
  "RECOLTE",
  "TRAVAIL_DU_SOL",
  "IRRIGATION",
  "AUTRE",
];

export function libelleType(type: InterventionType): string {
  return TYPE_META[type].label;
}

export function emojiType(type: InterventionType): string {
  return TYPE_META[type].emoji;
}

export function colorType(type: InterventionType): string {
  return TYPE_META[type].color;
}

export function formatDateFr(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatQuantite(quantite: string | null, unite: string | null): string | null {
  if (!quantite) return null;
  const value = Number(quantite);
  if (Number.isNaN(value)) return null;
  return unite ? `${value} ${unite}` : String(value);
}
