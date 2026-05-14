"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getApiBaseUrl } from "./api-client";
import { getStoredTokens } from "./auth-storage";
import { getActiveTenantId } from "./active-tenant";

export interface Photo {
  id: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
  createdAt: string;
  odooAttachmentId: number | null;
}

interface UploadInput {
  file: File;
  interventionId?: string;
  travailId?: string;
}

/**
 * Hook : fetch le binaire d'une photo via Bearer token et expose un
 * blob URL utilisable dans `<img src={...}>`. Révoque le blob URL au
 * démontage pour éviter les fuites mémoire.
 */
export function usePhotoBlobUrl(photoId: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let blobUrl: string | null = null;
    (async () => {
      const tokens = getStoredTokens();
      const headers: Record<string, string> = {};
      if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
      const tenantId = getActiveTenantId();
      if (tenantId) headers["X-Active-Tenant-Id"] = tenantId;
      const res = await fetch(`${getApiBaseUrl()}/api/photos/${photoId}/binary`, {
        headers,
      });
      if (!res.ok) return;
      const blob = await res.blob();
      if (!alive) return;
      blobUrl = URL.createObjectURL(blob);
      setUrl(blobUrl);
    })();
    return () => {
      alive = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [photoId]);
  return url;
}

export function usePhotos(params: { interventionId?: string; travailId?: string }) {
  const key = params.interventionId
    ? (["photos", "intervention", params.interventionId] as const)
    : params.travailId
      ? (["photos", "travail", params.travailId] as const)
      : (["photos", "none"] as const);
  return useQuery({
    queryKey: key,
    enabled: !!(params.interventionId || params.travailId),
    queryFn: () => {
      const search = new URLSearchParams();
      if (params.interventionId) search.set("interventionId", params.interventionId);
      if (params.travailId) search.set("travailId", params.travailId);
      return api<Photo[]>(`/api/photos?${search.toString()}`);
    },
  });
}

export function useUploadPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadInput) => {
      const form = new FormData();
      form.append("file", input.file);
      const search = new URLSearchParams();
      if (input.interventionId) search.set("interventionId", input.interventionId);
      if (input.travailId) search.set("travailId", input.travailId);
      return api<{
        id: string;
        odooAttachmentId: number | null;
        mimeType: string;
        sizeBytes: number;
      }>(`/api/photos/upload?${search.toString()}`, {
        method: "POST",
        body: form,
      });
    },
    onSuccess: (_, input) => {
      if (input.interventionId) {
        void qc.invalidateQueries({
          queryKey: ["photos", "intervention", input.interventionId],
        });
      }
      if (input.travailId) {
        void qc.invalidateQueries({ queryKey: ["photos", "travail", input.travailId] });
      }
    },
  });
}

export function useDeletePhoto(params: { interventionId?: string; travailId?: string }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => api<void>(`/api/photos/${photoId}`, { method: "DELETE" }),
    onSuccess: () => {
      if (params.interventionId) {
        void qc.invalidateQueries({
          queryKey: ["photos", "intervention", params.interventionId],
        });
      }
      if (params.travailId) {
        void qc.invalidateQueries({ queryKey: ["photos", "travail", params.travailId] });
      }
    },
  });
}
