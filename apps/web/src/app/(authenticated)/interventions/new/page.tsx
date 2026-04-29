"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  emojiType,
  type InterventionType,
  libelleType,
  TECHNIQUE_LABEL,
  TECHNIQUES_ORDER,
  type TechniqueEpandage,
  TYPES_ORDER,
  useCreateIntervention,
} from "@/lib/interventions";
import { useParcelles } from "@/lib/parcelles";
import { useCheckFumureOrganique } from "@/lib/per";
import {
  type Produit,
  type ProduitCategorie,
  type ProduitUnite,
  UNITE_LABEL,
  useCreateProduit,
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
  notes: z.string().max(500).optional().or(z.literal("")),
});

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
      quantite: undefined,
      unite: "",
      techniqueEpandage: "",
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

  const [showNewProduit, setShowNewProduit] = useState(false);

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(
      {
        parcelleId: values.parcelleId,
        type: values.type,
        dateOperation: values.dateOperation,
        ...(values.produitId ? { produitId: values.produitId } : {}),
        ...(values.produit ? { produit: values.produit } : {}),
        ...(values.quantite && !Number.isNaN(values.quantite) ? { quantite: values.quantite } : {}),
        ...(values.unite ? { unite: values.unite } : {}),
        ...(values.techniqueEpandage
          ? { techniqueEpandage: values.techniqueEpandage as TechniqueEpandage }
          : {}),
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
          { label: "Accueil", href: "/" },
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
          className="space-y-5 rounded-2xl border border-border bg-background p-6"
        >
          <Field label="Parcelle" error={errors.parcelleId?.message}>
            <select
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
              disabled={noParcelles}
              {...register("parcelleId")}
            >
              <option value="">Sélectionner une parcelle…</option>
              {parcelles.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </select>
          </Field>

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

          <Field label="Date" error={errors.dateOperation?.message}>
            <Input type="date" {...register("dateOperation")} />
          </Field>

          {categorie ? (
            <Field
              label={
                selectedType === "SEMIS"
                  ? "Semence (obligatoire pour le SEMIS)"
                  : "Produit catalogue"
              }
              hint={
                produits.isLoading
                  ? "Chargement du catalogue…"
                  : filteredProduits.length === 0
                    ? "Aucun produit dans cette catégorie."
                    : selectedType === "SEMIS"
                      ? "Sélectionner la semence créera automatiquement la culture sur la parcelle."
                      : "Optionnel : sélectionner un produit du catalogue pour la traçabilité."
              }
              error={errors.produitId?.message}
            >
              <select
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
                {...register("produitId")}
              >
                <option value="">
                  {selectedType === "SEMIS" ? "Sélectionner une semence…" : "Aucun (libellé libre)"}
                </option>
                {filteredProduits.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.libelle}
                    {p.fournisseur ? ` — ${p.fournisseur}` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewProduit(true)}
                className="mt-2 text-sm font-medium text-green hover:underline"
              >
                + Créer un nouveau produit
              </button>
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

      {showNewProduit && categorie && (
        <NewProduitDialog
          categorie={categorie}
          onClose={() => setShowNewProduit(false)}
          onCreated={(p) => {
            setValue("produitId", p.id);
            setShowNewProduit(false);
          }}
        />
      )}
    </>
  );
}

function NewProduitDialog({
  categorie,
  onClose,
  onCreated,
}: {
  categorie: ProduitCategorie;
  onClose: () => void;
  onCreated: (p: Produit) => void;
}) {
  const create = useCreateProduit();
  const [libelle, setLibelle] = useState("");
  const [fournisseur, setFournisseur] = useState("");
  const [unite, setUnite] = useState<ProduitUnite>(categorie === "ENGRAIS_ORGANIQUE" ? "M3" : "KG");
  const [especeCode, setEspeceCode] = useState("");
  const [tauxN, setTauxN] = useState("");
  const [tauxP, setTauxP] = useState("");

  const isEngrais = categorie === "ENGRAIS_MINERAL" || categorie === "ENGRAIS_ORGANIQUE";
  const isSemence = categorie === "SEMENCE";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        categorie,
        libelle,
        unite,
        ...(fournisseur ? { fournisseur } : {}),
        ...(especeCode ? { especeCode } : {}),
        ...(tauxN ? { tauxN: Number(tauxN) } : {}),
        ...(tauxP ? { tauxP: Number(tauxP) } : {}),
      },
      { onSuccess: (p) => onCreated(p) },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-xl font-bold">Nouveau produit ({categorie.toLowerCase()})</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Libellé *</span>
            <Input
              required
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="Ex : Lisier ferme Dupont"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Fournisseur</span>
            <Input
              value={fournisseur}
              onChange={(e) => setFournisseur(e.target.value)}
              placeholder="Optionnel"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Unité</span>
            <select
              value={unite}
              onChange={(e) => setUnite(e.target.value as ProduitUnite)}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base"
            >
              <option value="KG">kg</option>
              <option value="L">L (litre)</option>
              <option value="T">t (tonne)</option>
              <option value="M3">m³</option>
              <option value="DOSE">doses</option>
            </select>
          </label>
          {isSemence && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Code espèce</span>
              <Input
                value={especeCode}
                onChange={(e) => setEspeceCode(e.target.value)}
                placeholder="ex: ble_panifiable, mais_grain, triticale"
              />
              <p className="mt-1 text-xs text-foreground/50">
                Permet de créer auto la culture lors d'un SEMIS et de calculer le besoin N/P.
              </p>
            </label>
          )}
          {isEngrais && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">
                  Taux N (kg / 100 {UNITE_LABEL[unite]})
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tauxN}
                  onChange={(e) => setTauxN(e.target.value)}
                  placeholder="46"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">
                  Taux P (kg / 100 {UNITE_LABEL[unite]})
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tauxP}
                  onChange={(e) => setTauxP(e.target.value)}
                  placeholder="0"
                />
              </label>
            </div>
          )}
          {create.isError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Création impossible. Vérifie les valeurs et réessaie.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Création…" : "Créer et utiliser"}
            </Button>
          </div>
        </form>
      </div>
    </div>
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
