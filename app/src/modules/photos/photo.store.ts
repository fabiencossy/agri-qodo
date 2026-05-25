/**
 * Store des photos. Pattern useSyncExternalStore.
 *
 * Stockage :
 *  - métadonnées + thumb (data URL) en localStorage (clef "agriqodo.photos")
 *  - blob full size dans IndexedDB (photo-db.ts)
 *  - upload Supabase Storage si configuré + authentifié (Phase 3 bonus)
 *
 * À l'add : compresse → stocke blob IDB → enregistre meta. À la suppression :
 * inverse + cleanup.
 */

import { useSyncExternalStore, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { compressImage } from './photo-compress';
import { deleteBlob, getBlob, putBlob } from './photo-db';
import type { PhotoEntityType, PhotoMeta } from './photo.types';

const STORAGE_KEY = 'agriqodo.photos';
const BUCKET = 'photos';

function loadFromStorage(): ReadonlyArray<PhotoMeta> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is PhotoMeta =>
        p &&
        typeof p === 'object' &&
        typeof p.id === 'string' &&
        typeof p.entityType === 'string' &&
        typeof p.entityId === 'string' &&
        typeof p.thumbDataUrl === 'string',
    );
  } catch {
    return [];
  }
}

function saveToStorage(arr: ReadonlyArray<PhotoMeta>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (err) {
    console.warn('[photos] localStorage save failed (quota?)', err);
  }
}

let photos: ReadonlyArray<PhotoMeta> = loadFromStorage();
const listeners = new Set<() => void>();

function emit() {
  photos = [...photos];
  listeners.forEach((l) => l());
  saveToStorage(photos);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot(): ReadonlyArray<PhotoMeta> {
  return photos;
}

/** Hook React principal — souscrit à toutes les photos. */
export function useAllPhotos(): ReadonlyArray<PhotoMeta> {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Hook React filtré par entité. */
export function usePhotosFor(
  entityType: PhotoEntityType,
  entityId: string | undefined,
): ReadonlyArray<PhotoMeta> {
  const all = useAllPhotos();
  if (!entityId) return [];
  return all.filter((p) => p.entityType === entityType && p.entityId === entityId);
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `ph-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Ajoute une photo : compresse, stocke blob IDB + meta localStorage,
 * éventuellement upload Supabase Storage.
 */
export async function addPhoto(
  file: File,
  entityType: PhotoEntityType,
  entityId: string,
  options?: { caption?: string },
): Promise<PhotoMeta> {
  const compressed = await compressImage(file);
  const id = uuid();
  const nowIso = new Date().toISOString();

  // Stocke blob full en IDB
  await putBlob(id, compressed.fullBlob);

  // Bonus Supabase Storage si configuré + authentifié
  let storageUrl: string | undefined;
  if (supabase) {
    try {
      const path = `${entityType}/${entityId}/${id}.webp`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, compressed.fullBlob, {
        contentType: 'image/webp',
        upsert: false,
      });
      if (!error) {
        const pub = supabase.storage.from(BUCKET).getPublicUrl(path);
        storageUrl = pub.data.publicUrl;
      }
    } catch {
      // Best-effort : si Supabase échoue, on garde la photo en local
    }
  }

  const meta: PhotoMeta = {
    id,
    entityType,
    entityId,
    caption: options?.caption,
    createdAt: nowIso,
    takenAt: compressed.exifTakenAt ?? nowIso,
    lat: compressed.exifLat,
    lng: compressed.exifLng,
    originalBytes: compressed.originalBytes,
    compressedBytes: compressed.compressedBytes,
    width: compressed.width,
    height: compressed.height,
    thumbDataUrl: compressed.thumbDataUrl,
    storageUrl,
    mimeType: 'image/webp',
  };

  photos = [...photos, meta];
  emit();
  return meta;
}

export async function removePhoto(id: string): Promise<void> {
  const target = photos.find((p) => p.id === id);
  if (!target) return;
  photos = photos.filter((p) => p.id !== id);
  emit();
  // Best-effort cleanup
  try {
    await deleteBlob(id);
  } catch (err) {
    console.warn('[photos] IDB delete failed', err);
  }
  if (supabase && target.storageUrl) {
    try {
      const path = `${target.entityType}/${target.entityId}/${id}.webp`;
      await supabase.storage.from(BUCKET).remove([path]);
    } catch {
      // ignore
    }
  }
}

export async function updatePhotoCaption(id: string, caption: string | undefined): Promise<void> {
  photos = photos.map((p) => (p.id === id ? { ...p, caption: caption?.trim() || undefined } : p));
  emit();
}

/**
 * Hook pour récupérer l'URL "full size" d'une photo. Renvoie storageUrl si dispo,
 * sinon génère une blob URL temporaire depuis IDB.
 */
export function useFullPhotoUrl(photo: PhotoMeta | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photo) {
      setUrl(null);
      return;
    }
    if (photo.storageUrl) {
      setUrl(photo.storageUrl);
      return;
    }
    let cancelled = false;
    let createdObjectUrl: string | null = null;
    getBlob(photo.id)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setUrl(photo.thumbDataUrl); // fallback dernier recours
          return;
        }
        createdObjectUrl = URL.createObjectURL(blob);
        setUrl(createdObjectUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(photo.thumbDataUrl);
      });
    return () => {
      cancelled = true;
      if (createdObjectUrl) URL.revokeObjectURL(createdObjectUrl);
    };
  }, [photo]);

  return url;
}

/** Helper formatage taille fichier. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
