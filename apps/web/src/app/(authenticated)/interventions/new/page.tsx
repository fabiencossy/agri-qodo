"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import area from "@turf/area";
import { CalendarDays, Clock } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { BigActionButton } from "@/components/activites/big-action-button";
import { PhotosField } from "@/components/activites/photos-field";
import { TypeSaisieHeader } from "@/components/activites/type-saisie-header";
import { EditActionsMenu } from "@/components/activites/edit-actions-menu";
import { type HeuresSimplesValue } from "@/components/activites/heures-simples-input";
import { TempsSheet } from "@/components/activites/temps-sheet";
import { extractApiErrorMessage } from "@/lib/api-client";
import { useTenantDetail } from "@/lib/tenants";
import { useUsers } from "@/lib/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaterielPicker } from "@/components/ui/materiel-picker";
import { ParcelleSearchSelect } from "@/components/ui/parcelle-search-select";
import { ProduitFullscreenPicker } from "@/components/ui/produit-fullscreen-picker";
import {
  emojiType,
  type InterventionGeoJsonPolygon,
  type InterventionType,
  libelleType,
  TECHNIQUE_LABEL,
  TECHNIQUES_ORDER,
  type TechniqueEpandage,
  TYPES_ORDER,
  useCompleteIntervention,
  useCreateIntervention,
  useDeleteIntervention,
  useIntervention,
  useInterventionsWithGeom,
  useUpdateIntervention,
} from "@/lib/interventions";
import { formatSurface, useParcelle, useParcelles } from "@/lib/parcelles";
import { useCheckFumureOrganique } from "@/lib/per";

// Leaflet a besoin de window — on dynamiquement charge sans SSR.
const InterventionSubzoneDrawMap = dynamic(
  () => import("@/components/maps/intervention-subzone-draw-map"),
  { ssr: false, loading: () => <div className="h-[400px] animate-pulse rounded-xl bg-muted" /> },
);
import {
  type Produit,
  type ProduitCategorie,
  type ProduitUnite,
  UNITE_LABEL,
  useProduits,
} from "@/lib/produits";

const formSchema = z.object({
  parcelleId: z.string().uuid("Parcelle obligatoire"),
  type: z.enum([
    "SEMIS",
    "FUMURE_ORGANIQUE",
    "FUMURE_MINERALE",
    "PHYTO",
    "RECOLTE",
    "TRAVAIL_DU_SOL",
    "IRRIGATION",
    "AUTRE",
  ]),
  dateOperation: z.string().min(1, "Date obligatoire"),
  produitId: z.string().uuid().optional().or(z.literal("")),
  produit: z.string().max(200).optional().or(z.literal("")),
  materielId: z.string().uuid().optional().or(z.literal("")),
  surfaceHa: z.coerce.number().positive().optional().or(z.literal(NaN)),
  rendementParHa: z.coerce.number().min(0).optional().or(z.literal(NaN)),
  quantite: z.coerce.number().min(0).optional().or(z.literal(NaN)),
  unite: z.string().max(20).optional().or(z.literal("")),
  techniqueEpandage: z
    .enum([
      "EPANDEUR_CLASSIQUE",
      "RAMPE_PENDILLARDE",
      "TRAINEE_SOUPLE",
      "INJECTION",
      "FUMIER_SOLIDE",
    ])
    .optional()
    .or(z.literal("")),
  surfaceTravailleeM2: z.coerce.number().positive().optional().or(z.literal(NaN)),
  notes: z.string().max(500).optional().or(z.literal("")),
});

// Types d'intervention pour lesquels une saisie de surface partielle a du
// sens : on ne travaille pas forcément toute la parcelle.
const TYPES_AVEC_SURFACE_PARTIELLE: ReadonlyArray<InterventionType> = [
  "TRAVAIL_DU_SOL",
  "SEMIS",
  "RECOLTE",
  "PHYTO",
  "IRRIGATION",
];

type FormValues = z.infer<typeof formSchema>;

const today = (): string => new Date().toISOString().slice(0, 10);

// Mapping type d'intervention → catégorie de produit du catalogue.
// Pour SEMIS le produit est obligatoire (déclenche la Culture). Pour les
// autres types c'est facultatif (peut être un produit non catalogué).
const CATEGORIE_FOR_TYPE: Partial<Record<InterventionType, ProduitCategorie>> = {
  SEMIS: "SEMENCE",
  FUMURE_ORGANIQUE: "ENGRAIS_ORGANIQUE",
  FUMURE_MINERALE: "ENGRAIS_MINERAL",
  PHYTO: "PHYTO",
};

// Forme physique du produit déduite de l'unité — détermine les techniques
// d'épandage compatibles. Lisier en m³/L = liquide ; fumier en kg/t = solide ;
// doses (semences) = autre.
function formeProduit(unite: ProduitUnite): "liquide" | "solide" | "autre" {
  if (unite === "L" || unite === "M3") return "liquide";
  if (unite === "KG" || unite === "T") return "solide";
  return "autre";
}

export default function NewInterventionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetParcelleId = searchParams?.get("parcelleId") ?? "";
  // Mode édition : ?edit={id} → on fetch l'intervention existante et on
  // pré-remplit. Le backend interdit la modification de parcelleId, type
  // et produitId (cf UpdateInterventionDto) — ces champs sont disabled
  // dans le formulaire en mode édition.
  const editId = searchParams?.get("edit") ?? "";
  const isEditMode = !!editId;
  const existingIntervention = useIntervention(editId || undefined);
  const createMutation = useCreateIntervention();
  const updateMutation = useUpdateIntervention();
  const deleteIntervention = useDeleteIntervention();
  const completeIntervention = useCompleteIntervention();
  const tenantDetail = useTenantDetail();
  const heuresVisibles = tenantDetail.data?.heuresVisiblesCarnet !== false;
  const users = useUsers();
  const [heures, setHeures] = useState<HeuresSimplesValue>({
    heureDebut: "",
    heureFin: "",
    heureDebutPause: "",
    dureePauseMinutes: 0,
    dureeMinutes: 0,
  });
  // Modal plein écran "Ajouter du temps" (décision Fabien 2026-05-14 :
  // sortir la saisie d'heures du formulaire principal, comme Travaux).
  const [showTempsSheet, setShowTempsSheet] = useState(false);
  // Sprint 2 fusion-interventions — Planning : juste assignedToUserId.
  // datePrevue n'est plus un champ séparé, on prend `dateOperation` quand
  // on clique sur "Planifier".
  const [assignedToUserId, setAssignedToUserId] = useState<string>("");
  const parcelles = useParcelles();
  const produits = useProduits();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      parcelleId: presetParcelleId,
      type: "SEMIS",
      dateOperation: today(),
      produitId: "",
      produit: "",
      materielId: "",
      surfaceHa: undefined,
      rendementParHa: undefined,
      quantite: undefined,
      unite: "",
      techniqueEpandage: "",
      surfaceTravailleeM2: undefined,
      notes: "",
    },
  });

  // Pré-remplissage en mode édition : reset une fois que l'intervention
  // existante est chargée. Garde-fou via une ref-like (loadedRef) pour
  // éviter de reset à chaque re-render.
  const [loadedId, setLoadedId] = useState<string>("");
  useEffect(() => {
    if (!isEditMode || !existingIntervention.data) return;
    if (loadedId === existingIntervention.data.id) return;
    setLoadedId(existingIntervention.data.id);
    const iv = existingIntervention.data;
    reset({
      parcelleId: iv.parcelleId,
      type: iv.type,
      dateOperation: iv.dateOperation.slice(0, 10),
      produitId: iv.produitId ?? "",
      produit: iv.produit ?? "",
      materielId: iv.materielId ?? "",
      surfaceHa: iv.surfaceHa ? Number(iv.surfaceHa) : undefined,
      rendementParHa: undefined,
      quantite: iv.quantite ? Number(iv.quantite) : undefined,
      unite: iv.unite ?? "",
      techniqueEpandage: "",
      surfaceTravailleeM2: iv.surfaceTravailleeM2 ? Number(iv.surfaceTravailleeM2) : undefined,
      notes: iv.notes ?? "",
    });
    // Note : on ne touche pas `toutLeChamp` ici — l'effet
    // selectedParcelleId le reset à true. L'utilisateur peut décocher
    // s'il veut modifier la sous-zone partielle.
  }, [isEditMode, existingIntervention.data, loadedId, reset]);

  const selectedType = useWatch({ control, name: "type" });
  const selectedProduitId = useWatch({ control, name: "produitId" });
  const selectedParcelleId = useWatch({ control, name: "parcelleId" });
  const selectedDate = useWatch({ control, name: "dateOperation" });
  const categorie = CATEGORIE_FOR_TYPE[selectedType];

  // Check live ORRChim : si FUMURE_ORGANIQUE, vérifier si la date est interdite
  const interdictionCheck = useCheckFumureOrganique(
    selectedType === "FUMURE_ORGANIQUE" ? selectedParcelleId : undefined,
    selectedType === "FUMURE_ORGANIQUE" ? selectedDate : undefined,
  );

  const filteredProduits = useMemo<Produit[]>(() => {
    if (!produits.data) return [];
    if (!categorie) return [];
    return produits.data
      .filter((p) => p.categorie === categorie && p.actif)
      .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
  }, [produits.data, categorie]);

  const selectedProduit = filteredProduits.find((p) => p.id === selectedProduitId);

  // Auto-remplit l'unité du formulaire à partir de l'unité du produit choisi.
  // L'agriculteur n'a plus à se demander si c'est kg, L, m³…
  useEffect(() => {
    if (selectedProduit) {
      setValue("unite", UNITE_LABEL[selectedProduit.unite]);
    }
  }, [selectedProduit, setValue]);

  // Filtrage des techniques d'épandage selon la forme du produit (déduite
  // de l'unité). Lisier (L/M3) → techniques liquides ; fumier (KG/T) →
  // techniques solides. Évite de proposer "pendillard" sur du fumier.
  const techniquesAutorisees = useMemo(() => {
    const forme = selectedProduit ? formeProduit(selectedProduit.unite) : null;
    if (forme === "liquide") {
      return ["RAMPE_PENDILLARDE", "TRAINEE_SOUPLE", "INJECTION", "EPANDEUR_CLASSIQUE"] as const;
    }
    if (forme === "solide") {
      return ["FUMIER_SOLIDE", "EPANDEUR_CLASSIQUE"] as const;
    }
    return TECHNIQUES_ORDER;
  }, [selectedProduit]);

  const [toutLeChamp, setToutLeChamp] = useState(true);
  // Mode de saisie de la sous-zone : numérique (m² entré au clavier) ou
  // dessiné sur carte (polygone clippé à la parcelle, surface auto).
  const [modeSaisieZone, setModeSaisieZone] = useState<"numerique" | "dessin">("numerique");
  const [sousZoneGeom, setSousZoneGeom] = useState<InterventionGeoJsonPolygon | null>(null);
  const [sousZoneSurfaceM2, setSousZoneSurfaceM2] = useState<number | null>(null);
  // Aire de chevauchement avec un SEMIS déjà tracé (sur-semis). 0 = aucun
  // chevauchement. > 0 = afficher avertissement + dialog de confirmation
  // au submit. Décision Fabien 2026-05-08 : sur-semis autorisé mais avec
  // confirmation explicite.
  const [sousZoneOverlapM2, setSousZoneOverlapM2] = useState<number>(0);

  const selectedParcelle = parcelles.data?.find((p) => p.id === selectedParcelleId);
  // Le getById expose la geom — utile pour afficher le contour parent.
  const parcelleDetail = useParcelle(selectedParcelleId || undefined);
  const surfaceParcelleM2 = selectedParcelle ? Number(selectedParcelle.surfaceM2) : 0;
  // Pour SEMIS et RECOLTE, on force le choix binaire toute-parcelle vs
  // dessin (pas de saisie numérique). Décision Fabien 2026-05-08 :
  // ces types alimentent le plan d'assolement, on veut une géométrie
  // précise ou rien.
  const forceDessinMode = selectedType === "SEMIS" || selectedType === "RECOLTE";
  // Switch auto vers le mode dessin quand on passe sur SEMIS/RECOLTE
  // (les seuls modes valides étant alors "toute la parcelle" ou dessin).
  useEffect(() => {
    if (forceDessinMode) setModeSaisieZone("dessin");
  }, [forceDessinMode]);
  // La géom de la parcelle peut couvrir une surface différente de
  // surfaceM2 déclaré (import cadastre vs saisie manuelle, etc.). Pour
  // le check "sous-zone trop grande" on doit comparer à l'aire réelle
  // de la géom (le backend valide via ST_Within, pas vs surfaceM2).
  // Sinon on affiche un faux warning quand la géom > surface déclarée.
  const parcelleGeomAreaM2 = useMemo(() => {
    const geom = parcelleDetail.data?.geom;
    if (!geom) return null;
    try {
      return area({ type: "Feature", geometry: geom, properties: {} });
    } catch {
      return null;
    }
  }, [parcelleDetail.data?.geom]);
  // Plan d'assolement : sous-zones SEMIS déjà tracées sur cette parcelle
  // (autres cultures). On les soustrait à la zone tracable pour que
  // l'utilisateur ne puisse pas semer 2 cultures au même endroit. En mode
  // édition, on exclut l'intervention en cours pour qu'elle reste
  // re-traçable.
  const interventionsGeom = useInterventionsWithGeom(
    selectedParcelleId ? { parcelleId: selectedParcelleId } : undefined,
  );
  const forbiddenZones = useMemo(() => {
    if (!interventionsGeom.data) return [];
    return interventionsGeom.data
      .filter((iv) => iv.type === "SEMIS" && iv.geom && iv.id !== editId)
      .map((iv) => iv.geom!);
  }, [interventionsGeom.data, editId]);
  const peutSaisirSurfacePartielle = TYPES_AVEC_SURFACE_PARTIELLE.includes(selectedType);

  // Quand on change de parcelle, on revient à "toute la parcelle" et
  // on pré-remplit la surface (utile si l'utilisateur décoche).
  useEffect(() => {
    setToutLeChamp(true);
    setSousZoneGeom(null);
    setSousZoneSurfaceM2(null);
    setModeSaisieZone("numerique");
    if (surfaceParcelleM2 > 0) {
      setValue("surfaceTravailleeM2", surfaceParcelleM2);
    }
  }, [selectedParcelleId, surfaceParcelleM2, setValue]);

  /**
   * Sérialise le bloc heures pour le DTO backend (PRD fusion v0.2 §3.3).
   * - Mode "times" : combine la dateOperation + HH:MM → 2 ISO datetime.
   * - Mode "duree" : juste dureeMinutes.
   * - Vide : rien (toggle masqué ou non rempli).
   */
  function buildHeuresPayload(date: string): {
    heureDebut?: string;
    heureFin?: string;
    dureeMinutes?: number;
  } {
    if (!heuresVisibles) return {};
    if (heures.heureDebut && heures.heureFin) {
      return {
        heureDebut: new Date(`${date}T${heures.heureDebut}:00`).toISOString(),
        heureFin: new Date(`${date}T${heures.heureFin}:00`).toISOString(),
      };
    }
    if (heures.dureeMinutes > 0) {
      return { dureeMinutes: heures.dureeMinutes };
    }
    return {};
  }

  /**
   * Sprint 2 fusion-interventions — submit "Planifier". Crée une pré-tâche
   * d'intervention avec datePrevue + parcelle + assigné, type AUTRE par
   * défaut (l'utilisateur précisera quand il complètera la saisie).
   */
  async function onSubmitPlanning() {
    const parcelleId = watch("parcelleId") || "";
    if (!parcelleId) {
      alert("Sélectionne une parcelle avant de planifier.");
      return;
    }
    const dateOp = watch("dateOperation") || today();
    try {
      await createMutation.mutateAsync({
        parcelleId,
        type: "AUTRE",
        dateOperation: dateOp,
        datePrevue: dateOp,
        ...(assignedToUserId ? { assignedToUserId } : {}),
      });
      router.push("/planning");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Échec de la planification.");
    }
  }

  const onSubmit = (values: FormValues) => {
    // Confirmation explicite si sur-semis (zone tracée chevauche un
    // SEMIS déjà en place, ou "toute la parcelle" coché alors qu'un
    // SEMIS existe sur la parcelle). Décision Fabien 2026-05-08.
    if (values.type === "SEMIS" && forbiddenZones.length > 0) {
      const overlapsByDraw = modeSaisieZone === "dessin" && sousZoneOverlapM2 > 1;
      const overlapsByFullField = toutLeChamp;
      if (overlapsByDraw || overlapsByFullField) {
        const detail = overlapsByDraw
          ? `${formatSurface(sousZoneOverlapM2)} chevauche${sousZoneOverlapM2 >= 1 ? "" : "nt"} une culture déjà en place`
          : "tu vas semer sur toute la parcelle alors qu'une culture y est déjà en place";
        const ok = window.confirm(`Sur-semis : ${detail}.\n\nTu confirmes ?`);
        if (!ok) return;
      }
    }
    // Construction de la portion "surface" de la requête, par priorité :
    //   1. toute la parcelle → on n'envoie ni surface ni geom.
    //   2. sous-zone dessinée → on envoie geomGeoJson, le backend
    //      recalcule la surface (la valeur saisie est ignorée).
    //   3. sous-zone numérique → on envoie surfaceTravailleeM2.
    const zoneFields: Pick<
      Parameters<typeof createMutation.mutate>[0],
      "surfaceTravailleeM2" | "geomGeoJson"
    > = (() => {
      if (toutLeChamp) return {};
      if (modeSaisieZone === "dessin" && sousZoneGeom) {
        return { geomGeoJson: sousZoneGeom };
      }
      if (values.surfaceTravailleeM2 && !Number.isNaN(values.surfaceTravailleeM2)) {
        return { surfaceTravailleeM2: values.surfaceTravailleeM2 };
      }
      return {};
    })();

    if (isEditMode && editId) {
      // Sprint 2 fusion-interventions : type, parcelleId et produitId sont
      // désormais modifiables (utile pour compléter une pré-tâche planning).
      updateMutation.mutate(
        {
          id: editId,
          parcelleId: values.parcelleId,
          type: values.type,
          dateOperation: values.dateOperation,
          ...(values.produitId ? { produitId: values.produitId } : { produitId: "" }),
          ...(values.produit ? { produit: values.produit } : {}),
          ...(values.materielId ? { materielId: values.materielId } : {}),
          ...(values.surfaceHa && !Number.isNaN(values.surfaceHa)
            ? { surfaceHa: values.surfaceHa }
            : {}),
          ...(values.rendementParHa && !Number.isNaN(values.rendementParHa)
            ? { rendementParHa: values.rendementParHa }
            : {}),
          ...(values.quantite && !Number.isNaN(values.quantite)
            ? { quantite: values.quantite }
            : {}),
          ...(values.unite ? { unite: values.unite } : {}),
          ...(values.techniqueEpandage
            ? { techniqueEpandage: values.techniqueEpandage as TechniqueEpandage }
            : {}),
          ...zoneFields,
          ...(values.notes ? { notes: values.notes } : {}),
          ...buildHeuresPayload(values.dateOperation),
          ...(assignedToUserId ? { assignedToUserId } : {}),
        },
        // En mode édition, on reste sur le formulaire (champs tjs
        // éditables — décision Fabien 2026-05-14). react-query refetch
        // tout seul pour refléter les nouvelles valeurs.
      );
      return;
    }

    createMutation.mutate(
      {
        parcelleId: values.parcelleId,
        type: values.type,
        dateOperation: values.dateOperation,
        ...(values.produitId ? { produitId: values.produitId } : {}),
        ...(values.produit ? { produit: values.produit } : {}),
        ...(values.materielId ? { materielId: values.materielId } : {}),
        ...(values.surfaceHa && !Number.isNaN(values.surfaceHa)
          ? { surfaceHa: values.surfaceHa }
          : {}),
        ...(values.rendementParHa && !Number.isNaN(values.rendementParHa)
          ? { rendementParHa: values.rendementParHa }
          : {}),
        ...(values.quantite && !Number.isNaN(values.quantite) ? { quantite: values.quantite } : {}),
        ...(values.unite ? { unite: values.unite } : {}),
        ...(values.techniqueEpandage
          ? { techniqueEpandage: values.techniqueEpandage as TechniqueEpandage }
          : {}),
        ...zoneFields,
        ...(values.notes ? { notes: values.notes } : {}),
        ...buildHeuresPayload(values.dateOperation),
        ...(assignedToUserId ? { assignedToUserId } : {}),
      },
      {
        // Après création, on reste sur le formulaire en mode édition
        // pour continuer à modifier (décision Fabien 2026-05-14).
        onSuccess: (created) => router.push(`/interventions/new?edit=${created.id}` as never),
      },
    );
  };

  const noParcelles = parcelles.data !== undefined && parcelles.data.length === 0;
  const semisSansProduit = selectedType === "SEMIS" && !selectedProduitId;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/app" },
          { label: "Carnet des champs", href: "/interventions" },
          { label: isEditMode ? "Modifier" : "Nouvelle intervention" },
        ]}
      />
      <div className="mx-auto max-w-2xl px-4 py-8">
        {!isEditMode && <TypeSaisieHeader active="carnet" />}
        <div className="mb-6 flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">
            {isEditMode ? "Modifier l'intervention" : "Saisir une intervention"}
          </h1>
          {isEditMode && editId && (
            <EditActionsMenu
              onComplete={() => {
                completeIntervention.mutate(editId, {
                  onSuccess: () => router.push("/activites"),
                });
              }}
              onDelete={() => {
                deleteIntervention.mutate(editId, {
                  onSuccess: () => router.push("/activites"),
                });
              }}
              completing={completeIntervention.isPending}
              deleting={deleteIntervention.isPending}
            />
          )}
        </div>

        {isEditMode && (
          <div
            className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            hidden
          >
            Le type d'opération, la parcelle et le produit catalogue ne sont pas modifiables — ils
            gouvernent la culture créée pour les SEMIS. Pour les changer, supprime cette saisie et
            crée-en une nouvelle.
          </div>
        )}

        {noParcelles && (
          <div className="mb-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
            Vous devez d'abord créer au moins une parcelle.{" "}
            <Link href="/parcelles/new" className="font-semibold underline hover:no-underline">
              Créer une parcelle
            </Link>
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5 rounded-xl border border-border bg-background p-3 sm:rounded-2xl sm:p-6"
        >
          <Field label="Date" error={errors.dateOperation?.message}>
            <Input type="date" {...register("dateOperation")} />
          </Field>

          <Field label="Assigné à">
            <select
              value={assignedToUserId}
              onChange={(e) => setAssignedToUserId(e.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
            >
              <option value="">— Personne —</option>
              {(users.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.prenom} {u.nom}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Parcelle" error={errors.parcelleId?.message}>
            <Controller
              control={control}
              name="parcelleId"
              render={({ field: { value, onChange } }) => (
                <ParcelleSearchSelect
                  value={value ?? ""}
                  onChange={(id) => onChange(id)}
                  required
                  disabled={noParcelles}
                />
              )}
            />
          </Field>

          {/* Bouton Planifier inline (Sprint 2 fusion-interventions) :
              soumet une pré-tâche sans heures/produits, type AUTRE par défaut.
              Pas dispo en mode édition. */}
          {!isEditMode && (
            <button
              type="button"
              onClick={() => onSubmitPlanning()}
              disabled={createMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-green bg-background py-3 text-sm font-semibold text-green transition-colors hover:bg-green/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CalendarDays className="h-4 w-4" />
              Planifier (sans saisir les détails)
            </button>
          )}

          <Field label="Type d'opération" error={errors.type?.message}>
            <Controller
              control={control}
              name="type"
              render={({ field: { value, onChange } }) => (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TYPES_ORDER.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        onChange(t);
                        // Reset produit quand on change de type pour
                        // éviter d'envoyer un produit incompatible.
                        setValue("produitId", "");
                      }}
                      className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-sm transition-colors ${
                        value === t
                          ? "border-green bg-green/10 font-medium text-green"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <span className="text-2xl">{emojiType(t)}</span>
                      <span className="text-xs">{libelleType(t)}</span>
                    </button>
                  ))}
                </div>
              )}
            />
          </Field>

          <Field
            label="Matériel utilisé"
            hint="Outil/machine utilisé : charrue, semoir, pulvé, ensileuse… Optionnel."
            actionRight={
              <Link href="/materiels" className="text-xs font-medium text-green hover:underline">
                + Gérer
              </Link>
            }
          >
            <Controller
              control={control}
              name="materielId"
              render={({ field: { value, onChange } }) => (
                <MaterielPicker
                  interventionType={selectedType}
                  value={value ?? ""}
                  onChange={(id) => onChange(id)}
                />
              )}
            />
          </Field>

          {categorie ? (
            <Field
              label={
                selectedType === "SEMIS"
                  ? "Semence (obligatoire pour le SEMIS)"
                  : "Produit catalogue"
              }
              hint={
                selectedType === "SEMIS"
                  ? 'Sélectionner la semence créera automatiquement la culture sur la parcelle. Si la semence n\'existe pas, tape son nom et clique sur "Créer".'
                  : "Optionnel : choisir un produit du catalogue, ou en créer un nouveau si pas trouvé."
              }
              error={errors.produitId?.message}
            >
              <Controller
                control={control}
                name="produitId"
                render={({ field: { value, onChange } }) => (
                  <ProduitFullscreenPicker
                    value={value ?? ""}
                    onChange={(id) => onChange(id)}
                    placeholder={
                      selectedType === "SEMIS"
                        ? "Choisir une semence…"
                        : "Choisir un produit du catalogue…"
                    }
                    defaultCategorie={categorie}
                  />
                )}
              />
            </Field>
          ) : null}

          {selectedType === "SEMIS" && selectedProduit?.especeCode ? (
            <div className="rounded-lg bg-green/5 px-4 py-3 text-sm text-green-900">
              <span className="font-medium">Culture qui sera créée :</span>{" "}
              {selectedProduit.especeCode} — {selectedProduit.libelle}, campagne{" "}
              {new Date().getUTCFullYear()}
            </div>
          ) : null}

          {!categorie || selectedType === "AUTRE" ? (
            <Field
              label="Produit (libellé libre)"
              hint="Nom commercial si pas dans le catalogue"
              error={errors.produit?.message}
            >
              <Input placeholder="Roundup MAX 360" {...register("produit")} />
            </Field>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Quantité (optionnel)"
              hint="Quantité totale appliquée pour toute la surface concernée (ex : 200 kg de semence sur 2 ha = saisis 200, pas 100 kg/ha)."
              error={errors.quantite?.message}
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="25.5"
                {...register("quantite")}
              />
            </Field>
            <Field
              label="Unité"
              {...(selectedProduit ? { hint: "Auto-remplie depuis le produit catalogue." } : {})}
              error={errors.unite?.message}
            >
              <Input placeholder="L, kg, t, ha…" {...register("unite")} />
            </Field>
          </div>

          {selectedType === "RECOLTE" && (
            <Field
              label="Rendement à l'hectare (optionnel)"
              hint="Productivité de la parcelle. Ex : 80 q/ha de blé, 12 t/ha de maïs."
              error={errors.rendementParHa?.message}
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="80"
                {...register("rendementParHa")}
              />
            </Field>
          )}

          {peutSaisirSurfacePartielle && selectedParcelle && (
            <Field label="Surface concernée">
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={toutLeChamp}
                    onChange={(e) => {
                      setToutLeChamp(e.target.checked);
                      if (e.target.checked && surfaceParcelleM2 > 0) {
                        setValue("surfaceTravailleeM2", surfaceParcelleM2);
                      }
                      if (e.target.checked) {
                        setSousZoneGeom(null);
                        setSousZoneSurfaceM2(null);
                      }
                    }}
                    className="h-4 w-4"
                  />
                  <span>Toute la parcelle ({formatSurface(surfaceParcelleM2)})</span>
                </label>
                {!toutLeChamp && !forceDessinMode && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setModeSaisieZone("numerique")}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                        modeSaisieZone === "numerique"
                          ? "border-green bg-green text-white"
                          : "border-border bg-background hover:bg-muted"
                      }`}
                    >
                      Saisir une surface
                    </button>
                    <button
                      type="button"
                      onClick={() => setModeSaisieZone("dessin")}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                        modeSaisieZone === "dessin"
                          ? "border-green bg-green text-white"
                          : "border-border bg-background hover:bg-muted"
                      }`}
                      disabled={!parcelleDetail.data?.geom}
                      title={
                        parcelleDetail.data?.geom
                          ? "Dessine la zone exacte sur la carte (alimente le plan d'assolement)"
                          : "Dessin indisponible : la parcelle n'a pas de géométrie"
                      }
                    >
                      Dessiner sur la carte
                    </button>
                  </div>
                )}
                {!toutLeChamp && !forceDessinMode && modeSaisieZone === "numerique" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={surfaceParcelleM2}
                        placeholder={String(surfaceParcelleM2)}
                        {...register("surfaceTravailleeM2")}
                      />
                      <span className="text-sm text-foreground/60">m²</span>
                      <span className="text-xs text-foreground/50">
                        / {formatSurface(surfaceParcelleM2)}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/50">
                      Saisis la surface réellement {libelleType(selectedType).toLowerCase()}e (ex.
                      seulement la moitié sud de la parcelle).
                    </p>
                  </>
                )}
                {!toutLeChamp &&
                  (forceDessinMode || modeSaisieZone === "dessin") &&
                  parcelleDetail.data?.geom && (
                    <>
                      <InterventionSubzoneDrawMap
                        parcelleGeom={parcelleDetail.data.geom}
                        forbiddenZones={forbiddenZones}
                        {...(surfaceParcelleM2 > 0 ? { maxSurfaceM2: surfaceParcelleM2 } : {})}
                        onPolygonChange={(geom, m2) => {
                          setSousZoneGeom(geom);
                          setSousZoneSurfaceM2(m2 > 0 ? m2 : null);
                        }}
                        onOverlapChange={(m2) => setSousZoneOverlapM2(m2)}
                      />
                      {sousZoneOverlapM2 > 1 && (
                        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          ⚠️ Sur-semis détecté : ta zone chevauche{" "}
                          <strong>{formatSurface(sousZoneOverlapM2)}</strong> de culture déjà en
                          place. Une confirmation te sera demandée à l&apos;enregistrement.
                        </p>
                      )}
                      {sousZoneSurfaceM2 !== null &&
                        parcelleGeomAreaM2 !== null &&
                        sousZoneSurfaceM2 > parcelleGeomAreaM2 * 1.001 && (
                          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            Attention, la zone tracée ({formatSurface(sousZoneSurfaceM2)}) dépasse
                            la géométrie de la parcelle ({formatSurface(parcelleGeomAreaM2)}).
                            Re-trace à l&apos;intérieur des limites de la parcelle.
                          </p>
                        )}
                      {sousZoneSurfaceM2 !== null &&
                        parcelleGeomAreaM2 !== null &&
                        surfaceParcelleM2 > 0 &&
                        Math.abs(parcelleGeomAreaM2 - surfaceParcelleM2) / surfaceParcelleM2 >
                          0.05 && (
                          <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">
                            <p>
                              Note : la géométrie de cette parcelle couvre{" "}
                              <strong>{formatSurface(parcelleGeomAreaM2)}</strong> alors que sa
                              surface déclarée est{" "}
                              <strong>{formatSurface(surfaceParcelleM2)}</strong>. Si l&apos;écart
                              te semble anormal, re-trace la parcelle.
                            </p>
                            {selectedParcelleId && (
                              <Link
                                href={`/parcelles/${selectedParcelleId}/edit`}
                                className="mt-1 inline-block font-medium underline hover:no-underline"
                              >
                                Modifier la parcelle →
                              </Link>
                            )}
                          </div>
                        )}
                      <p className="text-xs text-foreground/50">
                        Cette zone alimentera le plan d'assolement. Tu peux saisir plusieurs
                        interventions SEMIS distinctes (une par culture) avec leur propre polygone
                        pour découper la parcelle en zones.
                      </p>
                    </>
                  )}
              </div>
            </Field>
          )}

          {selectedType === "FUMURE_ORGANIQUE" && (
            <Field
              label="Technique d'épandage"
              hint="Détermine la perte d'azote par volatilisation NH3 dans le bilan PER. Sans précision, 30% sont déduits par défaut."
              error={errors.techniqueEpandage?.message}
            >
              <select
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
                {...register("techniqueEpandage")}
              >
                <option value="">Non précisée (épandeur classique présumé)</option>
                {techniquesAutorisees.map((t) => (
                  <option key={t} value={t}>
                    {TECHNIQUE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {/* Bouton "Ajouter du temps" → modal plein écran + résumé
              détaillé en dessous (décision Fabien 2026-05-14 v2). */}
          {heuresVisibles && (
            <div className="space-y-2">
              <BigActionButton
                icon={Clock}
                label="Ajouter du temps"
                hint={heures.dureeMinutes > 0 ? "Modifier le temps saisi" : "Aucun temps saisi"}
                onClick={() => setShowTempsSheet(true)}
              />
              {heures.dureeMinutes > 0 && (
                <div className="rounded-xl border border-border bg-background px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-foreground/60">Durée effective</span>
                    <span className="font-mono font-semibold">
                      {Math.floor(heures.dureeMinutes / 60)}h
                      {String(heures.dureeMinutes % 60).padStart(2, "0")}
                    </span>
                  </div>
                  {(heures.heureDebut || heures.heureFin) && (
                    <div className="mt-1 flex items-center justify-between gap-2 text-foreground/60">
                      <span>Horaire</span>
                      <span className="font-mono">
                        {heures.heureDebut || "—"} → {heures.heureFin || "—"}
                      </span>
                    </div>
                  )}
                  {heures.dureePauseMinutes > 0 && (
                    <div className="mt-1 flex items-center justify-between gap-2 text-foreground/60">
                      <span>Pause</span>
                      <span className="font-mono">{heures.dureePauseMinutes} min</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <Field label="Notes (optionnel)" error={errors.notes?.message}>
            <textarea
              className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
              placeholder="Conditions météo, observations…"
              {...register("notes")}
            />
          </Field>

          <Field label="Photos (optionnel)">
            <PhotosField
              parent={
                isEditMode && editId ? { kind: "intervention", id: editId } : { kind: "none" }
              }
            />
          </Field>

          {interdictionCheck.data?.interdit && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <strong>⚠️ Période d'interdiction PER :</strong> {interdictionCheck.data.raison}
              {interdictionCheck.data.prochaineFenetreOuverture && (
                <>
                  {" "}
                  Prochaine fenêtre autorisée :{" "}
                  <strong>{interdictionCheck.data.prochaineFenetreOuverture}</strong>.
                </>
              )}
              <br />
              <span className="text-xs">
                La saisie reste possible (sols dégelés, exception cantonale…) mais sera signalée
                dans le bilan PER.
              </span>
            </div>
          )}

          {(createMutation.isError || updateMutation.isError) && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <strong>{isEditMode ? "Modification impossible" : "Saisie impossible"} :</strong>{" "}
              {extractApiErrorMessage(createMutation.error ?? updateMutation.error) ??
                "Vérifie les valeurs et réessaie."}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              size="lg"
              className="flex-1"
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                (!isEditMode && (noParcelles || semisSansProduit))
              }
            >
              {isEditMode
                ? updateMutation.isPending
                  ? "Modification…"
                  : "Enregistrer les modifications"
                : createMutation.isPending
                  ? "Enregistrement…"
                  : "Enregistrer"}
            </Button>
            <Link href={isEditMode ? (`/interventions/${editId}` as never) : "/interventions"}>
              <Button type="button" variant="ghost" size="lg">
                Annuler
              </Button>
            </Link>
          </div>
        </form>
      </div>

      {showTempsSheet && (
        <TempsSheet value={heures} onChange={setHeures} onClose={() => setShowTempsSheet(false)} />
      )}
    </>
  );
}

function Field({
  label,
  hint,
  error,
  actionRight,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | undefined;
  actionRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="block text-sm font-medium">{label}</label>
        {actionRight}
      </div>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-foreground/50">{hint}</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
