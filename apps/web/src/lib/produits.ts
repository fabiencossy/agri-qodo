"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export type ProduitCategorie =
  | "SEMENCE"
  | "ENGRAIS_MINERAL"
  | "ENGRAIS_ORGANIQUE"
  | "PHYTO"
  | "PRESTATION"
  | "TRAVAIL_SOL"
  | "RECOLTE"
  | "IRRIGATION"
  | "CARBURANT"
  | "PIECES_MATERIEL"
  | "AUTRE";

export type ProduitUnite = "KG" | "L" | "T" | "M3" | "DOSE" | "HA" | "UNITE" | "HEURE";

export interface Produit {
  id: string;
  tenantId: string | null;
  code: string;
  categorie: ProduitCategorie;
  libelle: string;
  fournisseur: string | null;
  marque: string | null;
  especeCode: string | null;
  tauxN: string | null; // Decimal sérialisé
  tauxP: string | null;
  tauxK: string | null;
  unite: ProduitUnite;
  /** Prix de vente catalogue CHF HT par unité — null si pas autorisé à le voir. */
  prixVenteCHF: string | null;
  /** Taux TVA CH en % (ex 8.10, 2.60). Sérialisé Decimal → string. */
  tauxTvaPercent: string | null;
  notes: string | null;
  actif: boolean;
  /** ID Odoo product.product si déjà poussé/synchronisé. */
  odooProductId: number | null;
  /** ISO datetime de la dernière sync Odoo. */
  odooSyncedAt: string | null;
}

export interface CreateProduitInput {
  categorie: ProduitCategorie;
  libelle: string;
  fournisseur?: string;
  marque?: string;
  especeCode?: string;
  tauxN?: number;
  tauxP?: number;
  tauxK?: number;
  unite?: ProduitUnite;
  prixVenteCHF?: number;
  tauxTvaPercent?: number;
  notes?: string;
}

const KEY = ["produits"] as const;

export function useProduits(categorie?: ProduitCategorie) {
  return useQuery({
    queryKey: [...KEY, categorie ?? "all"] as const,
    queryFn: () => api<Produit[]>(`/api/produits${categorie ? `?categorie=${categorie}` : ""}`),
  });
}

export function useCreateProduit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProduitInput) =>
      api<Produit>("/api/produits", { method: "POST", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateProduit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<CreateProduitInput> & { id: string }) =>
      api<Produit>(`/api/produits/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteProduit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/produits/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export interface SyncOdooProduitsResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ odooId: number; raison: string }>;
}

/** Lance la synchro `product.product` depuis Odoo. Admin only côté backend. */
export function useSyncProduitsOdoo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<SyncOdooProduitsResult>("/api/produits/sync-odoo", { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

/**
 * Push un produit unique vers Odoo (crée product.product type=consu
 * si pas encore mappé). Idempotent côté backend.
 */
export function usePushProduitOdoo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ odooProductId: number }>(`/api/produits/${id}/push-odoo`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export const CATEGORIE_LABEL: Record<ProduitCategorie, string> = {
  SEMENCE: "Semences",
  ENGRAIS_MINERAL: "Engrais minéraux",
  ENGRAIS_ORGANIQUE: "Engrais organiques",
  PHYTO: "Produits phytosanitaires",
  PRESTATION: "Prestations (bottelage, ensilage…)",
  TRAVAIL_SOL: "Travaux du sol",
  RECOLTE: "Récolte (foin, paille…)",
  IRRIGATION: "Irrigation",
  CARBURANT: "Carburants & lubrifiants",
  PIECES_MATERIEL: "Pièces de matériel",
  AUTRE: "Autres",
};

export const UNITE_LABEL: Record<ProduitUnite, string> = {
  KG: "kg",
  L: "L",
  T: "t",
  M3: "m³",
  DOSE: "doses",
  HA: "ha",
  UNITE: "u.",
  HEURE: "h",
};

export const CATEGORIES_ORDER: ProduitCategorie[] = [
  "SEMENCE",
  "ENGRAIS_MINERAL",
  "ENGRAIS_ORGANIQUE",
  "PHYTO",
  "PRESTATION",
  "TRAVAIL_SOL",
  "RECOLTE",
  "IRRIGATION",
  "CARBURANT",
  "PIECES_MATERIEL",
  "AUTRE",
];
