import { useSyncExternalStore } from 'react';
import { supabase } from '../../lib/supabase';
import { getAuth, subscribeAuth } from '../auth/auth.store';
import { FARMS as MOCK_FARMS } from './farms.mocks';
import type { Farm } from './farms.types';

/**
 * Store de l'exploitation active — dual-mode.
 *
 * - mode 'demo' : utilise FARMS mocks (3 exploitations Vaudoises)
 * - mode 'authenticated' : fetch les farms de l'utilisateur depuis Supabase
 *   (`select * from farms where id in (select farm_id from farm_members where user_id = me)`)
 *   — la RLS s'en charge automatiquement, on fait juste `select * from farms`.
 *
 * Le `currentFarmId` est persisté dans localStorage pour survivre aux
 * rechargements. Au login/logout, on rebascule entre les deux jeux.
 */

const STORAGE_KEY = 'newagriqodo-current-farm-id';

let farms: ReadonlyArray<Farm> = [...MOCK_FARMS];
let currentFarmId: string = loadCurrentFarmId() ?? farms[0]?.id ?? '';
let loading = false;
const listeners = new Set<() => void>();

function loadCurrentFarmId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistCurrentFarmId(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, currentFarmId);
  } catch {
    // localStorage indisponible
  }
}

function emit(): void {
  listeners.forEach((l) => l());
}

function rowToFarm(row: Record<string, unknown>): Farm {
  const name = String(row.name ?? '');
  const initials =
    name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';
  return {
    id: String(row.id),
    name,
    location: row.city ? `${row.city}` : undefined,
    cantonalNumber: undefined,
    surfaceTotalHa: undefined,
    initials,
    color: '#2d5016',
  };
}

async function hydrateFromSupabase(): Promise<void> {
  if (!supabase) return;
  loading = true;
  emit();
  try {
    const { data, error } = await supabase
      .from('farms')
      .select('id, name, city, postal_code, country')
      .order('name');
    if (error) {
      console.error('[farms] Supabase fetch failed:', error.message);
      farms = [];
    } else {
      farms = (data ?? []).map(rowToFarm);
    }
    // Ajuster currentFarmId si l'actuel n'est plus dans la liste
    if (!farms.some((f) => f.id === currentFarmId)) {
      currentFarmId = farms[0]?.id ?? '';
      persistCurrentFarmId();
    }
  } finally {
    loading = false;
    emit();
  }
}

function resetToMocks(): void {
  farms = [...MOCK_FARMS];
  if (!farms.some((f) => f.id === currentFarmId)) {
    currentFarmId = farms[0]?.id ?? '';
    persistCurrentFarmId();
  }
  emit();
}

// — API publique ——————————————————————————————————————————————————————

export function getFarms(): ReadonlyArray<Farm> {
  return farms;
}

export function getCurrentFarmId(): string {
  return currentFarmId;
}

export function getCurrentFarm(): Farm | undefined {
  return farms.find((f) => f.id === currentFarmId);
}

export function isFarmsLoading(): boolean {
  return loading;
}

export function setCurrentFarmId(id: string): void {
  if (id === currentFarmId) return;
  if (!farms.some((f) => f.id === id)) return;
  currentFarmId = id;
  persistCurrentFarmId();
  emit();
}

/**
 * Met à jour la ferme active en local (pas de persistance Supabase pour le
 * MVP — modif mémoire uniquement, rechargement = retour aux mocks).
 */
export function updateCurrentFarm(patch: Partial<Farm>): void {
  farms = farms.map((f) => (f.id === currentFarmId ? { ...f, ...patch } : f));
  emit();
}

export async function createFarm(input: {
  name: string;
  address?: string;
  postalCode?: string;
  city?: string;
}): Promise<Farm | null> {
  if (!supabase || getAuth().mode !== 'authenticated') {
    console.warn('[farms] createFarm requiert le mode authenticated');
    return null;
  }
  const { data, error } = await supabase
    .from('farms')
    .insert({
      name: input.name,
      address: input.address,
      postal_code: input.postalCode,
      city: input.city,
      created_by: getAuth().userId,
    })
    .select()
    .single();
  if (error || !data) {
    console.error('[farms] createFarm failed:', error?.message);
    return null;
  }
  await hydrateFromSupabase();
  const farm = rowToFarm(data);
  setCurrentFarmId(farm.id);
  return farm;
}

export function subscribeFarms(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useFarms(): ReadonlyArray<Farm> {
  return useSyncExternalStore(subscribeFarms, getFarms, getFarms);
}

export function useCurrentFarmId(): string {
  return useSyncExternalStore(subscribeFarms, getCurrentFarmId, getCurrentFarmId);
}

export function useCurrentFarm(): Farm | undefined {
  return useSyncExternalStore(subscribeFarms, getCurrentFarm, getCurrentFarm);
}

// — Bootstrap ——————————————————————————————————————————————————————————
// S'abonne aux changements de mode auth pour rebasculer mocks <-> Supabase.

let bootstrapped = false;
export function initFarmsBootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  const apply = () => {
    const { mode } = getAuth();
    if (mode === 'authenticated') {
      void hydrateFromSupabase();
    } else {
      resetToMocks();
    }
  };

  apply();
  subscribeAuth(apply);
}
