"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emojiType, libelleType, TYPES_ORDER, useCreateIntervention } from "@/lib/interventions";
import { useParcelles } from "@/lib/parcelles";

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
  produit: z.string().max(200).optional().or(z.literal("")),
  quantite: z.coerce.number().min(0).optional().or(z.literal(NaN)),
  unite: z.string().max(20).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

const today = (): string => new Date().toISOString().slice(0, 10);

export default function NewInterventionPage() {
  const router = useRouter();
  const createMutation = useCreateIntervention();
  const parcelles = useParcelles();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      parcelleId: "",
      type: "PHYTO",
      dateOperation: today(),
      produit: "",
      quantite: undefined,
      unite: "",
      notes: "",
    },
  });

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(
      {
        parcelleId: values.parcelleId,
        type: values.type,
        dateOperation: values.dateOperation,
        ...(values.produit ? { produit: values.produit } : {}),
        ...(values.quantite && !Number.isNaN(values.quantite) ? { quantite: values.quantite } : {}),
        ...(values.unite ? { unite: values.unite } : {}),
        ...(values.notes ? { notes: values.notes } : {}),
      },
      {
        onSuccess: () => router.push("/interventions"),
      },
    );
  };

  const noParcelles = parcelles.data !== undefined && parcelles.data.length === 0;

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
                      onClick={() => onChange(t)}
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

          <Field
            label="Produit (optionnel)"
            hint="Nom commercial ou code OPPh pour les phytos"
            error={errors.produit?.message}
          >
            <Input placeholder="Roundup MAX 360" {...register("produit")} />
          </Field>

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
            <Field label="Unité (optionnel)" error={errors.unite?.message}>
              <Input placeholder="L, kg, t, ha…" {...register("unite")} />
            </Field>
          </div>

          <Field label="Notes (optionnel)" error={errors.notes?.message}>
            <textarea
              className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
              placeholder="Conditions météo, observations…"
              {...register("notes")}
            />
          </Field>

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
              disabled={createMutation.isPending || noParcelles}
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
