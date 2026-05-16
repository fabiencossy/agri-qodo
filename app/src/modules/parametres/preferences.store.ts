import { useSyncExternalStore } from 'react';

/**
 * Préférences globales de l'app (locales, par navigateur).
 *
 * Aucune persistance serveur pour le MVP — uniquement localStorage.
 * Phase 3 : synchronisation avec le profil utilisateur Odoo.
 */

export type Language = 'fr' | 'de' | 'it' | 'en';
export type Currency = 'CHF' | 'EUR';
export type DateFormat = 'dd.MM.yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd';
export type SurfaceUnit = 'ha' | 'a' | 'm2';
export type UnitSystem = 'metric' | 'imperial';

export interface AppPreferences {
  language: Language;
  currency: Currency;
  dateFormat: DateFormat;
  surfaceUnit: SurfaceUnit;
  unitSystem: UnitSystem;
  firstDayOfWeek: 0 | 1;
  notifyOnBalanceOver: boolean;
  notifyOnWithholdingViolation: boolean;
  notifyOnLowDosage: boolean;
}

const DEFAULTS: AppPreferences = {
  language: 'fr',
  currency: 'CHF',
  dateFormat: 'dd.MM.yyyy',
  surfaceUnit: 'ha',
  unitSystem: 'metric',
  firstDayOfWeek: 1,
  notifyOnBalanceOver: true,
  notifyOnWithholdingViolation: true,
  notifyOnLowDosage: false,
};

const STORAGE_KEY = 'newagriqodo-preferences';

function load(): AppPreferences {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

let prefs: AppPreferences = load();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function persist(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore (quota / no localStorage)
  }
}

export function getPreferences(): AppPreferences {
  return prefs;
}

export function updatePreferences(patch: Partial<AppPreferences>): void {
  prefs = { ...prefs, ...patch };
  persist();
  emit();
}

export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePreferences(): AppPreferences {
  return useSyncExternalStore(subscribePreferences, getPreferences, getPreferences);
}
