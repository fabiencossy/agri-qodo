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
  exploitationId: string;
  nom: string;
  odooPartnerId: number | null;
}

/**
 * Crée un nouveau client (Exploitation shadow + PartnerLink + best-effort
 * res.partner Odoo). Renvoie l'exploitationId utilisable direct dans
 * Travail.partenaireId.
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
      void qc.invalidateQueries({ queryKey: ["partner-links"] });
    },
  });
}

/**
 * Lie un res.partner Odoo existant à une Exploitation shadow Agri Qodo.
 * Idempotent — appel multiple sur le même odooPartnerId ne crée pas de
 * doublon. Renvoie l'exploitationId à utiliser dans Travail.partenaireId.
 */
export function useLinkOdooPartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (odooPartnerId: number) =>
      api<{ exploitationId: string; nom: string }>("/api/odoo/partners/link", {
        method: "POST",
        body: { odooPartnerId },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["odoo-partners"] });
      void qc.invalidateQueries({ queryKey: ["partner-links"] });
    },
  });
}
