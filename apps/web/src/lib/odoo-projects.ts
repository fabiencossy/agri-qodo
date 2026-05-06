"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api-client";

export interface OdooProject {
  odooId: number;
  name: string;
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
