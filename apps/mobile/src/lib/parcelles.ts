import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export type ZoneAgricole = "ZA" | "ZP" | "ZM1" | "ZM2" | "ZM3" | "ZM4" | "ZE";

export interface Parcelle {
  id: string;
  nom: string;
  surfaceM2: string;
  zone: ZoneAgricole;
  identifiantCadastral: string | null;
  notes: string | null;
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
  geomGeoJson?: GeoJsonPolygon;
}

export interface ParcelleMapItem {
  id: string;
  nom: string;
  surfaceM2: string;
  zone: ZoneAgricole;
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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
      void qc.invalidateQueries({ queryKey: MAP_QUERY_KEY });
    },
  });
}

export function useDeleteParcelle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/parcelles/${id}`, { method: "DELETE" }),
    onSuccess: () => {
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

export function formatSurface(m2: string | number): string {
  const value = typeof m2 === "string" ? Number(m2) : m2;
  if (Number.isNaN(value)) return "—";
  if (value >= 10000) return `${(value / 10000).toFixed(2)} ha`;
  return `${value.toFixed(0)} m²`;
}
