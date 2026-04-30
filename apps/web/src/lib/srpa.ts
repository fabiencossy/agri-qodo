"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export type AnimalCategorie =
  // Bovins
  | "VACHE_LAITIERE"
  | "VACHE_ALLAITANTE"
  | "GENISSE"
  | "VEAU"
  | "TAUREAU"
  | "BOEUF"
  | "AUTRE_BOVIN"
  // Ovins
  | "BREBIS"
  | "AGNEAU"
  | "BELIER"
  // Caprins
  | "CHEVRE"
  | "CABRI"
  | "BOUC"
  // Équidés
  | "CHEVAL_ADULTE"
  | "POULAIN"
  | "ANE"
  // Cervidés
  | "CERF"
  | "DAIM"
  // Camélidés
  | "LAMA"
  | "ALPAGA"
  // Porcs
  | "PORC"
  | "TRUIE"
  | "PORCELET"
  // Volailles
  | "POULET"
  | "POULE_PONDEUSE"
  | "DINDE"
  | "OIE"
  | "CANARD"
  | "PINTADE"
  | "CAILLE"
  // Petits élevages
  | "LAPIN"
  | "ABEILLE_RUCHE"
  // Autres
  | "BISON"
  | "AUTRE";

export interface SortieSrpa {
  id: string;
  tenantId: string;
  date: string;
  categorie: AnimalCategorie;
  nombreAnimaux: number | null;
  dureeMinutes: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
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
  // Bovins
  VACHE_LAITIERE: { label: "Vaches laitières", emoji: "🐄" },
  VACHE_ALLAITANTE: { label: "Vaches allaitantes", emoji: "🐄" },
  GENISSE: { label: "Génisses", emoji: "🐃" },
  VEAU: { label: "Veaux", emoji: "🐮" },
  TAUREAU: { label: "Taureaux", emoji: "🐂" },
  BOEUF: { label: "Bœufs", emoji: "🐄" },
  AUTRE_BOVIN: { label: "Autres bovins", emoji: "🐂" },
  // Ovins
  BREBIS: { label: "Brebis", emoji: "🐑" },
  AGNEAU: { label: "Agneaux", emoji: "🐑" },
  BELIER: { label: "Béliers", emoji: "🐏" },
  // Caprins
  CHEVRE: { label: "Chèvres", emoji: "🐐" },
  CABRI: { label: "Cabris", emoji: "🐐" },
  BOUC: { label: "Boucs", emoji: "🐐" },
  // Équidés
  CHEVAL_ADULTE: { label: "Chevaux", emoji: "🐎" },
  POULAIN: { label: "Poulains", emoji: "🐴" },
  ANE: { label: "Ânes", emoji: "🫏" },
  // Cervidés
  CERF: { label: "Cerfs", emoji: "🦌" },
  DAIM: { label: "Daims", emoji: "🦌" },
  // Camélidés
  LAMA: { label: "Lamas", emoji: "🦙" },
  ALPAGA: { label: "Alpagas", emoji: "🦙" },
  // Porcs
  PORC: { label: "Porcs", emoji: "🐖" },
  TRUIE: { label: "Truies", emoji: "🐖" },
  PORCELET: { label: "Porcelets", emoji: "🐷" },
  // Volailles
  POULET: { label: "Poulets de chair", emoji: "🐔" },
  POULE_PONDEUSE: { label: "Poules pondeuses", emoji: "🐔" },
  DINDE: { label: "Dindes", emoji: "🦃" },
  OIE: { label: "Oies", emoji: "🪿" },
  CANARD: { label: "Canards", emoji: "🦆" },
  PINTADE: { label: "Pintades", emoji: "🐦" },
  CAILLE: { label: "Cailles", emoji: "🐦" },
  // Petits élevages
  LAPIN: { label: "Lapins", emoji: "🐰" },
  ABEILLE_RUCHE: { label: "Ruches", emoji: "🐝" },
  // Autres
  BISON: { label: "Bisons", emoji: "🦬" },
  AUTRE: { label: "Autres", emoji: "🐾" },
};

export const CATEGORIES_ORDER: AnimalCategorie[] = [
  // Bovins
  "VACHE_LAITIERE",
  "VACHE_ALLAITANTE",
  "GENISSE",
  "VEAU",
  "TAUREAU",
  "BOEUF",
  "AUTRE_BOVIN",
  // Ovins
  "BREBIS",
  "AGNEAU",
  "BELIER",
  // Caprins
  "CHEVRE",
  "CABRI",
  "BOUC",
  // Équidés
  "CHEVAL_ADULTE",
  "POULAIN",
  "ANE",
  // Cervidés
  "CERF",
  "DAIM",
  // Camélidés
  "LAMA",
  "ALPAGA",
  // Porcs
  "PORC",
  "TRUIE",
  "PORCELET",
  // Volailles
  "POULET",
  "POULE_PONDEUSE",
  "DINDE",
  "OIE",
  "CANARD",
  "PINTADE",
  "CAILLE",
  // Petits élevages
  "LAPIN",
  "ABEILLE_RUCHE",
  // Autres
  "BISON",
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
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function moisCleAnnee(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function moisLibelle(cle: string): string {
  const [y, m] = cle.split("-");
  if (!y || !m) return cle;
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
}
