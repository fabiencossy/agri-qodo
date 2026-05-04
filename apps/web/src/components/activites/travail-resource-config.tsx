/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
"use client";

import Link from "next/link";
import type { FilterOption, GroupByOption, ListColumn } from "@/components/ui/resource-view";
import {
  formatCHF,
  formatDuree,
  STATUT_BADGE,
  STATUT_LABEL,
  totalTravailCHF,
  type Travail,
  type TravailStatut,
} from "@/lib/travaux";

const STATUT_ORDER: TravailStatut[] = ["DRAFT", "VALIDATED", "INVOICED", "CANCELLED"];

export const travailFilters: FilterOption<Travail>[] = [
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
];

export const travailGroupBys: GroupByOption<Travail>[] = [
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
];

export const travailColumns: ListColumn<Travail>[] = [
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
];

export function renderTravailCard(t: Travail) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{t.titre}</span>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUT_BADGE[t.statut]}`}>
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
  );
}

export function travailSearchFields(t: Travail): string {
  return [t.titre, t.partenaire?.nom ?? "", t.parcelle?.nom ?? "", t.notes ?? ""].join(" ");
}
