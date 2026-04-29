"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api-client";

export interface InterdictionResult {
  interdit: boolean;
  raison: string | null;
  prochaineFenetreOuverture: string | null;
}

export function useCheckFumureOrganique(parcelleId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: ["per", "check-fumure", parcelleId, date] as const,
    queryFn: () =>
      api<InterdictionResult>(
        `/api/per/check-fumure-organique?parcelleId=${parcelleId}&date=${date}`,
      ),
    enabled: !!parcelleId && !!date,
    staleTime: 60_000, // les calendriers changent rarement
  });
}
