import type { Farm } from './farms.types';

/**
 * Exploitations mock pour démo multi-tenancy.
 *
 * - 3 possédées par F. Cossy (U-001) → section "Mes exploitations" du switcher
 * - 8 où F. Cossy est invité → section "Invité dans" (idéal pour tester la
 *   barre de recherche du switcher : entrepreneur agricole qui travaille pour
 *   beaucoup de clients)
 *
 * À remplacer par fetch Odoo `agri.farm` en Phase 3.
 */
export const FARMS: ReadonlyArray<Farm> = [
  {
    id: 'F-001',
    name: 'Domaine Darval',
    location: 'Échallens, VD',
    cantonalNumber: 'VD-2026',
    surfaceTotalHa: 34.1,
    initials: 'DD',
    color: '#2d5016',
    odooFarmId: 1,
    ownerUserId: 'U-001',
  },
  {
    id: 'F-002',
    name: 'Ferme des Crausaz',
    location: 'Cossonay, VD',
    cantonalNumber: 'VD-1145',
    surfaceTotalHa: 21.8,
    initials: 'FC',
    color: '#a16207',
    // F. Cossy y est invité : permet de tester la section "Invité dans" du
    // FarmSwitcher et le droit cross-farm Travaux pour tiers.
    ownerUserId: 'U-OWNER-CRAUSAZ',
  },
  {
    id: 'F-003',
    name: 'Domaine du Léman',
    location: 'Morges, VD',
    cantonalNumber: 'VD-3789',
    surfaceTotalHa: 47.2,
    initials: 'DL',
    color: '#0284c7',
    ownerUserId: 'U-001',
  },
  // Exploitation "gérée" pour un client externe sans app — droits complets
  // côté F. Cossy mais hors-forfait Solo/Multi. Liée au client C-007 (GAEC du
  // Plateau, Penthéréaz). Démo de la section "Gérées pour clients" du switcher.
  {
    id: 'F-201',
    name: 'GAEC du Plateau (géré)',
    location: 'Penthéréaz, VD',
    cantonalNumber: 'VD-7711',
    surfaceTotalHa: 52.3,
    initials: 'GP',
    color: '#16a34a',
    ownerUserId: 'EXTERNAL-C-007',
    managedByCurrentUser: true,
    linkedClientId: 'C-007',
  },
  // ─── Exploitations où F. Cossy est invité (prestataire de travaux tiers) ──
  {
    id: 'F-101',
    name: 'Famille Pittet',
    location: 'Bercher, VD',
    cantonalNumber: 'VD-4521',
    surfaceTotalHa: 18.4,
    initials: 'FP',
    color: '#c026d3',
    ownerUserId: 'U-OWNER-PITTET',
  },
  {
    id: 'F-102',
    name: 'Commune d’Échallens',
    location: 'Échallens, VD',
    cantonalNumber: 'VD-9001',
    surfaceTotalHa: 12.1,
    initials: 'CE',
    color: '#dc2626',
    ownerUserId: 'U-OWNER-COMMUNE',
  },
  {
    id: 'F-103',
    name: 'Hofstetter SA',
    location: 'Yverdon-les-Bains, VD',
    cantonalNumber: 'VD-5512',
    surfaceTotalHa: 64.5,
    initials: 'HO',
    color: '#0f766e',
    ownerUserId: 'U-OWNER-HOFSTETTER',
  },
  {
    id: 'F-104',
    name: 'Domaine de Goumoëns',
    location: 'Goumoëns-la-Ville, VD',
    cantonalNumber: 'VD-2278',
    surfaceTotalHa: 31.0,
    initials: 'DG',
    color: '#7c3aed',
    ownerUserId: 'U-OWNER-GOUMOENS',
  },
  {
    id: 'F-105',
    name: 'Ferme de la Combe',
    location: 'Oulens-sous-Échallens, VD',
    cantonalNumber: 'VD-3344',
    surfaceTotalHa: 9.8,
    initials: 'FL',
    color: '#ea580c',
    ownerUserId: 'U-OWNER-COMBE',
  },
  {
    id: 'F-106',
    name: 'GAEC du Plateau',
    location: 'Penthéréaz, VD',
    cantonalNumber: 'VD-7711',
    surfaceTotalHa: 52.3,
    initials: 'GP',
    color: '#16a34a',
    ownerUserId: 'U-OWNER-GAEC-PLATEAU',
  },
  {
    id: 'F-107',
    name: 'Domaine Beausite',
    location: 'Bottens, VD',
    cantonalNumber: 'VD-1188',
    surfaceTotalHa: 27.6,
    initials: 'DB',
    color: '#0891b2',
    ownerUserId: 'U-OWNER-BEAUSITE',
  },
  {
    id: 'F-108',
    name: 'Vignoble Cherpillod',
    location: 'Chexbres, VD',
    cantonalNumber: 'VD-6233',
    surfaceTotalHa: 4.2,
    initials: 'VC',
    color: '#9333ea',
    ownerUserId: 'U-OWNER-CHERPILLOD',
  },
];
