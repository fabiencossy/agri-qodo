import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
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

export function useIsAuthenticated() {
  return useQuery({
    queryKey: ["auth-state"],
    queryFn: async () => (await getStoredTokens()) !== null,
    staleTime: 0,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const tokens = await api<AuthTokens>("/api/auth/login", {
        method: "POST",
        body: input,
        skipAuth: true,
      });
      await setStoredTokens(tokens);
      return tokens;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["auth-state"] });
      router.replace("/");
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        await api<void>("/api/auth/logout", { method: "POST" });
      } catch (err) {
        if (!(err instanceof AuthError)) throw err;
      }
      await clearStoredTokens();
    },
    onSuccess: () => {
      queryClient.clear();
      router.replace("/login");
    },
  });
}

export function useCurrentTenant() {
  const auth = useIsAuthenticated();
  return useQuery({
    queryKey: ["current-tenant"],
    queryFn: () => api<CurrentTenant>("/api/tenants/me"),
    enabled: auth.data === true,
  });
}
