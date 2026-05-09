"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api-client";

export interface OdooEmployee {
  odooId: number;
  name: string;
  workEmail: string | null;
}

/**
 * Liste les `hr.employee` Odoo actifs du tenant courant. Vide si Odoo
 * non configuré ou si le module hr n'est pas installé. Sert à alimenter
 * le select Employé Odoo sur /utilisateurs (mapping User.odooEmployeeId).
 */
export function useOdooEmployees() {
  return useQuery({
    queryKey: ["odoo-employees"] as const,
    queryFn: () => api<OdooEmployee[]>("/api/odoo/employees"),
    staleTime: 60_000,
  });
}
