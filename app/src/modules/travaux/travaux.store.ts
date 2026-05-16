import { useSyncExternalStore } from 'react';
import { CLIENTS_MOCK, WORK_ORDERS_MOCK } from './travaux.mocks';
import type { ThirdPartyClient, WorkOrder } from './travaux.types';

/**
 * Stores travaux pour tiers — purement local (localStorage + mocks Darval).
 *
 * Phase 3 : sync Odoo `sale.order` (bon de travail), `account.move` (facture),
 * `res.partner` (client). Pour l'instant : tout en mémoire / navigateur.
 */

// ─── Bons de travaux ───────────────────────────────────────────────────────
const WO_KEY = 'newagriqodo-work-orders';
let workOrders: ReadonlyArray<WorkOrder> = loadWO();
const woListeners = new Set<() => void>();

function loadWO(): WorkOrder[] {
  if (typeof window === 'undefined') return [...WORK_ORDERS_MOCK];
  try {
    const raw = localStorage.getItem(WO_KEY);
    if (!raw) return [...WORK_ORDERS_MOCK];
    const parsed = JSON.parse(raw) as WorkOrder[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...WORK_ORDERS_MOCK];
  } catch {
    return [...WORK_ORDERS_MOCK];
  }
}

function persistWO(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WO_KEY, JSON.stringify(workOrders));
  } catch {
    // ignore
  }
}

function emitWO(): void {
  woListeners.forEach((l) => l());
}

export function getWorkOrders(): ReadonlyArray<WorkOrder> {
  return workOrders;
}

export function addWorkOrder(wo: WorkOrder): void {
  workOrders = [...workOrders, wo];
  persistWO();
  emitWO();
}

export function updateWorkOrder(id: string, patch: Partial<WorkOrder>): void {
  workOrders = workOrders.map((w) => (w.id === id ? { ...w, ...patch } : w));
  persistWO();
  emitWO();
}

export function removeWorkOrder(id: string): void {
  workOrders = workOrders.filter((w) => w.id !== id);
  persistWO();
  emitWO();
}

export function subscribeWorkOrders(listener: () => void): () => void {
  woListeners.add(listener);
  return () => {
    woListeners.delete(listener);
  };
}

export function useWorkOrders(): ReadonlyArray<WorkOrder> {
  return useSyncExternalStore(subscribeWorkOrders, getWorkOrders, getWorkOrders);
}

// ─── Clients tiers ─────────────────────────────────────────────────────────
const C_KEY = 'newagriqodo-third-party-clients';
let clients: ReadonlyArray<ThirdPartyClient> = loadClients();
const clientListeners = new Set<() => void>();

function loadClients(): ThirdPartyClient[] {
  if (typeof window === 'undefined') return [...CLIENTS_MOCK];
  try {
    const raw = localStorage.getItem(C_KEY);
    if (!raw) return [...CLIENTS_MOCK];
    const parsed = JSON.parse(raw) as ThirdPartyClient[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...CLIENTS_MOCK];
  } catch {
    return [...CLIENTS_MOCK];
  }
}

function persistClients(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(C_KEY, JSON.stringify(clients));
  } catch {
    // ignore
  }
}

function emitClients(): void {
  clientListeners.forEach((l) => l());
}

export function getClients(): ReadonlyArray<ThirdPartyClient> {
  return clients;
}

export function getClientById(id: string | undefined): ThirdPartyClient | undefined {
  if (!id) return undefined;
  return clients.find((c) => c.id === id);
}

export function addClient(client: ThirdPartyClient): void {
  clients = [...clients, client];
  persistClients();
  emitClients();
}

export function updateClient(id: string, patch: Partial<ThirdPartyClient>): void {
  clients = clients.map((c) => (c.id === id ? { ...c, ...patch } : c));
  persistClients();
  emitClients();
}

export function removeClient(id: string): void {
  clients = clients.filter((c) => c.id !== id);
  persistClients();
  emitClients();
}

export function subscribeClients(listener: () => void): () => void {
  clientListeners.add(listener);
  return () => {
    clientListeners.delete(listener);
  };
}

export function useClients(): ReadonlyArray<ThirdPartyClient> {
  return useSyncExternalStore(subscribeClients, getClients, getClients);
}
