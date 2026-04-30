"use client";

import { Clock, Pause as PauseIcon, Play, Square, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  formatDuree,
  type PresenceType,
  PRESENCE_TYPE_EMOJI,
  PRESENCE_TYPE_LABEL,
  PRESENCE_TYPES_ORDER,
  useClockIn,
  useClockOut,
  useCurrentPresence,
  useDeletePresence,
  useMesPresences,
} from "@/lib/presences";
import { useTravaux } from "@/lib/travaux";

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

export default function PresencesPage() {
  const current = useCurrentPresence();
  const { lundiIso, dimancheIso } = semaineCourante();
  const mes = useMesPresences({ dateDebut: lundiIso, dateFin: dimancheIso });
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const deletePresence = useDeletePresence();
  const travaux = useTravaux();

  const [type, setType] = useState<PresenceType>("CHANTIER");
  const [travailId, setTravailId] = useState("");

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
    clockIn.mutate({
      type,
      ...(travailId ? { travailId } : {}),
    });
  };

  const handleClockOut = () => {
    clockOut.mutate({});
  };

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/app" },
          { label: "Activités", href: "/activites" },
          { label: "Présences" },
        ]}
      />
      <div className="mx-auto max-w-3xl px-3 py-4 sm:py-8">
        <PageHeader
          title="Présences"
          icon={Clock}
          subtitle="Pointe ton entrée/sortie de chantier. Les heures sont reportées automatiquement sur la prestation liée."
        />

        {/* ----- Bouton géant clock-in ou clock-out ----- */}
        {current.isLoading ? (
          <div className="rounded-3xl border-2 border-dashed border-border p-10 text-center text-foreground/50">
            Chargement…
          </div>
        ) : current.data ? (
          <ClockOutCard
            type={current.data.type}
            dateDebut={current.data.dateDebut}
            elapsedMinutes={elapsedMinutes}
            travail={current.data.travail}
            isPending={clockOut.isPending}
            onClockOut={handleClockOut}
          />
        ) : (
          <ClockInCard
            type={type}
            onChangeType={setType}
            travailId={travailId}
            onChangeTravailId={setTravailId}
            travaux={travaux.data ?? []}
            isPending={clockIn.isPending}
            onClockIn={handleClockIn}
          />
        )}

        {/* ----- Récap semaine ----- */}
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
                  <span className="text-2xl">{PRESENCE_TYPE_EMOJI[p.type]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{PRESENCE_TYPE_LABEL[p.type]}</div>
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

interface ClockInCardProps {
  type: PresenceType;
  onChangeType: (t: PresenceType) => void;
  travailId: string;
  onChangeTravailId: (id: string) => void;
  travaux: Array<{ id: string; titre: string; date: string }>;
  isPending: boolean;
  onClockIn: () => void;
}

function ClockInCard({
  type,
  onChangeType,
  travailId,
  onChangeTravailId,
  travaux,
  isPending,
  onClockIn,
}: ClockInCardProps) {
  return (
    <section className="rounded-3xl border-2 border-green/30 bg-green/5 p-5 sm:p-7">
      <p className="text-sm text-foreground/70">Type de présence</p>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {PRESENCE_TYPES_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChangeType(t)}
            className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-all active:scale-95 ${
              type === t
                ? "border-green bg-green/10 font-medium"
                : "border-border bg-background hover:border-foreground/20"
            }`}
          >
            <span className="text-2xl">{PRESENCE_TYPE_EMOJI[t]}</span>
            <span className="text-xs">{PRESENCE_TYPE_LABEL[t]}</span>
          </button>
        ))}
      </div>

      {(type === "CHANTIER" || type === "DEPLACEMENT") && travaux.length > 0 && (
        <div className="mt-5">
          <p className="mb-1 text-sm text-foreground/70">Prestation liée (optionnel)</p>
          <select
            value={travailId}
            onChange={(e) => onChangeTravailId(e.target.value)}
            className="h-12 w-full rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
          >
            <option value="">— Aucune (à associer plus tard) —</option>
            {travaux.slice(0, 50).map((t) => (
              <option key={t.id} value={t.id}>
                {t.titre} — {new Date(t.date).toLocaleDateString("fr-CH")}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-foreground/50">
            Les heures seront reportées automatiquement sur cette prestation.
          </p>
        </div>
      )}

      <Button
        type="button"
        onClick={onClockIn}
        disabled={isPending}
        className="mt-6 h-16 w-full rounded-2xl bg-green text-lg font-bold hover:bg-green-dark"
      >
        <Play className="mr-2 h-6 w-6" />
        {isPending ? "Pointage…" : "Pointer entrée"}
      </Button>
    </section>
  );
}

interface ClockOutCardProps {
  type: PresenceType;
  dateDebut: string;
  elapsedMinutes: number;
  travail: { id: string; titre: string } | null;
  isPending: boolean;
  onClockOut: () => void;
}

function ClockOutCard({
  type,
  dateDebut,
  elapsedMinutes,
  travail,
  isPending,
  onClockOut,
}: ClockOutCardProps) {
  return (
    <section className="rounded-3xl border-2 border-amber-300/60 bg-amber-50 p-5 sm:p-7 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="flex items-start gap-4">
        <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white text-3xl shadow-md">
          {PRESENCE_TYPE_EMOJI[type]}
        </span>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-amber-800/80 dark:text-amber-300/80">
            En cours — {PRESENCE_TYPE_LABEL[type]}
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-amber-900 sm:text-4xl dark:text-amber-200">
            {formatDuree(elapsedMinutes)}
          </p>
          <p className="mt-0.5 text-xs text-foreground/70">
            Depuis{" "}
            {new Date(dateDebut).toLocaleTimeString("fr-CH", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          {travail && (
            <p className="mt-2 text-sm">
              📋 Prestation : <strong>{travail.titre}</strong>
            </p>
          )}
        </div>
      </div>

      <Button
        type="button"
        onClick={onClockOut}
        disabled={isPending}
        className="mt-6 h-16 w-full rounded-2xl bg-amber-600 text-lg font-bold hover:bg-amber-700"
      >
        <Square className="mr-2 h-6 w-6" />
        {isPending ? "Pointage…" : "Pointer sortie"}
      </Button>
    </section>
  );
}

void PauseIcon; // satisfy import (used in PRESENCE_TYPE_EMOJI map indirectly)
