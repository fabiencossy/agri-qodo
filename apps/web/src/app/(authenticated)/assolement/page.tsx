"use client";

import { Sprout } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { type InterventionWithGeom, useInterventionsWithGeom } from "@/lib/interventions";
import { formatSurface, useParcellesMap } from "@/lib/parcelles";

const AssolementMap = dynamic(() => import("@/components/maps/assolement-map"), {
  ssr: false,
  loading: () => <div className="h-[600px] animate-pulse rounded-xl bg-muted" />,
});

/**
 * Palette de couleurs stable pour les espèces. La même espèce = la même
 * couleur d'une session à l'autre, indépendamment de l'ordre d'arrivée
 * (hash déterministe). Permet de comparer 2 campagnes sans surprise visuelle.
 */
function colorForEspece(espece: string): string {
  const palette = [
    "#22C55E", // vert
    "#F59E0B", // ambre
    "#3B82F6", // bleu
    "#EC4899", // rose
    "#8B5CF6", // violet
    "#EF4444", // rouge
    "#06B6D4", // cyan
    "#84CC16", // lime
    "#F97316", // orange
    "#A855F7", // pourpre
    "#14B8A6", // teal
    "#EAB308", // jaune
  ];
  let h = 0;
  for (let i = 0; i < espece.length; i++) {
    h = (h * 31 + espece.charCodeAt(i)) >>> 0;
  }
  return palette[h % palette.length] ?? "#1565C0";
}

const currentYear = new Date().getUTCFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

export default function AssolementPage() {
  const [campagne, setCampagne] = useState<number>(currentYear);
  const parcelles = useParcellesMap();
  const interventions = useInterventionsWithGeom({ campagne });

  const semis = useMemo<InterventionWithGeom[]>(
    () => (interventions.data ?? []).filter((i) => i.type === "SEMIS" && i.geom),
    [interventions.data],
  );

  // Stats par espèce : surface totale + % de la SAU couverte.
  const stats = useMemo(() => {
    const map = new Map<string, { surfaceM2: number; nbZones: number }>();
    for (const i of semis) {
      const espece = i.culture?.espece ?? "Inconnu";
      const surface = i.surfaceTravailleeM2 ? Number(i.surfaceTravailleeM2) : 0;
      const cur = map.get(espece) ?? { surfaceM2: 0, nbZones: 0 };
      cur.surfaceM2 += surface;
      cur.nbZones += 1;
      map.set(espece, cur);
    }
    const totalM2 = Array.from(map.values()).reduce((s, v) => s + v.surfaceM2, 0);
    return Array.from(map.entries())
      .map(([espece, v]) => ({
        espece,
        surfaceM2: v.surfaceM2,
        nbZones: v.nbZones,
        pourcent: totalM2 > 0 ? (v.surfaceM2 / totalM2) * 100 : 0,
        couleur: colorForEspece(espece),
      }))
      .sort((a, b) => b.surfaceM2 - a.surfaceM2);
  }, [semis]);

  const sauTotaleM2 = useMemo(
    () => (parcelles.data ?? []).reduce((s, p) => s + Number(p.surfaceM2), 0),
    [parcelles.data],
  );
  const surfaceCouverteM2 = stats.reduce((s, v) => s + v.surfaceM2, 0);
  const tauxCouverture = sauTotaleM2 > 0 ? (surfaceCouverteM2 / sauTotaleM2) * 100 : 0;

  const colorByEspece = useMemo<Record<string, string>>(
    () => Object.fromEntries(stats.map((s) => [s.espece, s.couleur])),
    [stats],
  );

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Plan d'assolement" }]} />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <Sprout className="h-7 w-7 text-green" />
              Plan d'assolement {campagne}
            </h1>
            <p className="mt-1 text-foreground/70">
              Vue spatiale des cultures dérivée de tes interventions SEMIS de la campagne. Découpe
              une parcelle en plusieurs zones en saisissant des SEMIS distincts avec leur propre
              tracé.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Campagne :</label>
            <select
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
              value={campagne}
              onChange={(e) => setCampagne(Number(e.target.value))}
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {parcelles.isLoading || interventions.isLoading ? (
              <div className="h-[600px] animate-pulse rounded-xl bg-muted" />
            ) : (parcelles.data?.length ?? 0) === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
                <p className="text-foreground/60">
                  Aucune parcelle. Commence par{" "}
                  <Link href="/parcelles/new" className="text-green underline">
                    importer ou créer tes parcelles
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <AssolementMap
                parcelles={parcelles.data ?? []}
                interventions={semis}
                colorByEspece={colorByEspece}
              />
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-border bg-background p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
                SAU couverte
              </h2>
              <p className="mt-2 text-3xl font-bold">
                {tauxCouverture.toFixed(0)}
                <span className="text-lg text-foreground/60">%</span>
              </p>
              <p className="mt-1 text-xs text-foreground/60">
                {formatSurface(surfaceCouverteM2)} sur {formatSurface(sauTotaleM2)}
              </p>
              {tauxCouverture < 100 && sauTotaleM2 > 0 && (
                <p className="mt-2 rounded-lg border border-amber-300 bg-amber-100 px-2.5 py-1.5 text-xs text-amber-950">
                  Pour qu'une parcelle apparaisse colorée, saisis un SEMIS avec sa zone tracée (mode
                  "Dessiner sur la carte").
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-background p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/60">
                Cultures
              </h2>
              {stats.length === 0 ? (
                <p className="text-xs text-foreground/60">Aucune zone semée pour {campagne}.</p>
              ) : (
                <ul className="space-y-2">
                  {stats.map((s) => (
                    <li key={s.espece} className="flex items-center gap-2 text-sm">
                      <span
                        aria-hidden
                        className="h-3 w-3 rounded-sm border border-foreground/20"
                        style={{ backgroundColor: s.couleur }}
                      />
                      <span className="flex-1 truncate font-medium">{s.espece}</span>
                      <span className="text-xs text-foreground/60">
                        {formatSurface(s.surfaceM2)} · {s.pourcent.toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-border bg-background p-4 text-xs text-foreground/70">
              <p className="font-medium text-foreground">Comment compléter la carte ?</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>
                  Va dans{" "}
                  <Link href="/interventions/new" className="text-green underline">
                    Nouvelle intervention
                  </Link>
                  .
                </li>
                <li>Type = SEMIS, choisis une parcelle.</li>
                <li>Décoche "Toute la parcelle" → "Dessiner sur la carte".</li>
                <li>Trace la zone semée → la culture apparaît ici.</li>
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
