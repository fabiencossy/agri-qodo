import { useSyncExternalStore } from 'react';
import { LIVESTOCK_MOCK_ENTRIES } from './livestock.mocks';
import type { LivestockEntry } from './livestock.types';

/**
 * Store cheptel — purement local (mocks Darval, mutations en mémoire).
 *
 * Phase 3 : remplacement par fetch BDTA (Banque de données du trafic des
 * animaux) + sync Odoo si module animal en place.
 */

const STORAGE_KEY = 'newagriqodo-livestock-entries';

let entries: ReadonlyArray<LivestockEntry> = load();
const listeners = new Set<() => void>();

function load(): LivestockEntry[] {
  if (typeof window === 'undefined') return [...LIVESTOCK_MOCK_ENTRIES];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...LIVESTOCK_MOCK_ENTRIES];
    const parsed = JSON.parse(raw) as LivestockEntry[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...LIVESTOCK_MOCK_ENTRIES];
  } catch {
    return [...LIVESTOCK_MOCK_ENTRIES];
  }
}

function persist(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

function emit(): void {
  listeners.forEach((l) => l());
}

export function getLivestockEntries(): ReadonlyArray<LivestockEntry> {
  return entries;
}

export function addLivestockEntry(entry: LivestockEntry): void {
  entries = [...entries, entry];
  persist();
  emit();
}

export function updateLivestockEntry(id: string, patch: Partial<LivestockEntry>): void {
  entries = entries.map((e) =>
    e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString().slice(0, 10) } : e,
  );
  persist();
  emit();
}

export function removeLivestockEntry(id: string): void {
  entries = entries.filter((e) => e.id !== id);
  persist();
  emit();
}

export function resetLivestockToMocks(): void {
  entries = [...LIVESTOCK_MOCK_ENTRIES];
  persist();
  emit();
}

export function subscribeLivestock(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLivestockEntries(): ReadonlyArray<LivestockEntry> {
  return useSyncExternalStore(subscribeLivestock, getLivestockEntries, getLivestockEntries);
}
