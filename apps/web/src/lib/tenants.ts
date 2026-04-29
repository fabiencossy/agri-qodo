"use client";

import { useQuery } from "@tanstack/react-query";
import type { AccessibleTenant } from "./active-tenant";
import { api } from "./api-client";

export function useAccessibleTenants() {
  return useQuery({
    queryKey: ["tenants-accessible"],
    queryFn: () => api<AccessibleTenant[]>("/api/tenants/accessible"),
  });
}
