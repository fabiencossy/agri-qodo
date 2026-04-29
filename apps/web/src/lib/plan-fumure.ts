"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";
import type { TechniqueEpandage } from "./interventions";

export interface PlanApport {
  id: string;
  parcelleId: string;
  parcelle: { id: string; nom: string };
  campagne: number;
  datePrevue: string | null;
  produitId: string | null;
  produitRef: {
    id: string;
    libelle: string;
    categorie: string;
    tauxN: string | null;
    tauxP: string | null;
  } | null;
  produitLibre: string | null;
  quantitePrevue: string | null;
  unite: string | null;
  kgNPrevu: string | null;
  kgPPrevu: string | null;
  technique: TechniqueEpandage | null;
  notes: string | null;
  interventionId: string | null;
  intervention: {
    id: string;
    type: string;
    dateOperation: string;
    quantite: string | null;
    techniqueEpandage: TechniqueEpandage | null;
  } | null;
  createdAt: string;
}

export interface CreatePlanApportInput {
  parcelleId: string;
  campagne: number;
  datePrevue?: string;
  produitId?: string;
  produitLibre?: string;
  quantitePrevue?: number;
  unite?: string;
  kgNPrevu?: number;
  kgPPrevu?: number;
  technique?: TechniqueEpandage;
  notes?: string;
}

const KEY = ["plan-fumure"] as const;

export function usePlanFumure(filter: { campagne?: number; parcelleId?: string } = {}) {
  const params = new URLSearchParams();
  if (filter.campagne) params.set("campagne", String(filter.campagne));
  if (filter.parcelleId) params.set("parcelleId", filter.parcelleId);
  const qs = params.toString();
  return useQuery({
    queryKey: [...KEY, filter] as const,
    queryFn: () => api<PlanApport[]>(`/api/plan-fumure${qs ? `?${qs}` : ""}`),
  });
}

export function useCreatePlanApport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePlanApportInput) =>
      api<PlanApport>("/api/plan-fumure", { method: "POST", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeletePlanApport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/plan-fumure/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useRealiserPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dateOperation,
      quantite,
      technique,
    }: {
      id: string;
      dateOperation?: string;
      quantite?: number;
      technique?: TechniqueEpandage;
    }) =>
      api<PlanApport>(`/api/plan-fumure/${id}/realiser`, {
        method: "POST",
        body: { dateOperation, quantite, technique },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      void qc.invalidateQueries({ queryKey: ["interventions"] });
    },
  });
}
