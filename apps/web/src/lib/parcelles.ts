"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export type ZoneAgricole = "ZA" | "ZP" | "ZM1" | "ZM2" | "ZM3" | "ZM4" | "ZE";

export interface Parcelle {
  id: string;
  nom: string;
  surfaceM2: string; // Decimal arrive en string via JSON
  zone: ZoneAgricole;
  identifiantCadastral: string | null;
  notes: string | null;
  couleurHex: string | null;
  geom: GeoJsonPolygon | null;
  createdAt: string;
  updatedAt: string;
}

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface CreateParcelleInput {
  nom: string;
  surfaceM2: number;
  zone: ZoneAgricole;
  identifiantCadastral?: string;
  notes?: string;
  couleurHex?: string;
  geomGeoJson?: GeoJsonPolygon;
}

export interface UpdateParcelleInput {
  nom?: string;
  surfaceM2?: number;
  zone?: ZoneAgricole;
  identifiantCadastral?: string | null;
  notes?: string | null;
  couleurHex?: string | null;
  geomGeoJson?: GeoJsonPolygon;
}

export interface ParcelleMapItem {
  id: string;
  nom: string;
  surfaceM2: string;
  zone: ZoneAgricole;
  couleurHex: string | null;
  geom: GeoJsonPolygon | null;
}

const QUERY_KEY = ["parcelles"] as const;
const MAP_QUERY_KEY = ["parcelles", "map"] as const;

export function useParcelles() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api<Parcelle[]>("/api/parcelles"),
  });
}

export function useParcelle(id: string | undefined) {
  return useQuery({
    queryKey: ["parcelles", id] as const,
    queryFn: () => api<Parcelle>(`/api/parcelles/${id}`),
    enabled: !!id,
  });
}

export function useParcellesMap() {
  return useQuery({
    queryKey: MAP_QUERY_KEY,
    queryFn: () => api<ParcelleMapItem[]>("/api/parcelles/map"),
  });
}

export function useCreateParcelle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateParcelleInput) =>
      api<Parcelle>("/api/parcelles", { method: "POST", body: input }),
    onSuccess: (created) => {
      // Push optimiste : la liste est à jour immédiatement même si le
      // composant est démonté pendant le redirect (staleTime=30s ne masque
      // plus la nouvelle entrée).
      qc.setQueryData<Parcelle[]>(QUERY_KEY, (old) => (old ? [...old, created] : [created]));
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
      void qc.invalidateQueries({ queryKey: MAP_QUERY_KEY });
    },
  });
}

export function useUpdateParcelle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateParcelleInput & { id: string }) =>
      api<Parcelle>(`/api/parcelles/${id}`, { method: "PATCH", body: input }),
    onSuccess: (updated) => {
      qc.setQueryData<Parcelle>(["parcelles", updated.id], updated);
      qc.setQueryData<Parcelle[]>(QUERY_KEY, (old) =>
        old?.map((p) => (p.id === updated.id ? updated : p)),
      );
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
      void qc.invalidateQueries({ queryKey: MAP_QUERY_KEY });
    },
  });
}

export function useDeleteParcelle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/parcelles/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      qc.setQueryData<Parcelle[]>(QUERY_KEY, (old) => old?.filter((p) => p.id !== id));
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
      void qc.invalidateQueries({ queryKey: MAP_QUERY_KEY });
    },
  });
}

const ZONE_LABELS: Record<ZoneAgricole, string> = {
  ZA: "Zone agricole",
  ZP: "Zone des prairies",
  ZM1: "Zone montagne I",
  ZM2: "Zone montagne II",
  ZM3: "Zone montagne III",
  ZM4: "Zone montagne IV",
  ZE: "Zone d'estivage",
};

export function libelleZone(zone: ZoneAgricole): string {
  return ZONE_LABELS[zone];
}

/**
 * Palette de couleurs préréglées proposée à l'agriculteur. Couleurs
 * choisies pour être bien lisibles sur fond carte/satellite swisstopo.
 */
export const COULEURS_PARCELLE: Array<{ value: string; label: string }> = [
  { value: "#4CAF50", label: "Vert (défaut)" },
  { value: "#2196F3", label: "Bleu" },
  { value: "#F44336", label: "Rouge" },
  { value: "#FF9800", label: "Orange" },
  { value: "#9C27B0", label: "Violet" },
  { value: "#FFEB3B", label: "Jaune" },
  { value: "#795548", label: "Marron" },
  { value: "#00BCD4", label: "Cyan" },
];

export const COULEUR_PARCELLE_DEFAUT = "#4CAF50";

/**
 * Format métier suisse :
 *   - ≥ 1 hectare (10 000 m²) → ha
 *   - ≥ 1 are (100 m²)        → a (ares)
 *   - sinon                   → m²
 */
export function formatSurface(m2: string | number): string {
  const value = typeof m2 === "string" ? Number(m2) : m2;
  if (Number.isNaN(value) || value < 0) return "—";
  if (value >= 10000) return `${(value / 10000).toFixed(2)} ha`;
  if (value >= 100) return `${(value / 100).toFixed(2)} a`;
  return `${value.toFixed(0)} m²`;
}
