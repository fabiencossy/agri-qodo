"use client";

/**
 * Mes heures — `/mes-heures`.
 *
 * Vue des heures saisies par l'utilisateur courant. Agrège les
 * LigneTravailHeure où userId = me, à travers tous les Travaux du tenant.
 *
 * Deux modes :
 * - **Semaine** (par défaut, style qodo-clock) : onglets jours Lu→Di
 *   horizontaux avec total/jour, le jour sélectionné affiche la liste
 *   détaillée de ses saisies (cards cliquables, durée/CHF à droite).
 * - **Liste** : groupement par jour décroissant, détail des lignes
 *   (mode classique).
 */
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  LayoutGrid,
  Plus,
  Tractor,
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

type ViewMode = "semaine" | "liste";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] as const;
const JOURS_COURT = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"] as const;

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
  const [view, setView] = useState<ViewMode>("semaine");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  // Jour sélectionné dans la vue Semaine — défaut = aujourd'hui s'il
  // est dans la semaine affichée, sinon le lundi.
  const [selectedDayKey, setSelectedDayKey] = useState<string>(() => jourCle(new Date()));
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
                onClick={() => setView("semaine")}
                aria-label="Vue semaine"
                className={`flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors sm:px-3 ${
                  view === "semaine" ? "bg-green text-white" : "text-foreground/70 hover:bg-muted"
                }`}
              >
                <CalendarDays className="h-4 w-4" />
                <span className="hidden sm:inline">Semaine</span>
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

        {view === "semaine" ? (
          <SemaineView
            weekStart={weekStart}
            byDay={byDay}
            today={today}
            selectedDayKey={selectedDayKey}
            onSelectDay={setSelectedDayKey}
          />
        ) : (
          <ListeView grouped={grouped} isLoading={heures.isLoading} />
        )}
      </div>
    </>
  );
}

/**
 * Vue Semaine style qodo-clock — onglets jours horizontaux Lu→Di avec
 * total/jour en grand, le jour sélectionné affiche dessous la liste
 * détaillée de ses saisies.
 */
function SemaineView({
  weekStart,
  byDay,
  today,
  selectedDayKey,
  onSelectDay,
}: {
  weekStart: Date;
  byDay: Map<string, MesHeuresLigne[]>;
  today: string;
  selectedDayKey: string;
  onSelectDay: (key: string) => void;
}) {
  // Si le jour sélectionné n'est pas dans la semaine affichée, on tombe
  // sur le lundi par défaut pour garantir un affichage cohérent.
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const inWeek = days.some((d) => jourCle(d) === selectedDayKey);
  const effectiveDayKey = inWeek ? selectedDayKey : jourCle(weekStart);
  const selectedItems = byDay.get(effectiveDayKey) ?? [];
  const selectedDate = days.find((d) => jourCle(d) === effectiveDayKey) ?? weekStart;
  const selectedTotal = selectedItems.reduce((s, l) => s + l.dureeMinutes, 0);
  const selectedCHF = selectedItems.reduce((s, l) => {
    if (!l.tauxHoraireCHF) return s;
    return s + (l.dureeMinutes / 60) * Number(l.tauxHoraireCHF);
  }, 0);

  return (
    <div>
      {/* Onglets jours horizontaux */}
      <div className="mb-4 grid grid-cols-7 gap-1 sm:gap-2">
        {days.map((day, i) => {
          const key = jourCle(day);
          const items = byDay.get(key) ?? [];
          const totalMin = items.reduce((s, l) => s + l.dureeMinutes, 0);
          const isToday = key === today;
          const isSelected = key === effectiveDayKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(key)}
              aria-pressed={isSelected}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-1 py-2 text-center transition-all sm:py-3 ${
                isSelected
                  ? "border-amber-500 bg-amber-50 text-amber-900"
                  : isToday
                    ? "border-green/40 bg-green/5 text-foreground hover:border-green"
                    : "border-border bg-background text-foreground/80 hover:border-foreground/30"
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70 sm:text-xs">
                <span className="sm:hidden">{JOURS_COURT[i]}</span>
                <span className="hidden sm:inline">{JOURS[i]}</span>
              </span>
              <span className="text-xl font-bold tabular-nums sm:text-2xl">{day.getDate()}</span>
              <span
                className={`font-mono text-[11px] tabular-nums sm:text-xs ${
                  totalMin > 0 ? "" : "opacity-30"
                }`}
              >
                {totalMin > 0 ? formatDuree(totalMin) : "—"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Détail du jour sélectionné */}
      <section className="overflow-hidden rounded-2xl border border-border bg-background">
        <header className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3">
          <span className="text-sm font-semibold capitalize sm:text-base">
            {selectedDate.toLocaleDateString("fr-CH", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </span>
          <span className="font-mono text-base font-bold tabular-nums sm:text-lg">
            {formatDuree(selectedTotal)}
            {selectedCHF > 0 && (
              <span className="ml-2 text-sm font-normal text-foreground/60">
                · {formatCHF(selectedCHF)}
              </span>
            )}
          </span>
        </header>
        {selectedItems.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-sm text-foreground/50">
            <p>Aucune heure saisie ce jour.</p>
            <Link href={`/travaux/new?date=${effectiveDayKey}` as never}>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Ajouter une saisie
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {selectedItems.map((l) => (
                <SaisieRow key={l.id} ligne={l} />
              ))}
            </ul>
            <div className="border-t border-border bg-muted/10 px-4 py-2 text-right">
              <Link
                href={`/travaux/new?date=${effectiveDayKey}` as never}
                className="inline-flex items-center gap-1 text-xs font-medium text-green hover:text-green-dark"
              >
                <Plus className="h-3 w-3" />
                Ajouter une saisie
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function SaisieRow({ ligne: l }: { ligne: MesHeuresLigne }) {
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <Link
              href={`/travaux/${l.travail.id}` as never}
              className="font-medium hover:underline"
            >
              {l.travail.titre}
            </Link>
            {l.travail.partenaire && (
              <span className="text-xs text-foreground/60">· {l.travail.partenaire.nom}</span>
            )}
            {l.travail.parcelle && (
              <span className="text-xs text-foreground/60">· {l.travail.parcelle.nom}</span>
            )}
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-medium ${STATUT_BADGE[l.travail.statut]}`}
            >
              {STATUT_LABEL[l.travail.statut]}
            </span>
          </div>
          {l.notes && <p className="mt-0.5 text-xs italic text-foreground/60">{l.notes}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-mono text-base font-bold tabular-nums">
            {formatDuree(l.dureeMinutes)}
          </span>
          {l.tauxHoraireCHF && (
            <span className="font-mono text-xs text-foreground/60">
              {formatCHF((l.dureeMinutes / 60) * Number(l.tauxHoraireCHF))}
            </span>
          )}
          <Link
            href={`/travaux/${l.travail.id}` as never}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-green hover:bg-green/10"
          >
            <ArrowRight className="h-3 w-3" />
            Modifier
          </Link>
        </div>
      </div>
    </li>
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
            <Tractor className="mr-1 h-4 w-4" />
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
