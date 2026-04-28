import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";
import type { AnimalCategorie } from "./srpa";

export interface AnimauxSummary {
  categorie: AnimalCategorie;
  nombreActifs: number;
}

export interface CreateBatchInput {
  categorie: AnimalCategorie;
  nombre: number;
}

const KEY_LIST = ["animaux"] as const;
const KEY_SUMMARY = ["animaux", "summary"] as const;
const KEY_CATEGORIES = ["animaux", "categories-actives"] as const;

export function useAnimauxSummary() {
  return useQuery({
    queryKey: KEY_SUMMARY,
    queryFn: () => api<AnimauxSummary[]>("/api/animaux/summary"),
  });
}

export function useCategoriesActives() {
  return useQuery({
    queryKey: KEY_CATEGORIES,
    queryFn: () => api<AnimalCategorie[]>("/api/animaux/categories-actives"),
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: KEY_LIST });
  void qc.invalidateQueries({ queryKey: KEY_SUMMARY });
  void qc.invalidateQueries({ queryKey: KEY_CATEGORIES });
}

export function useCreateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBatchInput) =>
      api<{ created: number; categorie: AnimalCategorie }>("/api/animaux/batch", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useRemoveBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categorie, nombre }: { categorie: AnimalCategorie; nombre: number }) =>
      api<{ deleted: number }>(`/api/animaux/batch?categorie=${categorie}&nombre=${nombre}`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useSetEffectif() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { categorie: AnimalCategorie; total: number }) =>
      api<{ categorie: AnimalCategorie; total: number; delta: number }>("/api/animaux/effectif", {
        method: "PUT",
        body: input,
      }),
    onSuccess: () => invalidateAll(qc),
  });
}
