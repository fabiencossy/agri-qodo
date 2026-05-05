"use client";

import { Sprout, Tractor, Wrench } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { libelleType, type Intervention } from "@/lib/interventions";
import type { Travail } from "@/lib/travaux";

export type ActiviteKind = "CARNET" | "TIERS" | "INTERNE";

export type ActiviteUnifiee =
  | { kind: "CARNET"; date: string; intervention: Intervention }
  | { kind: "TIERS" | "INTERNE"; date: string; travail: Travail };

const KIND_META: Record<ActiviteKind, { Icon: typeof Sprout; iconColor: string; tooltip: string }> =
  {
    CARNET: {
      Icon: Sprout,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      tooltip: "Carnet des champs",
    },
    TIERS: {
      Icon: Tractor,
      iconColor: "text-purple-600 dark:text-purple-400",
      tooltip: "Travail pour tiers",
    },
    INTERNE: {
      Icon: Wrench,
      iconColor: "text-sky-600 dark:text-sky-400",
      tooltip: "Travail interne",
    },
  };

function KindIcon({ kind }: { kind: ActiviteKind }) {
  const meta = KIND_META[kind];
  const Icon = meta.Icon;
  return (
    <span title={meta.tooltip} aria-label={meta.tooltip} className={`shrink-0 ${meta.iconColor}`}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

export function ActiviteCard({ item }: { item: ActiviteUnifiee }) {
  const date = new Date(item.date).toLocaleDateString("fr-CH", {
    day: "2-digit",
    month: "short",
  });

  if (item.kind === "CARNET") {
    const iv = item.intervention;
    const href = `/interventions/new?edit=${iv.id}` as Route;
    return (
      <Link href={href} className="flex h-full min-w-0 flex-col">
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <KindIcon kind="CARNET" />
              <span className="min-w-0 truncate text-sm font-semibold">{libelleType(iv.type)}</span>
            </div>
            <span className="shrink-0 text-xs text-foreground/60">{date}</span>
          </div>
          <div className="mt-0.5 truncate pl-6 text-xs text-foreground/70">
            {iv.parcelle.nom}
            {iv.produitRef ? ` · ${iv.produitRef.libelle}` : ""}
            {iv.culture ? ` · ${iv.culture.espece}` : ""}
          </div>
          {iv.validationStatus === "PENDING" && (
            <div className="mt-1.5 pl-6">
              <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                À valider
              </span>
            </div>
          )}
        </div>
      </Link>
    );
  }

  const t = item.travail;
  const href = `/travaux/new?edit=${t.id}` as Route;
  return (
    <Link
      href={href}
      className="block min-w-0 rounded-xl border border-border bg-background p-3 transition-colors hover:bg-muted/30"
    >
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <KindIcon kind={item.kind} />
            <span className="min-w-0 truncate text-sm font-semibold">{t.titre}</span>
          </div>
          <span className="shrink-0 text-xs text-foreground/60">{date}</span>
        </div>
        <div className="mt-0.5 truncate pl-6 text-xs text-foreground/70">
          {t.partenaire?.nom ?? (item.kind === "INTERNE" ? "Interne" : "—")}
          {t.parcelle ? ` · ${t.parcelle.nom}` : ""}
          {t.projet ? ` · ${t.projet.nom}` : ""}
        </div>
        {t.statut !== "DRAFT" && (
          <div className="mt-1.5 pl-6">
            <StatutBadge statut={t.statut} />
          </div>
        )}
      </div>
    </Link>
  );
}

function StatutBadge({ statut }: { statut: Travail["statut"] }) {
  const map: Record<Travail["statut"], { label: string; cls: string }> = {
    PLANIFIE: { label: "Planifié", cls: "bg-background text-green border-green" },
    DRAFT: { label: "Brouillon", cls: "bg-muted/40 text-foreground/80 border-border" },
    PENDING_REVIEW: { label: "À valider", cls: "bg-amber-50 text-amber-900 border-amber-300" },
    VALIDATED: { label: "Validé", cls: "bg-emerald-50 text-emerald-900 border-emerald-300" },
    INVOICED: { label: "Facturé", cls: "bg-blue-50 text-blue-900 border-blue-300" },
    CANCELLED: { label: "Annulé", cls: "bg-red-50 text-red-900 border-red-300" },
  };
  const m = map[statut];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
