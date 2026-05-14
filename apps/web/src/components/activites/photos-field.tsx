"use client";

import { Camera, ImageOff, Loader2, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import {
  type Photo,
  useDeletePhoto,
  usePhotoBlobUrl,
  usePhotos,
  useUploadPhoto,
} from "@/lib/photos";

/**
 * Champ "Photos" affiché en bas des formulaires Carnet et Travaux.
 *
 * Disponible uniquement en mode édition (besoin de l'ID parent pour
 * attacher la photo). Pour la création, on suggère de sauvegarder
 * d'abord puis d'ajouter les photos.
 *
 * Push immédiat en ir.attachment Odoo côté backend ; la liste est
 * synchronisée via react-query.
 */
export function PhotosField({
  parent,
}: {
  parent: { kind: "intervention"; id: string } | { kind: "travail"; id: string } | { kind: "none" };
}) {
  const linkParams =
    parent.kind === "intervention"
      ? { interventionId: parent.id }
      : parent.kind === "travail"
        ? { travailId: parent.id }
        : {};
  const photos = usePhotos(linkParams);
  const upload = useUploadPhoto();
  const remove = useDeletePhoto(linkParams);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Photo | null>(null);

  if (parent.kind === "none") {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-muted/20 p-4 text-center text-sm text-foreground/60">
        <Camera className="mx-auto mb-2 h-6 w-6" />
        Sauvegarde d'abord pour pouvoir ajouter des photos.
      </div>
    );
  }

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    setError(null);
    const errs: string[] = [];
    for (const file of Array.from(fileList)) {
      try {
        await upload.mutateAsync({ file, ...linkParams });
      } catch (e) {
        errs.push(`${file.name} : ${e instanceof Error ? e.message : "échec"}`);
      }
    }
    if (errs.length > 0) setError(errs.join(" · "));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm("Supprimer cette photo ?")) return;
    try {
      await remove.mutateAsync(photoId);
      if (preview?.id === photoId) setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression échouée");
    }
  };

  const list = photos.data ?? [];

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {list.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {list.map((p) => (
            <PhotoThumb
              key={p.id}
              photo={p}
              onClick={() => setPreview(p)}
              onDelete={() => void handleDelete(p.id)}
            />
          ))}
        </div>
      )}
      {/* Bouton "+ Ajouter" pleine largeur (Fabien 2026-05-14, image 31). */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={upload.isPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 px-4 py-4 text-sm font-medium text-foreground/60 transition-colors hover:border-green hover:bg-green/5 hover:text-green disabled:cursor-not-allowed disabled:opacity-60"
      >
        {upload.isPending ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Upload en cours…
          </>
        ) : (
          <>
            <Plus className="h-5 w-5" />
            Ajouter une photo
          </>
        )}
      </button>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      {preview && <PhotoPreviewModal photo={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function PhotoThumb({
  photo,
  onClick,
  onDelete,
}: {
  photo: Photo;
  onClick: () => void;
  onDelete: () => void;
}) {
  const blob = usePhotoBlobUrl(photo.id);
  const notPushed = photo.odooAttachmentId == null;
  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted/20">
      {blob ? (
        <img
          src={blob}
          alt={photo.originalName}
          className="h-full w-full cursor-zoom-in object-cover transition-transform group-hover:scale-105"
          onClick={onClick}
        />
      ) : notPushed ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-foreground/40">
          <ImageOff className="h-6 w-6" />
          <span className="px-1 text-center text-[10px]">Pas encore poussé sur Odoo</span>
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-foreground/40" />
        </div>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Supprimer cette photo"
        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white opacity-0 shadow transition-opacity hover:bg-red-700 group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function PhotoPreviewModal({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const blob = usePhotoBlobUrl(photo.id);
  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      {blob ? (
        <img
          src={blob}
          alt={photo.originalName}
          className="max-h-full max-w-full rounded-lg object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      )}
    </div>
  );
}
