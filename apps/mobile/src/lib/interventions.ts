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

export interface Intervention {
  id: string;
  parcelleId: string;
  parcelle: { id: string; nom: string };
  type: InterventionType;
  dateOperation: string;
  produit: string | null;
  quantite: string | null;
  unite: string | null;
  notes: string | null;
  validationStatus: "SELF" | "PENDING" | "VALIDATED" | "REJECTED";
  ownerTenantId: string;
  authorTenantId: string;
  createdAt: string;
}

export interface CreateInterventionInput {
  parcelleId: string;
  type: InterventionType;
  dateOperation: string;
  produit?: string;
  quantite?: number;
  unite?: string;
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

const TYPE_META: Record<InterventionType, { label: string; emoji: string }> = {
  SEMIS: { label: "Semis", emoji: "🌱" },
  FUMURE_ORGANIQUE: { label: "Fumure organique", emoji: "💩" },
  FUMURE_MINERALE: { label: "Fumure minérale", emoji: "⚗️" },
  PHYTO: { label: "Traitement phyto", emoji: "🧪" },
  RECOLTE: { label: "Récolte", emoji: "🌾" },
  TRAVAIL_DU_SOL: { label: "Travail du sol", emoji: "🚜" },
  IRRIGATION: { label: "Irrigation", emoji: "💧" },
  AUTRE: { label: "Autre", emoji: "📋" },
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
