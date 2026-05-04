"use client";

import { Archive, ArchiveRestore, Briefcase, FolderOpen, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PROJET_TYPE_LABEL,
  type Projet,
  type ProjetType,
  useCreateProjet,
  useDeleteProjet,
  useProjets,
  useUpdateProjet,
} from "@/lib/projets";

const TYPES: { value: ProjetType; label: string }[] = [
  { value: "INTERVENTION", label: "Carnet des champs" },
  { value: "TRAVAUX_TIERS", label: "Travaux pour tiers" },
  { value: "INTERNE", label: "Travail interne" },
  { value: "AUTRE", label: "Autre" },
];

export default function ProjetsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const projets = useProjets({ includeArchived: showArchived });
  const create = useCreateProjet();
  const update = useUpdateProjet();
  const del = useDeleteProjet();

  const [draftNom, setDraftNom] = useState("");
  const [draftType, setDraftType] = useState<ProjetType>("AUTRE");

  const handleCreate = () => {
    if (!draftNom.trim()) return;
    create.mutate(
      { nom: draftNom.trim(), type: draftType },
      {
        onSuccess: () => {
          setDraftNom("");
          setDraftType("AUTRE");
        },
      },
    );
  };

  const handleArchive = (p: Projet) => {
    update.mutate({ id: p.id, archive: !p.archive });
  };

  const handleDelete = (p: Projet) => {
    if (
      !confirm(
        `Supprimer définitivement le projet "${p.nom}" ?\n\nLes opérations qui y faisaient référence ne seront PAS supprimées.`,
      )
    )
      return;
    del.mutate(p.id);
  };

  const data = projets.data ?? [];
  const grouped = TYPES.map((t) => ({
    type: t,
    items: data.filter((p) => p.type === t.value),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/app" },
          { label: "Paramètres", href: "/parametres" },
          { label: "Projets" },
        ]}
      />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <PageHeader
          title="Projets"
          icon={FolderOpen}
          subtitle="Étiquettes pour regrouper tes interventions et travaux (ex : « Récolte 2026 », « Chantier Bruhlart »)."
        />

        {/* Création rapide */}
        <section className="mb-6 rounded-2xl border border-border bg-background p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-medium">Nouveau projet</h2>
          <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
            <Input
              value={draftNom}
              onChange={(e) => setDraftNom(e.target.value)}
              placeholder="Nom du projet"
              maxLength={120}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
            <select
              value={draftType}
              onChange={(e) => setDraftType(e.target.value as ProjetType)}
              className="h-11 rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <Button
              onClick={handleCreate}
              disabled={!draftNom.trim() || create.isPending}
              className="h-11"
            >
              <Plus className="mr-1 h-4 w-4" />
              Créer
            </Button>
          </div>
          {create.isError && (
            <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {create.error instanceof Error ? create.error.message : "Création impossible."}
            </p>
          )}
        </section>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground/70">
            {data.length} projet{data.length > 1 ? "s" : ""}
          </h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-green"
            />
            Afficher les archivés
          </label>
        </div>

        {grouped.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-foreground/60">
            <Briefcase className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">Aucun projet pour l'instant.</p>
            <p className="mt-1 text-xs">
              Crée un premier projet ci-dessus pour regrouper tes opérations.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(({ type, items }) => (
              <section key={type.value}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">
                  {PROJET_TYPE_LABEL[type.value]}
                </h3>
                <ul className="overflow-hidden rounded-xl border border-border bg-background">
                  {items.map((p) => (
                    <li
                      key={p.id}
                      className={`flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0 ${
                        p.archive ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.nom}</span>
                          {p.archive && (
                            <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                              Archivé
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <p className="mt-0.5 text-xs text-foreground/60">{p.description}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleArchive(p)}
                        className="rounded-md p-1.5 text-foreground/50 hover:bg-muted hover:text-foreground/80"
                        aria-label={p.archive ? "Désarchiver" : "Archiver"}
                        title={p.archive ? "Désarchiver" : "Archiver"}
                      >
                        {p.archive ? (
                          <ArchiveRestore className="h-4 w-4" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        className="rounded-md p-1.5 text-foreground/50 hover:bg-red-50 hover:text-red-600"
                        aria-label="Supprimer"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
