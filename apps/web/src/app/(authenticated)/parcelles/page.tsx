"use client";

import { MapPin, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import { formatSurface, libelleZone, useDeleteParcelle, useParcelles } from "@/lib/parcelles";

export default function ParcellesPage() {
  const parcelles = useParcelles();
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
        <div className="mb-8 flex items-end justify-between">
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

        {parcelles.data && parcelles.data.length > 0 && (
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
