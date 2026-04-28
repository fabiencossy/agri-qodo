"use client";

import { MapPin, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useIsAuthenticated } from "@/lib/auth";
import { formatSurface, libelleZone, useDeleteParcelle, useParcelles } from "@/lib/parcelles";

export default function ParcellesPage() {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const parcelles = useParcelles();
  const deleteMutation = useDeleteParcelle();

  useEffect(() => {
    if (isAuthenticated === false) router.replace("/login");
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const onDelete = (id: string, nom: string) => {
    if (confirm(`Supprimer la parcelle « ${nom} » ? Cette action est définitive.`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-bold text-green">
              🌱 Agri Qodo
            </Link>
            <span className="text-sm text-foreground/60">· Parcelles</span>
          </div>
          <Link href="/parcelles/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle parcelle
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold">Mes parcelles</h1>
        <p className="mb-8 text-foreground/70">
          {parcelles.data
            ? `${parcelles.data.length} parcelle${parcelles.data.length > 1 ? "s" : ""}`
            : "Chargement…"}
        </p>

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
      </main>
    </div>
  );
}
