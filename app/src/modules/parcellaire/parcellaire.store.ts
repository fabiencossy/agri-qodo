import { useMemo, useSyncExternalStore } from 'react';
import type { Polygon, MultiPolygon } from 'geojson';
import { supabase } from '../../lib/supabase';
import { onAuthFarmChange } from '../../lib/auth-farm';
import { getAuth } from '../auth/auth.store';
import { getCurrentFarmId, useCurrentFarmId } from '../farms/farms.store';
import { cultureColor, cultureKeyByLabel, cultureLabelByKey } from '../assolement/cultures';
import { PARCELLES as MOCK_PARCELS, type ParcelDetail } from './parcellaire.mocks';

export type { ParcelDetail };

/**
 * Store parcelles — pattern dual-mode.
 *
 * Géométrie stockée en GeoJSON Polygon/MultiPolygon dans le champ jsonb
 * `geometry` (lng/lat WGS84). Pas de PostGIS pour le MVP — on calcule
 * la surface et les intersections côté client. Si ça devient un
 * bottleneck (ex: 1000+ parcelles avec recherches spatiales), on
 * migrera vers postgis avec un type geography(Polygon,4326).
 */

let parcels: ReadonlyArray<ParcelDetail> = [...MOCK_PARCELS];
let loading = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

// — Mapping DB row <-> ParcelDetail ————————————————————————————————————

interface DbParcelRow {
  id: string;
  farm_id: string;
  code: string | null;
  name: string;
  surface_ha: number;
  geometry: Polygon | MultiPolygon | null;
  centroid: { lat: number; lng: number } | null;
  culture_key: string | null;
  status: 'active' | 'archived' | 'planned';
  notes: string | null;
  imported_from: string | null;
  external_id: string | null;
  metadata: Record<string, unknown>;
}

function rowToParcel(row: DbParcelRow): ParcelDetail {
  const meta = row.metadata ?? {};
  const cultureLabel = cultureLabelByKey(row.culture_key ?? undefined) ?? undefined;
  return {
    id: row.id,
    name: row.name,
    surfaceHa: row.surface_ha,
    culture: cultureLabel,
    color: cultureColor(cultureLabel),
    status: row.status === 'planned' ? 'fallow' : row.status,
    geometry: (row.geometry ?? { type: 'Polygon', coordinates: [[]] }) as Polygon | MultiPolygon,
    varietyName: (meta.varietyName as string) ?? undefined,
    sowingDate: (meta.sowingDate as string) ?? undefined,
    notes: row.notes ?? undefined,
    year: (meta.year as number) ?? new Date().getFullYear(),
  };
}

interface DbParcelInsert {
  farm_id: string;
  code: string | null;
  name: string;
  surface_ha: number;
  geometry: Polygon | MultiPolygon;
  culture_key: string | null;
  status: 'active' | 'archived' | 'planned';
  notes: string | null;
  imported_from: string;
  metadata: Record<string, unknown>;
}

function parcelToInsert(p: ParcelDetail, farmId: string): DbParcelInsert {
  return {
    farm_id: farmId,
    code: null,
    name: p.name,
    surface_ha: p.surfaceHa,
    geometry: p.geometry,
    culture_key: cultureKeyByLabel(p.culture) ?? null,
    status: p.status === 'fallow' ? 'planned' : (p.status ?? 'active'),
    notes: p.notes ?? null,
    imported_from: 'app',
    metadata: {
      varietyName: p.varietyName,
      sowingDate: p.sowingDate,
      year: p.year,
    },
  };
}

// — Hydratation ————————————————————————————————————————————————————————

async function hydrateFromSupabase(farmId: string): Promise<void> {
  if (!supabase) return;
  loading = true;
  emit();
  try {
    const { data, error } = await supabase
      .from('parcels')
      .select('*')
      .eq('farm_id', farmId)
      .order('name');
    if (error) {
      console.error('[parcels] hydrate failed:', error.message);
      parcels = [];
    } else {
      parcels = (data as DbParcelRow[]).map(rowToParcel);
    }
  } finally {
    loading = false;
    emit();
  }
}

function resetToMocks(): void {
  parcels = [...MOCK_PARCELS];
  emit();
}

// — API publique ———————————————————————————————————————————————————————

export function getParcels(): ReadonlyArray<ParcelDetail> {
  return parcels;
}

export function isParcelsLoading(): boolean {
  return loading;
}

export function subscribeParcels(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function addParcels(additions: ReadonlyArray<ParcelDetail>): Promise<void> {
  if (additions.length === 0) return;
  // Auto-tag avec la farm courante si l'appelant n'a pas fourni de farmId.
  // Évite les parcelles orphelines qui apparaîtraient sur toutes les farms.
  const currentFarmId = getCurrentFarmId();
  const tagged = additions.map((p) => (p.farmId ? p : { ...p, farmId: currentFarmId }));
  if (getAuth().mode !== 'authenticated' || !supabase) {
    parcels = [...parcels, ...tagged];
    emit();
    return;
  }
  const farmId = currentFarmId;
  if (!farmId) return;
  const rows = tagged.map((p) => parcelToInsert(p, farmId));
  const { error } = await supabase.from('parcels').insert(rows);
  if (error) {
    console.error('[parcels] insert failed:', error.message);
    return;
  }
  await hydrateFromSupabase(farmId);
}

export async function updateParcel(id: string, patch: Partial<ParcelDetail>): Promise<void> {
  if (getAuth().mode !== 'authenticated' || !supabase) {
    parcels = parcels.map((p) => (p.id === id ? { ...p, ...patch } : p));
    emit();
    return;
  }
  const current = parcels.find((p) => p.id === id);
  if (!current) return;
  const merged = { ...current, ...patch };
  const farmId = getCurrentFarmId();
  const upd = parcelToInsert(merged, farmId);
  const { error } = await supabase
    .from('parcels')
    .update({
      name: upd.name,
      surface_ha: upd.surface_ha,
      geometry: upd.geometry,
      culture_key: upd.culture_key,
      status: upd.status,
      notes: upd.notes,
      metadata: upd.metadata,
    })
    .eq('id', id);
  if (error) {
    console.error('[parcels] update failed:', error.message);
    return;
  }
  await hydrateFromSupabase(farmId);
}

export async function removeParcel(id: string): Promise<void> {
  if (getAuth().mode !== 'authenticated' || !supabase) {
    parcels = parcels.filter((p) => p.id !== id);
    emit();
    return;
  }
  const farmId = getCurrentFarmId();
  const { error } = await supabase.from('parcels').delete().eq('id', id);
  if (error) {
    console.error('[parcels] delete failed:', error.message);
    return;
  }
  await hydrateFromSupabase(farmId);
}

/**
 * Retourne les parcelles de l'exploitation active. Filtrage STRICT par
 * `farmId` : on ne mélange jamais les parcelles d'un client avec celles d'une
 * autre exploitation. Les parcelles sans `farmId` (legacy import) sont
 * ignorées sous une farm spécifique pour éviter ce mélange.
 *
 * Mémoïsation impérative : `.filter()` crée un nouveau tableau à chaque
 * render, ce qui faisait boucler les useEffect de MapView dépendant de
 * `parcels` (boucle infinie => UI gelée). useMemo stabilise la référence
 * tant que all/farmId ne changent pas.
 */
export function useParcels(): ReadonlyArray<ParcelDetail> {
  const all = useSyncExternalStore(subscribeParcels, getParcels, getParcels);
  const farmId = useCurrentFarmId();
  return useMemo(() => all.filter((p) => p.farmId === farmId), [all, farmId]);
}

/** Variante : toutes les parcelles toutes farms confondues (rare — pour exports). */
export function useAllParcels(): ReadonlyArray<ParcelDetail> {
  return useSyncExternalStore(subscribeParcels, getParcels, getParcels);
}

// — Bootstrap ——————————————————————————————————————————————————————————

let bootstrapped = false;
export function initParcelsBootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  onAuthFarmChange((ctx) => {
    if (ctx.isRealFarm) {
      void hydrateFromSupabase(ctx.farmId);
    } else {
      resetToMocks();
    }
  });
}
