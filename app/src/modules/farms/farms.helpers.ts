/**
 * Helpers de logique métier sur les exploitations — facturation et rôles.
 *
 * Modèle (cf. mémoire `project-facturation-tiers`) :
 *  - Plan 'solo'  : 1 exploitation possédée maximum
 *  - Plan 'multi' : exploitations possédées illimitées
 *  - Mode invité (gratuit, transverse) : lecture seule + droit cross-farm Travaux
 */

import { useCurrentFarmId, useFarms } from './farms.store';
import { useCurrentUser } from '../users/permissions';
import type { Farm } from './farms.types';
import type { SubscriptionPlan } from '../parametres/preferences.store';

/**
 * Niveau d'accès de l'utilisateur courant sur une exploitation :
 *  - 'owner'   : possédée (paie l'abonnement, droits complets)
 *  - 'managed' : exploitation d'un client externe que je gère pour lui —
 *                droits complets côté UI, mais hors-forfait Solo/Multi
 *  - 'invitee' : invité par un autre user actif — lecture seule + droit
 *                cross-farm Travaux pour tiers
 */
export type FarmRole = 'owner' | 'managed' | 'invitee';

/** Détermine le rôle de l'utilisateur sur une exploitation donnée. */
export function getFarmRole(farm: Farm, currentUserId: string | undefined): FarmRole {
  if (farm.managedByCurrentUser) return 'managed';
  if (!currentUserId) return 'invitee';
  return farm.ownerUserId === currentUserId ? 'owner' : 'invitee';
}

/**
 * Liste des routes accessibles quand on est invité sur une exploitation.
 * Tout le reste doit être masqué (sidebar) et redirigé (route guard).
 * Notamment : pas d'assolement, pas de carnet, pas de fumure, pas de
 * troupeau, pas de paramètres — l'invité ne fait QUE consulter la carte et
 * créer/voir ses propres travaux pour tiers chez le client.
 */
export const INVITEE_ALLOWED_PATHS: ReadonlyArray<string> = [
  '/parcellaire',
  '/planning',
  '/travaux',
];

/** Vrai si une route est autorisée en mode invité (préfix-match sur chaque path). */
export function isInviteeAllowedPath(pathname: string): boolean {
  return INVITEE_ALLOWED_PATHS.some(
    (allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`),
  );
}

/* ─── Hooks React ──────────────────────────────────────────────────────── */

/** Rôle de l'utilisateur courant sur la current farm. */
export function useCurrentFarmRole(): FarmRole {
  const farms = useFarms();
  const currentId = useCurrentFarmId();
  const currentUser = useCurrentUser();
  const current = farms.find((f) => f.id === currentId);
  if (!current) return 'owner';
  return getFarmRole(current, currentUser?.id);
}

/**
 * Sucre syntaxique : true si l'utilisateur courant a un accès "restreint" sur
 * la current farm — invité strict OU exploitation gérée pour un client externe.
 * Dans les deux cas, l'UI bloque carnet / fumure / troupeau / paramètres :
 *  - 'invitee' : pas le droit (lecture seule chez le client propriétaire)
 *  - 'managed' : pas utile (le client n'a pas l'app, on ne saisit pas son
 *    agronomie privée pour lui — uniquement parcelles + travaux pour tiers)
 *
 * Le bandeau de la sidebar adapte son texte selon le rôle réel.
 */
export function useIsCurrentFarmInvitee(): boolean {
  const role = useCurrentFarmRole();
  return role === 'invitee' || role === 'managed';
}

/* ─── Mapping Farm ↔ Client (Travaux pour tiers) ───────────────────────── */

interface ClientLike {
  id: string;
  name: string;
}

/**
 * Trouve le client ThirdPartyClient correspondant à une exploitation,
 * pour préfill le Travaux pour tiers quand on est invité chez ce client.
 *
 * Stratégie MVP : matching par nom (substring bidirectionnel insensible
 * à la casse). Ex. "Famille Pittet" matche "Famille Pittet — Bercher".
 * Phase 3 : remplacer par un FK explicite Farm.clientId.
 */
export function findClientForFarm<C extends ClientLike>(
  farm: Farm | undefined,
  clients: ReadonlyArray<C>,
): C | undefined {
  if (!farm) return undefined;
  const farmName = farm.name.toLowerCase().trim();
  // Match strict bidirectionnel — voir findFarmForClient pour l'historique du bug.
  return clients.find((c) => {
    const clientName = c.name.toLowerCase().trim();
    return (
      clientName === farmName || clientName.includes(farmName) || farmName.includes(clientName)
    );
  });
}

/**
 * Inverse de findClientForFarm : trouve l'exploitation correspondant à un
 * client (matching nom case-insensitive). Sert à filtrer les parcelles d'un
 * client dans les modaux de bon de travail.
 */
export function findFarmForClient<C extends ClientLike>(
  client: C | undefined,
  farms: ReadonlyArray<Farm>,
): Farm | undefined {
  if (!client) return undefined;
  const clientName = client.name.toLowerCase().trim();
  // Match strict bidirectionnel : un nom doit contenir l'autre entièrement.
  // Évite que "Ferme des Crausaz" matche "Ferme de la Combe" via préfixe commun.
  return farms.find((f) => {
    const farmName = f.name.toLowerCase().trim();
    return (
      farmName === clientName || farmName.includes(clientName) || clientName.includes(farmName)
    );
  });
}

/** Filtre les exploitations possédées par l'utilisateur courant (forfait). */
export function filterOwnedFarms(
  farms: ReadonlyArray<Farm>,
  currentUserId: string | undefined,
): ReadonlyArray<Farm> {
  if (!currentUserId) return [];
  return farms.filter((f) => !f.managedByCurrentUser && f.ownerUserId === currentUserId);
}

/**
 * Filtre les exploitations chez les clients de l'utilisateur courant — fusion
 * des cas "invité par autrui" et "géré par moi pour un client sans app".
 *
 * Les deux cas ont le **même mode d'accès** (lecture seule + travaux pour
 * tiers, hors-forfait), seule la métadonnée `managedByCurrentUser` les
 * distingue en interne (utile pour Odoo : savoir qui a créé le client).
 * Côté UI, c'est une seule section unifiée.
 */
export function filterInvitedFarms(
  farms: ReadonlyArray<Farm>,
  currentUserId: string | undefined,
): ReadonlyArray<Farm> {
  if (!currentUserId) return [];
  return farms.filter(
    (f) =>
      // Géré par moi pour un client externe sans app
      f.managedByCurrentUser ||
      // OU invité par un autre utilisateur actif
      (f.ownerUserId && f.ownerUserId !== currentUserId),
  );
}

/**
 * Évalue le pricing d'une nouvelle exploitation pour l'utilisateur courant.
 * Jamais bloquant — la création est toujours autorisée. On retourne juste
 * la "situation tarifaire" pour informer l'utilisateur avant qu'il valide :
 *
 * - 'first'           : 1ère exploitation, forfait Solo s'applique (tarif de base)
 * - 'within-multi'    : déjà Multi, exploitation N+1 incluse dans le forfait
 * - 'upgrade-warning' : Solo + 1 owned existante → la création va faire passer
 *                       à Multi (tarif supérieur). À confirmer par l'utilisateur.
 *
 * La facturation réelle est gérée par Odoo (Master Qodo) — pas de Stripe direct.
 * Le mode invité n'a pas de notion de création — on est invité OU on possède.
 */
export type NewFarmPricingState = 'first' | 'within-multi' | 'upgrade-warning';

export function evaluateNewFarmPricing(
  plan: SubscriptionPlan,
  ownedFarmsCount: number,
): NewFarmPricingState {
  if (plan === 'multi') return 'within-multi';
  if (ownedFarmsCount === 0) return 'first';
  return 'upgrade-warning';
}

/**
 * Génère les initiales (2 lettres max) à partir d'un nom d'exploitation.
 * Ex. "Domaine Darval" → "DD", "Ferme des Crausaz" → "FC", "Léman" → "LÉ".
 */
export function deriveInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((w) => w && !['de', 'des', 'du', 'la', 'le', "l'", "d'"].includes(w.toLowerCase()));
  if (words.length === 0) return '??';
  if (words.length === 1) return (words[0]!.slice(0, 2) || '??').toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** Palette de couleurs pour les avatars de nouvelles exploitations. */
const PALETTE: ReadonlyArray<string> = [
  '#2d5016', // vert primary
  '#a16207', // ocre
  '#0284c7', // bleu
  '#c026d3', // magenta
  '#dc2626', // rouge
  '#0f766e', // teal
  '#7c3aed', // violet
  '#ea580c', // orange
];

/**
 * Couleur d'avatar déterministe à partir du nom (évite les doublons en
 * dérivant un index stable de la chaîne).
 */
export function deriveColor(name: string, usedColors: ReadonlyArray<string> = []): string {
  // Hash simple de la chaîne pour un index stable
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const startIndex = Math.abs(hash) % PALETTE.length;
  // Cherche la 1ère couleur non utilisée à partir de cet index
  for (let i = 0; i < PALETTE.length; i++) {
    const candidate = PALETTE[(startIndex + i) % PALETTE.length]!;
    if (!usedColors.includes(candidate)) return candidate;
  }
  return PALETTE[startIndex]!;
}
