"use client";

import {
  Beef,
  Briefcase,
  ClipboardList,
  Clock,
  type LucideIcon,
  MapPin,
  Sprout,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useCurrentTenant, useCurrentUser } from "@/lib/auth";
import { useUgb } from "@/lib/animaux";
import { useInterventions } from "@/lib/interventions";
import { useParcelles } from "@/lib/parcelles";
import { useMesHeures, useTravaux } from "@/lib/travaux";

function nbDays(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

function startOfWeek(): Date {
  const d = new Date();
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatDuree(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function formatHectares(m2: number): string {
  return (m2 / 10000).toLocaleString("fr-CH", { maximumFractionDigits: 1 });
}

export default function HomePage() {
  const tenant = useCurrentTenant();
  const me = useCurrentUser();
  const parcelles = useParcelles();
  const interventions = useInterventions();
  const ugb = useUgb();
  const travaux = useTravaux();
  const heuresWeek = useMesHeures({ dateDebut: startOfWeek().toISOString() });

  const prenom = me.data?.prenom ?? "agriculteur";

  // Stats
  const nbParcelles = parcelles.data?.length ?? 0;
  const totalSurfaceM2 = parcelles.data?.reduce((s, p) => s + Number(p.surfaceM2), 0) ?? 0;
  const nbInterventions7j =
    interventions.data?.filter((iv) => nbDays(new Date(iv.dateOperation), new Date()) <= 7)
      .length ?? 0;
  const totalUgb = ugb.data?.total ?? 0;
  const nbTravaux30j = travaux.data?.filter((t) => new Date(t.date) >= startOfMonth()).length ?? 0;
  const minutesSemaine = heuresWeek.data?.reduce((s, l) => s + l.dureeMinutes, 0) ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">Bonjour {prenom} 👋</h1>
        <p className="mt-1 text-sm text-foreground/70">
          {tenant.data?.nom ? `${tenant.data.nom} · ` : ""}aperçu rapide de ton exploitation
        </p>
      </header>

      {/* Section : Statistiques clés */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/50">
          Cette semaine
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard
            href="/parcelles"
            icon={MapPin}
            label="Parcelles"
            value={nbParcelles.toString()}
            sub={totalSurfaceM2 > 0 ? `${formatHectares(totalSurfaceM2)} ha au total` : undefined}
            color="bg-emerald-50 text-emerald-700"
          />
          <StatCard
            href="/interventions"
            icon={Sprout}
            label="Interventions 7j"
            value={nbInterventions7j.toString()}
            sub={nbInterventions7j === 0 ? "Rien saisi cette semaine" : `derniers 7 jours`}
            color="bg-green-50 text-green-700"
          />
          <StatCard
            href="/animaux"
            icon={Beef}
            label="UGB total"
            value={totalUgb.toFixed(1)}
            sub="Annexe 1 OPD-CH-2026"
            color="bg-amber-50 text-amber-700"
          />
          <StatCard
            href="/travaux"
            icon={Briefcase}
            label="Travaux ce mois"
            value={nbTravaux30j.toString()}
            sub={nbTravaux30j === 0 ? "Aucun travail saisi" : "ce mois-ci"}
            color="bg-violet-50 text-violet-700"
          />
          <StatCard
            href="/mes-heures"
            icon={Clock}
            label="Mes heures (sem.)"
            value={minutesSemaine > 0 ? formatDuree(minutesSemaine) : "0h"}
            sub="lundi → dimanche"
            color="bg-indigo-50 text-indigo-700"
          />
          <StatCard
            href="/srpa"
            icon={ClipboardList}
            label="SRPA"
            value="Voir"
            sub="Journal pâturage"
            color="bg-sky-50 text-sky-700"
          />
        </div>
      </section>

      {/* Section : Dernières interventions */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
            Dernières interventions
          </h2>
          <Link href="/interventions" className="text-xs font-medium text-green hover:underline">
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

      {/* Section : Derniers travaux */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
            Travaux récents
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
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                    <Briefcase className="h-4 w-4" />
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
