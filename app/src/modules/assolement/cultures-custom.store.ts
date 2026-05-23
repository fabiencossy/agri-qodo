import { useSyncExternalStore } from 'react';
import type { CultureCategory, CultureInfo } from './cultures';

/**
 * Overlay des cultures ajoutées manuellement par l'utilisateur. Persisté en
 * localStorage. Les helpers de `cultures.ts` lisent à la fois `CULTURES`
 * (catalogue Agridéa figé) et cet overlay pour fusionner les deux.
 */

const STORAGE_KEY = 'agri.cultures-custom.v1';

function loadFromStorage(): CultureInfo[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is CultureInfo =>
        c &&
        typeof c.key === 'string' &&
        typeof c.label === 'string' &&
        typeof c.color === 'string' &&
        typeof c.category === 'string',
    );
  } catch {
    return [];
  }
}

let custom: CultureInfo[] = loadFromStorage();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function persist() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
  } catch {
    // quota / mode privé
  }
}

export function getCustomCultures(): ReadonlyArray<CultureInfo> {
  return custom;
}

export function addCustomCulture(c: {
  key?: string;
  label: string;
  color: string;
  category: CultureCategory;
}): CultureInfo {
  const key =
    c.key?.trim() ||
    c.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  const created: CultureInfo = { key, label: c.label.trim(), color: c.color, category: c.category };
  custom = [...custom, created];
  persist();
  notify();
  return created;
}

export function updateCustomCulture(key: string, patch: Partial<CultureInfo>): void {
  custom = custom.map((c) => (c.key === key ? { ...c, ...patch } : c));
  persist();
  notify();
}

export function removeCustomCulture(key: string): void {
  custom = custom.filter((c) => c.key !== key);
  persist();
  notify();
}

export function useCustomCultures(): ReadonlyArray<CultureInfo> {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => custom,
    () => custom,
  );
}
