"use client";

import { Check, Download, Plus, Sprout, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  colorType,
  emojiType,
  formatDateFr,
  formatQuantite,
  type Intervention,
  libelleType,
  useDeleteIntervention,
  useInterventions,
  useRejectIntervention,
  useValidateIntervention,
} from "@/lib/interventions";

const TYPE_ORDER: Intervention["type"][] = [
  "SEMIS",
  "FUMURE_ORGANIQUE",
  "FUMURE_MINERALE",
  "PHYTO",
  "RECOLTE",
  "TRAVAIL_DU_SOL",
  "IRRIGATION",
  "AUTRE",
];

export default function InterventionsPage() {
  const router = useRouter();
  const interventionsQuery = useInterventions();
  // Tri client : PENDING en haut, puis par date décroissante. Donne plus
  // de visibilité aux interventions à valider sans casser le filtre/groupBy.
  const data = useMemo(() => {
    const list = [...(interventionsQuery.data ?? [])];
    list.sort((a, b) => {
      const ap = a.validationStatus === "PENDING" ? 0 : 1;
      const bp = b.validationStatus === "PENDING" ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return new Date(b.dateOperation).getTime() - new Date(a.dateOperation).getTime();
    });
    return list;
  }, [interventionsQuery.data]);
  const deleteMutation = useDeleteIntervention();
  const validateMutation = useValidateIntervention();
  const rejectMutation = useRejectIntervention();

  const onDelete = (id: string, label: string) => {
    if (confirm(`Supprimer cette ${label} ? Cette action est définitive.`)) {
      deleteMutation.mutate(id);
    }
  };

  const onReject = (id: string) => {
    const reason = prompt("Raison du refus (optionnel) :");
    if (reason === null) return;
    rejectMutation.mutate(reason.trim() ? { id, reason: reason.trim() } : { id });
  };

  const columns = useMemo<ListColumn<Intervention>[]>(
    () => [
      {
        key: "type",
        header: "Type",
        cell: (iv) => (
          <span className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-md text-base ${colorType(iv.type)}`}
            >
              {emojiType(iv.type)}
            </span>
            <span className="font-medium">{libelleType(iv.type)}</span>
            {iv.validationStatus === "PENDING" && (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                à valider
              </span>
            )}
          </span>
        ),
      },
      {
        key: "parcelle",
        header: "Parcelle",
        cell: (iv) => iv.parcelle?.nom ?? "—",
        hideBelow: "sm",
      },
      {
        key: "date",
        header: "Date",
        cell: (iv) => (
          <span className="whitespace-nowrap text-sm">{formatDateFr(iv.dateOperation)}</span>
        ),
      },
      {
        key: "produit",
        header: "Produit / matériel",
        cell: (iv) => {
          const quantite = formatQuantite(iv.quantite, iv.unite);
          const produit = iv.produit ?? iv.materielRef?.libelle ?? "—";
          return (
            <span className="text-sm text-foreground/80">
              {produit}
              {quantite ? ` · ${quantite}` : ""}
            </span>
          );
        },
        hideBelow: "md",
      },
      {
        key: "actions",
        header: "",
        cell: (iv) => (
          <div className="flex justify-end gap-1">
            {iv.validationStatus === "PENDING" ? (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    validateMutation.mutate(iv.id);
                  }}
                  disabled={validateMutation.isPending}
                  className="rounded-md p-1.5 text-foreground/50 hover:bg-green/10 hover:text-green"
                  aria-label="Accepter"
                  title="Accepter"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReject(iv.id);
                  }}
                  disabled={rejectMutation.isPending}
                  className="rounded-md p-1.5 text-foreground/50 hover:bg-red-50 hover:text-red-600"
                  aria-label="Refuser"
                  title="Refuser"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(iv.id, libelleType(iv.type).toLowerCase());
                }}
                disabled={deleteMutation.isPending}
                className="rounded-md p-1.5 text-foreground/50 hover:bg-red-50 hover:text-red-600"
                aria-label="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ),
        className: "text-right",
      },
    ],
    [deleteMutation.isPending, rejectMutation.isPending, validateMutation],
  );

  const filters = useMemo<FilterOption<Intervention>[]>(
    () => [
      {
        key: "pending",
        label: "À valider",
        predicate: (iv) => iv.validationStatus === "PENDING",
      },
      {
        key: "current-month",
        label: "Ce mois",
        predicate: (iv) => {
          const d = new Date(iv.dateOperation);
          const now = new Date();
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        },
      },
      {
        key: "current-year",
        label: "Cette campagne",
        predicate: (iv) => new Date(iv.dateOperation).getFullYear() === new Date().getFullYear(),
      },
      {
        key: "with-product",
        label: "Avec produit",
        predicate: (iv) => !!iv.produit || !!iv.produitRef,
      },
    ],
    [],
  );

  const groupBys = useMemo<GroupByOption<Intervention>[]>(
    () => [
      {
        key: "type",
        label: "Type d'intervention",
        groupKey: (iv) => iv.type,
        groupLabel: (k) => libelleType(k as Intervention["type"]),
        order: TYPE_ORDER,
      },
      {
        key: "parcelle",
        label: "Parcelle",
        groupKey: (iv) => iv.parcelle?.nom ?? "(sans parcelle)",
        groupLabel: (k) => k,
      },
      {
        key: "mois",
        label: "Mois",
        groupKey: (iv) => {
          const d = new Date(iv.dateOperation);
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
    ],
    [],
  );

  const renderCard = (iv: Intervention) => {
    const quantite = formatQuantite(iv.quantite, iv.unite);
    const isPending = iv.validationStatus === "PENDING";
    return (
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg ${colorType(iv.type)}`}
            >
              {emojiType(iv.type)}
            </span>
            <div className="min-w-0">
              <div className="font-medium">{libelleType(iv.type)}</div>
              <div className="text-xs text-foreground/60">
                {iv.parcelle?.nom ?? "—"} · {formatDateFr(iv.dateOperation)}
              </div>
            </div>
          </div>
          {isPending && (
            <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
              à valider
            </span>
          )}
        </div>
        {(iv.produit || iv.produitRef || quantite) && (
          <p className="mt-2 text-xs text-foreground/70">
            {iv.produit ?? iv.produitRef?.libelle ?? "—"}
            {quantite ? ` · ${quantite}` : ""}
          </p>
        )}
        {iv.notes && <p className="mt-1 text-xs text-foreground/60">{iv.notes}</p>}
      </div>
    );
  };

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Carnet des champs" }]} />
      <div className="mx-auto w-full px-2 py-4 sm:px-4 sm:py-8">
        <PageHeader
          title="Carnet des champs"
          icon={Sprout}
          subtitle={
            interventionsQuery.data
              ? `${interventionsQuery.data.length} intervention${interventionsQuery.data.length > 1 ? "s" : ""}`
              : "Chargement…"
          }
          menuActions={[
            {
              label: "Exporter en CSV",
              icon: Download,
              disabled: data.length === 0,
              onClick: () => {
                downloadCsv("interventions", data, [
                  {
                    header: "Date",
                    value: (iv) => new Date(iv.dateOperation).toISOString().slice(0, 10),
                  },
                  { header: "Type", value: (iv) => libelleType(iv.type) },
                  { header: "Parcelle", value: (iv) => iv.parcelle?.nom ?? "" },
                  { header: "Produit", value: (iv) => iv.produit ?? "" },
                  { header: "Quantité", value: (iv) => iv.quantite ?? "" },
                  { header: "Unité", value: (iv) => iv.unite ?? "" },
                  {
                    header: "Surface travaillée (m²)",
                    value: (iv) => iv.surfaceTravailleeM2 ?? "",
                  },
                  { header: "Notes", value: (iv) => iv.notes ?? "" },
                ]);
              },
            },
          ]}
        />

        {interventionsQuery.isError && (
          <div className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Impossible de charger les interventions. Vérifie ta connexion.
          </div>
        )}

        <ResourceView<Intervention>
          storageKey="carnet-des-champs"
          defaultView="list"
          data={data}
          columns={columns}
          renderCard={renderCard}
          renderKanbanCard={renderCard}
          getKey={(iv) => iv.id}
          dateField={(iv) => iv.dateOperation}
          renderCalendarItem={(iv) => (
            <span>
              {emojiType(iv.type)} {libelleType(iv.type)}
            </span>
          )}
          onItemClick={(iv) => router.push(`/interventions/${iv.id}` as never)}
          searchFields={(iv) =>
            [
              libelleType(iv.type),
              iv.parcelle?.nom ?? "",
              iv.produit ?? "",
              iv.produitRef?.libelle ?? "",
              iv.materielRef?.libelle ?? "",
              iv.culture?.espece ?? "",
              iv.notes ?? "",
            ].join(" ")
          }
          searchPlaceholder="Rechercher type, parcelle, produit, culture, notes…"
          filters={filters}
          groupBys={groupBys}
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
                let ko = 0;
                for (const iv of selected) {
                  try {
                    await deleteMutation.mutateAsync(iv.id);
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
              <p className="mb-3 text-sm text-foreground/60">Aucune intervention pour l'instant.</p>
              <Link href="/interventions/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Saisir ma première intervention
                </Button>
              </Link>
            </div>
          }
        />
      </div>
    </>
  );
}
