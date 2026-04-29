"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";
import type { AnimalCategorie } from "./srpa";

export interface Animal {
  id: string;
  tenantId: string;
  categorie: AnimalCategorie;
  nom: string | null;
  numeroBoucle: string | null;
  dateNaissance: string | null;
  lotId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnimauxSummary {
  categorie: AnimalCategorie;
  nombreActifs: number;
}

export interface UgbParCategorie {
  categorie: AnimalCategorie;
  nombreAnimaux: number;
  coefMoyen: number;
  ugbTotal: number;
}

export interface UgbExploitationResult {
  total: number;
  parCategorie: UgbParCategorie[];
}

export interface CreateAnimalInput {
  categorie: AnimalCategorie;
  nom?: string;
  numeroBoucle?: string;
  dateNaissance?: string;
}

export interface CreateBatchInput {
  categorie: AnimalCategorie;
  nombre: number;
}

export interface IdentifierBovinInput {
  categorie: AnimalCategorie;
  numeroBoucle: string;
  nom?: string;
  dateNaissance?: string;
}

export interface ImportBdtaResult {
  created: number;
  updated: number;
  promoted: number;
  skipped: number;
  errors: Array<{ ligne: number; raison: string }>;
}

/** Catégories pour lesquelles le n° de boucle BDTA s'applique. */
export const BOVIN_CATEGORIES: AnimalCategorie[] = [
  "VACHE_LAITIERE",
  "GENISSE",
  "VEAU",
  "TAUREAU",
  "BOEUF",
  "AUTRE_BOVIN",
];
export const isBovin = (c: AnimalCategorie): boolean => BOVIN_CATEGORIES.includes(c);

const KEY_LIST = ["animaux"] as const;
const KEY_SUMMARY = ["animaux", "summary"] as const;
const KEY_CATEGORIES = ["animaux", "categories-actives"] as const;
const KEY_UGB = ["animaux", "ugb"] as const;

export function useAnimaux(filters?: { categorie?: AnimalCategorie; identified?: boolean }) {
  const qs = new URLSearchParams();
  if (filters?.categorie) qs.set("categorie", filters.categorie);
  if (filters?.identified !== undefined) qs.set("identified", String(filters.identified));
  const url = qs.toString() ? `/api/animaux?${qs.toString()}` : "/api/animaux";
  return useQuery({
    queryKey: [...KEY_LIST, filters ?? {}] as const,
    queryFn: () => api<Animal[]>(url),
  });
}

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

export function useUgb() {
  return useQuery({
    queryKey: KEY_UGB,
    queryFn: () => api<UgbExploitationResult>("/api/animaux/ugb"),
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: KEY_LIST });
  void qc.invalidateQueries({ queryKey: KEY_SUMMARY });
  void qc.invalidateQueries({ queryKey: KEY_CATEGORIES });
  void qc.invalidateQueries({ queryKey: KEY_UGB });
}

export function useCreateAnimal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnimalInput) =>
      api<Animal>("/api/animaux", { method: "POST", body: input }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useIdentifierBovin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: IdentifierBovinInput) =>
      api<Animal>("/api/animaux/identifier", { method: "POST", body: input }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useImportBdta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) =>
      api<ImportBdtaResult>("/api/animaux/import-bdta", {
        method: "POST",
        body: { csv },
      }),
    onSuccess: () => invalidateAll(qc),
  });
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

export function useDeleteAnimal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/animaux/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}
