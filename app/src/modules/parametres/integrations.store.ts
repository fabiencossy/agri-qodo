import { useSyncExternalStore } from 'react';

/**
 * Paramètres d'intégrations externes — local uniquement pour le MVP.
 *
 * Toute la connexion réelle (XML-RPC Odoo, API REST MétéoSuisse) sera branchée
 * en Phase 3 côté serveur. Ici on stocke uniquement les credentials de
 * configuration et l'état des dernières tentatives de synchronisation.
 */

export type SyncStatus = 'never' | 'success' | 'error' | 'in-progress';

export interface SyncEntityStatus {
  /** Date ISO de la dernière synchronisation tentée. */
  lastSyncAt?: string;
  /** Statut de la dernière tentative. */
  status: SyncStatus;
  /** Message éventuel (erreur, nb lignes synchro, etc.). */
  message?: string;
  /** Nombre d'enregistrements synchronisés à la dernière tentative. */
  recordsCount?: number;
}

export interface OdooSettings {
  enabled: boolean;
  /** URL du serveur (ex. https://odoo.exploitation.ch). */
  url: string;
  /** Nom de la base Odoo. */
  database: string;
  /** Login utilisateur (souvent un email). */
  login: string;
  /** Clé API Odoo (jamais le mot de passe utilisateur). */
  apiKey: string;
  /** Synchronisation automatique périodique. */
  autoSync: boolean;
  /** Intervalle en minutes pour autoSync. */
  syncIntervalMinutes: number;
  /** Statut par entité synchronisée. */
  entities: {
    employees: SyncEntityStatus;
    partners: SyncEntityStatus;
    products: SyncEntityStatus;
    parcels: SyncEntityStatus;
    attendance: SyncEntityStatus;
    workOrders: SyncEntityStatus;
  };
}

export interface MeteoSettings {
  enabled: boolean;
  /** Identifiant de station MétéoSuisse la plus proche (ex. WYN, PUY). */
  stationId: string;
  /** Coordonnées GPS de l'exploitation (fallback si pas de station). */
  latitude?: number;
  longitude?: number;
  /** Auto-remplir la météo lors de la création d'intervention. */
  autoFillIntervention: boolean;
  /** Alerter si une fenêtre d'épandage approche une pluie >5mm. */
  alertOnRainBeforeSpread: boolean;
  /** Dernière synchronisation. */
  lastSync: SyncEntityStatus;
}

export interface IntegrationsState {
  odoo: OdooSettings;
  meteo: MeteoSettings;
}

const DEFAULTS: IntegrationsState = {
  odoo: {
    enabled: false,
    url: '',
    database: '',
    login: '',
    apiKey: '',
    autoSync: false,
    syncIntervalMinutes: 60,
    entities: {
      employees: { status: 'never' },
      partners: { status: 'never' },
      products: { status: 'never' },
      parcels: { status: 'never' },
      attendance: { status: 'never' },
      workOrders: { status: 'never' },
    },
  },
  meteo: {
    enabled: false,
    stationId: 'PUY',
    autoFillIntervention: false,
    alertOnRainBeforeSpread: true,
    lastSync: { status: 'never' },
  },
};

const STORAGE_KEY = 'newagriqodo-integrations';

function load(): IntegrationsState {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<IntegrationsState>;
    return {
      odoo: { ...DEFAULTS.odoo, ...parsed.odoo },
      meteo: { ...DEFAULTS.meteo, ...parsed.meteo },
    };
  } catch {
    return DEFAULTS;
  }
}

let state: IntegrationsState = load();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function persist(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function getIntegrations(): IntegrationsState {
  return state;
}

export function updateOdooSettings(patch: Partial<OdooSettings>): void {
  state = { ...state, odoo: { ...state.odoo, ...patch } };
  persist();
  emit();
}

export function updateMeteoSettings(patch: Partial<MeteoSettings>): void {
  state = { ...state, meteo: { ...state.meteo, ...patch } };
  persist();
  emit();
}

/** Marque une entité Odoo comme en cours / réussie / en erreur (simulation MVP). */
export function setOdooEntityStatus(
  entity: keyof OdooSettings['entities'],
  status: SyncEntityStatus,
): void {
  state = {
    ...state,
    odoo: {
      ...state.odoo,
      entities: { ...state.odoo.entities, [entity]: status },
    },
  };
  persist();
  emit();
}

export function subscribeIntegrations(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useIntegrations(): IntegrationsState {
  return useSyncExternalStore(subscribeIntegrations, getIntegrations, getIntegrations);
}
