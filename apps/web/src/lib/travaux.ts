"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export type TravailStatut =
  | "PLANIFIE"
  | "DRAFT"
  | "PENDING_REVIEW"
  | "VALIDATED"
  | "INVOICED"
  | "CANCELLED";

export interface LigneTravailProduit {
  id: string;
  travailId: string;
  produitId: string | null;
  produit?: { id: string; libelle: string; unite: string; especeCode: string | null } | null;
  libelle: string;
  quantite: string;
  unite: string;
  prixUnitaireCHF: string | null;
  notes: string | null;
}

export interface LigneTravailHeure {
  id: string;
  travailId: string;
  userId: string;
  user?: { id: string; prenom: string; nom: string; email: string };
  heureDebut: string | null;
  heureFin: string | null;
  dureeMinutes: number;
  tauxHoraireCHF: string | null;
  notes: string | null;
}

export interface Travail {
  id: string;
  tenantId: string;
  partenaireId: string | null;
  partenaire?: { id: string; nom: string; code: string; canton: string } | null;
  parcelleId: string | null;
  parcelle?: { id: string; nom: string } | null;
  /** Projet de regroupement (cf C2). Null = aucun projet rattaché. */
  projetId: string | null;
  projet?: { id: string; nom: string; type: string; couleurHex: string | null } | null;
  titre: string;
  date: string;
  dateDebut: string | null;
  dateFin: string | null;
  interne: boolean;
  statut: TravailStatut;
  notes: string | null;
  odooSaleOrderId: number | null;
  odooTaskId: number | null;
  invoicedAt: string | null;
  /** Client Odoo "seul" (res.partner) — alternatif à partenaireId. */
  odooPartnerId: number | null;
  /** Nom du client Odoo capturé au save (cache local pour affichage). */
  odooPartnerName: string | null;
  /** Sprint 2 fusion-interventions — Planning. */
  datePrevue: string | null;
  assignedToUserId: string | null;
  assignedTo?: { id: string; prenom: string; nom: string } | null;
  lignesProduit: LigneTravailProduit[];
  lignesHeure: LigneTravailHeure[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateLigneProduitInput {
  produitId?: string;
  libelle: string;
  quantite: number;
  unite?: string;
  prixUnitaireCHF?: number;
  notes?: string;
}

export interface CreateLigneHeureInput {
  userId: string;
  heureDebut?: string;
  heureFin?: string;
  dureeMinutes: number;
  tauxHoraireCHF?: number;
  notes?: string;
}

export interface CreateTravailInput {
  titre: string;
  date: string;
  dateDebut?: string;
  dateFin?: string;
  partenaireId?: string;
  odooPartnerId?: number;
  odooPartnerName?: string;
  parcelleId?: string;
  projetId?: string;
  interne?: boolean;
  notes?: string;
  datePrevue?: string;
  assignedToUserId?: string;
  lignesProduit?: CreateLigneProduitInput[];
  lignesHeure?: CreateLigneHeureInput[];
}

const KEY = ["travaux"] as const;

export function useTravaux() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api<Travail[]>("/api/travaux"),
  });
}

export interface MesHeuresLigne {
  id: string;
  travailId: string;
  travail: {
    id: string;
    titre: string;
    date: string;
    statut: TravailStatut;
    partenaire: { id: string; nom: string } | null;
    parcelle: { id: string; nom: string } | null;
  };
  userId: string;
  dureeMinutes: number;
  tauxHoraireCHF: string | null;
  notes: string | null;
}

export function useMesHeures(filters?: { dateDebut?: string; dateFin?: string }) {
  const params = new URLSearchParams();
  if (filters?.dateDebut) params.set("dateDebut", filters.dateDebut);
  if (filters?.dateFin) params.set("dateFin", filters.dateFin);
  const qs = params.toString();
  const url = qs ? `/api/travaux/mes-heures?${qs}` : "/api/travaux/mes-heures";
  return useQuery({
    queryKey: ["travaux", "mes-heures", filters?.dateDebut ?? "", filters?.dateFin ?? ""] as const,
    queryFn: () => api<MesHeuresLigne[]>(url),
  });
}

export function useTravail(id: string | undefined) {
  return useQuery({
    queryKey: ["travaux", id] as const,
    queryFn: () => api<Travail>(`/api/travaux/${id}`),
    enabled: !!id,
  });
}

export function useCreateTravail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTravailInput) =>
      api<Travail>("/api/travaux", { method: "POST", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateTravail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: CreateTravailInput & { id: string }) =>
      api<Travail>(`/api/travaux/${id}`, { method: "PATCH", body: input }),
    onSuccess: (t) => {
      void qc.invalidateQueries({ queryKey: KEY });
      void qc.invalidateQueries({ queryKey: ["travaux", t.id] });
    },
  });
}

export function useValidateTravail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<Travail>(`/api/travaux/${id}/validate`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCancelTravail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<Travail>(`/api/travaux/${id}/cancel`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

/**
 * Sprint 2 fusion-interventions — Marque un travail PLANIFIE comme terminé.
 * OWNER → VALIDATED ; EMPLOYE → PENDING_REVIEW (attente OWNER).
 */
export function useCompleteTravail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<Travail>(`/api/travaux/${id}/complete`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

export interface PushTravailResult {
  /** "sale_order" pour facturable, "project_task" pour travail interne. */
  odooKind: "sale_order" | "project_task";
  odooSaleOrderId: number | null;
  odooTaskId: number | null;
  odooUrl: string;
  partnerCreated: boolean;
  productsCreated: number;
  linesCount: number;
}

/**
 * Pousse un travail vers Odoo en sale.order brouillon. Le backend gère
 * la résolution du res.partner (lookup/create) et le mapping produits
 * via odooProductId. Les lignes heures sont agrégées sur un produit
 * service "Main d'œuvre (Agri Qodo)".
 */
export function usePushTravailOdoo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<PushTravailResult>(`/api/travaux/${id}/push-odoo`, { method: "POST" }),
    onSuccess: (_r, id) => {
      void qc.invalidateQueries({ queryKey: KEY });
      void qc.invalidateQueries({ queryKey: ["travaux", id] });
    },
  });
}

export function useDeleteTravail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/travaux/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

export const STATUT_LABEL: Record<TravailStatut, string> = {
  PLANIFIE: "Planifié",
  DRAFT: "Brouillon",
  PENDING_REVIEW: "À valider",
  VALIDATED: "Validé",
  INVOICED: "Facturé",
  CANCELLED: "Annulé",
};

export const STATUT_BADGE: Record<TravailStatut, string> = {
  PLANIFIE: "bg-background text-green border border-green",
  DRAFT: "bg-muted/40 text-foreground/80 border border-border",
  PENDING_REVIEW: "bg-amber-50 text-amber-900 border border-amber-300",
  VALIDATED: "bg-emerald-50 text-emerald-900 border border-emerald-300",
  INVOICED: "bg-blue-50 text-blue-900 border border-blue-300",
  CANCELLED: "bg-red-50 text-red-900 border border-red-300",
};

export function totalProduitsCHF(t: Travail): number {
  return t.lignesProduit.reduce((sum, l) => {
    if (!l.prixUnitaireCHF) return sum;
    return sum + Number(l.quantite) * Number(l.prixUnitaireCHF);
  }, 0);
}

export function totalHeuresCHF(t: Travail): number {
  return t.lignesHeure.reduce((sum, l) => {
    if (!l.tauxHoraireCHF) return sum;
    return sum + (l.dureeMinutes / 60) * Number(l.tauxHoraireCHF);
  }, 0);
}

export function totalTravailCHF(t: Travail): number {
  return totalProduitsCHF(t) + totalHeuresCHF(t);
}

export function formatCHF(n: number): string {
  return n.toLocaleString("fr-CH", { style: "currency", currency: "CHF" });
}

export function formatDuree(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, "0")}`;
}
