/**
 * Types pour le module photos.
 *
 * Une photo est attachée à UNE entité (balise, parcelle, bon de travail, intervention).
 * Le stockage :
 *  - thumb base64 (~5-15 KB) en localStorage avec metadata → render instant sans IDB
 *  - blob full size (~80-200 KB WebP) en IndexedDB par photoId → chargé à la demande au clic
 *  - éventuellement URL Supabase Storage si configuré + authentifié
 */

export type PhotoEntityType = 'marker' | 'parcel' | 'workOrder' | 'intervention';

export interface PhotoMeta {
  /** UUID v4 généré côté client */
  id: string;
  /** Type d'entité parente */
  entityType: PhotoEntityType;
  /** ID de l'entité parente */
  entityId: string;
  /** Légende optionnelle */
  caption?: string;
  /** Timestamp ISO de création (upload) */
  createdAt: string;
  /** Timestamp ISO de prise de vue (EXIF si dispo, sinon = createdAt) */
  takenAt?: string;
  /** GPS de prise de vue (EXIF si dispo) */
  lat?: number;
  lng?: number;
  /** Taille originale du fichier (octets, avant compression) */
  originalBytes?: number;
  /** Taille du blob compressé (octets, après WebP) */
  compressedBytes: number;
  /** Dimensions finales (post-compression) */
  width: number;
  height: number;
  /** Thumb base64 data URL (rendu inline immédiat) */
  thumbDataUrl: string;
  /**
   * Si Supabase Storage est utilisé, URL signée ou public de la version full.
   * Sinon le blob est lu via IndexedDB par id.
   */
  storageUrl?: string;
  /** MIME type du blob full (généralement image/webp) */
  mimeType: string;
}
