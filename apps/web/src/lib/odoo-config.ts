"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export interface OdooConfig {
  url: string | null;
  database: string | null;
  username: string | null;
  hasApiKey: boolean;
  version: string | null;
  connectedAt: string | null;
}

export interface UpsertOdooConfigInput {
  url: string;
  database: string;
  username: string;
  /** Optionnel : si absent, la clé actuelle est conservée. */
  apiKey?: string;
}

const KEY = ["odoo-config"] as const;

export function useOdooConfig() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api<OdooConfig>("/api/tenants/me/odoo-config"),
  });
}

export function useUpsertOdooConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertOdooConfigInput) =>
      api<OdooConfig>("/api/tenants/me/odoo-config", { method: "PUT", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteOdooConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/api/tenants/me/odoo-config", { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useTestOdooConfig() {
  return useMutation({
    mutationFn: () => api<unknown>("/api/tenants/me/odoo-config/test", { method: "POST" }),
  });
}
