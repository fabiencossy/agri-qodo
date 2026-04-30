"use client";

import { Briefcase, ClipboardCheck, Clock, Sprout, Timer, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { useInterventions, useInterventionsPending } from "@/lib/interventions";
import { useCurrentPresence } from "@/lib/presences";
import { useMesHeures, useTravaux } from "@/lib/travaux";

/**
 * Page d'accueil du module **Activités** — point d'entrée unique pour les
 * deux flux de saisie terrain :
 *
 *   🌾 **Carnet des champs** → Intervention sur ma parcelle
 *      (cas A : SELF) ou la parcelle d'un client (cas B :
 *      crée auto Travail + sale.order Odoo en plus du carnet).
 *
 *   🛠 **Travaux & prestations** → service rendu à un tiers (facturable)
 *      ou activité interne (mécanique, transport, formation) hors carnet.
 *
 * UX "gros doigts" : 2 cartes géantes, 1 décision visible, pas de menu
 * secondaire à parcourir.
 */
/** Renvoie le lundi 00:00 et le dimanche 23:59 de la semaine courante. */
function semaineCourante() {
  const now = new Date();
  const day = now.getDay() || 7;
  const lundi = new Date(now);
  lundi.setDate(now.getDate() - (day - 1));
  lundi.setHours(0, 0, 0, 0);
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);
  dimanche.setHours(23, 59, 59, 999);
  return {
    lundi,
    dimanche,
    lundiIso: lundi.toISOString().slice(0, 10),
    dimancheIso: dimanche.toISOString().slice(0, 10),
  };
}

export default function ActivitesPage() {
  const pending = useInterventionsPending();
  const pendingCount = pending.data?.length ?? 0;
  const presenceCourante = useCurrentPresence();

  const { lundi, dimanche, lundiIso, dimancheIso } = semaineCourante();
  const interventions = useInterventions();
  const travaux = useTravaux();
  const heures = useMesHeures({ dateDebut: lundiIso, dateFin: dimancheIso });

  const interventionsSemaine = (interventions.data ?? []).filter((i) => {
    const d = new Date(i.dateOperation);
    return d >= lundi && d <= dimanche;
  });
  const travauxSemaine = (travaux.data ?? []).filter((t) => {
    const d = new Date(t.date);
    return d >= lundi && d <= dimanche;
  });
  const minutesSemaine = (heures.data ?? []).reduce((sum, h) => sum + h.dureeMinutes, 0);
  const heuresSemaineLabel = `${Math.floor(minutesSemaine / 60)}h${String(minutesSemaine % 60).padStart(2, "0")}`;

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Activités" }]} />
      <div className="mx-auto max-w-3xl px-3 py-4 sm:py-8">
        <header className="mb-6 sm:mb-10">
          <h1 className="text-2xl font-bold sm:text-3xl">Activités</h1>
          <p className="mt-2 text-sm text-foreground/70 sm:text-base">
            Que veux-tu saisir aujourd&apos;hui&nbsp;?
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          <Link
            href="/interventions/new"
            className="group flex flex-col items-start gap-4 rounded-3xl border border-border bg-background p-6 transition-all hover:border-foreground/20 hover:shadow-md active:scale-[0.99] sm:p-8"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-green text-white shadow-md transition-transform group-hover:scale-105 sm:h-24 sm:w-24">
              <Sprout className="h-10 w-10 sm:h-12 sm:w-12" />
            </span>
            <span className="block">
              <span className="block text-xl font-bold sm:text-2xl">Faire une intervention</span>
              <span className="mt-1 block text-sm text-foreground/70 sm:text-base">
                Carnet des champs : labour, semis, fumure, traitement phyto, récolte…
              </span>
            </span>
            <span className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-foreground/70">
              Sur une parcelle <span aria-hidden>→</span>
            </span>
          </Link>

          <Link
            href="/travaux/new"
            className="group flex flex-col items-start gap-4 rounded-3xl border border-border bg-background p-6 transition-all hover:border-foreground/20 hover:shadow-md active:scale-[0.99] sm:p-8"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md transition-transform group-hover:scale-105 sm:h-24 sm:w-24">
              <Briefcase className="h-10 w-10 sm:h-12 sm:w-12" />
            </span>
            <span className="block">
              <span className="block text-xl font-bold text-foreground sm:text-2xl">
                Saisir une prestation
              </span>
              <span className="mt-1 block text-sm text-foreground/70 sm:text-base">
                Prestation pour un client (balles rondes, transport…) ou interne (mécanique).
              </span>
            </span>
            <span className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-foreground/70">
              Pour un client ou interne <span aria-hidden>→</span>
            </span>
          </Link>
        </div>

        {/* Notification présence en cours — ligne sobre */}
        {presenceCourante.data && (
          <Link
            href="/presences"
            className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 text-sm transition-colors hover:bg-muted/30"
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

        {/* Notification interventions à valider — ligne sobre, redirige sur /interventions
            où le badge "à valider" apparaît sur les lignes concernées avec boutons inline. */}
        {pendingCount > 0 && (
          <Link
            href="/interventions"
            className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 text-sm transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center gap-3">
              <ClipboardCheck className="h-4 w-4 text-foreground/60" />
              <span>
                <strong>
                  {pendingCount} intervention{pendingCount > 1 ? "s" : ""}
                </strong>{" "}
                à valider
              </span>
            </div>
            <span className="text-xs text-foreground/60">Voir →</span>
          </Link>
        )}

        {/* Résumé "Cette semaine" - 3 KPI cliquables (style uniforme sobre) */}
        <section className="mt-6 rounded-2xl border border-border bg-background p-4 sm:p-5">
          <header className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-foreground/60" />
            <h2 className="text-base font-semibold">Cette semaine</h2>
            <span className="text-xs text-foreground/50">
              ({lundi.toLocaleDateString("fr-CH")} → {dimanche.toLocaleDateString("fr-CH")})
            </span>
          </header>
          <div className="grid grid-cols-3 gap-3">
            <Link
              href="/interventions"
              className="rounded-xl border border-border bg-background p-3 text-center transition-colors hover:bg-muted/30"
            >
              <div className="text-2xl font-bold sm:text-3xl">{interventionsSemaine.length}</div>
              <div className="mt-0.5 text-xs text-foreground/70">
                intervention{interventionsSemaine.length > 1 ? "s" : ""}
              </div>
            </Link>
            <Link
              href="/travaux"
              className="rounded-xl border border-border bg-background p-3 text-center transition-colors hover:bg-muted/30"
            >
              <div className="text-2xl font-bold sm:text-3xl">{travauxSemaine.length}</div>
              <div className="mt-0.5 text-xs text-foreground/70">
                prestation{travauxSemaine.length > 1 ? "s" : ""}
              </div>
            </Link>
            <Link
              href="/mes-heures"
              className="rounded-xl border border-border bg-background p-3 text-center transition-colors hover:bg-muted/30"
            >
              <div className="font-mono text-2xl font-bold tabular-nums sm:text-3xl">
                {heuresSemaineLabel}
              </div>
              <div className="mt-0.5 text-xs text-foreground/70">heures</div>
            </Link>
          </div>
        </section>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-foreground/60" />
            <span className="text-foreground/70">Voir mes heures travaillées cette semaine</span>
          </div>
          <Link
            href="/mes-heures"
            className="rounded-lg border border-border bg-background px-3 py-1.5 font-medium hover:bg-muted"
          >
            Mes heures
          </Link>
        </div>
      </div>
    </>
  );
}
