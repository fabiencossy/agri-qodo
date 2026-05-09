"use client";

import {
  Archive,
  ArchiveRestore,
  Briefcase,
  FolderOpen,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type FilterOption,
  type GroupByOption,
  type ListColumn,
  ResourceView,
} from "@/components/ui/resource-view";
import {
  PROJET_TYPE_LABEL,
  type Projet,
  type ProjetType,
  useCreateProjet,
  useDeleteProjet,
  useProjets,
  useSyncProjetsFromOdoo,
  useUpdateProjet,
} from "@/lib/projets";

const TYPES: { value: ProjetType; label: string }[] = [
  { value: "INTERVENTION", label: "Carnet des champs" },
  { value: "TRAVAUX_TIERS", label: "Travaux pour tiers" },
  { value: "INTERNE", label: "Travail interne" },
  { value: "AUTRE", label: "Autre" },
];

export default function ProjetsPage() {
  // ResourceView gère son propre filtre archives via FilterOption — mais
  // l'API exige `includeArchived=true` pour les retourner. On charge donc
  // tout, puis on laisse l'utilisateur trier via le filtre.
  const projets = useProjets({ includeArchived: true });
  const create = useCreateProjet();
  const sync = useSyncProjetsFromOdoo();
  const [editingProjet, setEditingProjet] = useState<Projet | null>(null);

  const data = useMemo(() => projets.data ?? [], [projets.data]);

  const [draftNom, setDraftNom] = useState("");
  const [draftType, setDraftType] = useState<ProjetType>("AUTRE");

  const handleCreate = (e?: React.FormEvent) => {
    e?.preventDefault();
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

  const handleSync = () => {
    sync.mutate(undefined, {
      onSuccess: (r) => {
        const parts: string[] = [];
        if (r.created > 0) parts.push(`${r.created} créé(s)`);
        if (r.updated > 0) parts.push(`${r.updated} mis à jour`);
        if (r.archivedFromOdoo > 0) parts.push(`${r.archivedFromOdoo} archivé(s)`);
        if (r.skipped > 0) parts.push(`${r.skipped} ignoré(s)`);
        const summary = parts.length > 0 ? parts.join(", ") : "rien à mettre à jour";
        alert(`Sync Odoo : ${r.pulled} projet(s) lus — ${summary}.`);
      },
      onError: (err) => {
        alert(`Sync Odoo impossible : ${err instanceof Error ? err.message : err}`);
      },
    });
  };

  const columns = useMemo<ListColumn<Projet>[]>(
    () => [
      {
        key: "nom",
        header: "Nom",
        cell: (p) => (
          <span className="flex items-center gap-2 font-medium">
            {p.nom}
            {p.archive && (
              <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                Archivé
              </span>
            )}
          </span>
        ),
      },
      {
        key: "type",
        header: "Type",
        cell: (p) => <span className="text-xs">{PROJET_TYPE_LABEL[p.type]}</span>,
      },
      {
        key: "description",
        header: "Description",
        cell: (p) =>
          p.description ? (
            <span className="text-xs text-foreground/70">{p.description}</span>
          ) : (
            <span className="text-foreground/30">—</span>
          ),
        hideBelow: "md",
      },
      {
        key: "odoo",
        header: "Odoo",
        cell: (p) =>
          p.odooProjectId ? (
            <span
              className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800"
              title={
                p.odooSyncedAt
                  ? `project.project #${p.odooProjectId} — sync ${new Date(p.odooSyncedAt).toLocaleString("fr-CH")}`
                  : `project.project #${p.odooProjectId}`
              }
            >
              #{p.odooProjectId}
            </span>
          ) : (
            <span
              className="text-[10px] text-foreground/40"
              title="Pas encore poussé vers Odoo (Odoo non configuré ou push échoué)"
            >
              non poussé
            </span>
          ),
        hideBelow: "md",
      },
      {
        key: "createdAt",
        header: "Créé le",
        cell: (p) => (
          <span className="whitespace-nowrap text-xs text-foreground/60">
            {new Date(p.createdAt).toLocaleDateString("fr-CH")}
          </span>
        ),
        hideBelow: "lg",
      },
    ],
    [],
  );

  const filters = useMemo<FilterOption<Projet>[]>(
    () => [
      ...TYPES.map((t) => ({
        key: `type-${t.value}`,
        label: t.label,
        predicate: (p: Projet) => p.type === t.value,
      })),
      {
        key: "archive-actif",
        label: "Actifs uniquement",
        predicate: (p: Projet) => !p.archive,
      },
      {
        key: "archive-archive",
        label: "Archivés uniquement",
        predicate: (p: Projet) => p.archive,
      },
    ],
    [],
  );

  const groupBys = useMemo<GroupByOption<Projet>[]>(
    () => [
      {
        key: "type",
        label: "Type",
        groupKey: (p) => p.type,
        groupLabel: (key) => PROJET_TYPE_LABEL[key as ProjetType] ?? key,
        order: TYPES.map((t) => t.value),
      },
      {
        key: "archive",
        label: "Statut",
        groupKey: (p) => (p.archive ? "archive" : "actif"),
        groupLabel: (key) => (key === "archive" ? "Archivés" : "Actifs"),
      },
    ],
    [],
  );

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/app" },
          { label: "Paramètres", href: "/parametres" },
          { label: "Projets" },
        ]}
      />
      <div className="mx-auto w-full px-2 py-4 sm:px-4 sm:py-8">
        <PageHeader
          title="Projets"
          icon={FolderOpen}
          subtitle="Étiquettes pour regrouper tes interventions et travaux. Sync bidirectionnelle avec les project.project Odoo (créer/renommer ici → push Odoo, modifier côté Odoo → bouton Resync)."
          menuActions={[
            {
              label: sync.isPending ? "Synchronisation…" : "Resync depuis Odoo",
              icon: RefreshCw,
              disabled: sync.isPending,
              onClick: handleSync,
            },
          ]}
        />

        {/* Création rapide — garde l'encart inline historique pour le pattern speed-typing */}
        <section className="mb-6 rounded-2xl border border-border bg-background p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-medium">Nouveau projet</h2>
          <form onSubmit={handleCreate} className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
            <Input
              value={draftNom}
              onChange={(e) => setDraftNom(e.target.value)}
              placeholder="Nom du projet"
              maxLength={120}
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
            <Button type="submit" disabled={!draftNom.trim() || create.isPending} className="h-11">
              <Plus className="mr-1 h-4 w-4" />
              Créer
            </Button>
          </form>
          {create.isError && (
            <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {create.error instanceof Error ? create.error.message : "Création impossible."}
            </p>
          )}
        </section>

        {projets.isError && (
          <div className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Impossible de charger la liste.
          </div>
        )}

        <ResourceView<Projet>
          storageKey="projets"
          defaultView="list"
          availableViews={["list", "kanban"]}
          data={data}
          columns={columns}
          getKey={(p) => p.id}
          searchFields={(p) => [p.nom, p.description ?? "", PROJET_TYPE_LABEL[p.type]].join(" ")}
          searchPlaceholder="Rechercher nom, type, description…"
          filters={filters}
          groupBys={groupBys}
          onItemClick={(p) => setEditingProjet(p)}
          renderKanbanCard={(p) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="truncate font-medium">{p.nom}</span>
                {p.archive && (
                  <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                    Archivé
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-foreground/60">{PROJET_TYPE_LABEL[p.type]}</p>
              {p.description && (
                <p className="mt-1 line-clamp-2 text-xs text-foreground/50">{p.description}</p>
              )}
            </div>
          )}
          emptyState={
            <div>
              <Briefcase className="mx-auto mb-2 h-10 w-10 text-foreground/30" />
              <p className="text-sm text-foreground/60">Aucun projet pour l'instant.</p>
              <p className="mt-1 text-xs text-foreground/50">
                Crée un premier projet ci-dessus pour regrouper tes opérations.
              </p>
            </div>
          }
        />
      </div>

      {editingProjet && (
        <EditProjetDialog projet={editingProjet} onClose={() => setEditingProjet(null)} />
      )}
    </>
  );
}

function EditProjetDialog({ projet, onClose }: { projet: Projet; onClose: () => void }) {
  const [nom, setNom] = useState(projet.nom);
  const [type, setType] = useState<ProjetType>(projet.type);
  const [description, setDescription] = useState(projet.description ?? "");
  const update = useUpdateProjet();
  const del = useDeleteProjet();

  useEffect(() => {
    setNom(projet.nom);
    setType(projet.type);
    setDescription(projet.description ?? "");
  }, [projet]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedDescription = description.trim();
    update.mutate(
      {
        id: projet.id,
        ...(nom !== projet.nom ? { nom } : {}),
        ...(type !== projet.type ? { type } : {}),
        ...((projet.description ?? "") !== trimmedDescription
          ? { description: trimmedDescription }
          : {}),
      },
      { onSuccess: () => onClose() },
    );
  };

  const onArchive = () => {
    update.mutate({ id: projet.id, archive: !projet.archive }, { onSuccess: () => onClose() });
  };

  const onDelete = () => {
    if (
      !confirm(
        `Supprimer définitivement le projet "${projet.nom}" ?\n\nLes opérations qui y faisaient référence ne seront PAS supprimées.`,
      )
    )
      return;
    del.mutate(projet.id, { onSuccess: () => onClose() });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-xl font-bold">Modifier le projet</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Nom">
            <Input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
              maxLength={120}
              disabled={update.isPending}
            />
          </Field>
          <Field label="Type">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ProjetType)}
              disabled={update.isPending}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-base"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={update.isPending}
              maxLength={500}
              rows={3}
              className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
            />
          </Field>

          {update.isError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {update.error instanceof Error ? update.error.message : "Erreur"}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onArchive} disabled={update.isPending}>
                {projet.archive ? (
                  <>
                    <ArchiveRestore className="mr-2 h-4 w-4" /> Désarchiver
                  </>
                ) : (
                  <>
                    <Archive className="mr-2 h-4 w-4" /> Archiver
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onDelete}
                disabled={del.isPending}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </Button>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
