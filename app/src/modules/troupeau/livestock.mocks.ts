import type { LivestockEntry } from './livestock.types';

/**
 * Cheptel mock du Domaine Darval — petite exploitation diversifiée pour démo.
 *  - 42 vaches laitières (production moyenne)
 *  - 28 génisses 1-2 ans (renouvellement)
 *  - 12 jeunes bétails < 1 an
 *  - 80 poules pondeuses (basse-cour)
 *
 * Effectifs annuels moyens (DBF 2017 : utiliser la moyenne sur l'année).
 */
export const LIVESTOCK_MOCK_ENTRIES: ReadonlyArray<LivestockEntry> = [
  {
    id: 'LE-001',
    category: 'dairy-cow-7000',
    count: 42,
    notes: 'Stabulation libre, robot de traite',
    updatedAt: '2026-01-15',
  },
  {
    id: 'LE-002',
    category: 'heifer-1-2',
    count: 28,
    notes: 'Renouvellement',
    updatedAt: '2026-01-15',
  },
  {
    id: 'LE-003',
    category: 'young-cattle-lt1',
    count: 12,
    updatedAt: '2026-01-15',
  },
  {
    id: 'LE-004',
    category: 'laying-hen',
    count: 80,
    notes: 'Basse-cour, vente directe œufs',
    updatedAt: '2026-01-15',
  },
];
