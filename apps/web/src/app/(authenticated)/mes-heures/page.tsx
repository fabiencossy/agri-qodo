"use client";

/**
 * Mes heures — `/mes-heures`.
 *
 * Vue read-only des heures saisies par l'utilisateur courant. Agrège les
 * LigneTravailHeure où userId = me, à travers tous les Travaux du tenant.
 *
 * Deux modes :
 * - **Calendrier** (par défaut) : grille hebdomadaire 7 jours, total/jour
 *   en grand, navigation semaine prev/next, click sur un jour pour saisir
 * - **Liste** : groupement par jour, détail des lignes (mode classique)
 */
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  LayoutGrid,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/export-csv";
import {
  formatCHF,
  formatDuree,
  type MesHeuresLigne,
  STATUT_BADGE,
  STATUT_LABEL,
  useMesHeures,
} from "@/lib/travaux";

type ViewMode = "calendrier" | "liste";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] as const;

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + offset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function jourCle(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CH", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  });
}

function shortLabelWeek(monday: Date): string {
  const sunday = addDays(monday, 6);
  if (monday.getMonth() === sunday.getMonth()) {
    return `${monday.getDate()} – ${sunday.getDate()} ${sunday.toLocaleDateString("fr-CH", { month: "short" })} ${sunday.getFullYear()}`;
  }
  return `${monday.getDate()} ${monday.toLocaleDateString("fr-CH", { month: "short" })} – ${sunday.getDate()} ${sunday.toLocaleDateString("fr-CH", { month: "short" })} ${sunday.getFullYear()}`;
}

export default function MesHeuresPage() {
  const [view, setView] = useState<ViewMode>("calendrier");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const weekEnd = useMemo(() => endOfDay(addDays(weekStart, 6)), [weekStart]);

  const heures = useMesHeures({
    dateDebut: weekStart.toISOString(),
    dateFin: weekEnd.toISOString(),
  });
  const lignes = heures.data ?? [];

  const totalMin = lignes.reduce((s, l) => s + l.dureeMinutes, 0);
  const totalCHF = lignes.reduce((s, l) => {
    if (!l.tauxHoraireCHF) return s;
    return s + (l.dureeMinutes / 60) * Number(l.tauxHoraireCHF);
  }, 0);

  // ----- Calendrier : grouper par jour de la semaine -----
  const byDay = useMemo(() => {
    const map = new Map<string, MesHeuresLigne[]>();
    for (let i = 0; i < 7; i++) {
      map.set(jourCle(addDays(weekStart, i)), []);
    }
    for (const l of lignes) {
      const k = jourCle(l.travail.date);
      const bucket = map.get(k);
      if (bucket) bucket.push(l);
    }
    return map;
  }, [lignes, weekStart]);

  const today = jourCle(new Date());

  // ----- Liste : grouper par jour décroissant -----
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

  const goPrev = () => setWeekStart((w) => addDays(w, -7));
  const goNext = () => setWeekStart((w) => addDays(w, 7));
  const goThisWeek = () => setWeekStart(startOfWeek(new Date()));

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Mes heures" }]} />
      <div className="mx-auto max-w-5xl px-2 py-4 sm:px-4 sm:py-8">
        <PageHeader
          title="Mes heures"
          icon={Clock}
          subtitle="Tes heures viennent automatiquement des travaux. Pas de double saisie."
          menuActions={[
            {
              label: "Exporter en CSV",
              icon: Download,
              disabled: lignes.length === 0,
              onClick: () => {
                downloadCsv("mes-heures", lignes, [
                  { header: "Date", value: (l) => l.travail.date.slice(0, 10) },
                  { header: "Travail", value: (l) => l.travail.titre },
                  { header: "Client", value: (l) => l.travail.partenaire?.nom ?? "" },
                  { header: "Parcelle", value: (l) => l.travail.parcelle?.nom ?? "" },
                  { header: "Durée", value: (l) => formatDuree(l.dureeMinutes) },
                  { header: "Durée (minutes)", value: (l) => l.dureeMinutes },
                  { header: "Taux CHF/h", value: (l) => l.tauxHoraireCHF ?? "" },
                  {
                    header: "Total CHF",
                    value: (l) =>
                      l.tauxHoraireCHF
                        ? ((l.dureeMinutes / 60) * Number(l.tauxHoraireCHF)).toFixed(2)
                        : "",
                  },
                  { header: "Statut travail", value: (l) => STATUT_LABEL[l.travail.statut] },
                  { header: "Notes", value: (l) => l.notes ?? "" },
                ]);
              },
            },
          ]}
          rightSlot={
            <div className="inline-flex rounded-lg border border-border bg-background p-1">
              <button
                type="button"
                onClick={() => setView("calendrier")}
                aria-label="Vue calendrier"
                className={`flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors sm:px-3 ${
                  view === "calendrier"
                    ? "bg-green text-white"
                    : "text-foreground/70 hover:bg-muted"
                }`}
              >
                <CalendarDays className="h-4 w-4" />
                <span className="hidden sm:inline">Calendrier</span>
              </button>
              <button
                type="button"
                onClick={() => setView("liste")}
                aria-label="Vue liste"
                className={`flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors sm:px-3 ${
                  view === "liste" ? "bg-green text-white" : "text-foreground/70 hover:bg-muted"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Liste</span>
              </button>
            </div>
          }
        />

        {/* Navigation semaine */}
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
          <button
            type="button"
            onClick={goPrev}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted active:scale-95"
            aria-label="Semaine précédente"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold capitalize sm:text-base">
              {shortLabelWeek(weekStart)}
            </p>
            <p className="text-xs text-foreground/50">
              {formatDuree(totalMin)}
              {totalCHF > 0 && <> · {formatCHF(totalCHF)}</>}
            </p>
          </div>
          <button
            type="button"
            onClick={goNext}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted active:scale-95"
            aria-label="Semaine suivante"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={goThisWeek}
            className="ml-1 hidden rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted sm:inline-block"
          >
            Aujourd'hui
          </button>
        </div>

        {view === "calendrier" ? (
          <CalendrierView weekStart={weekStart} byDay={byDay} today={today} />
        ) : (
          <ListeView grouped={grouped} isLoading={heures.isLoading} />
        )}
      </div>
    </>
  );
}

function CalendrierView({
  weekStart,
  byDay,
  today,
}: {
  weekStart: Date;
  byDay: Map<string, MesHeuresLigne[]>;
  today: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
      {Array.from({ length: 7 }).map((_, i) => {
        const day = addDays(weekStart, i);
        const key = jourCle(day);
        const items = byDay.get(key) ?? [];
        const totalMin = items.reduce((s, l) => s + l.dureeMinutes, 0);
        const isToday = key === today;
        const isWeekend = i >= 5;

        const dateUrl = `/travaux/new?date=${key}`;

        return (
          <div
            key={key}
            className={`flex flex-col rounded-2xl border bg-background p-3 transition-shadow hover:shadow-md ${
              isToday ? "border-green ring-2 ring-green/30" : "border-border"
            } ${isWeekend ? "bg-muted/20" : ""}`}
          >
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                {JOURS[i]}
              </p>
              <p
                className={`text-2xl font-bold tabular-nums ${
                  isToday ? "text-green" : "text-foreground/80"
                }`}
              >
                {day.getDate()}
              </p>
            </div>

            {totalMin > 0 ? (
              <div className="mb-2 rounded-lg bg-green/10 px-2 py-1 text-center">
                <p className="font-mono text-sm font-bold text-green-dark">
                  {formatDuree(totalMin)}
                </p>
              </div>
            ) : (
              <div className="mb-2 rounded-lg bg-muted/40 px-2 py-1 text-center">
                <p className="text-xs text-foreground/40">—</p>
              </div>
            )}

            <ul className="flex-1 space-y-1 overflow-hidden">
              {items.slice(0, 3).map((l) => (
                <li
                  key={l.id}
                  className="rounded-md bg-muted/40 px-2 py-1 text-xs"
                  title={l.travail.titre}
                >
                  <p className="truncate font-medium">{l.travail.titre}</p>
                  <p className="font-mono text-[10px] text-foreground/60">
                    {formatDuree(l.dureeMinutes)}
                  </p>
                </li>
              ))}
              {items.length > 3 && (
                <li className="px-2 text-[10px] text-foreground/50">
                  + {items.length - 3} autre{items.length - 3 > 1 ? "s" : ""}
                </li>
              )}
            </ul>

            <Link
              href={dateUrl as never}
              className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-dashed border-border py-1.5 text-xs text-foreground/50 transition-colors hover:border-green hover:bg-green/5 hover:text-green"
            >
              <Plus className="h-3 w-3" />
              Ajouter
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function ListeView({
  grouped,
  isLoading,
}: {
  grouped: [string, MesHeuresLigne[]][];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <p className="text-sm text-foreground/60">Chargement…</p>;
  }
  if (grouped.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
        <p className="mb-3 text-sm text-foreground/60">Aucune heure pour cette semaine.</p>
        <Link href="/travaux/new">
          <Button variant="secondary">
            <Briefcase className="mr-1 h-4 w-4" />
            Créer un travail
          </Button>
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {grouped.map(([jour, items]) => {
        const totalJour = items.reduce((s, l) => s + l.dureeMinutes, 0);
        const firstDate = items[0]?.travail.date;
        return (
          <div
            key={jour}
            className="overflow-hidden rounded-2xl border border-border bg-background"
          >
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
              <span className="text-sm font-semibold capitalize">
                {firstDate ? dateLong(firstDate) : jour}
              </span>
              <span className="font-mono text-sm font-medium">{formatDuree(totalJour)}</span>
            </div>
            <ul className="divide-y divide-border">
              {items.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className="flex-1">
                    <Link
                      href={`/travaux/${l.travail.id}` as never}
                      className="font-medium hover:underline"
                    >
                      {l.travail.titre}
                    </Link>
                    {l.travail.partenaire && (
                      <span className="ml-2 text-foreground/60">· {l.travail.partenaire.nom}</span>
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
  );
}
