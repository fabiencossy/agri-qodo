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
  ChevronRight,
  Clock,
  ExternalLink,
  Package,
  Plus,
  Save,
  Send,
  Tractor,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { EditActionsMenu } from "@/components/activites/edit-actions-menu";
import { TypeSaisieHeader } from "@/components/activites/type-saisie-header";
import {
  HeuresSimplesInput,
  type HeuresSimplesValue,
} from "@/components/activites/heures-simples-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ParcelleSearchSelect } from "@/components/ui/parcelle-search-select";
import { PartenaireSelect } from "@/components/ui/partenaire-select";
import { ProduitFullscreenPicker } from "@/components/ui/produit-fullscreen-picker";
import { useCurrentUser } from "@/lib/auth";
import { useParcelle } from "@/lib/parcelles";
import { useProjets } from "@/lib/projets";
import { useProduits } from "@/lib/produits";
import { useTenantDetail } from "@/lib/tenants";
import { useOdooConnected } from "@/lib/odoo-config";
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
  const odoo = useOdooConnected();
  const [pushResult, setPushResult] = useState<PushTravailResult | null>(null);
  const me = useCurrentUser();
  const users = useUsers();
  const projets = useProjets({ type: "TRAVAUX_TIERS" });
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
  const [tauxCHF, setTauxCHF] = useState<string>("");
  // Multi-produits : tableau de lignes empilables.
  interface DraftProduitSimple {
    uid: string;
    produitId: string;
    quantite: string;
  }
  const [produitsLignes, setProduitsLignes] = useState<DraftProduitSimple[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Modaux plein écran "Ajouter du temps" / "Ajouter du matériel"
  // (décision Fabien 2026-05-14 : sortir ces saisies du formulaire principal).
  const [showTempsSheet, setShowTempsSheet] = useState(false);
  const [showMaterielSheet, setShowMaterielSheet] = useState(false);

  const parcelleQuery = useParcelle(parcelleId || undefined);
  const produitsQuery = useProduits();
  const produitsCatalogue = produitsQuery.data ?? [];
  const surfaceHa = parcelleQuery.data?.surfaceM2
    ? Number(parcelleQuery.data.surfaceM2) / 10_000
    : null;

  function addProduitLigne() {
    setProduitsLignes((prev) => [...prev, { uid: uid(), produitId: "", quantite: "" }]);
  }
  function updateProduitLigne(idx: number, patch: Partial<DraftProduitSimple>) {
    setProduitsLignes((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function removeProduitLigne(idx: number) {
    setProduitsLignes((prev) => prev.filter((_, i) => i !== idx));
  }

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
    if (first.tauxHoraireCHF != null) setTauxCHF(String(first.tauxHoraireCHF));
  }, [isEditMode, lignesHeure]);

  // Présélection projet par défaut (create only, et seulement si vide).
  useEffect(() => {
    if (isEditMode) return;
    const def = tenantDetail.data?.defaultProjetTravauxTiersId;
    if (def) setProjetId((prev) => prev || def);
  }, [tenantDetail.data?.defaultProjetTravauxTiersId, isEditMode]);

  const tauxNum = tauxCHF ? Number(tauxCHF) : 0;

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
    const payload = {
      titre: titreFinal,
      date,
      datePrevue: date,
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
      setError(err instanceof Error ? err.message : "Échec de la planification.");
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
      if (!interne && tauxNum > 0) out.tauxHoraireCHF = tauxNum;
      lignesHeureClean.push(out);
    }

    const payload = {
      titre: titreFinal,
      date,
      interne,
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
        await update.mutateAsync({ id: editId, ...payload });
        // Reste sur le formulaire en mode édition (champs toujours
        // éditables — décision Fabien 2026-05-14).
      } else {
        const created = await create.mutateAsync(payload);
        router.push(`/travaux/new?edit=${created.id}` as never);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
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

          <Field
            label={interne ? "Projet (optionnel)" : "Projet"}
            {...(tenantDetail.data?.defaultProjetTravauxTiersId && !interne
              ? {
                  hint: "Pré-rempli avec ton projet par défaut (modifiable dans Paramètres → Exploitation).",
                }
              : (projets.data?.length ?? 0) === 0
                ? { hint: "Aucun projet créé. Va dans Paramètres → Projets pour en créer." }
                : {})}
          >
            <select
              value={projetId}
              onChange={(e) => setProjetId(e.target.value)}
              className="h-12 w-full rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
            >
              <option value="">— Aucun —</option>
              {(projets.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Description (optionnel)">
            <textarea
              className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Conditions, particularités…"
            />
          </Field>

          {/* Boutons "Ajouter du temps" / "Ajouter du matériel" → ouvrent
              chacun une page complète (décision Fabien 2026-05-14). */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(interne
              ? tenantDetail.data?.heuresVisiblesTravauxInterne
              : tenantDetail.data?.heuresVisiblesTravauxTiers) !== false && (
              <BigActionButton
                icon={Clock}
                label="Ajouter du temps"
                hint={
                  heuresSimples.dureeMinutes > 0
                    ? `${Math.floor(heuresSimples.dureeMinutes / 60)}h${String(heuresSimples.dureeMinutes % 60).padStart(2, "0")}${
                        tauxNum > 0 && !interne ? ` · ${tauxNum} CHF/h` : ""
                      }`
                    : "Aucun temps saisi"
                }
                onClick={() => setShowTempsSheet(true)}
              />
            )}
            <BigActionButton
              icon={Package}
              label="Ajouter du matériel"
              hint={
                produitsLignes.filter((l) => l.produitId).length > 0
                  ? `${produitsLignes.filter((l) => l.produitId).length} produit${
                      produitsLignes.filter((l) => l.produitId).length > 1 ? "s" : ""
                    } ajouté${produitsLignes.filter((l) => l.produitId).length > 1 ? "s" : ""}`
                  : "Aucun matériel ajouté"
              }
              onClick={() => setShowMaterielSheet(true)}
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          {/* ----- Bloc édition : statut + total + push Odoo + actions
              (Valider / Annuler) ----- */}
          {isEditMode && existingTravail.data && (
            <EditActionsBlock
              travail={existingTravail.data}
              odooConnected={odoo.connected}
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
              onValidate={() => validateTravail.mutate(existingTravail.data!.id)}
              validating={validateTravail.isPending}
              onCancel={() => cancelTravail.mutate(existingTravail.data!.id)}
              cancelling={cancelTravail.isPending}
            />
          )}

          {/* ----- Sticky bottom bar mobile ----- */}
          <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:pt-2">
            <div className="mx-auto flex max-w-3xl justify-end gap-2">
              <Link href="/travaux">
                <Button type="button" variant="ghost">
                  Annuler
                </Button>
              </Link>
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
          tauxCHF={tauxCHF}
          onTauxChange={setTauxCHF}
          showTaux={!interne}
          onClose={() => setShowTempsSheet(false)}
        />
      )}
      {showMaterielSheet && (
        <MateriauxSheet
          lignes={produitsLignes}
          onAdd={addProduitLigne}
          onUpdate={updateProduitLigne}
          onRemove={removeProduitLigne}
          produitsCatalogue={produitsCatalogue}
          surfaceHa={surfaceHa}
          onClose={() => setShowMaterielSheet(false)}
        />
      )}
    </>
  );
}

function BigActionButton({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: typeof Clock;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/20 p-4 text-left transition-colors hover:border-green hover:bg-green/5"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background text-foreground/70">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{label}</span>
        <span className="mt-0.5 block truncate text-xs text-foreground/60">{hint}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-foreground/40" />
    </button>
  );
}

function FullscreenSheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[8000] flex flex-col bg-background"
      role="dialog"
      aria-label={title}
    >
      <header className="border-b border-border bg-background p-3 sm:p-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h2>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>
      </div>
      {footer && (
        <footer className="border-t border-border bg-background p-3 sm:p-4">
          <div className="mx-auto flex max-w-3xl justify-end gap-2">{footer}</div>
        </footer>
      )}
    </div>
  );
}

function TempsSheet({
  value,
  onChange,
  tauxCHF,
  onTauxChange,
  showTaux,
  onClose,
}: {
  value: HeuresSimplesValue;
  onChange: (v: HeuresSimplesValue) => void;
  tauxCHF: string;
  onTauxChange: (v: string) => void;
  showTaux: boolean;
  onClose: () => void;
}) {
  return (
    <FullscreenSheet
      title="Ajouter du temps"
      onClose={onClose}
      footer={
        <Button type="button" onClick={onClose} className="h-11 px-6">
          OK
        </Button>
      }
    >
      <div className="space-y-5">
        <HeuresSimplesInput value={value} onChange={onChange} />
        {showTaux && (
          <Field
            label="Taux horaire (CHF / h)"
            hint="Optionnel — utilisé pour le total et le push Odoo."
          >
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.05"
              value={tauxCHF}
              onChange={(e) => onTauxChange(e.target.value)}
              placeholder="Ex. 80"
              className="h-12 text-base"
            />
          </Field>
        )}
      </div>
    </FullscreenSheet>
  );
}

interface DraftProduitForSheet {
  uid: string;
  produitId: string;
  quantite: string;
}

function MateriauxSheet({
  lignes,
  onAdd,
  onUpdate,
  onRemove,
  produitsCatalogue,
  surfaceHa,
  onClose,
}: {
  lignes: DraftProduitForSheet[];
  onAdd: () => void;
  onUpdate: (idx: number, patch: Partial<DraftProduitForSheet>) => void;
  onRemove: (idx: number) => void;
  produitsCatalogue: Array<{ id: string; libelle: string; unite: string }>;
  surfaceHa: number | null;
  onClose: () => void;
}) {
  return (
    <FullscreenSheet
      title="Ajouter du matériel"
      onClose={onClose}
      footer={
        <Button type="button" onClick={onClose} className="h-11 px-6">
          OK
        </Button>
      }
    >
      <div className="space-y-3">
        {surfaceHa != null && (
          <p className="text-xs text-foreground/60">
            Astuce : pour une dose à l'hectare × {surfaceHa.toFixed(2)} ha = quantité totale.
          </p>
        )}
        {lignes.length === 0 && (
          <p className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-foreground/60">
            Aucun produit pour l'instant. Clique sur « Ajouter un produit » pour commencer.
          </p>
        )}
        {lignes.map((ligne, idx) => {
          const produit = produitsCatalogue.find((p) => p.id === ligne.produitId);
          return (
            <div key={ligne.uid} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <ProduitFullscreenPicker
                    value={ligne.produitId}
                    onChange={(id) => onUpdate(idx, { produitId: id })}
                    placeholder="Choisir un produit…"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(idx)}
                  aria-label="Supprimer cette ligne"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {ligne.produitId && (
                <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={ligne.quantite}
                    onChange={(e) => onUpdate(idx, { quantite: e.target.value })}
                    placeholder="Quantité totale"
                    className="h-11"
                  />
                  <span className="flex h-11 items-center justify-center rounded-lg border border-border bg-muted/30 px-3 text-sm font-medium text-foreground/70">
                    {produit?.unite ?? ""}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-green bg-background py-4 text-sm font-semibold text-green hover:bg-green/5"
        >
          <Plus className="h-4 w-4" />
          Ajouter un produit
        </button>
      </div>
    </FullscreenSheet>
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
  odooConnected,
  pushResult,
  onPush,
  pushing,
  pushError,
  onValidate,
  validating,
  onCancel,
  cancelling,
}: {
  travail: NonNullable<ReturnType<typeof useTravail>["data"]>;
  odooConnected: boolean;
  pushResult: PushTravailResult | null;
  onPush: () => void;
  pushing: boolean;
  pushError: string | null;
  onValidate: () => void;
  validating: boolean;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const total = totalTravailCHF(travail);
  const showOdooBanner = odooConnected && travail.statut !== "CANCELLED" && !travail.interne;
  const hasOdooLink = !!(travail.odooSaleOrderId || travail.odooTaskId);

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

      {showOdooBanner && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 sm:px-5">
          {hasOdooLink ? (
            <div className="flex flex-wrap items-center gap-3">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-amber-700" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-amber-900">
                  {travail.odooSaleOrderId
                    ? `Devis Odoo créé · sale.order #${travail.odooSaleOrderId}`
                    : `Tâche Odoo créée · project.task #${travail.odooTaskId}`}
                </p>
                <p className="text-xs text-foreground/70">
                  {travail.odooSaleOrderId
                    ? "Pour re-pousser, annule d'abord le devis dans Odoo."
                    : "La tâche contient le détail des heures et des employés."}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Send className="h-5 w-5 flex-shrink-0 text-amber-700" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-amber-900">Push Odoo en attente</p>
                <p className="text-xs text-foreground/70">
                  Le push se déclenche automatiquement au save quand le travail a au moins une ligne
                  (heure ou produit). Si rien n'est arrivé après quelques secondes, clique
                  "Réessayer".
                </p>
              </div>
              <Button type="button" onClick={onPush} disabled={pushing} size="sm" variant="ghost">
                <Send className="mr-1 h-4 w-4" />
                {pushing ? "Envoi…" : "Réessayer"}
              </Button>
            </div>
          )}
        </div>
      )}

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
          Push Odoo échoué : {pushError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {travail.statut === "DRAFT" && (
          <Button type="button" onClick={onValidate} disabled={validating}>
            <CheckCircle2 className="mr-1 h-4 w-4" />
            {validating ? "Validation…" : "Valider"}
          </Button>
        )}
        {(travail.statut === "DRAFT" || travail.statut === "VALIDATED") && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={cancelling}>
            <XCircle className="mr-1 h-4 w-4" />
            {cancelling ? "Annulation…" : "Annuler ce travail"}
          </Button>
        )}
      </div>
    </div>
  );
}
