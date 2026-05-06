"use client";

import { ClipboardCheck, Sprout, Timer, Trash2 } from "lucide-react";
import Link from "next/link";
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
import {
  type Intervention,
  libelleType,
  useDeleteIntervention,
  useInterventions,
  useInterventionsPending,
} from "@/lib/interventions";
import { useCurrentPresence } from "@/lib/presences";
import { type Travail, useDeleteTravail, useTravaux } from "@/lib/travaux";

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
function travailKind(t: Travail): "TIERS" | "INTERNE" {
  return t.interne ? "INTERNE" : "TIERS";
}

const KIND_LABEL: Record<ActiviteKind, string> = {
  CARNET: "Carnet",
  TIERS: "Travail tiers",
  INTERNE: "Travail interne",
};
const KIND_ORDER: ActiviteKind[] = ["CARNET", "TIERS", "INTERNE"];

function searchFields(item: ActiviteUnifiee): string {
  if (item.kind === "CARNET") {
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
  const t = item.travail;
  return [
    t.titre,
    t.partenaire?.nom ?? "",
    t.parcelle?.nom ?? "",
    t.projet?.nom ?? "",
    t.notes ?? "",
  ].join(" ");
}

function buildFilters(): FilterOption<ActiviteUnifiee>[] {
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
    { key: "carnet", label: "Carnet uniquement", predicate: (it) => it.kind === "CARNET" },
    { key: "tiers", label: "Travaux pour tiers", predicate: (it) => it.kind === "TIERS" },
    { key: "interne", label: "Travaux internes", predicate: (it) => it.kind === "INTERNE" },
    {
      key: "pending",
      label: "Carnet à valider",
      predicate: (it) => it.kind === "CARNET" && it.intervention.validationStatus === "PENDING",
    },
  ];
}

const GROUPBYS: GroupByOption<ActiviteUnifiee>[] = [
  {
    key: "kind",
    label: "Type d'activité",
    groupKey: (it) => it.kind,
    groupLabel: (k) => KIND_LABEL[k as ActiviteKind] ?? k,
    order: KIND_ORDER,
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

const COLUMNS: ListColumn<ActiviteUnifiee>[] = [
  {
    key: "type",
    header: "Type",
    cell: (it) => <KindPill kind={it.kind} />,
    className: "w-28",
  },
  {
    key: "titre",
    header: "Titre",
    cell: (it) => (
      <span className="font-medium">
        {it.kind === "CARNET" ? libelleType(it.intervention.type) : it.travail.titre}
      </span>
    ),
  },
  {
    key: "parcelle",
    header: "Parcelle",
    cell: (it) =>
      it.kind === "CARNET"
        ? (it.intervention.parcelle.nom ?? "—")
        : (it.travail.parcelle?.nom ?? "—"),
    hideBelow: "sm",
  },
  {
    key: "client",
    header: "Client",
    cell: (it) => {
      if (it.kind === "CARNET") return "—";
      return it.travail.partenaire?.nom ?? (it.kind === "INTERNE" ? "Interne" : "—");
    },
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

function KindPill({ kind }: { kind: ActiviteKind }) {
  const map: Record<ActiviteKind, string> = {
    CARNET: "bg-emerald-50 text-emerald-700 border-emerald-300",
    TIERS: "bg-purple-50 text-purple-700 border-purple-300",
    INTERNE: "bg-sky-50 text-sky-700 border-sky-300",
  };
  const labels: Record<ActiviteKind, string> = {
    CARNET: "Carnet",
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

export default function ActivitesPage() {
  const router = useRouter();
  const interventions = useInterventions();
  const travaux = useTravaux();
  const pending = useInterventionsPending();
  const presenceCourante = useCurrentPresence();
  const deleteIntervention = useDeleteIntervention();
  const deleteTravail = useDeleteTravail();

  const items = useMemo<ActiviteUnifiee[]>(() => {
    const fromIv: ActiviteUnifiee[] = (interventions.data ?? []).map((iv: Intervention) => ({
      kind: "CARNET" as const,
      date: iv.dateOperation,
      intervention: iv,
    }));
    const fromTravaux: ActiviteUnifiee[] = (travaux.data ?? []).map((t: Travail) => {
      const kind = travailKind(t);
      return { kind, date: t.date, travail: t } as ActiviteUnifiee;
    });
    return [...fromIv, ...fromTravaux].sort((a, b) => {
      const aPending = a.kind === "CARNET" && a.intervention.validationStatus === "PENDING" ? 1 : 0;
      const bPending = b.kind === "CARNET" && b.intervention.validationStatus === "PENDING" ? 1 : 0;
      if (aPending !== bPending) return bPending - aPending;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [interventions.data, travaux.data]);

  const pendingCount = pending.data?.length ?? 0;
  const filters = useMemo(buildFilters, []);

  function getItemKey(it: ActiviteUnifiee): string {
    return it.kind === "CARNET" ? `iv-${it.intervention.id}` : `tr-${it.travail.id}`;
  }
  function onItemClick(it: ActiviteUnifiee) {
    // Click sur une carte → ouvre le formulaire de saisie pré-rempli
    // (mode édition). Même UI que la création, valeurs chargées depuis l'API.
    if (it.kind === "CARNET") {
      router.push(`/interventions/new?edit=${it.intervention.id}` as never);
    } else {
      router.push(`/travaux/new?edit=${it.travail.id}` as never);
    }
  }

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Activités" }]} />
      <div className="mx-auto w-full px-3 py-4 sm:py-6">
        <h1 className="mb-3 text-2xl font-bold sm:text-3xl">Activités</h1>

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
              à valider — utilise le filtre "Carnet à valider".
            </span>
          </div>
        )}

        {/* ResourceView : barre de recherche + 5 vues + filtres + groupBy */}
        <ResourceView<ActiviteUnifiee>
          storageKey="activites-unifiees-v3"
          defaultView="list"
          availableViews={["list", "kanban", "calendar"]}
          data={items}
          columns={COLUMNS}
          renderCard={(it) => <ActiviteCard item={it} />}
          renderKanbanCard={(it) => <ActiviteCard item={it} />}
          getKey={getItemKey}
          dateField={(it) => it.date}
          onItemClick={onItemClick}
          searchFields={searchFields}
          searchPlaceholder="Rechercher type, titre, parcelle, client, produit, notes…"
          filters={filters}
          groupBys={GROUPBYS}
          selectable
          bulkActions={[
            {
              key: "delete",
              label: "Supprimer",
              icon: Trash2,
              className: "bg-red-600 hover:bg-red-700",
              confirm: "Supprimer {n} activité(s) ?",
              handler: async (selected) => {
                let ok = 0;
                let ko = 0;
                for (const it of selected) {
                  try {
                    if (it.kind === "CARNET")
                      await deleteIntervention.mutateAsync(it.intervention.id);
                    else await deleteTravail.mutateAsync(it.travail.id);
                    ok++;
                  } catch {
                    ko++;
                  }
                }
                if (ko > 0) alert(`${ok} supprimées, ${ko} échecs.`);
              },
            },
          ]}
          emptyState={
            <div>
              <Sprout className="mx-auto mb-2 h-10 w-10 text-foreground/30" />
              <p className="text-sm text-foreground/60">Aucune activité pour l'instant.</p>
              <p className="mt-1 text-xs text-foreground/50">
                Tape sur le bouton + en bas à droite pour commencer.
              </p>
            </div>
          }
        />
      </div>
    </>
  );
}
