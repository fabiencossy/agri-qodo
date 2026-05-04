"use client";

/**
 * Page présences — un seul gros bouton Play/Stop + 3 champs Date / Heure
 * début / Heure fin avec saisie HHMM compact (qodo-clock-style).
 *
 * Le sélecteur "Travail pour tiers lié" a été supprimé (review 2026-05-04 :
 * "pas besoin de lier au travaux"). L'association heures→travail se fait
 * désormais en aval, dans /mes-heures ou côté Travail directement.
 *
 * Le `type` Presence n'est plus saisi côté UI : on utilise toujours
 * "CHANTIER" par défaut. Le champ reste en DB pour rétrocompat.
 */

import { Clock, Play, Square, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { PageHeader } from "@/components/app/page-header";
import { HhmmTimeInput } from "@/components/ui/hhmm-time-input";
import { Input } from "@/components/ui/input";
import {
  formatDuree,
  PRESENCE_TYPE_LABEL,
  useClockIn,
  useClockOut,
  useCurrentPresence,
  useDeletePresence,
  useMesPresences,
} from "@/lib/presences";

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
    lundiIso: lundi.toISOString().slice(0, 10),
    dimancheIso: dimanche.toISOString().slice(0, 10),
  };
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function combineDateTime(date: string, time: string): string | null {
  if (!date || !time) return null;
  const iso = `${date}T${time}:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function PresencesPage() {
  const current = useCurrentPresence();
  const { lundiIso, dimancheIso } = semaineCourante();
  const mes = useMesPresences({ dateDebut: lundiIso, dateFin: dimancheIso });
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const deletePresence = useDeletePresence();

  // Champs éditables pré-pointage. Default = maintenant — l'utilisateur
  // peut les modifier pour saisir une présence rétroactive.
  const [date, setDate] = useState(todayDate());
  const [heureDebut, setHeureDebut] = useState(nowTime());
  const [heureFin, setHeureFin] = useState("");

  // Quand une présence ouvre, on synchronise les champs avec ses valeurs
  // pour permettre l'édition de l'heure de fin avant le clock-out.
  useEffect(() => {
    if (current.data) {
      const d = new Date(current.data.dateDebut);
      setDate(d.toISOString().slice(0, 10));
      setHeureDebut(
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      );
    }
  }, [current.data]);

  // Timer live pour la présence ouverte (mise à jour chaque seconde).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!current.data) return;
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, [current.data]);

  const elapsedMinutes = current.data
    ? Math.max(0, Math.floor((now - new Date(current.data.dateDebut).getTime()) / 60000))
    : 0;

  const totalMinutesSemaine = (mes.data ?? [])
    .filter((p) => p.dureeMinutes !== null)
    .reduce((sum, p) => sum + (p.dureeMinutes ?? 0), 0);

  const handleClockIn = () => {
    const dateDebut = combineDateTime(date, heureDebut);
    clockIn.mutate({
      type: "CHANTIER",
      ...(dateDebut ? { dateDebut } : {}),
    });
  };

  const handleClockOut = () => {
    const dateFin = combineDateTime(date, heureFin);
    clockOut.mutate({
      ...(dateFin ? { dateFin } : {}),
    });
  };

  const isOpen = !!current.data;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/app" },
          { label: "Activités", href: "/activites" },
          { label: "Présences" },
        ]}
      />
      <div className="mx-auto max-w-2xl px-3 py-4 sm:py-8">
        <PageHeader
          title="Présences"
          icon={Clock}
          subtitle="Un clic Play, un clic Stop. Tape 720 pour 7h20, 7 pour 7h pile."
        />

        {current.isLoading ? (
          <div className="rounded-3xl border-2 border-dashed border-border p-10 text-center text-foreground/50">
            Chargement…
          </div>
        ) : (
          <section
            className={`rounded-3xl border-2 p-6 sm:p-8 ${
              isOpen ? "border-amber-300/60 bg-amber-50" : "border-green/30 bg-green/5"
            }`}
          >
            {/* Bouton Play/Stop centré */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={isOpen ? handleClockOut : handleClockIn}
                disabled={clockIn.isPending || clockOut.isPending}
                aria-label={isOpen ? "Arrêter le pointage" : "Démarrer le pointage"}
                className={`flex h-32 w-32 items-center justify-center rounded-full text-white shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50 sm:h-40 sm:w-40 ${
                  isOpen ? "bg-red-600 hover:bg-red-700" : "bg-green hover:bg-green-dark"
                }`}
              >
                {isOpen ? (
                  <Square className="h-14 w-14 sm:h-16 sm:w-16" fill="currentColor" />
                ) : (
                  <Play className="h-14 w-14 sm:h-16 sm:w-16" fill="currentColor" />
                )}
              </button>
              <p
                className={`mt-3 text-center text-base font-semibold ${
                  isOpen ? "text-amber-900" : "text-foreground/80"
                }`}
              >
                {isOpen
                  ? clockOut.isPending
                    ? "Arrêt…"
                    : "Pointage en cours"
                  : clockIn.isPending
                    ? "Démarrage…"
                    : "Démarrer le pointage"}
              </p>
              {isOpen && current.data && (
                <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-amber-900 sm:text-4xl">
                  {formatDuree(elapsedMinutes)}
                </p>
              )}
            </div>

            {/* 3 champs Date / Heure début / Heure fin avec HHMM compact */}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-foreground/70">Date</span>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={isOpen}
                  className="h-12 w-full"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-foreground/70">Heure de début</span>
                <HhmmTimeInput
                  value={heureDebut}
                  onChange={setHeureDebut}
                  disabled={isOpen}
                  ariaLabel="Heure de début"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-foreground/70">Heure de fin</span>
                <HhmmTimeInput value={heureFin} onChange={setHeureFin} ariaLabel="Heure de fin" />
              </label>
            </div>

            {isOpen && current.data?.travail && (
              <p className="mt-4 text-center text-sm">
                🚜 Travail pour tiers : <strong>{current.data.travail.titre}</strong>
              </p>
            )}
          </section>
        )}

        {/* Récap semaine */}
        <section className="mt-8 rounded-2xl border border-border bg-background p-4 sm:p-5">
          <header className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Cette semaine</h2>
            <span className="font-mono text-lg font-bold tabular-nums">
              {formatDuree(totalMinutesSemaine)}
            </span>
          </header>
          {mes.data && mes.data.length === 0 ? (
            <p className="text-sm text-foreground/60">Aucune présence cette semaine.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(mes.data ?? []).map((p) => (
                <li key={p.id} className="flex items-start gap-3 py-3">
                  <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground/40" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{PRESENCE_TYPE_LABEL[p.type]}</div>
                    <div className="text-xs text-foreground/60">
                      {new Date(p.dateDebut).toLocaleString("fr-CH", {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {p.dateFin && (
                        <>
                          {" "}
                          →{" "}
                          {new Date(p.dateFin).toLocaleTimeString("fr-CH", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </>
                      )}
                    </div>
                    {p.travail && (
                      <div className="mt-0.5 text-xs text-foreground/70">
                        Lié à <strong>{p.travail.titre}</strong>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm tabular-nums">
                      {formatDuree(p.dureeMinutes)}
                    </span>
                    {!p.dateFin && (
                      <span className="rounded-full bg-green/10 px-2 py-0.5 text-xs font-medium text-green">
                        en cours
                      </span>
                    )}
                    {p.dateFin && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Supprimer cette présence ?")) deletePresence.mutate(p.id);
                        }}
                        className="text-foreground/40 hover:text-red-600"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
