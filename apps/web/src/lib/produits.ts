"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export type ProduitCategorie =
  | "SEMENCE"
  | "ENGRAIS_MINERAL"
  | "ENGRAIS_ORGANIQUE"
  | "PHYTO"
  | "AUTRE";

export type ProduitUnite = "KG" | "L" | "T" | "M3" | "DOSE";

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
  notes: string | null;
  actif: boolean;
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
    mutationFn: ({ id, ...input }: CreateProduitInput & { id: string }) =>
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

export const CATEGORIE_LABEL: Record<ProduitCategorie, string> = {
  SEMENCE: "Semences",
  ENGRAIS_MINERAL: "Engrais minéraux",
  ENGRAIS_ORGANIQUE: "Engrais organiques",
  PHYTO: "Produits phytosanitaires",
  AUTRE: "Autres",
};

export const UNITE_LABEL: Record<ProduitUnite, string> = {
  KG: "kg",
  L: "L",
  T: "t",
  M3: "m³",
  DOSE: "doses",
};

export const CATEGORIES_ORDER: ProduitCategorie[] = [
  "SEMENCE",
  "ENGRAIS_MINERAL",
  "ENGRAIS_ORGANIQUE",
  "PHYTO",
  "AUTRE",
];
