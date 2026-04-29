"use client";

/**
 * Storage minimal du tenant actif (localStorage). Volontairement sans
 * dépendance pour éviter les cycles avec api-client.ts qui le consomme.
 *
 * Sert au compte fédéré : un même couple email+password peut ouvrir
 * une session sur plusieurs exploitations. Le switcher bascule entre
 * elles via le header `X-Active-Tenant-Id`. Le JwtAuthGuard valide que
 * le tenantId demandé fait bien partie de la liste émise au login.
 */

const KEY = "agriqodo.activeTenantId";

export interface AccessibleTenant {
  id: string;
  nom: string;
  code: string;
  canton: string;
  /** "home" : tenant accessible via compte fédéré. */
  kind: "home";
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
