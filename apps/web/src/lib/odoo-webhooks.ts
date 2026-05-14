"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

const KEY = ["odoo-webhooks", "status"] as const;

export interface OdooWebhookStatus {
  enabled: boolean;
  enabledAt: string | null;
  publicUrl: string;
}

export interface OdooWebhookSetupResult {
  enabled: boolean;
  publicUrl: string;
  tokenPreview: string;
}

/** Statut du webhook temps réel Odoo → AQ pour le tenant courant. */
export function useOdooWebhookStatus() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api<OdooWebhookStatus>("/api/webhooks/odoo/status"),
  });
}

/** Active la sync webhook (crée les base.automation côté Odoo). */
export function useEnableOdooWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<OdooWebhookSetupResult>("/api/webhooks/odoo/setup", { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

/** Désactive la sync webhook (rend les base.automation inactives). */
export function useDisableOdooWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ disabled: boolean }>("/api/webhooks/odoo/disable", { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
