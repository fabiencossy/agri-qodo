"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export type MaterielCategorie =
  | "TRAVAIL_DU_SOL"
  | "SEMIS"
  | "FERTILISATION"
  | "PROTECTION"
  | "RECOLTE"
  | "IRRIGATION"
  | "TRANSPORT"
  | "AUTRE";

export type MaterielUnite = "HA" | "M3" | "T" | "H" | "FORFAIT";

export interface Materiel {
  id: string;
  tenantId: string | null;
  code: string;
  libelle: string;
  categorie: MaterielCategorie;
  unite: MaterielUnite;
  prixUnitaireCHF: string | null; // Decimal sérialisé
  /** Taux TVA CH en % (ex 8.10, 2.60). Sérialisé Decimal → string. */
  tauxTvaPercent: string | null;
  odooProductId: number | null;
  odooSyncedAt: string | null;
  notes: string | null;
  actif: boolean;
}

export interface CreateMaterielInput {
  libelle: string;
  categorie: MaterielCategorie;
  unite?: MaterielUnite;
  prixUnitaireCHF?: number;
  tauxTvaPercent?: number;
  notes?: string;
}

const KEY = ["materiels"] as const;

export function useMateriels(categorie?: MaterielCategorie) {
  return useQuery({
    queryKey: [...KEY, categorie ?? "all"] as const,
    queryFn: () => api<Materiel[]>(`/api/materiels${categorie ? `?categorie=${categorie}` : ""}`),
  });
}

export function useCreateMateriel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMaterielInput) =>
      api<Materiel>("/api/materiels", { method: "POST", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateMateriel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<CreateMaterielInput> & { id: string }) =>
      api<Materiel>(`/api/materiels/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteMateriel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/materiels/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export interface SyncOdooMaterielsResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ odooId: number; raison: string }>;
}

export function useSyncMaterielsOdoo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<SyncOdooMaterielsResult>("/api/materiels/sync-odoo", { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

/** Push un matériel unique vers Odoo. Idempotent. */
export function usePushMaterielOdoo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ odooProductId: number }>(`/api/materiels/${id}/push-odoo`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export const MATERIEL_CATEGORIE_LABEL: Record<MaterielCategorie, string> = {
  TRAVAIL_DU_SOL: "Travail du sol",
  SEMIS: "Semis & plantation",
  FERTILISATION: "Fertilisation",
  PROTECTION: "Protection des cultures",
  RECOLTE: "Récolte",
  IRRIGATION: "Irrigation",
  TRANSPORT: "Transport",
  AUTRE: "Autre",
};

export const MATERIEL_UNITE_LABEL: Record<MaterielUnite, string> = {
  HA: "ha",
  M3: "m³",
  T: "t",
  H: "h",
  FORFAIT: "forfait",
};

export const MATERIEL_CATEGORIES_ORDER: MaterielCategorie[] = [
  "TRAVAIL_DU_SOL",
  "SEMIS",
  "FERTILISATION",
  "PROTECTION",
  "RECOLTE",
  "IRRIGATION",
  "TRANSPORT",
  "AUTRE",
];
