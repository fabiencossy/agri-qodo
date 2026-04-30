"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "./api-client";
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

export interface CurrentUser {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  role: "OWNER" | "EMPLOYE" | "COMPTABLE" | "CONSULTANT";
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
      router.push("/app");
    },
  });
}

export interface RegisterInput {
  email: string;
  password: string;
  prenom: string;
  nom: string;
  exploitationNom: string;
  canton: string;
}

export function useRegister() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RegisterInput): Promise<AuthTokens> => {
      const tokens = await api<AuthTokens>("/api/auth/register", {
        method: "POST",
        body: input,
        skipAuth: true,
      });
      setStoredTokens(tokens);
      return tokens;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["auth-state"] });
      router.push("/app");
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      // La déconnexion locale doit TOUJOURS réussir, même si le serveur
      // est down ou renvoie une 5xx — sinon l'utilisateur reste coincé sur
      // l'app sans pouvoir partir. On tente la révocation côté serveur,
      // mais on swallow toutes les erreurs (réseau, 401, 5xx) — c'est une
      // optimisation (révoquer le refresh token), pas une condition de
      // déconnexion.
      try {
        await api<void>("/api/auth/logout", { method: "POST" });
      } catch {
        // intentionnellement silencieux
      }
      clearStoredTokens();
    },
    onSuccess: () => {
      queryClient.clear();
      router.push("/login");
    },
    // Si onSuccess ne s'exécute pas (pas attendu mais filet), nettoyer ici
    // aussi — onSettled tourne dans tous les cas.
    onSettled: () => {
      clearStoredTokens();
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

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: () => api<CurrentUser>("/api/auth/me"),
    enabled: getStoredTokens() !== null,
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      api<void>("/api/auth/change-password", { method: "POST", body: input }),
  });
}

export interface UserProfile {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  telephone: string | null;
  avatarUrl: string | null;
  preferences: Record<string, unknown> | null;
  role: "OWNER" | "EMPLOYE" | "COMPTABLE" | "CONSULTANT";
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export function useMyProfile() {
  return useQuery({
    queryKey: ["users", "me"],
    queryFn: () => api<UserProfile>("/api/users/me"),
    enabled: getStoredTokens() !== null,
  });
}

export interface UpdateProfileInput {
  prenom?: string;
  nom?: string;
  telephone?: string;
  preferences?: Record<string, unknown>;
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      api<UserProfile>("/api/users/me", { method: "PATCH", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users", "me"] });
      void qc.invalidateQueries({ queryKey: ["current-user"] });
    },
  });
}
