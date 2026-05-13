"use client";

import { ClipboardCheck, Sprout, Timer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { ActiviteCard, type ActiviteUnifiee } from "@/components/activites/activite-card";
import { Breadcrumb } from "@/components/app/breadcrumb";
import {
  type FilterOption,
  type GroupByOption,
  type ListColumn,
  ResourceView,
} from "@/components/ui/resource-view";
import {
  type Intervention,
  libelleType,
  useDeleteIntervention,
  useInterventions,
  useInterventionsPending,
} from "@/lib/interventions";
import { useCurrentPresence } from "@/lib/presences";

type CarnetItem = Extract<ActiviteUnifiee, { kind: "CARNET" }>;

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

function searchFields(item: CarnetItem): string {
  const iv = item.intervention;
  return [
    libelleType(iv.type),
    iv.parcelle.nom,
    iv.produit ?? "",
    iv.produitRef?.libelle ?? "",
    iv.culture?.espece ?? "",
    iv.notes ?? "",
  ].join(" ");
}

function buildFilters(): FilterOption<CarnetItem>[] {
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
    {
      key: "pending",
      label: "À valider",
      predicate: (it) => it.intervention.validationStatus === "PENDING",
    },
  ];
}

const GROUPBYS: GroupByOption<CarnetItem>[] = [
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
  {
    key: "type",
    label: "Type d'intervention",
    groupKey: (it) => it.intervention.type,
    groupLabel: (k) => libelleType(k as Intervention["type"]),
  },
];

const COLUMNS: ListColumn<CarnetItem>[] = [
  {
    key: "type",
    header: "Type",
    cell: (it) => <span className="font-medium">{libelleType(it.intervention.type)}</span>,
  },
  {
    key: "parcelle",
    header: "Parcelle",
    cell: (it) => it.intervention.parcelle.nom ?? "—",
    hideBelow: "sm",
  },
  {
    key: "produit",
    header: "Produit / culture",
    cell: (it) => it.intervention.produitRef?.libelle ?? it.intervention.culture?.espece ?? "—",
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

export default function CarnetDesChampsPage() {
  const router = useRouter();
  const interventions = useInterventions();
  const pending = useInterventionsPending();
  const presenceCourante = useCurrentPresence();
  const deleteIntervention = useDeleteIntervention();

  const items = useMemo<CarnetItem[]>(() => {
    return (interventions.data ?? [])
      .map((iv: Intervention) => ({
        kind: "CARNET" as const,
        date: iv.dateOperation,
        intervention: iv,
      }))
      .sort((a, b) => {
        const aPending = a.intervention.validationStatus === "PENDING" ? 1 : 0;
        const bPending = b.intervention.validationStatus === "PENDING" ? 1 : 0;
        if (aPending !== bPending) return bPending - aPending;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [interventions.data]);

  const pendingCount = pending.data?.length ?? 0;
  const filters = useMemo(buildFilters, []);

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Carnet des champs" }]} />
      <div className="mx-auto w-full px-3 py-4 sm:py-6">
        <h1 className="mb-3 text-2xl font-bold sm:text-3xl">Carnet des champs</h1>

        {presenceCourante.data && (
          <Link
            href="/presences"
            className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 text-sm transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center gap-3">
              <Timer className="h-4 w-4 text-foreground/60" />
              <span>
                Présence <strong>{presenceCourante.data.type.toLowerCase()}</strong> en cours
              </span>
            </div>
            <span className="text-xs text-foreground/60">Pointer la sortie →</span>
          </Link>
        )}
        {pendingCount > 0 && (
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-100 p-3 text-sm">
            <ClipboardCheck className="h-4 w-4 text-amber-700" />
            <span className="text-amber-950">
              <strong>
                {pendingCount} intervention{pendingCount > 1 ? "s" : ""}
              </strong>{" "}
              à valider — utilise le filtre "À valider".
            </span>
          </div>
        )}

        <ResourceView<CarnetItem>
          storageKey="carnet-des-champs-v1"
          defaultView="list"
          availableViews={["list", "kanban", "calendar"]}
          data={items}
          columns={COLUMNS}
          renderCard={(it) => <ActiviteCard item={it} />}
          renderKanbanCard={(it) => <ActiviteCard item={it} />}
          getKey={(it) => `iv-${it.intervention.id}`}
          dateField={(it) => it.date}
          onItemClick={(it) => router.push(`/interventions/${it.intervention.id}` as never)}
          searchFields={searchFields}
          searchPlaceholder="Rechercher type, parcelle, produit, culture, notes…"
          filters={filters}
          groupBys={GROUPBYS}
          selectable
          bulkActions={[
            {
              key: "delete",
              label: "Supprimer",
              icon: Trash2,
              className: "bg-red-600 hover:bg-red-700",
              confirm: "Supprimer {n} intervention(s) ?",
              handler: async (selected) => {
                let ok = 0;
                const errors: string[] = [];
                for (const it of selected) {
                  try {
                    await deleteIntervention.mutateAsync(it.intervention.id);
                    ok++;
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    errors.push(`${libelleType(it.intervention.type)} : ${msg}`);
                  }
                }
                if (errors.length > 0) {
                  alert(`${ok} supprimée(s), ${errors.length} échec(s) :\n\n${errors.join("\n")}`);
                }
              },
            },
          ]}
          emptyState={
            <div>
              <Sprout className="mx-auto mb-2 h-10 w-10 text-foreground/30" />
              <p className="text-sm text-foreground/60">Aucune intervention pour l'instant.</p>
              <p className="mt-1 text-xs text-foreground/50">
                Tape sur le bouton + en bas à droite pour saisir ta première intervention.
              </p>
            </div>
          }
        />
      </div>
    </>
  );
}
