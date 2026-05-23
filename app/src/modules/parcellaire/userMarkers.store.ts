import { useSyncExternalStore } from 'react';

export type UserMarkerKind = 'observation' | 'danger' | 'note';

export interface UserMarker {
  id: string;
  kind: UserMarkerKind;
  lng: number;
  lat: number;
  label?: string;
  notes?: string;
  parcelId?: string;
  createdAt: string;
}

export const USER_MARKER_KIND_LABELS: Record<UserMarkerKind, string> = {
  observation: 'Observation',
  danger: 'Danger',
  note: 'Note',
};

export const USER_MARKER_KIND_COLORS: Record<UserMarkerKind, string> = {
  observation: '#f59e0b',
  danger: '#dc2626',
  note: '#3b82f6',
};

const STORAGE_KEY = 'agri.user-markers.v1';

function loadFromStorage(): ReadonlyArray<UserMarker> {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is UserMarker =>
        m && typeof m.id === 'string' && typeof m.lng === 'number' && typeof m.lat === 'number',
    );
  } catch {
    return [];
  }
}

let markers: ReadonlyArray<UserMarker> = loadFromStorage();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function persist() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(markers));
  } catch {
    // ignore (quota / private mode)
  }
}

export function getUserMarkers(): ReadonlyArray<UserMarker> {
  return markers;
}

export function addUserMarker(
  partial: Omit<UserMarker, 'id' | 'createdAt'> & Partial<Pick<UserMarker, 'id' | 'createdAt'>>,
): UserMarker {
  const m: UserMarker = {
    id: partial.id ?? `um-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: partial.createdAt ?? new Date().toISOString(),
    kind: partial.kind,
    lng: partial.lng,
    lat: partial.lat,
    label: partial.label,
    notes: partial.notes,
    parcelId: partial.parcelId,
  };
  markers = [...markers, m];
  persist();
  notify();
  return m;
}

export function updateUserMarker(id: string, patch: Partial<Omit<UserMarker, 'id'>>): void {
  markers = markers.map((m) => (m.id === id ? { ...m, ...patch } : m));
  persist();
  notify();
}

export function removeUserMarker(id: string): void {
  markers = markers.filter((m) => m.id !== id);
  persist();
  notify();
}

export function useUserMarkers(): ReadonlyArray<UserMarker> {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => markers,
    () => markers,
  );
}
