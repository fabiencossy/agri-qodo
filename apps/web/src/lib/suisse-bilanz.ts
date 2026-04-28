"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api-client";

export interface DetailParcelle {
  parcelleId: string;
  parcelleNom: string;
  surfaceHa: number;
  espece: string;
  besoinN: number;
  besoinP: number;
}

export interface BilanResponse {
  annee: number;
  apportsN: number;
  apportsP: number;
  besoinsN: number;
  besoinsP: number;
  soldeN: number;
  soldeP: number;
  conformeN: boolean;
  conformeP: boolean;
  details: DetailParcelle[];
  culturesInconnues: string[];
  warnings: string[];
}

export function useSuisseBilanz(annee: number) {
  return useQuery({
    queryKey: ["suisse-bilanz", annee] as const,
    queryFn: () => api<BilanResponse>(`/api/suisse-bilanz/${annee}`),
  });
}

export function formatKg(kg: number): string {
  return new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 1 }).format(kg);
}

export function formatHa(ha: number): string {
  return new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 2 }).format(ha);
}
