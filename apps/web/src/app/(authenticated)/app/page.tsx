"use client";

import {
  CalendarDays,
  type LucideIcon,
  MapPin,
  Sprout,
  Tractor,
  TrendingUp,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useCurrentTenant, useCurrentUser } from "@/lib/auth";
import { useInterventions } from "@/lib/interventions";
import { useParcelles } from "@/lib/parcelles";
import { useTenantDetail } from "@/lib/tenants";
import { useMesHeures, useTravaux } from "@/lib/travaux";

function startOfWeek(): Date {
  const d = new Date();
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeekIso(): string {
  const d = startOfWeek();
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d.toISOString().slice(0, 10);
}

function formatHectares(m2: number): string {
  return (m2 / 10000).toLocaleString("fr-CH", { maximumFractionDigits: 1 });
}

export default function HomePage() {
  const tenant = useCurrentTenant();
  const me = useCurrentUser();
  const parcelles = useParcelles();
  const interventions = useInterventions();
  const travaux = useTravaux();
  const tenantDetail = useTenantDetail();
  const heuresWeek = useMesHeures({
    dateDebut: startOfWeek().toISOString().slice(0, 10),
    dateFin: endOfWeekIso(),
  });

  const prenom = me.data?.prenom ?? "agriculteur";

  // Stats
  const nbParcelles = parcelles.data?.length ?? 0;
  const totalSurfaceM2 = parcelles.data?.reduce((s, p) => s + Number(p.surfaceM2), 0) ?? 0;
  const minutesSemaine = heuresWeek.data?.reduce((s, l) => s + l.dureeMinutes, 0) ?? 0;

  // Résumé semaine compact (déplacé depuis /activites — décision 2026-05-05).
  const lundi = startOfWeek();
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);
  dimanche.setHours(23, 59, 59, 999);
  const carnetSemaine =
    interventions.data?.filter((iv) => {
      const d = new Date(iv.dateOperation);
      return d >= lundi && d <= dimanche;
    }).length ?? 0;
  const travauxSemaineList = (travaux.data ?? []).filter((t) => {
    const d = new Date(t.date);
    return d >= lundi && d <= dimanche;
  });
  const tiersSemaine = travauxSemaineList.filter((t) => !t.interne).length;
  const interneSemaine = travauxSemaineList.filter((t) => t.interne).length;

  // Vue Planning du dashboard (Fabien 2026-05-14, image 27) : items
  // ayant une datePrevue dans la fenêtre [maintenant ; +7 jours],
  // triés par date croissante, 5 premiers affichés.
  type PlanningPreview = {
    kind: "CARNET" | "TIERS" | "INTERNE";
    id: string;
    datePrevue: Date;
    titre: string;
    sousTitre: string;
    href: string;
  };
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 7);
  horizon.setHours(23, 59, 59, 999);
  const planningItems: PlanningPreview[] = [
    ...(interventions.data ?? [])
      .filter((iv) => iv.datePrevue)
      .map((iv) => {
        const d = new Date(iv.datePrevue as unknown as string);
        return {
          kind: "CARNET" as const,
          id: iv.id,
          datePrevue: d,
          titre: iv.type,
          sousTitre: `${iv.parcelle?.nom ?? "—"}${iv.produit ? ` · ${iv.produit}` : ""}`,
          href: `/interventions/new?edit=${iv.id}`,
        };
      }),
    ...(travaux.data ?? [])
      .filter((t) => t.datePrevue)
      .map((t) => {
        const d = new Date(t.datePrevue as unknown as string);
        return {
          kind: t.interne ? ("INTERNE" as const) : ("TIERS" as const),
          id: t.id,
          datePrevue: d,
          titre: t.titre,
          sousTitre: t.partenaire?.nom ?? (t.interne ? "Interne" : "—"),
          href: `/travaux/new?edit=${t.id}`,
        };
      }),
  ]
    .filter((it) => it.datePrevue >= now && it.datePrevue <= horizon)
    .sort((a, b) => a.datePrevue.getTime() - b.datePrevue.getTime())
    .slice(0, 5);
  const heuresLabel = `${Math.floor(minutesSemaine / 60)}h${String(minutesSemaine % 60).padStart(2, "0")}`;
  const showHours =
    tenantDetail.data?.heuresVisiblesCarnet !== false ||
    tenantDetail.data?.heuresVisiblesTravauxTiers !== false ||
    tenantDetail.data?.heuresVisiblesTravauxInterne !== false;

  return (
    <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">Bonjour {prenom} 👋</h1>
        <p className="mt-1 text-sm text-foreground/70">
          {tenant.data?.nom ? `${tenant.data.nom} · ` : ""}aperçu rapide de ton exploitation
        </p>
      </header>

      {/* Résumé activités de la semaine (déplacé depuis /activites). */}
      <section className="mb-6 rounded-2xl border border-border bg-background p-3 sm:p-4">
        <header className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-foreground/60" />
            <h2 className="text-sm font-semibold">Activités de la semaine</h2>
          </div>
          <span className="text-[11px] text-foreground/50">
            {lundi.toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit" })} →{" "}
            {dimanche.toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit" })}
          </span>
        </header>
        <div className={`grid gap-2 ${showHours ? "grid-cols-4" : "grid-cols-3"}`}>
          <SemKpi label="Carnet" value={carnetSemaine} dotClass="bg-emerald-500" />
          <SemKpi label="Tiers" value={tiersSemaine} dotClass="bg-purple-500" />
          <SemKpi label="Interne" value={interneSemaine} dotClass="bg-sky-500" />
          {showHours && (
            <Link
              href="/mes-heures"
              className="rounded-xl border border-border bg-background p-2.5 text-center transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center justify-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-[10px] font-medium uppercase tracking-wide text-foreground/60">
                  Heures
                </span>
              </div>
              <div className="mt-1 font-mono text-xl font-bold tabular-nums text-foreground sm:text-2xl">
                {heuresLabel}
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* Section : Statistiques clés */}
      {/* Section "Vue d'ensemble" retirée 2026-05-14 (image 34) : faisait
          doublon avec "Activités de la semaine" (heures, carnet, tiers
          partagent les mêmes chiffres). Seule la card Parcelles n'était
          pas couverte → on la remet ailleurs ci-dessous, en compact. */}
      <section className="mb-8">
        <StatCard
          href="/parcelles"
          icon={MapPin}
          label="Parcelles"
          value={nbParcelles.toString()}
          sub={totalSurfaceM2 > 0 ? `${formatHectares(totalSurfaceM2)} ha au total` : undefined}
          color="bg-emerald-50 text-emerald-700"
        />
      </section>

      {/* Section : Planning des prochains jours (Fabien 2026-05-14, image 27) */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
            Planning des 7 prochains jours
          </h2>
          <Link href="/planning" className="text-xs font-medium text-green hover:underline">
            Voir tout →
          </Link>
        </div>
        <div className="rounded-2xl border border-border bg-background">
          {planningItems.length > 0 ? (
            <ul className="divide-y divide-border">
              {planningItems.map((it) => {
                const Icon = it.kind === "CARNET" ? Sprout : it.kind === "TIERS" ? Tractor : Wrench;
                const iconColor =
                  it.kind === "CARNET"
                    ? "bg-emerald-50 text-emerald-700"
                    : it.kind === "TIERS"
                      ? "bg-purple-50 text-purple-700"
                      : "bg-sky-50 text-sky-700";
                return (
                  <li key={`${it.kind}-${it.id}`}>
                    <Link
                      href={it.href as Route}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                    >
                      <span
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${iconColor}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{it.titre}</p>
                        <p className="truncate text-xs text-foreground/50">{it.sousTitre}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium text-foreground/70">
                          {it.datePrevue.toLocaleDateString("fr-CH", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                          })}
                        </p>
                        <p className="font-mono text-xs text-foreground/50">
                          {it.datePrevue.toLocaleTimeString("fr-CH", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="flex items-center justify-center gap-2 p-6 text-center text-sm text-foreground/50">
              <CalendarDays className="h-4 w-4" />
              Rien de planifié sur les 7 prochains jours.
            </p>
          )}
        </div>
      </section>

      {/* Section : Dernières interventions */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
            Dernières interventions
          </h2>
          <Link href="/activites" className="text-xs font-medium text-green hover:underline">
            Voir tout →
          </Link>
        </div>
        <div className="rounded-2xl border border-border bg-background">
          {interventions.isLoading ? (
            <p className="p-4 text-sm text-foreground/50">Chargement…</p>
          ) : interventions.data && interventions.data.length > 0 ? (
            <ul className="divide-y divide-border">
              {interventions.data.slice(0, 4).map((iv) => (
                <li key={iv.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-green/10 text-lg">
                    🌱
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {iv.type}
                      {iv.produit && (
                        <span className="ml-1 font-normal text-foreground/60">· {iv.produit}</span>
                      )}
                    </p>
                    <p className="text-xs text-foreground/50">
                      {iv.parcelle?.nom ?? "—"} ·{" "}
                      {new Date(iv.dateOperation).toLocaleDateString("fr-CH")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-center text-sm text-foreground/50">
              Aucune intervention. Saisis-en une avec le bouton + ↘
            </p>
          )}
        </div>
      </section>

      {/* Section : Derniers travaux pour tiers */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
            Travaux pour tiers récents
          </h2>
          <Link href="/travaux" className="text-xs font-medium text-green hover:underline">
            Voir tout →
          </Link>
        </div>
        <div className="rounded-2xl border border-border bg-background">
          {travaux.isLoading ? (
            <p className="p-4 text-sm text-foreground/50">Chargement…</p>
          ) : travaux.data && travaux.data.length > 0 ? (
            <ul className="divide-y divide-border">
              {travaux.data.slice(0, 4).map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <Tractor className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {t.titre}
                      {t.interne && (
                        <span className="ml-2 rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                          interne
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-foreground/50">
                      {t.partenaire?.nom ?? "Sans client"} ·{" "}
                      {new Date(t.date).toLocaleDateString("fr-CH")}
                    </p>
                  </div>
                  <span className="text-xs text-foreground/60">{t.statut}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-center text-sm text-foreground/50">
              Aucun travail saisi pour l'instant.
            </p>
          )}
        </div>
      </section>

      <p className="mt-8 flex items-center gap-2 text-xs text-foreground/40">
        <TrendingUp className="h-3.5 w-3.5" />
        Astuce : le bouton <span className="font-bold text-green">+</span> en bas à droite ouvre les
        actions rapides de la page courante.
      </p>
    </div>
  );
}

function SemKpi({ label, value, dotClass }: { label: string; value: number; dotClass: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-2.5 text-center">
      <div className="flex items-center justify-center gap-1.5">
        <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
        <span className="text-[10px] font-medium uppercase tracking-wide text-foreground/60">
          {label}
        </span>
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums text-foreground sm:text-2xl">{value}</div>
    </div>
  );
}

function StatCard({
  href,
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  href: Route;
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string | undefined;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-2xl border border-border bg-background p-4 transition-all hover:border-foreground/20 hover:shadow-md active:scale-[0.98]"
    >
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-xs uppercase tracking-wide text-foreground/50">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-foreground/50">{sub}</p>}
      </div>
    </Link>
  );
}
