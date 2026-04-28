import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export type AnimalCategorie =
  | "VACHE_LAITIERE"
  | "GENISSE"
  | "VEAU"
  | "TAUREAU"
  | "BOEUF"
  | "AUTRE_BOVIN"
  | "PORC"
  | "POULET"
  | "AUTRE";

export interface SortieSrpa {
  id: string;
  date: string;
  categorie: AnimalCategorie;
  nombreAnimaux: number | null;
  dureeMinutes: number | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateSortieInput {
  date: string;
  categorie: AnimalCategorie;
  nombreAnimaux?: number;
  dureeMinutes?: number;
  notes?: string;
}

const QUERY_KEY = ["srpa"] as const;

export function useSrpa() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api<SortieSrpa[]>("/api/srpa"),
  });
}

export function useCreateSortie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSortieInput) =>
      api<SortieSrpa>("/api/srpa", { method: "POST", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteSortie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/srpa/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

const META: Record<AnimalCategorie, { label: string; emoji: string }> = {
  VACHE_LAITIERE: { label: "Vaches laitières", emoji: "🐄" },
  GENISSE: { label: "Génisses", emoji: "🐃" },
  VEAU: { label: "Veaux", emoji: "🐮" },
  TAUREAU: { label: "Taureaux", emoji: "🐂" },
  BOEUF: { label: "Bœufs", emoji: "🐄" },
  AUTRE_BOVIN: { label: "Autres bovins", emoji: "🐂" },
  PORC: { label: "Porcs", emoji: "🐖" },
  POULET: { label: "Poulets", emoji: "🐔" },
  AUTRE: { label: "Autres", emoji: "🐾" },
};

export const CATEGORIES_ORDER: AnimalCategorie[] = [
  "VACHE_LAITIERE",
  "GENISSE",
  "VEAU",
  "TAUREAU",
  "BOEUF",
  "AUTRE_BOVIN",
  "PORC",
  "POULET",
  "AUTRE",
];

export function libelleCategorie(c: AnimalCategorie): string {
  return META[c].label;
}

export function emojiCategorie(c: AnimalCategorie): string {
  return META[c].emoji;
}

export function formatDateFr(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-CH", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}
