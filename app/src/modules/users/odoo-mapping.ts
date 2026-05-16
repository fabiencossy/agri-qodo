/**
 * Helpers de mapping AppUser → Odoo (Phase 3 — préparation).
 *
 * Convention du projet Field Service : les opérateurs sont représentés en
 * Odoo par des **étiquettes `project.tags`** (pas par `res.users`), car la
 * plupart des employés agricoles n'ont pas de compte Odoo (licences res.users
 * coûteuses).
 *
 * Voir la doc dans `modules/travaux/travaux.types.ts` (section "NOTE —
 * Assignation des opérateurs via étiquettes").
 */

import { getUserById } from './users.store';
import type { AppUser } from './users.types';

/**
 * Convertit une liste d'AppUser.id en liste de `project.tags.id` Odoo,
 * via le champ `AppUser.odooTagId`. Les utilisateurs sans tag mappé sont
 * silencieusement ignorés (à vérifier au moment du sync).
 */
export function userIdsToOdooTagIds(userIds: ReadonlyArray<string>): number[] {
  const tagIds: number[] = [];
  for (const id of userIds) {
    const tag = getUserById(id)?.odooTagId;
    if (typeof tag === 'number') tagIds.push(tag);
  }
  return tagIds;
}

/**
 * Convertit une liste d'AppUser.id en liste de `res.users.id` Odoo
 * (uniquement pour les employés disposant d'un compte Odoo).
 */
export function userIdsToOdooUserIds(userIds: ReadonlyArray<string>): number[] {
  const result: number[] = [];
  for (const id of userIds) {
    const u = getUserById(id)?.odooUserId;
    if (typeof u === 'number') result.push(u);
  }
  return result;
}

/**
 * Convertit un AppUser.id en hr.employee.id Odoo (timesheets).
 */
export function userIdToOdooEmployeeId(userId: string | undefined): number | undefined {
  return getUserById(userId)?.odooEmployeeId;
}

/**
 * Audit de complétude du mapping : retourne les utilisateurs actifs qui
 * n'ont pas d'`odooTagId` défini (à corriger avant 1re sync).
 */
export function listUsersMissingOdooTag(users: ReadonlyArray<AppUser>): ReadonlyArray<AppUser> {
  return users.filter((u) => u.active && typeof u.odooTagId !== 'number');
}
