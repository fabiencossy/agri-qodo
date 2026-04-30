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
            className="group flex flex-col items-start gap-4 rounded-3xl border-2 border-green/30 bg-green/5 p-6 transition-all hover:border-green hover:shadow-lg active:scale-[0.99] sm:p-8"
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
            <span className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-green">
              Sur une parcelle <span aria-hidden>→</span>
            </span>
          </Link>

          <Link
            href="/travaux/new"
            className="group flex flex-col items-start gap-4 rounded-3xl border-2 border-violet-300/60 bg-violet-50 p-6 transition-all hover:border-violet-500 hover:shadow-lg active:scale-[0.99] sm:p-8 dark:bg-violet-950/30 dark:border-violet-800"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md transition-transform group-hover:scale-105 sm:h-24 sm:w-24">
              <Briefcase className="h-10 w-10 sm:h-12 sm:w-12" />
            </span>
            <span className="block">
              <span className="block text-xl font-bold sm:text-2xl">Saisir une prestation</span>
              <span className="mt-1 block text-sm text-foreground/70 sm:text-base">
                Prestation pour un client (balles rondes, transport…) ou interne (mécanique).
              </span>
            </span>
            <span className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300">
              Pour un client ou interne <span aria-hidden>→</span>
            </span>
          </Link>
        </div>

        {/* Présence en cours — bandeau rouge si pointage ouvert */}
        {presenceCourante.data && (
          <Link
            href="/presences"
            className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-red-400 bg-red-50 p-4 text-sm transition-colors hover:border-red-600 hover:bg-red-100 active:scale-[0.99] dark:border-red-800 dark:bg-red-950/30"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white">
                <Timer className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-red-900 dark:text-red-200">
                  Présence en cours — {presenceCourante.data.type}
                </p>
                <p className="text-xs text-red-700/80 dark:text-red-300/80">
                  Pointe ta sortie quand tu as terminé.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white">
              ▶
            </span>
          </Link>
        )}

        {/* Résumé "Cette semaine" - 3 KPI cliquables */}
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
              className="rounded-xl border border-border bg-green/5 p-3 text-center transition-colors hover:border-green/50 hover:bg-green/10"
            >
              <div className="text-2xl font-bold text-green-dark sm:text-3xl">
                {interventionsSemaine.length}
              </div>
              <div className="mt-0.5 text-xs text-foreground/70">
                intervention{interventionsSemaine.length > 1 ? "s" : ""}
              </div>
            </Link>
            <Link
              href="/travaux"
              className="rounded-xl border border-border bg-violet-50 p-3 text-center transition-colors hover:border-violet-300 hover:bg-violet-100 dark:bg-violet-950/30 dark:hover:bg-violet-950/50"
            >
              <div className="text-2xl font-bold text-violet-700 sm:text-3xl dark:text-violet-300">
                {travauxSemaine.length}
              </div>
              <div className="mt-0.5 text-xs text-foreground/70">
                prestation{travauxSemaine.length > 1 ? "s" : ""}
              </div>
            </Link>
            <Link
              href="/mes-heures"
              className="rounded-xl border border-border bg-muted/30 p-3 text-center transition-colors hover:border-foreground/20 hover:bg-muted/60"
            >
              <div className="font-mono text-2xl font-bold tabular-nums sm:text-3xl">
                {heuresSemaineLabel}
              </div>
              <div className="mt-0.5 text-xs text-foreground/70">heures</div>
            </Link>
          </div>
        </section>

        {pendingCount > 0 && (
          <Link
            href="/interventions/pending"
            className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm transition-colors hover:border-amber-500 hover:bg-amber-100 active:scale-[0.99] dark:border-amber-800 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white">
                <ClipboardCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  {pendingCount} intervention{pendingCount > 1 ? "s" : ""} à valider
                </p>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                  Saisies par tes partenaires sur tes parcelles — accepte, refuse ou modifie.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-amber-500 px-3 py-1 text-sm font-bold text-white">
              {pendingCount}
            </span>
          </Link>
        )}

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
