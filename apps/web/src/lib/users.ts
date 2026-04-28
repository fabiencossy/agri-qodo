"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export type UserRole = "OWNER" | "EMPLOYE" | "COMPTABLE" | "CONSULTANT";

export interface User {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  prenom: string;
  nom: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  prenom?: string;
  nom?: string;
  role?: UserRole;
  isActive?: boolean;
  password?: string;
}

const KEY = ["users"] as const;

export function useUsers() {
  return useQuery({ queryKey: KEY, queryFn: () => api<User[]>("/api/users") });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) =>
      api<User>("/api/users", { method: "POST", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateUserInput & { id: string }) =>
      api<User>(`/api/users/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export const ROLE_LABEL: Record<UserRole, string> = {
  OWNER: "Chef d'exploitation",
  EMPLOYE: "Salarié",
  COMPTABLE: "Comptable",
  CONSULTANT: "Conseiller (Agridea, fiduciaire)",
};

export const ROLES_ORDER: UserRole[] = ["OWNER", "EMPLOYE", "COMPTABLE", "CONSULTANT"];
