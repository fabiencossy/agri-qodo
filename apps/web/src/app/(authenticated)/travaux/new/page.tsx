"use client";

/**
 * Nouveau travail — `/travaux/new`.
 *
 * Form unifié mobile-first avec :
 * - Métadonnées : titre, date, client (partenaire), parcelle, notes.
 * - Toggle "Travail interne" (non facturable, cache les prix).
 * - Lignes PRODUITS (ProduitSearchSelect — création inline OK).
 * - Lignes HEURES avec heure début / fin → durée auto.
 *   Présélection de l'employé courant ; possibilité d'ajouter d'autres
 *   employés (chef d'équipe).
 * - Total CHF estimé en bas (caché si interne).
 * - Sticky bottom action bar mobile (Save + Annuler).
 */
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Navigation,
  Package,
  Save,
  Send,
  Tractor,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { BigActionButton } from "@/components/activites/big-action-button";
import { EditActionsMenu } from "@/components/activites/edit-actions-menu";
import { PhotosField } from "@/components/activites/photos-field";
import { type HeuresSimplesValue } from "@/components/activites/heures-simples-input";
import { ProduitsSheet, type ProduitLigne } from "@/components/activites/produits-sheet";
import { TempsSheet } from "@/components/activites/temps-sheet";
import { TypeSaisieHeader } from "@/components/activites/type-saisie-header";
import { Button } from "@/components/ui/button";
import { HhmmTimeInput } from "@/components/ui/hhmm-time-input";
import { Input } from "@/components/ui/input";
import { ParcelleSearchSelect } from "@/components/ui/parcelle-search-select";
import { useParcelle } from "@/lib/parcelles";
import { PartenaireSelect } from "@/components/ui/partenaire-select";
import { extractApiErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/auth";
import { useProduits } from "@/lib/produits";
import { useTenantDetail } from "@/lib/tenants";
import {
  type CreateLigneHeureInput,
  type CreateLigneProduitInput,
  formatCHF,
  type PushTravailResult,
  STATUT_BADGE,
  STATUT_LABEL,
  totalTravailCHF,
  useCancelTravail,
  useCompleteTravail,
  useCreateTravail,
  useDeleteTravail,
  usePushTravailOdoo,
  useTravail,
  useUpdateTravail,
  useValidateTravail,
} from "@/lib/travaux";
import { useUsers } from "@/lib/users";

interface DraftLigneHeure {
  uid: string;
  userId: string;
  heureDebut?: string;
  heureFin?: string;
  dureeMinutes: number;
  tauxHoraireCHF?: number | undefined;
  notes?: string | undefined;
}

const todayIso = (): string => new Date().toISOString().slice(0, 10);

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function combineDateTime(date: string, time: string): string | undefined {
  if (!date || !time) return undefined;
  const iso = `${date}T${time}:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export default function NewTravailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const create = useCreateTravail();
  const update = useUpdateTravail();
  const completeTravail = useCompleteTravail();
  const deleteTravail = useDeleteTravail();
  const validateTravail = useValidateTravail();
  const cancelTravail = useCancelTravail();
  const pushOdoo = usePushTravailOdoo();
  const [pushResult, setPushResult] = useState<PushTravailResult | null>(null);
  const me = useCurrentUser();
  const users = useUsers();
  const tenantDetail = useTenantDetail();

  // Mode édition : ?edit={travailId} → pré-remplit le form depuis l'API.
  const editId = searchParams.get("edit") ?? undefined;
  const isEditMode = !!editId;
  const existingTravail = useTravail(editId);

  // Date pré-remplie via query string (ex: depuis le calendrier
  // /mes-heures qui passe ?date=YYYY-MM-DD).
  const dateParam = searchParams.get("date");
  // Parcelle pré-remplie quand on arrive depuis une fiche parcelle
  // (?parcelleId=...). Validée comme UUID light pour éviter d'injecter un
  // truc bizarre dans l'URL.
  const parcelleIdParam = searchParams.get("parcelleId");
  const [titre, setTitre] = useState("");
  const [date, setDate] = useState(
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayIso(),
  );
  // Heure prévue optionnelle (Fabien 2026-05-14 image 46) : si renseignée,
  // elle est combinée avec `date` pour produire la `datePrevue` ISO. Sinon
  // datePrevue = date à 00:00 et la carte planning n'affiche pas d'heure.
  const [heurePrevue, setHeurePrevue] = useState<string>("");
  const [partenaireId, setPartenaireId] = useState("");
  // Décision Fabien 2026-05-06 : un client Odoo n'est pas un partenaire
  // Agri Qodo. Le sélecteur peut renvoyer soit l'un soit l'autre.
  const [odooPartnerId, setOdooPartnerId] = useState<number | null>(null);
  // Nom du client Odoo capturé au moment du choix (le picker l'a déjà).
  // Persisté avec le Travail pour affichage sans round-trip Odoo.
  const [odooPartnerName, setOdooPartnerName] = useState<string>("");
  const [parcelleId, setParcelleId] = useState(
    parcelleIdParam && /^[0-9a-f-]{36}$/i.test(parcelleIdParam) ? parcelleIdParam : "",
  );
  const interneParam = searchParams.get("interne");
  const [interne, setInterne] = useState(interneParam === "true");
  // En mode création, l'onglet (Tiers/Interne) pilote `interne` via la query.
  // Sans cet effet, cliquer sur "Interne" depuis "Tiers" ne reset pas le state.
  useEffect(() => {
    if (isEditMode) return;
    setInterne(searchParams.get("interne") === "true");
  }, [searchParams, isEditMode]);
  const [notes, setNotes] = useState("");
  const [projetId, setProjetId] = useState("");
  // Sprint 2 fusion-interventions — Planning : juste assignedToUserId.
  // datePrevue n'est plus un champ séparé, c'est égal à `date` quand on
  // clique sur "Planifier" (sinon non envoyé en mode saisie classique).
  const [assignedToUserId, setAssignedToUserId] = useState<string>("");
  const [lignesHeure, setLignesHeure] = useState<DraftLigneHeure[]>([]);
  // Heures mono-employé (l'auteur connecté). Pas de multi-ligne — on
  // mappe vers une seule entrée lignesHeure au submit.
  const [heuresSimples, setHeuresSimples] = useState<HeuresSimplesValue>({
    heureDebut: "",
    heureFin: "",
    heureDebutPause: "",
    dureePauseMinutes: 0,
    dureeMinutes: 0,
  });
  // Multi-produits : tableau de lignes empilables.
  const [produitsLignes, setProduitsLignes] = useState<ProduitLigne[]>([]);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  // Scroll auto vers le bandeau d'erreur dès qu'il apparaît, pour que
  // l'utilisateur ne le rate pas même sur formulaire long.
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);
  // Modaux plein écran "Ajouter du temps" / "Ajouter des produits"
  // (décision Fabien 2026-05-14 : sortir ces saisies du formulaire principal).
  const [showTempsSheet, setShowTempsSheet] = useState(false);
  const [showProduitsSheet, setShowProduitsSheet] = useState(false);

  const produitsQuery = useProduits();
  const produitsCatalogue = produitsQuery.data ?? [];
  // Charge la parcelle sélectionnée pour disposer de son lat/lng et
  // afficher le bouton "Itinéraire" (Fabien 2026-05-14 image 53).
  const parcelleDetail = useParcelle(parcelleId || undefined);

  // Pré-remplissage en mode édition depuis le travail existant.
  const loadedRef = useState({ id: "" })[0];
  useEffect(() => {
    if (!isEditMode || !existingTravail.data) return;
    if (loadedRef.id === existingTravail.data.id) return; // déjà chargé
    loadedRef.id = existingTravail.data.id;
    const t = existingTravail.data;
    setTitre(t.titre);
    setDate(t.date.slice(0, 10));
    setPartenaireId(t.partenaireId ?? "");
    setOdooPartnerId(t.odooPartnerId ?? null);
    setOdooPartnerName(t.odooPartnerName ?? "");
    setParcelleId(t.parcelleId ?? "");
    setProjetId(t.projetId ?? "");
    setInterne(t.interne);
    setNotes(t.notes ?? "");
    setAssignedToUserId(t.assignedToUserId ?? "");
    // Si édition d'un planning : la date du form devient la datePrevue.
    if (t.datePrevue && t.statut === "PLANIFIE") {
      setDate(t.datePrevue.slice(0, 10));
    }
    // Pré-remplit l'heure prévue depuis la datePrevue ISO, sauf si
    // c'est exactement minuit (= aucune heure renseignée).
    if (t.datePrevue) {
      const d = new Date(t.datePrevue);
      if (d.getHours() !== 0 || d.getMinutes() !== 0) {
        setHeurePrevue(
          `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
        );
      }
    }
    // Pré-remplit les produits en mode édition (V1 : 1 ligne = 1 produit
    // catalogué, on ignore les lignes libellé libre sans produitId).
    setProduitsLignes(
      t.lignesProduit
        .filter((l) => l.produitId)
        .map((l) => ({
          uid: uid(),
          produitId: l.produitId ?? "",
          quantite: String(l.quantite),
        })),
    );
    setLignesHeure(
      t.lignesHeure.map((l) => ({
        uid: uid(),
        userId: l.userId,
        ...(l.heureDebut ? { heureDebut: l.heureDebut.slice(11, 16) } : {}),
        ...(l.heureFin ? { heureFin: l.heureFin.slice(11, 16) } : {}),
        dureeMinutes: l.dureeMinutes,
        ...(l.tauxHoraireCHF ? { tauxHoraireCHF: Number(l.tauxHoraireCHF) } : {}),
        ...(l.notes ? { notes: l.notes } : {}),
      })),
    );
  }, [existingTravail.data, isEditMode, loadedRef]);

  // Présélection mono-employé : on charge les heures depuis l'édit si la
  // ligne existe, sinon on les laisse vides.
  const meId = me.data?.id;
  useEffect(() => {
    if (!isEditMode) return;
    const first = lignesHeure[0];
    if (!first) return;
    setHeuresSimples({
      heureDebut: first.heureDebut ?? "",
      heureFin: first.heureFin ?? "",
      heureDebutPause: "",
      dureePauseMinutes: 0,
      dureeMinutes: first.dureeMinutes,
    });
    // tauxHoraireCHF n'est plus exposé dans la saisie (décision Fabien
    // 2026-05-14) — le champ existant en DB reste lisible pour le total,
    // mais on ne le re-prérompit plus ici puisqu'il n'y a plus d'UI.
  }, [isEditMode, lignesHeure]);

  // Présélection projet par défaut (create only, et seulement si vide).
  useEffect(() => {
    if (isEditMode) return;
    const def = tenantDetail.data?.defaultProjetTravauxTiersId;
    if (def) setProjetId((prev) => prev || def);
  }, [tenantDetail.data?.defaultProjetTravauxTiersId, isEditMode]);

  /**
   * Sprint 2 fusion-interventions — submit "Planifier" : crée une pré-tâche
   * avec datePrevue = date, sans heures ni produits. Le service Travaux
   * détecte ce cas et met le statut en PLANIFIE.
   */
  async function onSubmitPlanning() {
    setError(null);
    if (!interne && !partenaireId && !odooPartnerId) {
      setError("Sélectionne un client (obligatoire pour un travail pour tiers).");
      return;
    }
    const titreFinal =
      titre.trim() ||
      `Travail ${new Date(date).toLocaleDateString("fr-CH")}${interne ? " — interne" : ""}`;
    // Si heure prévue saisie → combine avec date pour produire un ISO
    // local (la TZ est inférée par le navigateur). Sinon date pure.
    const datePrevueIso = combineDateTime(date, heurePrevue) ?? date;
    const payload = {
      titre: titreFinal,
      date,
      datePrevue: datePrevueIso,
      interne,
      ...(partenaireId && !interne ? { partenaireId } : {}),
      ...(odooPartnerId && !interne ? { odooPartnerId } : {}),
      ...(odooPartnerName && odooPartnerId && !interne ? { odooPartnerName } : {}),
      ...(parcelleId ? { parcelleId } : {}),
      ...(projetId ? { projetId } : {}),
      ...(assignedToUserId ? { assignedToUserId } : {}),
    };
    try {
      const created = await create.mutateAsync(payload);
      router.push(`/planning?from=${created.id}` as never);
    } catch (err) {
      setError(extractApiErrorMessage(err) ?? "Échec de la planification.");
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!interne && !partenaireId && !odooPartnerId) {
      setError("Sélectionne un client (obligatoire pour un travail pour tiers).");
      return;
    }
    // Titre auto-généré si vide (Fabien préfère ne pas le saisir).
    const titreFinal =
      titre.trim() ||
      `Travail ${new Date(date).toLocaleDateString("fr-CH")}${interne ? " — interne" : ""}`;
    // Multi-produits : on construit une ligne par produit valide.
    const lignesProduitClean: CreateLigneProduitInput[] = produitsLignes
      .map((l) => {
        const produit = produitsCatalogue.find((p) => p.id === l.produitId);
        const qte = Number(l.quantite);
        if (!produit || !(qte > 0)) return null;
        const out: CreateLigneProduitInput = {
          produitId: produit.id,
          libelle: produit.libelle,
          quantite: qte,
          unite: produit.unite,
        };
        if (!interne && produit.prixVenteCHF != null) {
          out.prixUnitaireCHF = Number(produit.prixVenteCHF);
        }
        return out;
      })
      .filter((l): l is CreateLigneProduitInput => l !== null);
    // Heures mono-employé (l'auteur).
    const lignesHeureClean: CreateLigneHeureInput[] = [];
    if (meId && heuresSimples.dureeMinutes > 0) {
      const out: CreateLigneHeureInput = {
        userId: meId,
        dureeMinutes: heuresSimples.dureeMinutes,
      };
      const debutIso = combineDateTime(date, heuresSimples.heureDebut);
      const finIso = combineDateTime(date, heuresSimples.heureFin);
      if (debutIso) out.heureDebut = debutIso;
      if (finIso) out.heureFin = finIso;
      lignesHeureClean.push(out);
    }

    // Si l'heure prévue est saisie → datePrevue ISO local complet.
    // Sinon on envoie juste la date (le backend la traite comme 00:00).
    const datePrevueIso = combineDateTime(date, heurePrevue);
    const payload = {
      titre: titreFinal,
      date,
      interne,
      ...(datePrevueIso ? { datePrevue: datePrevueIso } : {}),
      ...(partenaireId && !interne ? { partenaireId } : {}),
      ...(odooPartnerId && !interne ? { odooPartnerId } : {}),
      ...(odooPartnerName && odooPartnerId && !interne ? { odooPartnerName } : {}),
      ...(parcelleId ? { parcelleId } : {}),
      ...(projetId ? { projetId } : {}),
      ...(notes ? { notes } : {}),
      ...(assignedToUserId ? { assignedToUserId } : {}),
      ...(lignesProduitClean.length > 0 ? { lignesProduit: lignesProduitClean } : {}),
      ...(lignesHeureClean.length > 0 ? { lignesHeure: lignesHeureClean } : {}),
    };
    try {
      if (isEditMode && editId) {
        const updated = await update.mutateAsync({ id: editId, ...payload });
        // Si le backend a déclenché un push Odoo lors de l'update,
        // on remonte le résultat dans le bandeau vert (toast éphémère
        // dans l'EditActionsBlock) — Fabien 2026-05-14 image 40.
        if (updated.lastPushResult) {
          setPushResult(updated.lastPushResult);
        }
      } else {
        const created = await create.mutateAsync(payload);
        router.push(`/travaux/new?edit=${created.id}` as never);
      }
    } catch (err) {
      setError(extractApiErrorMessage(err) ?? "Erreur inconnue");
    }
  };

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/app" },
          { label: "Travaux", href: "/travaux" },
          { label: isEditMode ? "Modifier" : "Nouveau" },
        ]}
      />
      <div className="mx-auto max-w-3xl px-4 pb-32 pt-6 sm:py-8">
        {!isEditMode && (
          <TypeSaisieHeader active={interne ? "interne" : "tiers"} closeHref="/travaux" />
        )}
        {isEditMode && editId && (
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link href={"/travaux" as never} className="text-foreground/60 hover:text-foreground">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="flex min-w-0 items-center gap-2 text-2xl font-bold sm:text-3xl">
                <Tractor className="h-6 w-6 shrink-0 text-green sm:h-7 sm:w-7" />
                <span className="truncate">Modifier le travail</span>
              </h1>
            </div>
            <EditActionsMenu
              onComplete={() => {
                completeTravail.mutate(editId, {
                  onSuccess: () => router.push("/travaux"),
                });
              }}
              onDelete={() => {
                deleteTravail.mutate(editId, {
                  onSuccess: () => router.push("/travaux"),
                });
              }}
              completing={completeTravail.isPending}
              deleting={deleteTravail.isPending}
            />
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-border bg-background p-4 sm:p-6"
        >
          {/* Le toggle Tiers/Interne est désormais piloté par l'onglet en
              haut (TypeSaisieHeader). Plus de checkbox dans le formulaire. */}

          <Field
            label="Date"
            hint="Sert de date d'exécution prévue (planning) ou réelle (saisie). Pré-remplie au jour."
          >
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-12 text-base"
            />
          </Field>

          <Field
            label="Heure prévue (optionnel)"
            hint="Tape 7 = 7h00, 730 = 7h30, 1645 = 16h45. Si renseignée, elle apparaît dans la carte du planning ; sinon le travail reste planifié dans la journée sans heure précise."
          >
            <HhmmTimeInput
              value={heurePrevue}
              onChange={setHeurePrevue}
              placeholder="--:--"
              className="h-12 w-full text-base"
            />
          </Field>

          <Field label="Assigné à">
            <select
              value={assignedToUserId}
              onChange={(e) => setAssignedToUserId(e.target.value)}
              className="h-12 w-full rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
            >
              <option value="">— Personne —</option>
              {(users.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.prenom} {u.nom}
                </option>
              ))}
            </select>
          </Field>

          {!interne && (
            <Field label="Client" required>
              <PartenaireSelect
                value={{
                  ...(partenaireId ? { partenaireId } : {}),
                  ...(odooPartnerId ? { odooPartnerId } : {}),
                  ...(odooPartnerName ? { odooPartnerName } : {}),
                }}
                onChange={(next) => {
                  setPartenaireId(next.partenaireId ?? "");
                  setOdooPartnerId(next.odooPartnerId ?? null);
                  setOdooPartnerName(next.odooPartnerName ?? "");
                }}
                placeholder="Choisir un client…"
              />
            </Field>
          )}

          <Field label="Parcelle (optionnel)">
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <ParcelleSearchSelect
                  value={parcelleId}
                  onChange={(id) => setParcelleId(id)}
                  placeholder="Choisir une parcelle…"
                  {...(partenaireId
                    ? { filtreTenantId: partenaireId }
                    : odooPartnerId
                      ? { filtreOdooPartnerId: odooPartnerId }
                      : {})}
                />
              </div>
              {/* Bouton Itinéraire (Fabien 2026-05-14 image 53). */}
              {parcelleDetail.data?.lat != null && parcelleDetail.data?.lng != null && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${parcelleDetail.data.lat},${parcelleDetail.data.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground/80 transition-colors hover:border-green hover:text-green"
                  title="Ouvrir Google Maps en navigation vers cette parcelle"
                >
                  <Navigation className="h-4 w-4" />
                  <span className="hidden sm:inline">Itinéraire</span>
                </a>
              )}
            </div>
          </Field>

          {/* Bouton Planifier (Sprint 2 fusion-interventions) : soumet
              une pré-tâche sans heures/produits, statut PLANIFIE.
              Disponible uniquement en mode création (pas édition). */}
          {!isEditMode && (
            <button
              type="button"
              onClick={() => onSubmitPlanning()}
              disabled={create.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-green bg-background py-3 text-sm font-semibold text-green transition-colors hover:bg-green/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CalendarDays className="h-4 w-4" />
              Planifier (sans saisir les détails)
            </button>
          )}

          {/* Le dropdown "Projet" Agri Qodo (étiquette locale) a été
              retiré 2026-05-14 (v2) — la projection vers Odoo se gère
              via "Projets Odoo cibles" dans Paramètres → Exploitation.
              `projetId` reste à vide pour les nouveaux travaux. */}

          <Field label="Description (optionnel)">
            <textarea
              className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Conditions, particularités…"
            />
          </Field>

          {/* Boutons côte à côte ; résumés détaillés empilés en pleine
              largeur sous les boutons (décision Fabien 2026-05-14 v4). */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(interne
                ? tenantDetail.data?.heuresVisiblesTravauxInterne
                : tenantDetail.data?.heuresVisiblesTravauxTiers) !== false && (
                <BigActionButton
                  icon={Clock}
                  label="Ajouter du temps"
                  hint={
                    heuresSimples.dureeMinutes > 0 ? "Modifier le temps saisi" : "Aucun temps saisi"
                  }
                  onClick={() => setShowTempsSheet(true)}
                />
              )}
              <BigActionButton
                icon={Package}
                label="Ajouter des produits"
                hint={
                  produitsLignes.filter((l) => l.produitId).length > 0
                    ? "Modifier les produits sélectionnés"
                    : "Aucun produit ajouté"
                }
                onClick={() => setShowProduitsSheet(true)}
              />
            </div>
            {heuresSimples.dureeMinutes > 0 && (
              <TempsSummary value={heuresSimples} onClick={() => setShowTempsSheet(true)} />
            )}
            {produitsLignes.filter((l) => l.produitId).length > 0 && (
              <ProduitsSummary
                lignes={produitsLignes}
                catalogue={produitsCatalogue}
                onChangeQuantite={(uid, q) =>
                  setProduitsLignes((prev) =>
                    prev.map((l) => (l.uid === uid ? { ...l, quantite: q } : l)),
                  )
                }
                onRemove={(uid) => setProduitsLignes((prev) => prev.filter((l) => l.uid !== uid))}
              />
            )}
          </div>

          <Field label="Photos (optionnel)">
            <PhotosField
              parent={isEditMode && editId ? { kind: "travail", id: editId } : { kind: "none" }}
            />
          </Field>

          {error && (
            <div
              ref={errorRef}
              role="alert"
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
            >
              <span className="mr-2 inline-block rounded bg-red-700 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                Erreur
              </span>
              {error}
            </div>
          )}

          {/* ----- Bloc édition : statut + total + push Odoo + actions
              (Valider / Annuler) ----- */}
          {isEditMode && existingTravail.data && (
            <EditActionsBlock
              travail={existingTravail.data}
              pushResult={pushResult}
              onPush={() =>
                pushOdoo.mutate(existingTravail.data!.id, {
                  onSuccess: (r) => setPushResult(r),
                })
              }
              pushing={pushOdoo.isPending}
              pushError={
                pushOdoo.isError
                  ? pushOdoo.error instanceof Error
                    ? pushOdoo.error.message
                    : "erreur inconnue"
                  : null
              }
            />
          )}

          {/* ----- Sticky bottom bar — tous les boutons sur une seule
              ligne (Fabien 2026-05-14 v5). En mode édition :
              [Annuler ce travail] [Valider] [Mettre à jour]. En mode
              création : juste [Sauvegarder]. ----- */}
          <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:pt-2">
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-end gap-2">
              {isEditMode &&
                existingTravail.data &&
                (existingTravail.data.statut === "DRAFT" ||
                  existingTravail.data.statut === "VALIDATED") && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => cancelTravail.mutate(existingTravail.data!.id)}
                    disabled={cancelTravail.isPending}
                  >
                    <XCircle className="mr-1 h-4 w-4" />
                    {cancelTravail.isPending ? "Annulation…" : "Annuler ce travail"}
                  </Button>
                )}
              {isEditMode &&
                existingTravail.data &&
                (existingTravail.data.statut === "DRAFT" ||
                  existingTravail.data.statut === "PENDING_REVIEW") && (
                  <Button
                    type="button"
                    onClick={() => validateTravail.mutate(existingTravail.data!.id)}
                    disabled={validateTravail.isPending}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    {validateTravail.isPending ? "Validation…" : "Valider"}
                  </Button>
                )}
              <Button type="submit" disabled={create.isPending} className="h-11 px-6">
                <Save className="mr-1 h-4 w-4" />
                {create.isPending || update.isPending
                  ? "Sauvegarde…"
                  : isEditMode
                    ? "Mettre à jour"
                    : "Sauvegarder"}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {showTempsSheet && (
        <TempsSheet
          value={heuresSimples}
          onChange={setHeuresSimples}
          onClose={() => setShowTempsSheet(false)}
        />
      )}
      {showProduitsSheet && (
        <ProduitsSheet
          lignes={produitsLignes}
          onChange={setProduitsLignes}
          onClose={() => setShowProduitsSheet(false)}
        />
      )}
    </>
  );
}

function TempsSummary({ value, onClick }: { value: HeuresSimplesValue; onClick: () => void }) {
  const h = Math.floor(value.dureeMinutes / 60);
  const m = value.dureeMinutes % 60;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Modifier le temps saisi"
      className="block w-full rounded-xl border border-border bg-background px-3 py-2 text-left text-xs transition-colors hover:border-green hover:bg-green/5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-foreground/60">Durée effective</span>
        <span className="font-mono font-semibold">
          {h}h{String(m).padStart(2, "0")}
        </span>
      </div>
      {(value.heureDebut || value.heureFin) && (
        <div className="mt-1 flex items-center justify-between gap-2 text-foreground/60">
          <span>Horaire</span>
          <span className="font-mono">
            {value.heureDebut || "—"} → {value.heureFin || "—"}
          </span>
        </div>
      )}
      {value.dureePauseMinutes > 0 && (
        <div className="mt-1 flex items-center justify-between gap-2 text-foreground/60">
          <span>Pause</span>
          <span className="font-mono">{value.dureePauseMinutes} min</span>
        </div>
      )}
    </button>
  );
}

function ProduitsSummary({
  lignes,
  catalogue,
  onChangeQuantite,
  onRemove,
}: {
  lignes: ProduitLigne[];
  catalogue: Array<{ id: string; libelle: string; unite: string }>;
  onChangeQuantite: (uid: string, quantite: string) => void;
  onRemove: (uid: string) => void;
}) {
  const valides = lignes.filter((l) => l.produitId);
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-background text-xs">
      {valides.map((l) => {
        const produit = catalogue.find((p) => p.id === l.produitId);
        return (
          <li key={l.uid} className="flex items-center gap-2 px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-medium">
              {produit?.libelle ?? "Produit"}
            </span>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={l.quantite}
              onChange={(e) => onChangeQuantite(l.uid, e.target.value)}
              placeholder="—"
              className="h-9 w-20 text-right font-mono text-xs"
              aria-label={`Quantité de ${produit?.libelle ?? "ce produit"}`}
            />
            <span className="w-10 shrink-0 text-center font-mono text-foreground/70">
              {produit?.unite ?? ""}
            </span>
            <button
              type="button"
              onClick={() => onRemove(l.uid)}
              aria-label={`Retirer ${produit?.libelle ?? "ce produit"}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground/50 transition-colors hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Field({
  label,
  required,
  hint,
  actionRight,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  actionRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="block text-sm font-medium">
          {label}
          {required && <span className="ml-1 text-red-600">*</span>}
        </span>
        {actionRight}
      </div>
      {children}
      {hint && <span className="mt-1 block text-xs text-foreground/50">{hint}</span>}
    </div>
  );
}

/**
 * Bloc affiché en mode édition : statut, total HT, bandeau Push Odoo et
 * boutons Valider / Annuler. Reprend les sections de l'ancienne page
 * détail `/travaux/[id]` qui est maintenant une redirection.
 */
function EditActionsBlock({
  travail,
  pushResult,
  onPush,
  pushing,
  pushError,
}: {
  travail: NonNullable<ReturnType<typeof useTravail>["data"]>;
  pushResult: PushTravailResult | null;
  onPush: () => void;
  pushing: boolean;
  pushError: string | null;
}) {
  const total = totalTravailCHF(travail);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUT_BADGE[travail.statut]}`}>
          {STATUT_LABEL[travail.statut]}
        </span>
        {travail.interne && (
          <span className="rounded bg-foreground/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide">
            Interne
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="rounded-2xl border-2 border-green bg-green/5 p-4 text-right">
          <p className="text-sm text-foreground/60">Total HT</p>
          <p className="font-mono text-2xl font-bold text-green-dark">{formatCHF(total)}</p>
        </div>
      )}

      {/* Bandeau "Push Odoo en attente" / "Devis créé" supprimé (Fabien
          2026-05-14, image 31 : "je veux pas de bandrole sauf si ça
          fonctionne pas"). Seul le bandeau rouge d'erreur ci-dessous
          reste, avec un bouton Réessayer intégré. */}

      {pushResult && (
        <div className="rounded-xl border border-green/30 bg-green/5 p-4 text-sm">
          <p className="font-medium text-green-dark">
            {pushResult.odooKind === "project_task"
              ? `✓ Tâche Odoo créée : project.task #${pushResult.odooTaskId} (${pushResult.linesCount} ligne${pushResult.linesCount > 1 ? "s" : ""} d'heures)`
              : `✓ Devis créé : sale.order #${pushResult.odooSaleOrderId} (${pushResult.linesCount} lignes${pushResult.partnerCreated ? ", nouveau client créé" : ""}${pushResult.productsCreated > 0 ? `, ${pushResult.productsCreated} produit${pushResult.productsCreated > 1 ? "s" : ""} créé${pushResult.productsCreated > 1 ? "s" : ""}` : ""})`}
          </p>
          {pushResult.odooUrl && (
            <a
              href={pushResult.odooUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-green-dark underline"
            >
              Ouvrir dans Odoo
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {pushError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Push Odoo échoué</p>
              <p className="mt-1 font-mono text-xs">{pushError}</p>
              {/^.*\b(50[234])\b/.test(pushError) ? (
                <p className="mt-2 text-xs text-red-700/80">
                  Ton instance Odoo est temporairement indisponible (erreur passerelle). Vérifie
                  qu'elle est bien démarrée puis clique sur « Réessayer ». Le backend retente
                  automatiquement 2 fois avant de remonter cette erreur.
                </p>
              ) : (
                <p className="mt-2 text-xs text-red-700/80">
                  Clique sur « Réessayer ». Si l'erreur persiste, vérifie la config Odoo dans
                  Paramètres → Odoo.
                </p>
              )}
            </div>
            <Button
              type="button"
              onClick={onPush}
              disabled={pushing}
              size="sm"
              variant="ghost"
              className="shrink-0"
            >
              <Send className="mr-1 h-4 w-4" />
              {pushing ? "Envoi…" : "Réessayer"}
            </Button>
          </div>
        </div>
      )}

      {/* Les boutons Valider / Annuler ce travail sont désormais
          fusionnés dans la sticky bar du formulaire avec "Mettre à
          jour" — Fabien 2026-05-14 v5 (image 21) : tous les boutons
          d'action sur une seule ligne. */}
    </div>
  );
}
