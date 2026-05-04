"use client";

import { Download, FileUp, MapPin, Plus, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  type FilterOption,
  type GroupByOption,
  type ListColumn,
  ResourceView,
} from "@/components/ui/resource-view";
import { downloadCsv } from "@/lib/export-csv";
import {
  formatSurface,
  libelleZone,
  type Parcelle,
  type ZoneAgricole,
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

const ZONE_ORDER: ZoneAgricole[] = ["ZA", "ZP", "ZM1", "ZM2", "ZM3", "ZM4", "ZE"];

export default function ParcellesPage() {
  const parcelles = useParcelles();
  const parcellesMap = useParcellesMap();
  const deleteMutation = useDeleteParcelle();

  const data = useMemo(() => parcelles.data ?? [], [parcelles.data]);

  const columns: ListColumn<Parcelle>[] = [
    {
      key: "nom",
      header: "Nom",
      cell: (p) => (
        <Link
          href={`/parcelles/${p.id}` as never}
          className="font-medium hover:text-green hover:underline"
        >
          {p.nom}
        </Link>
      ),
    },
    {
      key: "surface",
      header: "Surface",
      cell: (p) => (
        <span className="whitespace-nowrap font-mono text-sm tabular-nums">
          {formatSurface(p.surfaceM2)}
        </span>
      ),
    },
    {
      key: "zone",
      header: "Zone",
      cell: (p) => libelleZone(p.zone),
      hideBelow: "md",
    },
    {
      key: "cadastral",
      header: "N° cadastral",
      cell: (p) => (
        <span className="font-mono text-xs text-foreground/60">
          {p.identifiantCadastral ?? "—"}
        </span>
      ),
      hideBelow: "lg",
    },
    {
      key: "actions",
      header: "",
      cell: (p) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Supprimer la parcelle « ${p.nom} » ? Cette action est définitive.`)) {
              deleteMutation.mutate(p.id);
            }
          }}
          disabled={deleteMutation.isPending}
          className="rounded-md p-1.5 text-foreground/40 hover:bg-red-50 hover:text-red-600"
          aria-label="Supprimer"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
      className: "text-right",
    },
  ];

  const filters: FilterOption<Parcelle>[] = [
    {
      key: "with-cadastral",
      label: "Avec N° cadastral",
      predicate: (p) => !!p.identifiantCadastral,
    },
    { key: "with-notes", label: "Avec notes", predicate: (p) => !!p.notes },
    { key: "small", label: "< 1 ha", predicate: (p) => Number(p.surfaceM2) < 10000 },
    {
      key: "large",
      label: "≥ 5 ha",
      predicate: (p) => Number(p.surfaceM2) >= 50000,
    },
  ];

  const groupBys: GroupByOption<Parcelle>[] = [
    {
      key: "zone",
      label: "Zone agricole",
      groupKey: (p) => p.zone,
      groupLabel: (k) => libelleZone(k as ZoneAgricole),
      order: ZONE_ORDER as string[],
    },
  ];

  const renderCard = (p: Parcelle) => (
    <div>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold">{p.nom}</h3>
      </div>
      <dl className="mt-2 space-y-0.5 text-sm">
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
      {p.notes && <p className="mt-2 text-xs text-foreground/60">{p.notes}</p>}
    </div>
  );

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
          menuActions={[
            {
              label: "Importer un fichier",
              icon: FileUp,
              href: "/parcelles/import",
            },
            {
              label: "Exporter en CSV",
              icon: Download,
              disabled: data.length === 0,
              onClick: () => {
                downloadCsv("parcelles", data, [
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

        {parcelles.isError && (
          <div className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Impossible de charger les parcelles. Vérifie ta connexion.
          </div>
        )}

        <ResourceView<Parcelle>
          storageKey="parcelles"
          defaultView="map"
          data={data}
          columns={columns}
          renderCard={renderCard}
          renderKanbanCard={renderCard}
          getKey={(p) => p.id}
          onItemClick={(p) =>
            // Use Link semantics — fallback to window navigation since
            // ResourceView ne propage pas les props nav. Simple navigation
            // côté client suffit ici.
            (window.location.href = `/parcelles/${p.id}`)
          }
          searchFields={(p) =>
            [p.nom, p.identifiantCadastral ?? "", p.notes ?? "", libelleZone(p.zone)].join(" ")
          }
          searchPlaceholder="Rechercher par nom, N° cadastral, zone…"
          filters={filters}
          groupBys={groupBys}
          renderMapView={(filteredItems) => {
            const ids = new Set(filteredItems.map((p) => p.id));
            const filteredMap = (parcellesMap.data ?? []).filter((m) => ids.has(m.id));
            return (
              <>
                <ParcellesMapView parcelles={filteredMap} />
                {filteredMap.length === 0 && (
                  <p className="mt-3 text-center text-sm text-foreground/60">
                    Aucune parcelle ne correspond aux filtres.
                  </p>
                )}
              </>
            );
          }}
          emptyState={
            <div>
              <MapPin className="mx-auto h-10 w-10 text-foreground/30" />
              <h2 className="mt-4 text-lg font-semibold">Aucune parcelle pour l'instant</h2>
              <p className="mt-1 text-sm text-foreground/60">
                Importe tes parcelles depuis le portail cantonal ou crées-en une manuellement.
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
          }
        />
      </div>
    </>
  );
}
