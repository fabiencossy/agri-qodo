"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export type ProjetType = "INTERVENTION" | "TRAVAUX_TIERS" | "INTERNE" | "AUTRE";

export const PROJET_TYPE_LABEL: Record<ProjetType, string> = {
  INTERVENTION: "Carnet des champs",
  TRAVAUX_TIERS: "Travaux pour tiers",
  INTERNE: "Travail interne",
  AUTRE: "Autre",
};

export interface Projet {
  id: string;
  tenantId: string;
  nom: string;
  description: string | null;
  type: ProjetType;
  couleurHex: string | null;
  archive: boolean;
  /** ID `project.project` Odoo correspondant. Null = pas encore poussé. */
  odooProjectId: number | null;
  /** Dernier pull réussi depuis Odoo (ISO). Null = jamais sync. */
  odooSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OdooProjetsSyncResult {
  pulled: number;
  created: number;
  updated: number;
  archivedFromOdoo: number;
  skipped: number;
}

export interface CreateProjetInput {
  nom: string;
  description?: string;
  type?: ProjetType;
  couleurHex?: string;
}

export interface UpdateProjetInput extends Partial<CreateProjetInput> {
  archive?: boolean;
}

const KEY = ["projets"] as const;

export function useProjets(filters?: { includeArchived?: boolean; type?: ProjetType }) {
  const params = new URLSearchParams();
  if (filters?.includeArchived) params.set("includeArchived", "true");
  if (filters?.type) params.set("type", filters.type);
  const qs = params.toString();
  return useQuery({
    queryKey: [...KEY, filters?.includeArchived ?? false, filters?.type ?? null] as const,
    queryFn: () => api<Projet[]>(`/api/projets${qs ? `?${qs}` : ""}`),
  });
}

export function useProjet(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id] as const,
    queryFn: () => api<Projet>(`/api/projets/${id}`),
    enabled: !!id,
  });
}

export function useCreateProjet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjetInput) =>
      api<Projet>("/api/projets", { method: "POST", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateProjet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateProjetInput & { id: string }) =>
      api<Projet>(`/api/projets/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteProjet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/projets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

/**
 * Pull manuel des `project.project` Odoo et upsert dans Projet AQ.
 * Renvoie un résumé (créés / mis à jour / archivés / skipped).
 */
export function useSyncProjetsFromOdoo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<OdooProjetsSyncResult>("/api/projets/sync", { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
