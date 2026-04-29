"use client";

/**
 * Storage minimal du tenant actif (localStorage). Volontairement sans
 * dépendance pour éviter les cycles avec api-client.ts qui le consomme.
 *
 * Quand l'utilisateur travaille sur le tenant d'un partenaire (lien M16
 * ACTIF), toutes les requêtes API joignent le header `X-Active-Tenant-Id`
 * pour basculer le contexte côté backend (cf JwtAuthGuard).
 */

const KEY = "agriqodo.activeTenantId";

export type AccessibleTenantKind = "home" | "partner";
export type PartnerLinkLevel = "LECTURE" | "VALIDATION" | "DIRECT";

export interface AccessibleTenant {
  id: string;
  nom: string;
  code: string;
  canton: string;
  kind: AccessibleTenantKind;
  niveau?: PartnerLinkLevel;
}

export function getActiveTenantId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

/**
 * Bascule le tenant actif et reload la page pour vider tous les caches
 * React Query d'un coup — pattern le plus sûr pour éviter d'afficher
 * des données du tenant précédent.
 */
export function setActiveTenantId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(KEY, id);
  else window.localStorage.removeItem(KEY);
  window.location.reload();
}
