"use client";

import { ClipboardCheck, Sprout, Timer, Tractor, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  buildInterventionColumns,
  interventionFilters,
  interventionGroupBys,
  interventionSearchFields,
  renderInterventionCard,
  sortInterventionsPendingFirst,
} from "@/components/activites/intervention-resource-config";
import {
  renderTravailCard,
  travailColumns,
  travailFilters,
  travailGroupBys,
  travailSearchFields,
} from "@/components/activites/travail-resource-config";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { ResourceView } from "@/components/ui/resource-view";
import {
  type Intervention,
  libelleType,
  useDeleteIntervention,
  useInterventions,
  useInterventionsPending,
  useRejectIntervention,
  useValidateIntervention,
} from "@/lib/interventions";
import { useCurrentPresence } from "@/lib/presences";
import { type Travail, useMesHeures, useTravaux } from "@/lib/travaux";

type Onglet = "interventions" | "travaux-tiers";

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

/**
 * Hub Activités — toggle Carnet/Travaux pour tiers en haut + ResourceView
 * complet (recherche unifiée, filtres, 3 vues Cartes/Liste/Kanban,
 * regroupement). Création via le FAB "+" en bas à droite (déjà global).
 * Affiche les notifications (présence en cours, PENDING) et le résumé
 * hebdo en pied.
 */
export default function ActivitesPage() {
  const router = useRouter();
  const [onglet, setOnglet] = useState<Onglet>("interventions");

  const interventions = useInterventions();
  const travaux = useTravaux();
  const pending = useInterventionsPending();
  const presenceCourante = useCurrentPresence();
  const validateMut = useValidateIntervention();
  const rejectMut = useRejectIntervention();
  const deleteMut = useDeleteIntervention();

  const { lundi, dimanche, lundiIso, dimancheIso } = semaineCourante();
  const heures = useMesHeures({ dateDebut: lundiIso, dateFin: dimancheIso });

  const interventionsSorted = useMemo(
    () => sortInterventionsPendingFirst(interventions.data ?? []),
    [interventions.data],
  );

  const interventionsSemaine = useMemo(
    () =>
      (interventions.data ?? []).filter((i) => {
        const d = new Date(i.dateOperation);
        return d >= lundi && d <= dimanche;
      }),
    [interventions.data, lundi, dimanche],
  );
  const travauxSemaine = useMemo(
    () =>
      (travaux.data ?? []).filter((t) => {
        const d = new Date(t.date);
        return d >= lundi && d <= dimanche;
      }),
    [travaux.data, lundi, dimanche],
  );
  const minutesSemaine = (heures.data ?? []).reduce((sum, h) => sum + h.dureeMinutes, 0);
  const heuresSemaineLabel = `${Math.floor(minutesSemaine / 60)}h${String(minutesSemaine % 60).padStart(2, "0")}`;

  const pendingCount = pending.data?.length ?? 0;

  const isMutating = validateMut.isPending || rejectMut.isPending || deleteMut.isPending;

  const interventionColumns = useMemo(
    () =>
      buildInterventionColumns({
        onValidate: (id) => validateMut.mutate(id),
        onReject: (id) => {
          const reason = prompt("Raison du refus (optionnel) :");
          if (reason === null) return;
          rejectMut.mutate(reason.trim() ? { id, reason: reason.trim() } : { id });
        },
        onDelete: (iv) => {
          if (!confirm(`Supprimer cette ${libelleType(iv.type).toLowerCase()} ?`)) return;
          deleteMut.mutate(iv.id);
        },
        isMutating,
      }),
    [validateMut, rejectMut, deleteMut, isMutating],
  );

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Activités" }]} />
      <div className="mx-auto max-w-5xl px-3 py-4 sm:py-8">
        <header className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">Activités</h1>
        </header>

        {/* Toggle Carnet / Travaux pour tiers */}
        <div className="mb-4 inline-flex w-full rounded-xl border border-border bg-muted/30 p-1 sm:w-auto">
          <button
            type="button"
            onClick={() => setOnglet("interventions")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none sm:px-6 ${
              onglet === "interventions"
                ? "bg-background text-foreground shadow-sm"
                : "text-foreground/60 hover:text-foreground/80"
            }`}
          >
            <Sprout className="h-4 w-4" />
            Carnet des champs
          </button>
          <button
            type="button"
            onClick={() => setOnglet("travaux-tiers")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none sm:px-6 ${
              onglet === "travaux-tiers"
                ? "bg-background text-foreground shadow-sm"
                : "text-foreground/60 hover:text-foreground/80"
            }`}
          >
            <Tractor className="h-4 w-4" />
            Travaux pour tiers
          </button>
        </div>

        {/* Notifications discrètes */}
        {presenceCourante.data && (
          <Link
            href="/presences"
            className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 text-sm transition-colors hover:bg-muted/30"
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

        {pendingCount > 0 && onglet === "interventions" && (
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-100 p-3 text-sm">
            <ClipboardCheck className="h-4 w-4 text-amber-700" />
            <span className="text-amber-950">
              <strong>
                {pendingCount} intervention{pendingCount > 1 ? "s" : ""}
              </strong>{" "}
              à valider — épinglées en haut de la liste ci-dessous.
            </span>
          </div>
        )}

        {/* ResourceView de l'onglet sélectionné */}
        {onglet === "interventions" ? (
          <ResourceView<Intervention>
            storageKey="activites-carnet"
            defaultView="card"
            data={interventionsSorted}
            columns={interventionColumns}
            renderCard={renderInterventionCard}
            renderKanbanCard={renderInterventionCard}
            getKey={(iv) => iv.id}
            onItemClick={(iv) => router.push(`/interventions/${iv.id}` as never)}
            searchFields={interventionSearchFields}
            searchPlaceholder="Rechercher type, parcelle, produit, culture, notes…"
            filters={interventionFilters}
            groupBys={interventionGroupBys}
            emptyState={
              <div>
                <Sprout className="mx-auto mb-2 h-10 w-10 text-foreground/30" />
                <p className="text-sm text-foreground/60">Aucune intervention pour l'instant.</p>
                <p className="mt-1 text-xs text-foreground/50">
                  Tape sur le bouton + en bas à droite pour commencer.
                </p>
              </div>
            }
          />
        ) : (
          <ResourceView<Travail>
            storageKey="activites-travaux-tiers"
            defaultView="card"
            data={travaux.data ?? []}
            columns={travailColumns}
            renderCard={renderTravailCard}
            renderKanbanCard={renderTravailCard}
            getKey={(t) => t.id}
            onItemClick={(t) => router.push(`/travaux/${t.id}` as never)}
            searchFields={travailSearchFields}
            searchPlaceholder="Rechercher titre, client, parcelle…"
            filters={travailFilters}
            groupBys={travailGroupBys}
            emptyState={
              <div>
                <Tractor className="mx-auto mb-2 h-10 w-10 text-foreground/30" />
                <p className="text-sm text-foreground/60">
                  Aucun travail pour tiers pour l'instant.
                </p>
                <p className="mt-1 text-xs text-foreground/50">
                  Tape sur le bouton + en bas à droite pour commencer.
                </p>
              </div>
            }
          />
        )}

        {/* Résumé "Cette semaine" */}
        <section className="mt-8 rounded-2xl border border-border bg-background p-4 sm:p-5">
          <header className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-foreground/60" />
            <h2 className="text-base font-semibold">Cette semaine</h2>
            <span className="text-xs text-foreground/50">
              ({lundi.toLocaleDateString("fr-CH")} → {dimanche.toLocaleDateString("fr-CH")})
            </span>
          </header>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-background p-3 text-center">
              <div className="text-2xl font-bold sm:text-3xl">{interventionsSemaine.length}</div>
              <div className="mt-0.5 text-xs text-foreground/70">
                intervention{interventionsSemaine.length > 1 ? "s" : ""}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background p-3 text-center">
              <div className="text-2xl font-bold sm:text-3xl">{travauxSemaine.length}</div>
              <div className="mt-0.5 text-xs text-foreground/70">
                travail{travauxSemaine.length > 1 ? "s" : ""} pour tiers
              </div>
            </div>
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
      </div>
    </>
  );
}
