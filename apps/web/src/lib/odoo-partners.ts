"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export interface OdooPartner {
  odooId: number;
  name: string;
  email: string | null;
  phone: string | null;
  ville: string | null;
  npa: string | null;
  adresse: string | null;
  /** Si défini : ce client Odoo est aussi sur Agri Qodo via PartnerLink. */
  linkedExploitationId: string | null;
  linkedExploitationNom: string | null;
}

/**
 * Sprint 2 fusion-interventions — sélecteur Client unifié.
 * Liste les res.partner Odoo (clients) du tenant connecté, avec un flag
 * indiquant lesquels sont déjà liés à une Exploitation Agri Qodo via
 * PartnerLink.odooPartnerId. Vide si Odoo non configuré.
 */
export function useOdooPartners() {
  return useQuery({
    queryKey: ["odoo-partners"] as const,
    queryFn: () => api<OdooPartner[]>("/api/odoo/partners"),
    staleTime: 60_000,
  });
}

export interface CreateQuickClientInput {
  nom: string;
  ville?: string;
  npa?: string;
  adresse?: string;
  email?: string;
  telephone?: string;
}

export interface CreateQuickClientResult {
  odooPartnerId: number;
  name: string;
}

/**
 * Crée un res.partner Odoo (sans Exploitation Agri Qodo). Décision
 * Fabien 2026-05-06 : un client Odoo n'est PAS un partenaire — on
 * stocke juste l'odooPartnerId côté Travail.
 */
export function useCreateQuickClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuickClientInput) =>
      api<CreateQuickClientResult>("/api/odoo/partners", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["odoo-partners"] });
    },
  });
}
