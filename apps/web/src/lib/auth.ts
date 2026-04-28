"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, AuthError } from "./api-client";
import {
  type AuthTokens,
  clearStoredTokens,
  getStoredTokens,
  setStoredTokens,
} from "./auth-storage";

export interface CurrentTenant {
  id: string;
  code: string;
  nom: string;
  canton: string;
}

/** Hook qui dit si l'utilisateur a un token. Pas de vérif côté serveur ici. */
export function useIsAuthenticated(): boolean | null {
  const query = useQuery({
    queryKey: ["auth-state"],
    queryFn: (): boolean => getStoredTokens() !== null,
    staleTime: 0,
  });
  return query.data ?? null;
}

export function useLogin() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { email: string; password: string }): Promise<AuthTokens> => {
      const tokens = await api<AuthTokens>("/api/auth/login", {
        method: "POST",
        body: input,
        skipAuth: true,
      });
      setStoredTokens(tokens);
      return tokens;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["auth-state"] });
      router.push("/");
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      try {
        await api<void>("/api/auth/logout", { method: "POST" });
      } catch (err) {
        // 401 déjà = on est déconnecté
        if (!(err instanceof AuthError)) throw err;
      }
      clearStoredTokens();
    },
    onSuccess: () => {
      queryClient.clear();
      router.push("/login");
    },
  });
}

export function useCurrentTenant() {
  return useQuery({
    queryKey: ["current-tenant"],
    queryFn: () => api<CurrentTenant>("/api/tenants/me"),
    enabled: getStoredTokens() !== null,
  });
}
