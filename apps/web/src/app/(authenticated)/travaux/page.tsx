"use client";

/**
 * Liste des travaux facturables — `/travaux`.
 *
 * Utilise <ResourceView> pour la bascule liste/kanban + recherche.
 * Le travail = mission/prestation/opération avec lignes produits +
 * lignes heures. Cf project_agri_qodo_travaux_timesheet.
 */
import { ClipboardList, Download, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { PageHeader } from "@/components/app/page-header";
import { downloadCsv } from "@/lib/export-csv";
import { Button } from "@/components/ui/button";
import {
  type FilterOption,
  type GroupByOption,
  type ListColumn,
  ResourceView,
} from "@/components/ui/resource-view";
import {
  formatCHF,
  formatDuree,
  STATUT_BADGE,
  STATUT_LABEL,
  totalTravailCHF,
  type Travail,
  type TravailStatut,
  useTravaux,
} from "@/lib/travaux";

const STATUT_ORDER: TravailStatut[] = ["DRAFT", "VALIDATED", "INVOICED", "CANCELLED"];

export default function TravauxPage() {
  const travauxQuery = useTravaux();
  const travaux = useMemo(() => travauxQuery.data ?? [], [travauxQuery.data]);

  const filters = useMemo<FilterOption<Travail>[]>(
    () => [
      { key: "draft", label: "Brouillons", predicate: (t) => t.statut === "DRAFT" },
      {
        key: "validated",
        label: "À facturer (validés)",
        predicate: (t) => t.statut === "VALIDATED",
      },
      { key: "invoiced", label: "Facturés", predicate: (t) => t.statut === "INVOICED" },
      { key: "with-client", label: "Avec client", predicate: (t) => !!t.partenaireId },
      { key: "internal", label: "Interne (sans client)", predicate: (t) => !t.partenaireId },
      {
        key: "current-month",
        label: "Ce mois",
        predicate: (t) => {
          const d = new Date(t.date);
          const now = new Date();
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        },
      },
    ],
    [],
  );

  const groupBys = useMemo<GroupByOption<Travail>[]>(
    () => [
      {
        key: "statut",
        label: "Statut",
        groupKey: (t) => t.statut,
        groupLabel: (k) => STATUT_LABEL[k as TravailStatut],
        order: STATUT_ORDER as string[],
      },
      {
        key: "client",
        label: "Client",
        groupKey: (t) => t.partenaire?.nom ?? "(Interne)",
        groupLabel: (k) => k,
      },
      {
        key: "mois",
        label: "Mois",
        groupKey: (t) => {
          const d = new Date(t.date);
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

  const columns = useMemo<ListColumn<Travail>[]>(
    () => [
      {
        key: "date",
        header: "Date",
        cell: (t) => (
          <span className="whitespace-nowrap text-sm">
            {new Date(t.date).toLocaleDateString("fr-CH")}
          </span>
        ),
      },
      {
        key: "titre",
        header: "Titre",
        cell: (t) => (
          <span className="truncate font-medium">
            <Link href={`/travaux/${t.id}` as never} className="hover:underline">
              {t.titre}
            </Link>
          </span>
        ),
      },
      {
        key: "client",
        header: "Client",
        cell: (t) => t.partenaire?.nom ?? <span className="text-foreground/30">Interne</span>,
        hideBelow: "md",
      },
      {
        key: "lignes",
        header: "Lignes",
        cell: (t) => {
          const heuresMin = t.lignesHeure.reduce((s, l) => s + l.dureeMinutes, 0);
          return (
            <span className="text-xs text-foreground/60">
              {t.lignesProduit.length} produit{t.lignesProduit.length > 1 ? "s" : ""} ·{" "}
              {formatDuree(heuresMin)}
            </span>
          );
        },
        hideBelow: "sm",
      },
      {
        key: "total",
        header: "Total",
        cell: (t) => (
          <span className="whitespace-nowrap font-mono text-sm font-medium tabular-nums">
            {formatCHF(totalTravailCHF(t))}
          </span>
        ),
        className: "text-right",
      },
      {
        key: "statut",
        header: "Statut",
        cell: (t) => (
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUT_BADGE[t.statut]}`}>
            {STATUT_LABEL[t.statut]}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Travaux" }]} />
      <div className="mx-auto max-w-6xl px-2 py-4 sm:px-4 sm:py-8">
        <PageHeader
          title="Travaux"
          icon={ClipboardList}
          subtitle="Produits + heures dans une seule saisie. Facturation Odoo automatique."
          menuActions={[
            {
              label: "Exporter en CSV",
              icon: Download,
              disabled: travaux.length === 0,
              onClick: () => {
                downloadCsv("travaux", travaux, [
                  { header: "Date", value: (t) => t.date.slice(0, 10) },
                  { header: "Titre", value: (t) => t.titre },
                  { header: "Client", value: (t) => t.partenaire?.nom ?? "" },
                  { header: "Parcelle", value: (t) => t.parcelle?.nom ?? "" },
                  { header: "Statut", value: (t) => STATUT_LABEL[t.statut] },
                  { header: "Interne", value: (t) => (t.interne ? "oui" : "non") },
                  {
                    header: "Heures totales",
                    value: (t) =>
                      formatDuree(t.lignesHeure.reduce((s, l) => s + l.dureeMinutes, 0)),
                  },
                  { header: "Total CHF HT", value: (t) => totalTravailCHF(t).toFixed(2) },
                  { header: "Notes", value: (t) => t.notes ?? "" },
                ]);
              },
            },
          ]}
        />

        {travauxQuery.isError && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Impossible de charger les travaux.
          </p>
        )}

        <ResourceView<Travail>
          storageKey="travaux"
          defaultView="list"
          data={travaux}
          columns={columns}
          renderKanbanCard={(t) => (
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">
                  <Link href={`/travaux/${t.id}` as never} className="hover:underline">
                    {t.titre}
                  </Link>
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${STATUT_BADGE[t.statut]}`}
                >
                  {STATUT_LABEL[t.statut]}
                </span>
              </div>
              <p className="mt-1 text-xs text-foreground/60">
                {new Date(t.date).toLocaleDateString("fr-CH")}
                {t.partenaire ? ` · ${t.partenaire.nom}` : " · Interne"}
              </p>
              <p className="mt-1 font-mono text-sm font-medium">{formatCHF(totalTravailCHF(t))}</p>
              <p className="mt-1 text-[11px] text-foreground/50">
                {t.lignesProduit.length} produit{t.lignesProduit.length > 1 ? "s" : ""} ·{" "}
                {formatDuree(t.lignesHeure.reduce((s, l) => s + l.dureeMinutes, 0))}
              </p>
            </div>
          )}
          getKey={(t) => t.id}
          searchFields={(t) =>
            [t.titre, t.partenaire?.nom ?? "", t.parcelle?.nom ?? "", t.notes ?? ""].join(" ")
          }
          searchPlaceholder="Rechercher par titre, client, parcelle…"
          filters={filters}
          groupBys={groupBys}
          emptyState={
            <div>
              <p className="mb-3 text-sm text-foreground/60">Aucun travail enregistré.</p>
              <Link href="/travaux/new">
                <Button>
                  <Plus className="mr-1 h-4 w-4" />
                  Créer le premier travail
                </Button>
              </Link>
            </div>
          }
        />
      </div>
    </>
  );
}
