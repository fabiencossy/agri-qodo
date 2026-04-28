"use client";

import { LayoutGrid, Map as MapIcon, MapPin, Plus, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  formatSurface,
  libelleZone,
  useDeleteParcelle,
  useParcelles,
  useParcellesMap,
} from "@/lib/parcelles";

const ParcellesMapView = dynamic(() => import("@/components/maps/parcelles-map-view"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[500px] items-center justify-center rounded-xl border border-border bg-muted text-sm text-foreground/60">
      Chargement de la carte…
    </div>
  ),
});

type View = "liste" | "carte";

export default function ParcellesPage() {
  const [view, setView] = useState<View>("liste");
  const parcelles = useParcelles();
  const parcellesMap = useParcellesMap();
  const deleteMutation = useDeleteParcelle();

  const onDelete = (id: string, nom: string) => {
    if (confirm(`Supprimer la parcelle « ${nom} » ? Cette action est définitive.`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Parcelles" }]} />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold">Mes parcelles</h1>
            <p className="mt-1 text-foreground/70">
              {parcelles.data
                ? `${parcelles.data.length} parcelle${parcelles.data.length > 1 ? "s" : ""}`
                : "Chargement…"}
            </p>
          </div>
          <Link href="/parcelles/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle parcelle
            </Button>
          </Link>
        </div>

        {parcelles.data && parcelles.data.length > 0 && (
          <div className="mb-6 inline-flex rounded-lg border border-border bg-background p-1">
            <button
              type="button"
              onClick={() => setView("liste")}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                view === "liste" ? "bg-green text-white" : "text-foreground/70 hover:bg-muted"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Liste
            </button>
            <button
              type="button"
              onClick={() => setView("carte")}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                view === "carte" ? "bg-green text-white" : "text-foreground/70 hover:bg-muted"
              }`}
            >
              <MapIcon className="h-4 w-4" />
              Carte
            </button>
          </div>
        )}

        {view === "carte" && parcellesMap.data && (
          <>
            <ParcellesMapView parcelles={parcellesMap.data} />
            {parcellesMap.data.every((p) => p.geom === null) && (
              <p className="mt-3 text-center text-sm text-foreground/60">
                Aucune parcelle n'a de tracé géographique. Crée une nouvelle parcelle avec le mode «
                Dessiner sur la carte ».
              </p>
            )}
          </>
        )}

        {parcelles.isError && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Impossible de charger les parcelles. Vérifie ta connexion.
          </div>
        )}

        {parcelles.data && parcelles.data.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
            <MapPin className="mx-auto h-10 w-10 text-foreground/30" />
            <h2 className="mt-4 text-lg font-semibold">Aucune parcelle pour l'instant</h2>
            <p className="mt-1 text-sm text-foreground/60">
              Commencez par créer votre première parcelle.
            </p>
            <Link href="/parcelles/new" className="mt-6 inline-block">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Créer ma première parcelle
              </Button>
            </Link>
          </div>
        )}

        {view === "liste" && parcelles.data && parcelles.data.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {parcelles.data.map((p) => (
              <article
                key={p.id}
                className="rounded-2xl border border-border bg-background p-5 transition-colors hover:border-green"
              >
                <header className="mb-3 flex items-start justify-between">
                  <h2 className="text-lg font-semibold">{p.nom}</h2>
                  <button
                    onClick={() => onDelete(p.id, p.nom)}
                    disabled={deleteMutation.isPending}
                    className="rounded-md p-1.5 text-foreground/50 hover:bg-red-50 hover:text-red-600"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </header>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-foreground/60">Surface</dt>
                    <dd className="font-medium">{formatSurface(p.surfaceM2)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-foreground/60">Zone</dt>
                    <dd>{libelleZone(p.zone)}</dd>
                  </div>
                  {p.identifiantCadastral && (
                    <div className="flex justify-between">
                      <dt className="text-foreground/60">N° cadastral</dt>
                      <dd className="font-mono text-xs">{p.identifiantCadastral}</dd>
                    </div>
                  )}
                </dl>
                {p.notes && <p className="mt-3 text-xs text-foreground/60">{p.notes}</p>}
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
