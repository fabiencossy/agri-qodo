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
  sexe: "M" | "F" | null;
  dateNaissance: string | null;
  dateMort: string | null;
  usage: string | null;
  secteurLabel: string | null;
  statutBvd: string | null;
  lotId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const USAGES: { value: string; label: string }[] = [
  { value: "laitiere", label: "Laitière" },
  { value: "allaitante", label: "Allaitante" },
  { value: "engraissement", label: "Engraissement" },
  { value: "reproduction", label: "Reproduction" },
  { value: "jeune", label: "Jeune" },
  { value: "trait", label: "Trait" },
  { value: "loisir", label: "Loisir" },
  { value: "autre", label: "Autre" },
];

export const LABELS: { value: string; label: string }[] = [
  { value: "bio", label: "Bio Suisse / Bourgeon" },
  { value: "ips", label: "IP-Suisse" },
  { value: "per", label: "PER" },
  { value: "suisse-garantie", label: "Suisse Garantie" },
  { value: "conventionnel", label: "Conventionnel" },
  { value: "autre", label: "Autre" },
];

export const STATUTS_BVD: { value: string; label: string; color: string }[] = [
  { value: "frei", label: "BVD-frei", color: "bg-emerald-100 text-emerald-800" },
  { value: "vaccine", label: "Vacciné", color: "bg-blue-100 text-blue-800" },
  { value: "exempt", label: "Exempt", color: "bg-emerald-100 text-emerald-800" },
  { value: "suspect", label: "Suspect", color: "bg-amber-100 text-amber-800" },
  { value: "positif", label: "Positif", color: "bg-red-100 text-red-800" },
];

export function libelleUsage(v: string | null): string {
  if (!v) return "—";
  return USAGES.find((u) => u.value === v)?.label ?? v;
}

export function libelleLabel(v: string | null): string {
  if (!v) return "—";
  return LABELS.find((l) => l.value === v)?.label ?? v;
}

export function bvdBadge(v: string | null): { label: string; color: string } | null {
  if (!v) return null;
  const found = STATUTS_BVD.find((s) => s.value === v);
  if (found) return { label: found.label, color: found.color };
  return { label: v, color: "bg-foreground/10 text-foreground/70" };
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
  sexe?: "M" | "F";
  dateNaissance?: string;
  dateMort?: string;
  usage?: string;
  secteurLabel?: string;
  statutBvd?: string;
}

export type UpdateAnimalInput = Partial<CreateAnimalInput> & { isActive?: boolean };

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
  "VACHE_ALLAITANTE",
  "GENISSE",
  "VEAU",
  "TAUREAU",
  "BOEUF",
  "AUTRE_BOVIN",
];
export const isBovin = (c: AnimalCategorie): boolean => BOVIN_CATEGORIES.includes(c);

/**
 * Familles d'animaux pour le regroupement / filtres dans le cheptel.
 * Permet de grouper Brebis+Agneaux+Béliers sous "Ovins" en kanban.
 */
export type AnimalFamille =
  | "Bovins"
  | "Ovins"
  | "Caprins"
  | "Équidés"
  | "Cervidés"
  | "Camélidés"
  | "Porcins"
  | "Volailles"
  | "Petits élevages"
  | "Autres";

export const FAMILLE_BY_CATEGORIE: Record<AnimalCategorie, AnimalFamille> = {
  VACHE_LAITIERE: "Bovins",
  VACHE_ALLAITANTE: "Bovins",
  GENISSE: "Bovins",
  VEAU: "Bovins",
  TAUREAU: "Bovins",
  BOEUF: "Bovins",
  AUTRE_BOVIN: "Bovins",
  BREBIS: "Ovins",
  AGNEAU: "Ovins",
  BELIER: "Ovins",
  CHEVRE: "Caprins",
  CABRI: "Caprins",
  BOUC: "Caprins",
  CHEVAL_ADULTE: "Équidés",
  POULAIN: "Équidés",
  ANE: "Équidés",
  CERF: "Cervidés",
  DAIM: "Cervidés",
  LAMA: "Camélidés",
  ALPAGA: "Camélidés",
  PORC: "Porcins",
  TRUIE: "Porcins",
  PORCELET: "Porcins",
  POULET: "Volailles",
  POULE_PONDEUSE: "Volailles",
  DINDE: "Volailles",
  OIE: "Volailles",
  CANARD: "Volailles",
  PINTADE: "Volailles",
  CAILLE: "Volailles",
  LAPIN: "Petits élevages",
  ABEILLE_RUCHE: "Petits élevages",
  BISON: "Autres",
  AUTRE: "Autres",
};

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

export function useAnimal(id: string | undefined) {
  return useQuery({
    queryKey: ["animaux", id] as const,
    queryFn: () => api<Animal>(`/api/animaux/${id}`),
    enabled: !!id,
  });
}

export function useUpdateAnimal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateAnimalInput & { id: string }) =>
      api<Animal>(`/api/animaux/${id}`, { method: "PATCH", body: input }),
    onSuccess: (a) => {
      invalidateAll(qc);
      void qc.invalidateQueries({ queryKey: ["animaux", a.id] });
    },
  });
}
