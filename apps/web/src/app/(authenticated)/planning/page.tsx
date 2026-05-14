"use client";

/**
 * Sprint 2 fusion-interventions — page /planning.
 *
 * Liste les travaux + interventions ayant une `datePrevue` non null,
 * groupés par jour (chronologique). Permet de filtrer par employé
 * assigné. Chaque carte ouvre le formulaire en mode édition pour saisir
 * les heures réelles. Bouton "Marquer comme terminé" si le statut le
 * permet (OWNER → VALIDATED direct, EMPLOYE → PENDING_REVIEW).
 */
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Leaf,
  Loader2,
  MapPin,
  Plus,
  Sprout,
  Tractor,
  User as UserIcon,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { useCurrentUser } from "@/lib/auth";
import { useInterventions } from "@/lib/interventions";
import {
  STATUT_BADGE,
  STATUT_LABEL,
  type TravailStatut,
  useCompleteTravail,
  useTravaux,
} from "@/lib/travaux";
import { useUsers } from "@/lib/users";

type PlanningKind = "CARNET" | "TIERS" | "INTERNE";

interface PlanningItem {
  kind: PlanningKind;
  id: string;
  datePrevue: Date;
  titre: string;
  /** "Chez Y" pour les travaux tiers, null sinon. */
  client: string | null;
  /** Nom de la parcelle si renseignée. */
  parcelle: string | null;
  /** Produit (semence/engrais/phyto) pour les interventions du carnet. */
  produit: string | null;
  assignedToUserId: string | null;
  assignedToLabel: string | null;
  href: Route;
  /** Pour Travail uniquement (Carnet n'a pas de bouton Marquer terminé V1). */
  travailStatut: TravailStatut | null;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatJour(d: Date): string {
  const today = startOfDay(new Date());
  const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff === -1) return "Hier";
  return d.toLocaleDateString("fr-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

const KIND_META: Record<PlanningKind, { label: string; Icon: typeof Sprout; color: string }> = {
  CARNET: { label: "Carnet", Icon: Sprout, color: "text-emerald-600" },
  TIERS: { label: "Tiers", Icon: Tractor, color: "text-purple-600" },
  INTERNE: { label: "Interne", Icon: Wrench, color: "text-sky-600" },
};

export default function PlanningPage() {
  const me = useCurrentUser();
  const interventions = useInterventions();
  const travaux = useTravaux();
  const users = useUsers();
  const completeTravail = useCompleteTravail();

  // Filtre par employé assigné (null = tous, "me" = moi).
  // Décision Fabien 2026-05-14 : par défaut on affiche toute l'équipe
  // (avant : "me"). L'utilisateur bascule sur "Mes assignations" si besoin.
  const [filtreEmploye, setFiltreEmploye] = useState<string | "all" | "me">("all");
  // Décalage de jours par rapport à aujourd'hui pour la navigation.
  const [jourOffset, setJourOffset] = useState(0);
  // Modal de choix au click sur "Planifier" : Carnet / Tiers / Interne
  // (Fabien 2026-05-14, image 36).
  const [showPlanifierModal, setShowPlanifierModal] = useState(false);

  const items = useMemo<PlanningItem[]>(() => {
    const usersById = new Map((users.data ?? []).map((u) => [u.id, `${u.prenom} ${u.nom}`.trim()]));

    const fromInterventions: PlanningItem[] = (interventions.data ?? [])
      .filter((iv) => iv.datePrevue)
      .map((iv) => ({
        kind: "CARNET" as const,
        id: iv.id,
        datePrevue: new Date(iv.datePrevue!),
        titre: iv.type.replace(/_/g, " "),
        client: null,
        parcelle: iv.parcelle?.nom ?? null,
        produit: iv.produitRef?.libelle ?? iv.produit ?? null,
        assignedToUserId: iv.assignedToUserId,
        assignedToLabel: iv.assignedToUserId ? (usersById.get(iv.assignedToUserId) ?? null) : null,
        href: `/interventions/new?edit=${iv.id}` as Route,
        travailStatut: null,
      }));

    const fromTravaux: PlanningItem[] = (travaux.data ?? [])
      .filter((t) => t.datePrevue)
      .map((t) => ({
        kind: t.interne ? ("INTERNE" as const) : ("TIERS" as const),
        id: t.id,
        datePrevue: new Date(t.datePrevue!),
        titre: t.titre,
        client: t.partenaire?.nom ?? t.odooPartnerName ?? (t.interne ? "Interne" : null),
        parcelle: t.parcelle?.nom ?? null,
        produit: null,
        assignedToUserId: t.assignedToUserId,
        assignedToLabel: t.assignedToUserId ? (usersById.get(t.assignedToUserId) ?? null) : null,
        href: `/travaux/new?edit=${t.id}` as Route,
        travailStatut: t.statut,
      }));

    return [...fromInterventions, ...fromTravaux].sort(
      (a, b) => a.datePrevue.getTime() - b.datePrevue.getTime(),
    );
  }, [interventions.data, travaux.data, users.data]);

  // Filtre employé.
  const itemsFiltres = useMemo(() => {
    return items.filter((it) => {
      if (filtreEmploye === "all") return true;
      if (filtreEmploye === "me") return it.assignedToUserId === me.data?.id;
      return it.assignedToUserId === filtreEmploye;
    });
  }, [items, filtreEmploye, me.data?.id]);

  // Filtre jour (today + offset).
  const jourCible = useMemo(() => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() + jourOffset);
    return d;
  }, [jourOffset]);

  const itemsDuJour = useMemo(() => {
    const start = jourCible.getTime();
    const end = start + 86_400_000;
    return itemsFiltres.filter((it) => {
      const t = it.datePrevue.getTime();
      return t >= start && t < end;
    });
  }, [itemsFiltres, jourCible]);

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Planning" }]} />
      <div className="mx-auto max-w-3xl px-3 py-4 sm:py-6">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-foreground/60" />
            <h1 className="text-2xl font-bold sm:text-3xl">Planning</h1>
          </div>
          <button
            type="button"
            onClick={() => setShowPlanifierModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-green px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-dark"
          >
            <Plus className="h-4 w-4" />
            Planifier
          </button>
        </header>

        {/* Filtres employé */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          <FiltreChip
            actif={filtreEmploye === "all"}
            onClick={() => setFiltreEmploye("all")}
            label="Toute l'équipe"
          />
          <FiltreChip
            actif={filtreEmploye === "me"}
            onClick={() => setFiltreEmploye("me")}
            label="Mes assignations"
          />
          {(users.data ?? [])
            .filter((u) => u.id !== me.data?.id)
            .map((u) => (
              <FiltreChip
                key={u.id}
                actif={filtreEmploye === u.id}
                onClick={() => setFiltreEmploye(u.id)}
                label={`${u.prenom}`}
              />
            ))}
        </div>

        {/* Navigation jour */}
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-background p-2">
          <button
            type="button"
            onClick={() => setJourOffset((x) => x - 1)}
            aria-label="Jour précédent"
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-base font-semibold capitalize sm:text-lg">
              {formatJour(jourCible)}
            </span>
            <span className="text-xs text-foreground/60">
              {jourCible.toLocaleDateString("fr-CH", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setJourOffset((x) => x + 1)}
            aria-label="Jour suivant"
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        {jourOffset !== 0 && (
          <div className="mb-3 flex justify-center">
            <button
              type="button"
              onClick={() => setJourOffset(0)}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground/70 hover:bg-muted"
            >
              Revenir à aujourd'hui
            </button>
          </div>
        )}

        {/* Liste du jour */}
        {itemsDuJour.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
            <CalendarDays className="mx-auto mb-2 h-10 w-10 text-foreground/30" />
            <p className="text-sm text-foreground/60">Rien de planifié pour ce jour.</p>
            <p className="mt-1 text-xs text-foreground/50">
              Crée une activité avec une date prévue depuis le bouton +.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {itemsDuJour.map((it) => (
              <PlanningCard
                key={`${it.kind}-${it.id}`}
                item={it}
                onComplete={() => completeTravail.mutate(it.id)}
                completing={completeTravail.isPending && completeTravail.variables === it.id}
              />
            ))}
          </ul>
        )}
      </div>

      {showPlanifierModal && <PlanifierChoiceModal onClose={() => setShowPlanifierModal(false)} />}
    </>
  );
}

function PlanifierChoiceModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[9000] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-background p-4 shadow-2xl sm:p-5 sm:rounded-3xl sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">Que veux-tu planifier ?</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-2 hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <PlanifierChoice
            href={"/interventions/new" as Route}
            icon={Sprout}
            label="Carnet des champs"
            hint="Intervention sur mes parcelles (semis, fumure, phyto…)"
            iconColor="bg-emerald-50 text-emerald-700"
            onClose={onClose}
          />
          <PlanifierChoice
            href={"/travaux/new?interne=false" as Route}
            icon={Tractor}
            label="Travail pour tiers"
            hint="Prestation facturable chez un client."
            iconColor="bg-purple-50 text-purple-700"
            onClose={onClose}
          />
          <PlanifierChoice
            href={"/travaux/new?interne=true" as Route}
            icon={Wrench}
            label="Travail interne"
            hint="Activité interne non facturable."
            iconColor="bg-sky-50 text-sky-700"
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}

function PlanifierChoice({
  href,
  icon: Icon,
  label,
  hint,
  iconColor,
  onClose,
}: {
  href: Route;
  icon: typeof Sprout;
  label: string;
  hint: string;
  iconColor: string;
  onClose: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="flex items-center gap-3 rounded-2xl border-2 border-border bg-background p-4 transition-all hover:border-green hover:bg-green/5 active:scale-[0.99]"
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconColor}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="block">
        <span className="block text-sm font-bold">{label}</span>
        <span className="mt-0.5 block text-xs text-foreground/70">{hint}</span>
      </span>
    </Link>
  );
}

function FiltreChip({
  actif,
  onClick,
  label,
}: {
  actif: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
        actif
          ? "border-green bg-green text-white"
          : "border-border bg-background text-foreground/60 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function PlanningCard({
  item,
  onComplete,
  completing,
}: {
  item: PlanningItem;
  onComplete: () => void;
  completing: boolean;
}) {
  const meta = KIND_META[item.kind];
  const Icon = meta.Icon;
  const peutMarquerTermine = item.travailStatut === "PLANIFIE" || item.travailStatut === "DRAFT";
  // Affiche l'heure prévue seulement si elle a été saisie (≠ minuit
  // local). Sinon on n'affiche rien — la date sert juste à grouper
  // l'item dans le bon jour. Fabien 2026-05-14 image 46.
  const hasHeurePrevue = item.datePrevue.getHours() !== 0 || item.datePrevue.getMinutes() !== 0;
  const heureLabel = hasHeurePrevue
    ? item.datePrevue.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <li className="rounded-xl border border-border bg-background p-3">
      <Link href={item.href} className="flex items-start gap-3">
        <span className={`shrink-0 ${meta.color}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold capitalize">{item.titre}</span>
            {heureLabel && (
              <span className="shrink-0 font-mono text-xs tabular-nums text-foreground/60">
                {heureLabel}
              </span>
            )}
          </div>
          {(item.client || item.parcelle || item.produit) && (
            <div className="mt-1 space-y-0.5 text-xs text-foreground/70">
              {item.client && (
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3 w-3 shrink-0 text-foreground/50" />
                  <span className="truncate">{item.client}</span>
                </div>
              )}
              {item.parcelle && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 shrink-0 text-foreground/50" />
                  <span className="truncate">{item.parcelle}</span>
                </div>
              )}
              {item.produit && (
                <div className="flex items-center gap-1.5">
                  <Leaf className="h-3 w-3 shrink-0 text-foreground/50" />
                  <span className="truncate">{item.produit}</span>
                </div>
              )}
            </div>
          )}
          {item.assignedToLabel && (
            <div className="mt-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
                <UserIcon className="h-3 w-3" />
                {item.assignedToLabel}
              </span>
            </div>
          )}
          {/* Badge "Planifié" retiré (Fabien 2026-05-14 image 45) — sur
              la page Planning, tous les items sont par définition
              planifiés. Le statut Travail reste utile en revanche pour
              distinguer DRAFT/VALIDATED/CANCELLED, mais on ne l'affiche
              plus tant qu'on est en PLANIFIE. */}
          {item.travailStatut && item.travailStatut !== "PLANIFIE" && (
            <div className="mt-1.5">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUT_BADGE[item.travailStatut]}`}
              >
                {STATUT_LABEL[item.travailStatut]}
              </span>
            </div>
          )}
        </div>
      </Link>
      {peutMarquerTermine && (
        <div className="mt-3 flex justify-end border-t border-border pt-3">
          <button
            type="button"
            onClick={onComplete}
            disabled={completing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-green bg-green/10 px-3 py-1.5 text-xs font-semibold text-green hover:bg-green/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {completing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Marquer comme terminé
          </button>
        </div>
      )}
    </li>
  );
}
