"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaterielPicker } from "@/components/ui/materiel-picker";
import { ParcelleSearchSelect } from "@/components/ui/parcelle-search-select";
import { PartenaireSelect } from "@/components/ui/partenaire-select";
import { ProduitSearchSelect } from "@/components/ui/produit-search-select";
import {
  emojiType,
  type InterventionGeoJsonPolygon,
  type InterventionType,
  libelleType,
  TECHNIQUE_LABEL,
  TECHNIQUES_ORDER,
  type TechniqueEpandage,
  TYPES_ORDER,
  useCreateIntervention,
} from "@/lib/interventions";
import { formatSurface, useParcelle, useParcelles, useParcellesAccessibles } from "@/lib/parcelles";
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
  const createMutation = useCreateIntervention();
  const parcelles = useParcelles();
  const accessiblesParcelles = useParcellesAccessibles();
  const produits = useProduits();

  const {
    register,
    handleSubmit,
    control,
    setValue,
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

  // Client choisi en haut du formulaire — sert à filtrer les parcelles
  // visibles dans le ParcelleSearchSelect (UX "trouver vite la bonne parcelle").
  // Pas persisté côté serveur : le tenantId effectif vient de la parcelle.
  const [clientId, setClientId] = useState("");

  const [toutLeChamp, setToutLeChamp] = useState(true);
  // Mode de saisie de la sous-zone : numérique (m² entré au clavier) ou
  // dessiné sur carte (polygone clippé à la parcelle, surface auto).
  const [modeSaisieZone, setModeSaisieZone] = useState<"numerique" | "dessin">("numerique");
  const [sousZoneGeom, setSousZoneGeom] = useState<InterventionGeoJsonPolygon | null>(null);
  const [sousZoneSurfaceM2, setSousZoneSurfaceM2] = useState<number | null>(null);

  const selectedParcelle = parcelles.data?.find((p) => p.id === selectedParcelleId);
  // Détection cas A (parcelle perso) vs cas B (parcelle d'un partenaire) —
  // pour afficher le bandeau "facturé à {client}" et déclencher le push
  // automatique sale.order Odoo (PR-6).
  const accessibleParcelle = accessiblesParcelles.data?.find((p) => p.id === selectedParcelleId);
  const casB = accessibleParcelle && !accessibleParcelle.isOwn;
  const proprietaireParcelle = accessibleParcelle?.tenant;
  // Le getById expose la geom — utile pour afficher le contour parent.
  const parcelleDetail = useParcelle(selectedParcelleId || undefined);
  const surfaceParcelleM2 = selectedParcelle ? Number(selectedParcelle.surfaceM2) : 0;
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

  const onSubmit = (values: FormValues) => {
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
      },
      {
        onSuccess: () => router.push("/interventions"),
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
          { label: "Nouvelle intervention" },
        ]}
      />
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Saisir une intervention</h1>

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

          <Field
            label="Client (optionnel)"
            hint="Si renseigné, filtre les parcelles à celles du client. Laisse vide pour tes parcelles."
          >
            <PartenaireSelect
              value={clientId}
              onChange={(id) => {
                setClientId(id);
                // Reset parcelle si on change de client (sinon l'ID
                // sélectionné peut ne plus matcher la liste filtrée).
                setValue("parcelleId", "");
              }}
              placeholder="Choisir un client lié…"
            />
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
                  {...(clientId ? { filtreTenantId: clientId } : {})}
                />
              )}
            />
          </Field>

          {casB && proprietaireParcelle && (
            <div className="flex items-start gap-3 rounded-2xl border-2 border-amber-300 bg-white p-4 text-sm dark:border-amber-800 dark:bg-zinc-900">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-600 text-white">
                <span className="text-base" aria-hidden>
                  💼
                </span>
              </span>
              <div className="flex-1">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  Prestation pour <strong>{proprietaireParcelle.nom}</strong>
                </p>
                <p className="mt-1 text-xs text-foreground/80">
                  L'intervention sera enregistrée dans le carnet du client (en attente de
                  validation) et générera un devis Odoo facturable.
                </p>
              </div>
            </div>
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
            label={casB ? "Matériel utilisé (facturé au client)" : "Matériel utilisé"}
            hint={
              casB
                ? "Le matériel sélectionné servira à générer la ligne de facture Odoo (quantité = surface en hectares)."
                : "Outil/machine utilisé : charrue, semoir, pulvé, ensileuse… Optionnel."
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
                  <ProduitSearchSelect
                    categorie={categorie}
                    value={value ?? ""}
                    onChange={(id) => onChange(id)}
                    placeholder={
                      selectedType === "SEMIS"
                        ? "Choisir une semence…"
                        : "Choisir un produit du catalogue…"
                    }
                    required={selectedType === "SEMIS"}
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
            <Field label="Quantité (optionnel)" error={errors.quantite?.message}>
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
                {!toutLeChamp && (
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
                {!toutLeChamp && modeSaisieZone === "numerique" && (
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
                {!toutLeChamp && modeSaisieZone === "dessin" && parcelleDetail.data?.geom && (
                  <>
                    <InterventionSubzoneDrawMap
                      parcelleGeom={parcelleDetail.data.geom}
                      onPolygonChange={(geom, m2) => {
                        setSousZoneGeom(geom);
                        setSousZoneSurfaceM2(m2 > 0 ? m2 : null);
                      }}
                    />
                    {sousZoneSurfaceM2 !== null &&
                      sousZoneSurfaceM2 > surfaceParcelleM2 * 1.001 && (
                        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          Attention, la zone tracée ({formatSurface(sousZoneSurfaceM2)}) dépasse la
                          surface de la parcelle ({formatSurface(surfaceParcelleM2)}). Le serveur
                          rejettera la sauvegarde.
                        </p>
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

          <Field label="Notes (optionnel)" error={errors.notes?.message}>
            <textarea
              className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
              placeholder="Conditions météo, observations…"
              {...register("notes")}
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

          {createMutation.isError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Saisie impossible. Vérifie les valeurs et réessaie.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              size="lg"
              className="flex-1"
              disabled={createMutation.isPending || noParcelles || semisSansProduit}
            >
              {createMutation.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Link href="/interventions">
              <Button type="button" variant="ghost" size="lg">
                Annuler
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-foreground/50">{hint}</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
