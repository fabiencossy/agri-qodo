"use client";

/**
 * Mes heures — `/mes-heures`.
 *
 * Vue read-only des heures saisies par l'utilisateur courant. Agrège
 * les LigneTravailHeure où userId = me, à travers tous les Travaux du
 * tenant. Pas un nouveau modèle — c'est une vue dérivée du Travail
 * unifié (cf project_agri_qodo_travaux_timesheet en mémoire).
 *
 * Filtres prédéfinis : cette semaine, ce mois, mois précédent.
 * Total cumulé en haut, lignes triées par date décroissante.
 */
import { ArrowRight, Briefcase, Clock } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  formatCHF,
  formatDuree,
  type MesHeuresLigne,
  STATUT_BADGE,
  STATUT_LABEL,
  useMesHeures,
} from "@/lib/travaux";

type Periode = "semaine" | "mois" | "mois-precedent" | "tout";

function periodeRange(p: Periode): { dateDebut?: string; dateFin?: string } {
  const today = new Date();
  if (p === "tout") return {};
  if (p === "semaine") {
    const day = today.getDay();
    const monday = new Date(today);
    const offset = day === 0 ? -6 : 1 - day; // ISO : lundi = 1, dim = 0
    monday.setDate(today.getDate() + offset);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { dateDebut: monday.toISOString(), dateFin: sunday.toISOString() };
  }
  if (p === "mois") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    return { dateDebut: first.toISOString(), dateFin: last.toISOString() };
  }
  // mois-precedent
  const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const last = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
  return { dateDebut: first.toISOString(), dateFin: last.toISOString() };
}

const PERIODES: { key: Periode; label: string }[] = [
  { key: "semaine", label: "Cette semaine" },
  { key: "mois", label: "Ce mois" },
  { key: "mois-precedent", label: "Mois précédent" },
  { key: "tout", label: "Tout l'historique" },
];

function dateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CH", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  });
}

function jourCle(iso: string): string {
  // Pour grouper visuellement par jour.
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MesHeuresPage() {
  const [periode, setPeriode] = useState<Periode>("semaine");
  const heures = useMesHeures(periodeRange(periode));
  const lignes = heures.data ?? [];

  const totalMin = lignes.reduce((s, l) => s + l.dureeMinutes, 0);
  const totalCHF = lignes.reduce((s, l) => {
    if (!l.tauxHoraireCHF) return s;
    return s + (l.dureeMinutes / 60) * Number(l.tauxHoraireCHF);
  }, 0);

  const grouped = useMemo(() => {
    const map = new Map<string, MesHeuresLigne[]>();
    for (const l of lignes) {
      const k = jourCle(l.travail.date);
      const bucket = map.get(k);
      if (bucket) bucket.push(l);
      else map.set(k, [l]);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [lignes]);

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Mes heures" }]} />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Clock className="h-7 w-7 text-green" />
            Mes heures
          </h1>
          <p className="mt-1 text-foreground/70">
            Tes heures saisies sur les travaux. Pas de double saisie : tout vient automatiquement
            des travaux que tu pointes.
          </p>
        </div>

        <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-muted p-1 text-sm">
          {PERIODES.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriode(p.key)}
              className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${
                periode === p.key
                  ? "bg-background font-medium shadow-sm"
                  : "text-foreground/70 hover:bg-background/40"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Total" value={formatDuree(totalMin)} icon={Clock} />
          <Stat label="Lignes" value={`${lignes.length}`} icon={Briefcase} />
          <Stat label="Facturable" value={totalCHF > 0 ? formatCHF(totalCHF) : "—"} icon={Clock} />
        </div>

        {heures.isLoading ? (
          <p className="text-sm text-foreground/60">Chargement…</p>
        ) : lignes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
            <p className="mb-3 text-sm text-foreground/60">Aucune heure pour cette période.</p>
            <Link href="/travaux/new">
              <Button variant="secondary">
                <Briefcase className="mr-1 h-4 w-4" />
                Créer un travail
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(([jour, items]) => {
              const totalJour = items.reduce((s, l) => s + l.dureeMinutes, 0);
              const firstDate = items[0]?.travail.date;
              return (
                <div
                  key={jour}
                  className="overflow-hidden rounded-xl border border-border bg-background"
                >
                  <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
                    <span className="text-sm font-semibold capitalize">
                      {firstDate ? dateLong(firstDate) : jour}
                    </span>
                    <span className="font-mono text-sm font-medium">{formatDuree(totalJour)}</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {items.map((l) => (
                      <li
                        key={l.id}
                        className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
                      >
                        <span className="flex-1">
                          <Link
                            href={`/travaux/${l.travail.id}` as never}
                            className="font-medium hover:underline"
                          >
                            {l.travail.titre}
                          </Link>
                          {l.travail.partenaire && (
                            <span className="ml-2 text-foreground/60">
                              · {l.travail.partenaire.nom}
                            </span>
                          )}
                          {l.notes && (
                            <p className="mt-0.5 truncate text-xs text-foreground/50">{l.notes}</p>
                          )}
                        </span>
                        <span
                          className={`hidden rounded px-2 py-0.5 text-xs font-medium md:inline-block ${STATUT_BADGE[l.travail.statut]}`}
                        >
                          {STATUT_LABEL[l.travail.statut]}
                        </span>
                        <span className="font-mono text-sm tabular-nums">
                          {formatDuree(l.dureeMinutes)}
                        </span>
                        {l.tauxHoraireCHF && (
                          <span className="hidden font-mono text-xs text-foreground/60 sm:inline">
                            {formatCHF((l.dureeMinutes / 60) * Number(l.tauxHoraireCHF))}
                          </span>
                        )}
                        <ArrowRight className="h-3.5 w-3.5 text-foreground/30" />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Clock }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-foreground/60">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
