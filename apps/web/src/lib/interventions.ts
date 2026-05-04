"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export type InterventionType =
  | "SEMIS"
  | "FUMURE_ORGANIQUE"
  | "FUMURE_MINERALE"
  | "PHYTO"
  | "RECOLTE"
  | "TRAVAIL_DU_SOL"
  | "IRRIGATION"
  | "AUTRE";

export type TechniqueEpandage =
  | "EPANDEUR_CLASSIQUE"
  | "RAMPE_PENDILLARDE"
  | "TRAINEE_SOUPLE"
  | "INJECTION"
  | "FUMIER_SOLIDE";

export const TECHNIQUE_LABEL: Record<TechniqueEpandage, string> = {
  EPANDEUR_CLASSIQUE: "Épandeur classique (~30% pertes NH3)",
  RAMPE_PENDILLARDE: "Rampe pendillarde (~15%)",
  TRAINEE_SOUPLE: "Traînée souple / sabots (~10%)",
  INJECTION: "Injection sol (~5%)",
  FUMIER_SOLIDE: "Fumier solide, incorporé < 4h (~25%)",
};

export const TECHNIQUES_ORDER: TechniqueEpandage[] = [
  "RAMPE_PENDILLARDE",
  "TRAINEE_SOUPLE",
  "INJECTION",
  "FUMIER_SOLIDE",
  "EPANDEUR_CLASSIQUE",
];

export type ValidationStatus = "SELF" | "PENDING" | "VALIDATED" | "REJECTED";

export interface Intervention {
  id: string;
  clientUuid: string;
  parcelleId: string;
  parcelle: { id: string; nom: string };
  ownerTenantId: string;
  authorTenantId: string;
  type: InterventionType;
  dateOperation: string;
  produitId: string | null;
  produit: string | null;
  produitRef: {
    id: string;
    libelle: string;
    categorie: string;
    especeCode: string | null;
  } | null;
  /** Matériel utilisé (outil/machine) — null si saisi sans matériel précis. */
  materielId: string | null;
  materielRef: {
    id: string;
    libelle: string;
    categorie: string;
    unite: string;
    prixUnitaireCHF: string | null;
  } | null;
  /** Surface effective travaillée en hectares — sert à la facturation cas B. */
  surfaceHa: string | null;
  /** Cas B : ID du Travail créé chez le prestataire pour facturer Odoo. */
  linkedTravailId: string | null;
  quantite: string | null;
  unite: string | null;
  surfaceTravailleeM2: string | null;
  notes: string | null;
  cultureId: string | null;
  culture: { id: string; espece: string; variete: string | null; campagne: number } | null;
  validationStatus: ValidationStatus;
  /** Multi-employés (PRD fusion v0.2). Vide = saisie solo de l'auteur. */
  participants: InterventionParticipant[];
  createdAt: string;
}

export interface InterventionParticipant {
  id: string;
  interventionId: string;
  userId: string;
  user: { id: string; prenom: string; nom: string; email: string };
  /** Durée individuelle en minutes (null = durée de l'intervention). */
  dureeMinutes: number | null;
  notes: string | null;
}

export interface InterventionParticipantInput {
  userId: string;
  dureeMinutes?: number;
  notes?: string;
}

export interface InterventionGeoJsonPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface CreateInterventionInput {
  parcelleId: string;
  type: InterventionType;
  dateOperation: string;
  produitId?: string;
  produit?: string;
  /** ID Matériel utilisé (charrue, semoir, pulvé, ensileuse…). En cas B, sert à facturer Odoo. */
  materielId?: string;
  /** Surface effective en hectares — quantité facturée si matériel tarifé HA. */
  surfaceHa?: number;
  /** Rendement à l'hectare (optionnel). Typique sur RECOLTE — unité héritée de `unite`. */
  rendementParHa?: number;
  quantite?: number;
  unite?: string;
  surfaceTravailleeM2?: number;
  techniqueEpandage?: TechniqueEpandage;
  notes?: string;
  /** Sous-zone géométrique (Polygon GeoJSON) — recalcule surfaceTravailleeM2 côté backend. */
  geomGeoJson?: InterventionGeoJsonPolygon;
  /** Participants à l'intervention (PRD fusion v0.2). */
  participants?: InterventionParticipantInput[];
}

export interface InterventionWithGeom {
  id: string;
  parcelleId: string;
  parcelleNom: string;
  type: InterventionType;
  dateOperation: string;
  surfaceTravailleeM2: string | null;
  produit: string | null;
  culture: { espece: string; variete: string | null; campagne: number } | null;
  geom: InterventionGeoJsonPolygon | null;
}

const QUERY_KEY = ["interventions"] as const;

export function useInterventions() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api<Intervention[]>("/api/interventions"),
  });
}

/**
 * Liste les interventions ayant une sous-zone géométrique. Filtrable par
 * campagne (année) et/ou parcelle. Sert à la page Plan d'assolement et
 * à l'affichage des sous-zones existantes sur la carte.
 */
export function useInterventionsWithGeom(filters?: { campagne?: number; parcelleId?: string }) {
  const params = new URLSearchParams();
  if (filters?.campagne !== undefined) params.set("campagne", String(filters.campagne));
  if (filters?.parcelleId) params.set("parcelleId", filters.parcelleId);
  const qs = params.toString();
  const url = qs ? `/api/interventions/with-geom?${qs}` : "/api/interventions/with-geom";
  return useQuery({
    queryKey: [
      "interventions",
      "with-geom",
      filters?.campagne ?? null,
      filters?.parcelleId ?? null,
    ],
    queryFn: () => api<InterventionWithGeom[]>(url),
  });
}

/** Détail d'une intervention par id — pour la fiche /interventions/[id]. */
export function useIntervention(id: string | undefined) {
  return useQuery({
    queryKey: ["interventions", id] as const,
    queryFn: () => api<Intervention>(`/api/interventions/${id}`),
    enabled: !!id,
  });
}

export function useCreateIntervention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInterventionInput) =>
      api<Intervention>("/api/interventions", { method: "POST", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * Champs modifiables d'une intervention. Le backend interdit la
 * modification de parcelleId, type et produitId — ces champs gouvernent
 * la Culture créée par un SEMIS, modifier nécessite de supprimer/recréer.
 */
export interface UpdateInterventionInput {
  dateOperation?: string;
  produit?: string;
  materielId?: string;
  surfaceHa?: number;
  rendementParHa?: number;
  quantite?: number;
  unite?: string;
  techniqueEpandage?: TechniqueEpandage;
  surfaceTravailleeM2?: number;
  geomGeoJson?: InterventionGeoJsonPolygon;
  notes?: string;
  /** Si fourni, remplace toute la liste de participants. */
  participants?: InterventionParticipantInput[];
}

export function useUpdateIntervention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateInterventionInput & { id: string }) =>
      api<Intervention>(`/api/interventions/${id}`, { method: "PATCH", body: input }),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
      void qc.invalidateQueries({ queryKey: ["interventions", variables.id] });
    },
  });
}

/** Variante d'Intervention enrichie de l'auteur, renvoyée par /pending. */
export interface PendingIntervention extends Intervention {
  authorTenant: { id: string; nom: string; code: string };
}

/** Interventions PENDING reçues d'un partenaire — à valider/refuser. */
export function useInterventionsPending() {
  return useQuery({
    queryKey: ["interventions", "pending"] as const,
    queryFn: () => api<PendingIntervention[]>("/api/interventions/pending"),
  });
}

export function useValidateIntervention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<Intervention>(`/api/interventions/${id}/validate`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useRejectIntervention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api<Intervention>(`/api/interventions/${id}/reject`, {
        method: "POST",
        body: { reason },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteIntervention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/interventions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

const TYPE_META: Record<InterventionType, { label: string; emoji: string; color: string }> = {
  SEMIS: { label: "Semis", emoji: "🌱", color: "bg-green-100 text-green-800" },
  FUMURE_ORGANIQUE: {
    label: "Fumure organique",
    emoji: "💩",
    color: "bg-amber-100 text-amber-800",
  },
  FUMURE_MINERALE: {
    label: "Fumure minérale",
    emoji: "⚗️",
    color: "bg-blue-100 text-blue-800",
  },
  PHYTO: {
    label: "Traitement phyto",
    emoji: "🧪",
    color: "bg-purple-100 text-purple-800",
  },
  RECOLTE: {
    label: "Récolte",
    emoji: "🌾",
    color: "bg-yellow-100 text-yellow-800",
  },
  TRAVAIL_DU_SOL: {
    label: "Travail du sol",
    emoji: "🚜",
    color: "bg-orange-100 text-orange-800",
  },
  IRRIGATION: {
    label: "Irrigation",
    emoji: "💧",
    color: "bg-sky-100 text-sky-800",
  },
  AUTRE: { label: "Autre", emoji: "📋", color: "bg-gray-100 text-gray-800" },
};

export const TYPES_ORDER: InterventionType[] = [
  "SEMIS",
  "FUMURE_ORGANIQUE",
  "FUMURE_MINERALE",
  "PHYTO",
  "RECOLTE",
  "TRAVAIL_DU_SOL",
  "IRRIGATION",
  "AUTRE",
];

export function libelleType(type: InterventionType): string {
  return TYPE_META[type].label;
}

export function emojiType(type: InterventionType): string {
  return TYPE_META[type].emoji;
}

export function colorType(type: InterventionType): string {
  return TYPE_META[type].color;
}

export function formatDateFr(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatQuantite(quantite: string | null, unite: string | null): string | null {
  if (!quantite) return null;
  const value = Number(quantite);
  if (Number.isNaN(value)) return null;
  return unite ? `${value} ${unite}` : String(value);
}
