"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api-client";

export type ClientType = "tenant" | "odoo";

export interface ClientSummary {
  type: ClientType;
  id: string;
  nom: string;
  canton: string | null;
  nbParcelles: number;
  nbTravaux: number;
  totalTravauxCHF: number;
}

export interface ClientDetail extends ClientSummary {
  numeroExploitant: string | null;
  emailContact: string | null;
  telephone: string | null;
  parcelles: Array<{
    id: string;
    nom: string;
    surfaceHa: number;
    cultureActuelle: string | null;
  }>;
  travaux: Array<{
    id: string;
    titre: string;
    date: string;
    statut: string;
    totalCHF: number;
    nbProduits: number;
    nbHeures: number;
  }>;
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"] as const,
    queryFn: () => api<ClientSummary[]>("/api/clients"),
  });
}

export function useClient(type: ClientType, id: string | undefined) {
  return useQuery({
    queryKey: ["clients", type, id] as const,
    enabled: !!id,
    queryFn: () => api<ClientDetail>(`/api/clients/${type}/${id}`),
  });
}
