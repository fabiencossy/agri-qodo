"use client";

import { Briefcase, ClipboardCheck, Sprout, Timer, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import {
  emojiType,
  formatDateFr,
  formatQuantite,
  libelleType,
  useInterventions,
  useInterventionsPending,
  useRejectIntervention,
  useValidateIntervention,
} from "@/lib/interventions";
import { useCurrentPresence } from "@/lib/presences";
import {
  formatCHF,
  formatDuree,
  STATUT_BADGE,
  STATUT_LABEL,
  totalTravailCHF,
  useMesHeures,
  useTravaux,
} from "@/lib/travaux";

type Onglet = "interventions" | "prestations";

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
 * Hub Activités — toggle Interventions/Prestations en haut + liste directe
 * de l'onglet sélectionné. Création via le FAB "+" en bas à droite (déjà
 * en place globalement). Affiche les notifications (présence, pending) et
 * le résumé hebdo en pied.
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

  const { lundi, dimanche, lundiIso, dimancheIso } = semaineCourante();
  const heures = useMesHeures({ dateDebut: lundiIso, dateFin: dimancheIso });

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

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Activités" }]} />
      <div className="mx-auto max-w-5xl px-3 py-4 sm:py-8">
        <header className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">Activités</h1>
        </header>

        {/* Toggle Interventions / Prestations */}
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
            onClick={() => setOnglet("prestations")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none sm:px-6 ${
              onglet === "prestations"
                ? "bg-background text-foreground shadow-sm"
                : "text-foreground/60 hover:text-foreground/80"
            }`}
          >
            <Briefcase className="h-4 w-4" />
            Prestations
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
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
            <ClipboardCheck className="h-4 w-4 text-amber-700" />
            <span>
              <strong>
                {pendingCount} intervention{pendingCount > 1 ? "s" : ""}
              </strong>{" "}
              à valider — repère le badge "à valider" dans la liste ci-dessous.
            </span>
          </div>
        )}

        {/* Liste de l'onglet sélectionné */}
        {onglet === "interventions" ? (
          <InterventionsList
            data={interventions.data ?? []}
            isLoading={interventions.isLoading}
            onValidate={(id) => validateMut.mutate(id)}
            onReject={(id) => {
              const reason = prompt("Raison du refus (optionnel) :");
              if (reason === null) return;
              rejectMut.mutate(reason.trim() ? { id, reason: reason.trim() } : { id });
            }}
            isPendingMutation={validateMut.isPending || rejectMut.isPending}
          />
        ) : (
          <PrestationsList
            data={travaux.data ?? []}
            isLoading={travaux.isLoading}
            onClick={(id) => router.push(`/travaux/${id}` as never)}
          />
        )}

        {/* Résumé "Cette semaine" - sobre et uniforme */}
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
                prestation{travauxSemaine.length > 1 ? "s" : ""}
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

/* ---------- Liste interventions (tableau-style) ---------- */

interface InterventionsListProps {
  data: ReturnType<typeof useInterventions>["data"] extends infer T
    ? T extends Array<infer U>
      ? U[]
      : never
    : never;
  isLoading: boolean;
  onValidate: (id: string) => void;
  onReject: (id: string) => void;
  isPendingMutation: boolean;
}

function InterventionsList({
  data,
  isLoading,
  onValidate,
  onReject,
  isPendingMutation,
}: InterventionsListProps) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((iv) =>
      [libelleType(iv.type), iv.parcelle.nom, iv.produit ?? "", iv.materielRef?.libelle ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [data, search]);

  if (isLoading) return <p className="text-sm text-foreground/60">Chargement…</p>;
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-foreground/60">
        <Sprout className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">Aucune intervention saisie pour l&apos;instant.</p>
        <p className="mt-1 text-xs">Tape sur le bouton + en bas à droite pour commencer.</p>
      </div>
    );
  }

  return (
    <>
      <input
        type="search"
        placeholder="Rechercher (type, parcelle, produit, matériel…)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
      />
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
        {filtered.map((iv) => {
          const quantite = formatQuantite(iv.quantite, iv.unite);
          const isPending = iv.validationStatus === "PENDING";
          return (
            <li key={iv.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-xl">
                {emojiType(iv.type)}
              </span>
              <Link
                href={`/interventions/${iv.id}/edit` as never}
                className="flex-1 min-w-0 hover:underline"
              >
                <div className="font-medium text-sm">
                  {libelleType(iv.type)}
                  {iv.produit && (
                    <span className="ml-2 font-normal text-foreground/70">· {iv.produit}</span>
                  )}
                  {isPending && (
                    <span className="ml-2 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                      à valider
                    </span>
                  )}
                </div>
                <div className="text-xs text-foreground/60">
                  {iv.parcelle.nom} · {formatDateFr(iv.dateOperation)}
                  {quantite && ` · ${quantite}`}
                </div>
              </Link>
              {isPending && (
                <div className="flex flex-shrink-0 gap-1">
                  <button
                    onClick={() => onValidate(iv.id)}
                    disabled={isPendingMutation}
                    className="rounded-md px-2 py-1 text-xs font-medium text-green hover:bg-green/10"
                    title="Accepter"
                  >
                    ✓ Accepter
                  </button>
                  <button
                    onClick={() => onReject(iv.id)}
                    disabled={isPendingMutation}
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    title="Refuser"
                  >
                    ✗
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/* ---------- Liste prestations (tableau-style) ---------- */

interface PrestationsListProps {
  data: ReturnType<typeof useTravaux>["data"] extends infer T
    ? T extends Array<infer U>
      ? U[]
      : never
    : never;
  isLoading: boolean;
  onClick: (id: string) => void;
}

function PrestationsList({ data, isLoading, onClick }: PrestationsListProps) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((t) =>
      [t.titre, t.partenaire?.nom ?? "", t.parcelle?.nom ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [data, search]);

  if (isLoading) return <p className="text-sm text-foreground/60">Chargement…</p>;
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-foreground/60">
        <Briefcase className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">Aucune prestation saisie pour l&apos;instant.</p>
        <p className="mt-1 text-xs">Tape sur le bouton + en bas à droite pour commencer.</p>
      </div>
    );
  }

  return (
    <>
      <input
        type="search"
        placeholder="Rechercher (titre, client, parcelle…)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
      />
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
        {filtered.map((t) => {
          const heuresMin = t.lignesHeure.reduce((s, l) => s + l.dureeMinutes, 0);
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onClick(t.id)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/30 sm:px-4 sm:py-3"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Briefcase className="h-4 w-4 text-foreground/60" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{t.titre}</span>
                    <span
                      className={`flex-shrink-0 rounded px-1.5 py-0.5 text-xs ${STATUT_BADGE[t.statut]}`}
                    >
                      {STATUT_LABEL[t.statut]}
                    </span>
                  </div>
                  <div className="text-xs text-foreground/60">
                    {new Date(t.date).toLocaleDateString("fr-CH")}
                    {t.partenaire && ` · ${t.partenaire.nom}`}
                    {t.parcelle && ` · ${t.parcelle.nom}`}
                    {t.lignesProduit.length > 0 &&
                      ` · ${t.lignesProduit.length} produit${t.lignesProduit.length > 1 ? "s" : ""}`}
                    {heuresMin > 0 && ` · ${formatDuree(heuresMin)}`}
                  </div>
                </div>
                <span className="flex-shrink-0 font-mono text-sm font-medium tabular-nums">
                  {formatCHF(totalTravailCHF(t))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
