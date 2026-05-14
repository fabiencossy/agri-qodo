"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api-client";

export interface OdooProject {
  odooId: number;
  name: string;
}

export interface OdooProjectsDiagnostic {
  configured: boolean;
  error: string | null;
  count: number;
  countActifs: number;
  sample: Array<{ odooId: number; name: string; active: boolean }>;
}

/**
 * Liste les `project.project` Odoo actifs du tenant courant. Vide si
 * Odoo non configuré. Sert à alimenter les 3 sélecteurs dans
 * /parametres/exploitation pour le PRD prestations v0.3 §2.
 */
export function useOdooProjects() {
  return useQuery({
    queryKey: ["odoo-projects"] as const,
    queryFn: () => api<OdooProject[]>("/api/odoo/projects"),
    staleTime: 60_000,
  });
}

/**
 * Diagnostic appelé quand la liste des projets est vide pour expliquer
 * pourquoi (Odoo non configuré / erreur XML-RPC / projets archivés).
 */
export function useOdooProjectsDiagnostic(enabled: boolean) {
  return useQuery({
    queryKey: ["odoo-projects-diagnostic"] as const,
    queryFn: () => api<OdooProjectsDiagnostic>("/api/odoo/projects/diagnose"),
    enabled,
    staleTime: 30_000,
  });
}
