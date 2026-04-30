"use client";

import { Briefcase, Clock, Sprout } from "lucide-react";
import Link from "next/link";
import { Breadcrumb } from "@/components/app/breadcrumb";

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
export default function ActivitesPage() {
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
              <span className="block text-xl font-bold sm:text-2xl">Saisir un travail</span>
              <span className="mt-1 block text-sm text-foreground/70 sm:text-base">
                Prestation pour un client (balles rondes, transport…) ou interne (mécanique).
              </span>
            </span>
            <span className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300">
              Pour un client ou interne <span aria-hidden>→</span>
            </span>
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
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
