"use client";

import { Tractor, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  ActiviteCard,
  type ActiviteKind,
  type ActiviteUnifiee,
} from "@/components/activites/activite-card";
import { Breadcrumb } from "@/components/app/breadcrumb";
import {
  type FilterOption,
  type GroupByOption,
  type ListColumn,
  ResourceView,
} from "@/components/ui/resource-view";
import { useInterventions } from "@/lib/interventions";
import { type Travail, useDeleteTravail, useTravaux } from "@/lib/travaux";

type TravailItem = Extract<ActiviteUnifiee, { kind: "TIERS" | "INTERNE" }>;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function semaineFromDate(d: Date): { lundi: Date; dimanche: Date } {
  const day = d.getDay() || 7;
  const lundi = startOfDay(d);
  lundi.setDate(d.getDate() - (day - 1));
  const dimanche = endOfDay(lundi);
  dimanche.setDate(lundi.getDate() + 6);
  return { lundi, dimanche };
}

const KIND_LABEL: Record<Exclude<ActiviteKind, "CARNET">, string> = {
  TIERS: "Travail pour tiers",
  INTERNE: "Travail interne",
};

function searchFields(item: TravailItem): string {
  const t = item.travail;
  return [
    t.titre,
    t.partenaire?.nom ?? "",
    t.odooPartnerName ?? "",
    t.parcelle?.nom ?? "",
    t.projet?.nom ?? "",
    t.notes ?? "",
  ].join(" ");
}

function buildFilters(): FilterOption<TravailItem>[] {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const sem = semaineFromDate(today);
  return [
    {
      key: "today",
      label: "Aujourd'hui",
      predicate: (it) => {
        const t = new Date(it.date).getTime();
        return t >= today.getTime() && t < tomorrow.getTime();
      },
    },
    {
      key: "week",
      label: "Cette semaine",
      predicate: (it) => {
        const t = new Date(it.date).getTime();
        return t >= sem.lundi.getTime() && t <= sem.dimanche.getTime();
      },
    },
    { key: "tiers", label: "Pour tiers", predicate: (it) => it.kind === "TIERS" },
    { key: "interne", label: "Internes", predicate: (it) => it.kind === "INTERNE" },
    // À valider : un employé a marqué le travail "terminé" → statut
    // PENDING_REVIEW. Le OWNER doit cliquer Valider pour passer en
    // VALIDATED (Fabien 2026-05-14 image 48).
    {
      key: "a-valider",
      label: "À valider",
      predicate: (it) => it.travail.statut === "PENDING_REVIEW",
    },
  ];
}

const GROUPBYS: GroupByOption<TravailItem>[] = [
  {
    key: "kind",
    label: "Type",
    groupKey: (it) => it.kind,
    groupLabel: (k) => KIND_LABEL[k as Exclude<ActiviteKind, "CARNET">] ?? k,
    order: ["TIERS", "INTERNE"],
  },
  {
    key: "client",
    label: "Client",
    groupKey: (it) =>
      it.travail.partenaire?.nom ??
      it.travail.odooPartnerName ??
      (it.kind === "INTERNE" ? "— Interne —" : "— Sans client —"),
    groupLabel: (k) => k,
  },
  {
    key: "jour",
    label: "Jour",
    groupKey: (it) => new Date(it.date).toISOString().slice(0, 10),
    groupLabel: (k) =>
      new Date(k).toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "short" }),
  },
  {
    key: "mois",
    label: "Mois",
    groupKey: (it) => {
      const d = new Date(it.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    },
    groupLabel: (k) => {
      const [y, m] = k.split("-");
      if (!y || !m) return k;
      return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("fr-CH", {
        month: "long",
        year: "numeric",
      });
    },
  },
];

function KindPill({ kind }: { kind: Exclude<ActiviteKind, "CARNET"> }) {
  const map: Record<Exclude<ActiviteKind, "CARNET">, string> = {
    TIERS: "bg-purple-50 text-purple-700 border-purple-300",
    INTERNE: "bg-sky-50 text-sky-700 border-sky-300",
  };
  const labels: Record<Exclude<ActiviteKind, "CARNET">, string> = {
    TIERS: "Tiers",
    INTERNE: "Interne",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${map[kind]}`}
    >
      {labels[kind]}
    </span>
  );
}

const COLUMNS: ListColumn<TravailItem>[] = [
  {
    key: "type",
    header: "Type",
    cell: (it) => <KindPill kind={it.kind} />,
    className: "w-24",
  },
  {
    key: "titre",
    header: "Titre",
    cell: (it) => <span className="font-medium">{it.travail.titre}</span>,
  },
  {
    key: "client",
    header: "Client",
    cell: (it) =>
      it.travail.partenaire?.nom ??
      it.travail.odooPartnerName ??
      (it.kind === "INTERNE" ? "Interne" : "—"),
    hideBelow: "sm",
  },
  {
    key: "parcelle",
    header: "Parcelle",
    cell: (it) => it.travail.parcelle?.nom ?? "—",
    hideBelow: "md",
  },
  {
    key: "date",
    header: "Date",
    cell: (it) => new Date(it.date).toLocaleDateString("fr-CH"),
    className: "w-24 text-sm tabular-nums",
    hideBelow: "md",
  },
];

export default function TravauxPage() {
  const router = useRouter();
  const travaux = useTravaux();
  // Les Travaux "shadow" générés par une Intervention chez un partenaire
  // (linkedTravailId) doivent être masqués pour ne pas apparaître deux fois.
  const interventions = useInterventions();
  const deleteTravail = useDeleteTravail();

  const items = useMemo<TravailItem[]>(() => {
    const shadowTravailIds = new Set<string>(
      (interventions.data ?? []).map((iv) => iv.linkedTravailId).filter((id): id is string => !!id),
    );
    return (travaux.data ?? [])
      .filter((t: Travail) => !shadowTravailIds.has(t.id))
      .map((t: Travail) => ({
        kind: t.interne ? ("INTERNE" as const) : ("TIERS" as const),
        date: t.date,
        travail: t,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [travaux.data, interventions.data]);

  const filters = useMemo(buildFilters, []);

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Travaux" }]} />
      <div className="mx-auto w-full px-3 py-4 sm:py-6">
        <h1 className="mb-3 text-2xl font-bold sm:text-3xl">Travaux</h1>

        <ResourceView<TravailItem>
          storageKey="travaux-v1"
          defaultView="list"
          availableViews={["list", "kanban", "calendar"]}
          data={items}
          columns={COLUMNS}
          renderCard={(it) => <ActiviteCard item={it} />}
          renderKanbanCard={(it) => <ActiviteCard item={it} />}
          getKey={(it) => `tr-${it.travail.id}`}
          dateField={(it) => it.date}
          onItemClick={(it) => router.push(`/travaux/${it.travail.id}` as never)}
          searchFields={searchFields}
          searchPlaceholder="Rechercher titre, client, parcelle, projet, notes…"
          filters={filters}
          groupBys={GROUPBYS}
          selectable
          bulkActions={[
            {
              key: "delete",
              label: "Supprimer",
              icon: Trash2,
              className: "bg-red-600 hover:bg-red-700",
              confirm: "Supprimer {n} travail(aux) ?",
              handler: async (selected) => {
                let ok = 0;
                const errors: string[] = [];
                for (const it of selected) {
                  try {
                    await deleteTravail.mutateAsync(it.travail.id);
                    ok++;
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    errors.push(`${it.travail.titre} : ${msg}`);
                  }
                }
                if (errors.length > 0) {
                  alert(`${ok} supprimé(s), ${errors.length} échec(s) :\n\n${errors.join("\n")}`);
                }
              },
            },
          ]}
          emptyState={
            <div>
              <Tractor className="mx-auto mb-2 h-10 w-10 text-foreground/30" />
              <p className="text-sm text-foreground/60">Aucun travail pour l'instant.</p>
              <p className="mt-1 text-xs text-foreground/50">
                Tape sur le bouton + en bas à droite pour saisir un travail pour tiers ou interne.
              </p>
            </div>
          }
        />
      </div>
    </>
  );
}
