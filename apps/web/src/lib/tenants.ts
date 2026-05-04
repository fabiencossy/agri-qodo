"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccessibleTenant } from "./active-tenant";
import { api } from "./api-client";

export interface TenantDetail {
  id: string;
  code: string;
  nom: string;
  canton: string;
  numeroUfam: string | null;
  numeroBdta: string | null;
  adresse: string | null;
  npa: string | null;
  localite: string | null;
  emailContact: string | null;
  telephone: string | null;
  visibleInDirectory: boolean;
  /** Settings projets (cf C2). */
  noterTempsParProjet: boolean;
  defaultProjetTravauxTiersId: string | null;
  /** Suivi des heures sur toutes les activités (PRD fusion v0.2). */
  suiviHeuresActif: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateTenantInput {
  numeroExploitant?: string;
  nom?: string;
  numeroUfam?: string;
  numeroBdta?: string;
  visibleInDirectory?: boolean;
  noterTempsParProjet?: boolean;
  defaultProjetTravauxTiersId?: string;
  suiviHeuresActif?: boolean;
}

export function useAccessibleTenants() {
  return useQuery({
    queryKey: ["tenants-accessible"],
    queryFn: () => api<AccessibleTenant[]>("/api/tenants/accessible"),
  });
}

export function useTenantDetail() {
  return useQuery({
    queryKey: ["tenant-detail"],
    queryFn: () => api<TenantDetail>("/api/tenants/me"),
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTenantInput) =>
      api<TenantDetail>("/api/tenants/me", { method: "PATCH", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tenant-detail"] });
      void qc.invalidateQueries({ queryKey: ["current-tenant"] });
    },
  });
}
