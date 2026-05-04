"use client";

import { Download, FileUp, LayoutGrid, Map as MapIcon, MapPin, Plus, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/export-csv";
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

const VIEW_STORAGE_KEY = "agriqodo:parcelles:view";

export default function ParcellesPage() {
  /**
   * Default = carte (visuel agriculteur). Persistance localStorage —
   * lecture en effect côté client pour ne pas casser le rendu SSR.
   */
  const [view, setView] = useState<View>("carte");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "liste" || saved === "carte") setView(saved);
    } catch {
      // localStorage indisponible — on garde le défaut
    }
  }, []);
  const setViewPersisted = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {
      // ignore
    }
  };
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
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Parcelles" }]} />
      <div className="mx-auto max-w-5xl px-2 py-4 sm:px-4 sm:py-8">
        <PageHeader
          title="Mes parcelles"
          icon={MapPin}
          subtitle={
            parcelles.data
              ? `${parcelles.data.length} parcelle${parcelles.data.length > 1 ? "s" : ""}`
              : "Chargement…"
          }
          rightSlot={
            parcelles.data && parcelles.data.length > 0 ? (
              <div className="inline-flex rounded-lg border border-border bg-background p-1">
                <button
                  type="button"
                  onClick={() => setViewPersisted("liste")}
                  aria-label="Vue liste"
                  className={`flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors sm:px-3 ${
                    view === "liste" ? "bg-green text-white" : "text-foreground/70 hover:bg-muted"
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden sm:inline">Liste</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewPersisted("carte")}
                  aria-label="Vue carte"
                  className={`flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors sm:px-3 ${
                    view === "carte" ? "bg-green text-white" : "text-foreground/70 hover:bg-muted"
                  }`}
                >
                  <MapIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Carte</span>
                </button>
              </div>
            ) : null
          }
          menuActions={[
            {
              label: "Importer un fichier",
              icon: FileUp,
              href: "/parcelles/import",
            },
            {
              label: "Exporter en CSV",
              icon: Download,
              disabled: !parcelles.data || parcelles.data.length === 0,
              onClick: () => {
                if (!parcelles.data) return;
                downloadCsv("parcelles", parcelles.data, [
                  { header: "Nom", value: (p) => p.nom },
                  { header: "Surface (m²)", value: (p) => p.surfaceM2 },
                  {
                    header: "Surface (ha)",
                    value: (p) => (Number(p.surfaceM2) / 10000).toFixed(2),
                  },
                  { header: "Zone", value: (p) => libelleZone(p.zone) },
                  { header: "Identifiant cadastral", value: (p) => p.identifiantCadastral ?? "" },
                  { header: "Notes", value: (p) => p.notes ?? "" },
                ]);
              },
            },
          ]}
        />

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
              Importez vos parcelles depuis votre portail cantonal en un clic, ou commencez par en
              créer une.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/parcelles/import">
                <Button>
                  <FileUp className="mr-2 h-4 w-4" />
                  Importer un fichier
                </Button>
              </Link>
              <Link href="/parcelles/new">
                <Button variant="secondary">
                  <Plus className="mr-2 h-4 w-4" />
                  Créer manuellement
                </Button>
              </Link>
            </div>
          </div>
        )}

        {view === "liste" && parcelles.data && parcelles.data.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {parcelles.data.map((p) => (
              <Link
                key={p.id}
                href={`/parcelles/${p.id}` as never}
                className="group relative block rounded-2xl border border-border bg-background p-5 transition-all hover:border-green hover:shadow-md active:scale-[0.99]"
              >
                <header className="mb-3 flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold group-hover:text-green">{p.nom}</h2>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDelete(p.id, p.nom);
                    }}
                    disabled={deleteMutation.isPending}
                    className="relative z-10 -mr-1 -mt-1 flex-shrink-0 rounded-md p-1.5 text-foreground/40 hover:bg-red-50 hover:text-red-600"
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
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
