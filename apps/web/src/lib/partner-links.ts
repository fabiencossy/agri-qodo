"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export type PartnerLinkStatus = "PENDING" | "ACTIVE" | "REVOKED";
export type PartnerLinkLevel = "LECTURE" | "VALIDATION" | "DIRECT";

export interface PartnerLinkScope {
  parcelles: "all" | string[];
  niveau: PartnerLinkLevel;
}

export interface PartnerLinkPartner {
  id: string;
  nom: string;
  code: string;
  canton: string;
}

export interface PartnerLinkView {
  id: string;
  status: PartnerLinkStatus;
  niveau: PartnerLinkLevel;
  scope: PartnerLinkScope;
  role: "owner" | "partner";
  partner: PartnerLinkPartner;
  createdAt: string;
  grantedAt: string | null;
  revokedAt: string | null;
}

const KEY_LIST = ["partner-links"] as const;

export function usePartnerLinks() {
  return useQuery({
    queryKey: KEY_LIST,
    queryFn: () => api<PartnerLinkView[]>("/api/partner-links"),
  });
}

export function useLookupTenant(code: string, enabled: boolean) {
  return useQuery({
    queryKey: ["partner-links", "lookup", code] as const,
    queryFn: () =>
      api<PartnerLinkPartner>(`/api/partner-links/lookup?code=${encodeURIComponent(code)}`),
    enabled,
    retry: false,
  });
}

export interface DirectoryHit {
  id: string;
  nom: string;
  code: string;
  canton: string;
  adresse: string | null;
  npa: string | null;
  localite: string | null;
  ownerPrenom: string | null;
  ownerNom: string | null;
}

/**
 * Recherche annuaire — déclenchée à partir de 2 caractères, debounce
 * conseillé côté UI. N'inclut que les exploitations qui ont opté pour la
 * visibilité publique. Endpoint : GET /partner-links/directory/search
 */
export function useSearchDirectory(query: string, canton?: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["partner-links", "directory", trimmed, canton ?? ""] as const,
    queryFn: () => {
      const params = new URLSearchParams({ q: trimmed });
      if (canton) params.set("canton", canton);
      return api<DirectoryHit[]>(`/api/partner-links/directory/search?${params}`);
    },
    enabled: trimmed.length >= 2,
    retry: false,
  });
}

export interface InvitePartnerInput {
  partnerCode: string;
  scope?: PartnerLinkScope;
}

export function useInvitePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InvitePartnerInput) =>
      api<PartnerLinkView>("/api/partner-links", { method: "POST", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY_LIST });
    },
  });
}

export function useAcceptPartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<PartnerLinkView>(`/api/partner-links/${id}/accept`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY_LIST });
    },
  });
}

export function useRevokePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<PartnerLinkView>(`/api/partner-links/${id}/revoke`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY_LIST });
    },
  });
}

export const NIVEAU_LIBELLE: Record<PartnerLinkLevel, string> = {
  LECTURE: "Lecture seule",
  VALIDATION: "Saisie avec validation",
  DIRECT: "Saisie directe",
};

export const STATUS_LIBELLE: Record<PartnerLinkStatus, string> = {
  PENDING: "En attente",
  ACTIVE: "Actif",
  REVOKED: "Révoqué",
};
