/**
 * Système de droits par utilisateur — version Odoo simplifiée.
 *
 * Chaque utilisateur a un rôle global (admin / editor / viewer) qui définit
 * des défauts par module. Les valeurs `permissions` sur l'utilisateur les
 * surchargent finement, module par module.
 *
 * Helper principal : `canAccess(user, module, requiredLevel)`.
 * Hook React : `useCan(module, requiredLevel)` — utilise le user courant.
 */

import { useUsers } from './users.store';
import type {
  AppUser,
  ModuleKey,
  ModulePermissions,
  PermissionLevel,
  UserRole,
} from './users.types';

export const MODULE_KEYS: ReadonlyArray<ModuleKey> = [
  'parcellaire',
  'assolement',
  'carnet',
  'fumure',
  'troupeau',
  'travaux',
  'rh',
  'parametres',
];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  parcellaire: 'Parcellaire',
  assolement: 'Plan d’assolement',
  carnet: 'Carnet des champs',
  fumure: 'Plan de fumure',
  troupeau: 'Troupeau',
  travaux: 'Travaux pour tiers',
  rh: 'Ressources humaines',
  parametres: 'Paramètres',
};

export const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  none: 'Aucun accès',
  read: 'Lecture',
  write: 'Lecture + écriture',
  admin: 'Administration',
};

export const PERMISSION_ORDER: ReadonlyArray<PermissionLevel> = ['none', 'read', 'write', 'admin'];

/** Droits par défaut associés à chaque rôle. */
export const ROLE_DEFAULTS: Record<UserRole, ModulePermissions> = {
  admin: {
    parcellaire: 'admin',
    assolement: 'admin',
    carnet: 'admin',
    fumure: 'admin',
    troupeau: 'admin',
    travaux: 'admin',
    rh: 'admin',
    parametres: 'admin',
  },
  editor: {
    parcellaire: 'write',
    assolement: 'write',
    carnet: 'write',
    fumure: 'write',
    troupeau: 'write',
    travaux: 'write',
    rh: 'read',
    parametres: 'read',
  },
  viewer: {
    parcellaire: 'read',
    assolement: 'read',
    carnet: 'read',
    fumure: 'read',
    troupeau: 'read',
    travaux: 'read',
    rh: 'read',
    parametres: 'none',
  },
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  editor: 'Éditeur',
  viewer: 'Lecteur',
};

/** Retourne la permission effective (override sur défaut du rôle). */
export function effectivePermission(user: AppUser | undefined, module: ModuleKey): PermissionLevel {
  if (!user || !user.active) return 'none';
  const override = user.permissions?.[module];
  if (override) return override;
  return ROLE_DEFAULTS[user.role][module];
}

/** Compare deux niveaux : retourne true si `actual` couvre `required`. */
export function meetsLevel(actual: PermissionLevel, required: PermissionLevel): boolean {
  return PERMISSION_ORDER.indexOf(actual) >= PERMISSION_ORDER.indexOf(required);
}

/** Helper principal : l'utilisateur a-t-il au moins le niveau requis sur le module ? */
export function canAccess(
  user: AppUser | undefined,
  module: ModuleKey,
  requiredLevel: PermissionLevel = 'read',
): boolean {
  return meetsLevel(effectivePermission(user, module), requiredLevel);
}

/** Résoud les permissions à partir d'un draft d'utilisateur (form). */
export function resolvePermissions(
  role: UserRole,
  overrides?: Partial<ModulePermissions>,
): ModulePermissions {
  const base = ROLE_DEFAULTS[role];
  if (!overrides) return { ...base };
  return MODULE_KEYS.reduce<ModulePermissions>((acc, k) => {
    acc[k] = overrides[k] ?? base[k];
    return acc;
  }, {} as ModulePermissions);
}

/**
 * Récupère l'utilisateur courant — pour l'instant : 1er admin actif.
 *
 * Phase 3 : viendra de auth.store (lien `auth.users.id` <-> `farm_workers.user_id`).
 */
export function useCurrentUser(): AppUser | undefined {
  const users = useUsers();
  return users.find((u) => u.active && u.role === 'admin') ?? users[0];
}

/** Hook : l'utilisateur courant a-t-il le droit `requiredLevel` sur ce module ? */
export function useCan(module: ModuleKey, requiredLevel: PermissionLevel = 'read'): boolean {
  const me = useCurrentUser();
  return canAccess(me, module, requiredLevel);
}
