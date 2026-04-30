"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export type PresenceType = "CHANTIER" | "DEPLACEMENT" | "REPAS" | "PAUSE" | "BUREAU" | "AUTRE";

export interface Presence {
  id: string;
  tenantId: string;
  userId: string;
  type: PresenceType;
  dateDebut: string;
  dateFin: string | null;
  dureeMinutes: number | null;
  travailId: string | null;
  travail: { id: string; titre: string; date: string } | null;
  linkedLigneHeureId: string | null;
  latitudeDebut: string | null;
  longitudeDebut: string | null;
  notes: string | null;
  user: { id: string; prenom: string; nom: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface ClockInInput {
  type: PresenceType;
  dateDebut?: string;
  travailId?: string;
  latitudeDebut?: number;
  longitudeDebut?: number;
  notes?: string;
}

export interface ClockOutInput {
  dateFin?: string;
  travailId?: string;
  skipTimesheet?: boolean;
  notes?: string;
}

const KEY = ["presences"] as const;
const CURRENT = ["presences", "current"] as const;

/** Présence ouverte du user courant (null = pas pointé). */
export function useCurrentPresence() {
  return useQuery({
    queryKey: CURRENT,
    queryFn: () => api<Presence | null>("/api/presences/current"),
    refetchInterval: 60_000, // refresh chaque minute pour timer live
  });
}

/** Mes présences (default = semaine courante). */
export function useMesPresences(filters?: { dateDebut?: string; dateFin?: string }) {
  const params = new URLSearchParams();
  if (filters?.dateDebut) params.set("dateDebut", filters.dateDebut);
  if (filters?.dateFin) params.set("dateFin", filters.dateFin);
  const qs = params.toString();
  return useQuery({
    queryKey: [...KEY, "mes", filters?.dateDebut ?? null, filters?.dateFin ?? null] as const,
    queryFn: () => api<Presence[]>(`/api/presences/mes${qs ? `?${qs}` : ""}`),
  });
}

/** Vue admin : toutes les présences du tenant. */
export function usePresences(filters?: { userId?: string; dateDebut?: string; dateFin?: string }) {
  const params = new URLSearchParams();
  if (filters?.userId) params.set("userId", filters.userId);
  if (filters?.dateDebut) params.set("dateDebut", filters.dateDebut);
  if (filters?.dateFin) params.set("dateFin", filters.dateFin);
  const qs = params.toString();
  return useQuery({
    queryKey: [...KEY, filters ?? null] as const,
    queryFn: () => api<Presence[]>(`/api/presences${qs ? `?${qs}` : ""}`),
  });
}

export function useClockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClockInInput) =>
      api<Presence>("/api/presences/clock-in", { method: "POST", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      void qc.invalidateQueries({ queryKey: CURRENT });
    },
  });
}

export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClockOutInput) =>
      api<Presence>("/api/presences/clock-out", { method: "POST", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      void qc.invalidateQueries({ queryKey: CURRENT });
      void qc.invalidateQueries({ queryKey: ["travaux"] });
      void qc.invalidateQueries({ queryKey: ["mes-heures"] });
    },
  });
}

export function useDeletePresence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/presences/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export const PRESENCE_TYPE_LABEL: Record<PresenceType, string> = {
  CHANTIER: "Chantier",
  DEPLACEMENT: "Déplacement",
  REPAS: "Repas",
  PAUSE: "Pause",
  BUREAU: "Bureau",
  AUTRE: "Autre",
};

export const PRESENCE_TYPE_EMOJI: Record<PresenceType, string> = {
  CHANTIER: "🚜",
  DEPLACEMENT: "🚗",
  REPAS: "🍽",
  PAUSE: "☕",
  BUREAU: "💻",
  AUTRE: "❓",
};

export const PRESENCE_TYPES_ORDER: PresenceType[] = [
  "CHANTIER",
  "DEPLACEMENT",
  "REPAS",
  "PAUSE",
  "BUREAU",
  "AUTRE",
];

/** Format HH:MM depuis minutes. */
export function formatDuree(minutes: number | null): string {
  if (minutes === null || minutes < 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}
