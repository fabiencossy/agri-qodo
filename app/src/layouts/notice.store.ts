/**
 * Mini-store global de notifications (toasts). useSyncExternalStore.
 * Usage : `notify('Bilan en cours...')` ou `notify('Erreur', 'error')`.
 * Affiché par <NoticeHost /> dans AppLayout.
 */
import { useSyncExternalStore } from 'react';

export type NoticeKind = 'info' | 'success' | 'error';

export interface Notice {
  id: string;
  text: string;
  kind: NoticeKind;
}

let notices: Notice[] = [];
const listeners = new Set<() => void>();

function emit() {
  notices = [...notices];
  listeners.forEach((l) => l());
}

export function notify(text: string, kind: NoticeKind = 'info'): void {
  const id = `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  notices = [...notices, { id, text, kind }];
  emit();
  setTimeout(() => dismiss(id), 4500);
}

export function dismiss(id: string): void {
  notices = notices.filter((n) => n.id !== id);
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  return notices;
}

export function useNotices(): Notice[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
