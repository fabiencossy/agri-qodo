"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCategoriesActives } from "@/lib/animaux";
import {
  type AnimalCategorie,
  CATEGORIES_ORDER,
  emojiCategorie,
  libelleCategorie,
  useCreateSortie,
} from "@/lib/srpa";

const formSchema = z.object({
  date: z.string().min(1, "Date obligatoire"),
  categorie: z.enum([
    "VACHE_LAITIERE",
    "GENISSE",
    "VEAU",
    "TAUREAU",
    "BOEUF",
    "AUTRE_BOVIN",
    "PORC",
    "POULET",
    "AUTRE",
  ]),
  nombreAnimaux: z.coerce.number().int().min(0).optional().or(z.literal(NaN)),
  dureeHeures: z.coerce.number().min(0).max(24).optional().or(z.literal(NaN)),
  notes: z.string().max(500).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

const today = (): string => new Date().toISOString().slice(0, 10);

export default function NewSortiePage() {
  const router = useRouter();
  const createMutation = useCreateSortie();
  const categoriesActives = useCategoriesActives();
  // Si l'exploitation a déjà des animaux, on ne propose que ces catégories.
  // Sinon (cheptel pas encore saisi) on retombe sur la liste complète.
  const categoriesAffichees: AnimalCategorie[] =
    categoriesActives.data && categoriesActives.data.length > 0
      ? CATEGORIES_ORDER.filter((c) => categoriesActives.data?.includes(c))
      : CATEGORIES_ORDER;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: today(),
      categorie: "VACHE_LAITIERE",
      nombreAnimaux: undefined,
      dureeHeures: undefined,
      notes: "",
    },
  });

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(
      {
        date: values.date,
        categorie: values.categorie,
        ...(values.nombreAnimaux && !Number.isNaN(values.nombreAnimaux)
          ? { nombreAnimaux: values.nombreAnimaux }
          : {}),
        ...(values.dureeHeures && !Number.isNaN(values.dureeHeures)
          ? { dureeMinutes: Math.round(values.dureeHeures * 60) }
          : {}),
        ...(values.notes ? { notes: values.notes } : {}),
      },
      {
        onSuccess: () => router.push("/srpa"),
      },
    );
  };

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/app" },
          { label: "SRPA", href: "/srpa" },
          { label: "Nouvelle sortie" },
        ]}
      />
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Saisir une sortie</h1>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5 rounded-2xl border border-border bg-background p-6"
        >
          <Field label="Catégorie d'animaux" error={errors.categorie?.message}>
            <Controller
              control={control}
              name="categorie"
              render={({ field: { value, onChange } }) => (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {categoriesAffichees.map((c: AnimalCategorie) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onChange(c)}
                      className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-sm transition-colors ${
                        value === c
                          ? "border-green bg-green/10 font-medium text-green"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <span className="text-2xl">{emojiCategorie(c)}</span>
                      <span className="text-xs text-center">{libelleCategorie(c)}</span>
                    </button>
                  ))}
                </div>
              )}
            />
          </Field>

          <Field label="Date de la sortie" error={errors.date?.message}>
            <Input type="date" {...register("date")} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre d'animaux (optionnel)" error={errors.nombreAnimaux?.message}>
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="25"
                {...register("nombreAnimaux")}
              />
            </Field>
            <Field label="Durée (heures, optionnel)" error={errors.dureeHeures?.message}>
              <Input
                type="number"
                min="0"
                max="24"
                step="0.5"
                placeholder="8"
                {...register("dureeHeures")}
              />
            </Field>
          </div>

          <Field label="Notes (optionnel)" error={errors.notes?.message}>
            <textarea
              className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
              placeholder="Conditions météo, parcelle de pâturage…"
              {...register("notes")}
            />
          </Field>

          {createMutation.isError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : "Saisie impossible."}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" size="lg" className="flex-1" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Link href="/srpa">
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
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
