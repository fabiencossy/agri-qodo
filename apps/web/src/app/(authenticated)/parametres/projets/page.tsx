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
import { useOdooConnected } from "@/lib/odoo-config";
import { type OdooPartner, useOdooPartners } from "@/lib/odoo-partners";
import {
  PROJET_TYPE_LABEL,
  type CreateProjetInput,
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

interface ProjetFormState {
  nom: string;
  type: ProjetType;
  description: string;
  dateDebut: string;
  dateFin: string;
  allowBillable: boolean;
  odooPartnerId: number | null;
  couleurHex: string;
}

function emptyFormFor(type: ProjetType = "AUTRE"): ProjetFormState {
  return {
    nom: "",
    type,
    description: "",
    dateDebut: "",
    dateFin: "",
    // Pré-coché si type facturable par défaut.
    allowBillable: type === "TRAVAUX_TIERS",
    odooPartnerId: null,
    couleurHex: "",
  };
}

function projetToForm(p: Projet): ProjetFormState {
  return {
    nom: p.nom,
    type: p.type,
    description: p.description ?? "",
    dateDebut: p.dateDebut ? p.dateDebut.slice(0, 10) : "",
    dateFin: p.dateFin ? p.dateFin.slice(0, 10) : "",
    allowBillable: p.allowBillable,
    odooPartnerId: p.odooPartnerId,
    couleurHex: p.couleurHex ?? "",
  };
}

export default function ProjetsPage() {
  // ResourceView gère son propre filtre archives via FilterOption — mais
  // l'API exige `includeArchived=true` pour les retourner. On charge donc
  // tout, puis on laisse l'utilisateur trier via le filtre.
  const projets = useProjets({ includeArchived: true });
  const sync = useSyncProjetsFromOdoo();
  const [editingProjet, setEditingProjet] = useState<Projet | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const data = useMemo(() => projets.data ?? [], [projets.data]);

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
            {p.couleurHex && (
              <span
                className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                style={{ backgroundColor: p.couleurHex }}
                aria-hidden
              />
            )}
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
        key: "billable",
        header: "Facturable",
        cell: (p) =>
          p.allowBillable ? (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
              oui
            </span>
          ) : (
            <span className="text-[10px] text-foreground/40">—</span>
          ),
        hideBelow: "md",
      },
      {
        key: "dates",
        header: "Période",
        cell: (p) => {
          const start = p.dateDebut ? new Date(p.dateDebut).toLocaleDateString("fr-CH") : null;
          const end = p.dateFin ? new Date(p.dateFin).toLocaleDateString("fr-CH") : null;
          if (!start && !end) return <span className="text-foreground/30">—</span>;
          return (
            <span className="whitespace-nowrap text-xs text-foreground/70">
              {start ?? "…"} → {end ?? "…"}
            </span>
          );
        },
        hideBelow: "lg",
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
        key: "billable",
        label: "Facturables",
        predicate: (p: Projet) => p.allowBillable,
      },
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
          subtitle="Étiquettes pour regrouper tes interventions et travaux. Sync bidirectionnelle avec les project.project Odoo (créer ici → push Odoo, modifier côté Odoo → bouton Resync)."
          menuActions={[
            {
              label: sync.isPending ? "Synchronisation…" : "Resync depuis Odoo",
              icon: RefreshCw,
              disabled: sync.isPending,
              onClick: handleSync,
            },
          ]}
        />

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
                <span className="flex items-center gap-1.5 truncate font-medium">
                  {p.couleurHex && (
                    <span
                      className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: p.couleurHex }}
                      aria-hidden
                    />
                  )}
                  <span className="truncate">{p.nom}</span>
                </span>
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
                Tape sur le bouton + en bas à droite pour créer ton premier projet.
              </p>
            </div>
          }
        />
      </div>

      {/* FAB local : « + Nouveau projet » contextuel (à gauche du FAB global). */}
      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        aria-label="Nouveau projet"
        className="fixed bottom-6 right-24 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-green text-white shadow-xl transition-transform duration-200 hover:scale-105 hover:bg-green-dark active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2"
      >
        <Plus className="h-6 w-6" />
      </button>

      {createOpen && <NewProjetDialog onClose={() => setCreateOpen(false)} />}
      {editingProjet && (
        <EditProjetDialog projet={editingProjet} onClose={() => setEditingProjet(null)} />
      )}
    </>
  );
}

function NewProjetDialog({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<ProjetFormState>(() => emptyFormFor("AUTRE"));
  const create = useCreateProjet();

  // Synchronise allowBillable au changement de type — facilite la saisie
  // (TRAVAUX_TIERS = facturable par défaut, les autres non).
  useEffect(() => {
    setForm((f) => ({ ...f, allowBillable: f.type === "TRAVAUX_TIERS" ? true : f.allowBillable }));
  }, [form.type]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim()) return;
    const input: CreateProjetInput = {
      nom: form.nom.trim(),
      type: form.type,
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      ...(form.dateDebut ? { dateDebut: form.dateDebut } : {}),
      ...(form.dateFin ? { dateFin: form.dateFin } : {}),
      ...(form.allowBillable ? { allowBillable: true } : {}),
      ...(form.odooPartnerId ? { odooPartnerId: form.odooPartnerId } : {}),
      ...(form.couleurHex ? { couleurHex: form.couleurHex } : {}),
    };
    create.mutate(input, { onSuccess: () => onClose() });
  };

  return (
    <DialogShell title="Nouveau projet" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <ProjetFormFields form={form} setForm={setForm} disabled={create.isPending} />
        {create.isError && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {create.error instanceof Error ? create.error.message : "Création impossible."}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={!form.nom.trim() || create.isPending}>
            {create.isPending ? "Création…" : "Créer le projet"}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

function EditProjetDialog({ projet, onClose }: { projet: Projet; onClose: () => void }) {
  const [form, setForm] = useState<ProjetFormState>(() => projetToForm(projet));
  const update = useUpdateProjet();
  const del = useDeleteProjet();

  useEffect(() => {
    setForm(projetToForm(projet));
  }, [projet]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedDesc = form.description.trim();
    const currentDateDebut = projet.dateDebut ? projet.dateDebut.slice(0, 10) : "";
    const currentDateFin = projet.dateFin ? projet.dateFin.slice(0, 10) : "";
    const dateDebutChanged = currentDateDebut !== form.dateDebut;
    const dateFinChanged = currentDateFin !== form.dateFin;
    const odooPartnerChanged = form.odooPartnerId !== projet.odooPartnerId;
    const couleurChanged = (projet.couleurHex ?? "") !== form.couleurHex;
    update.mutate(
      {
        id: projet.id,
        ...(form.nom !== projet.nom ? { nom: form.nom } : {}),
        ...(form.type !== projet.type ? { type: form.type } : {}),
        ...((projet.description ?? "") !== trimmedDesc ? { description: trimmedDesc } : {}),
        ...(dateDebutChanged && form.dateDebut ? { dateDebut: form.dateDebut } : {}),
        ...(dateFinChanged && form.dateFin ? { dateFin: form.dateFin } : {}),
        ...(form.allowBillable !== projet.allowBillable
          ? { allowBillable: form.allowBillable }
          : {}),
        ...(odooPartnerChanged && form.odooPartnerId !== null
          ? { odooPartnerId: form.odooPartnerId }
          : {}),
        ...(couleurChanged && form.couleurHex ? { couleurHex: form.couleurHex } : {}),
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
        `Supprimer définitivement le projet "${projet.nom}" ?\n\nLes opérations qui y faisaient référence ne seront PAS supprimées. Côté Odoo, le projet sera archivé.`,
      )
    )
      return;
    del.mutate(projet.id, { onSuccess: () => onClose() });
  };

  return (
    <DialogShell title="Modifier le projet" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <ProjetFormFields form={form} setForm={setForm} disabled={update.isPending} />
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
    </DialogShell>
  );
}

function ProjetFormFields({
  form,
  setForm,
  disabled,
}: {
  form: ProjetFormState;
  setForm: React.Dispatch<React.SetStateAction<ProjetFormState>>;
  disabled?: boolean;
}) {
  const odooConnected = useOdooConnected();
  const partnersQuery = useOdooPartners();
  const partners: OdooPartner[] = odooConnected.connected ? (partnersQuery.data ?? []) : [];

  return (
    <>
      <Field label="Nom du projet *">
        <Input
          value={form.nom}
          onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
          required
          maxLength={120}
          placeholder="Récolte 2026 — Champ du Bas"
          disabled={disabled}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type">
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ProjetType }))}
            disabled={disabled}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-base"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Couleur sur les listes">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.couleurHex || "#4CAF50"}
              onChange={(e) => setForm((f) => ({ ...f, couleurHex: e.target.value }))}
              disabled={disabled}
              className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-background"
            />
            {form.couleurHex && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, couleurHex: "" }))}
                disabled={disabled}
                className="text-xs text-foreground/60 hover:text-foreground"
              >
                Retirer
              </button>
            )}
          </div>
        </Field>
      </div>

      <Field label="Description">
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          disabled={disabled}
          maxLength={500}
          rows={3}
          placeholder="Notes internes (côté Odoo : description du projet)"
          className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date de début">
          <Input
            type="date"
            value={form.dateDebut}
            onChange={(e) => setForm((f) => ({ ...f, dateDebut: e.target.value }))}
            disabled={disabled}
          />
        </Field>
        <Field label="Date d'échéance">
          <Input
            type="date"
            value={form.dateFin}
            onChange={(e) => setForm((f) => ({ ...f, dateFin: e.target.value }))}
            disabled={disabled}
          />
        </Field>
      </div>

      <Field label="Client (Odoo)">
        <select
          value={form.odooPartnerId ?? ""}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              odooPartnerId: e.target.value === "" ? null : Number(e.target.value),
            }))
          }
          disabled={disabled || !odooConnected.connected || partners.length === 0}
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-base disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">— Aucun client —</option>
          {partners.map((p) => (
            <option key={p.odooId} value={p.odooId}>
              {p.name}
              {p.ville ? ` — ${p.ville}` : ""}
            </option>
          ))}
        </select>
        {!odooConnected.connected && (
          <p className="mt-1 text-xs text-foreground/60">
            Connecte Odoo dans <span className="font-mono">Paramètres → Connexion Odoo</span> pour
            sélectionner un client.
          </p>
        )}
      </Field>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
        <input
          type="checkbox"
          checked={form.allowBillable}
          onChange={(e) => setForm((f) => ({ ...f, allowBillable: e.target.checked }))}
          disabled={disabled}
          className="mt-0.5 h-5 w-5 cursor-pointer accent-green disabled:cursor-not-allowed"
        />
        <span className="flex-1">
          <span className="block text-sm font-medium">Projet facturable (allow_billable)</span>
          <span className="mt-0.5 block text-xs text-foreground/60">
            Active le rattachement à une commande client Odoo. Recommandé pour les Travaux pour
            tiers.
          </span>
        </span>
      </label>
    </>
  );
}

function DialogShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-xl font-bold">{title}</h2>
        {children}
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
