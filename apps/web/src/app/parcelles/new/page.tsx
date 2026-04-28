"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsAuthenticated } from "@/lib/auth";
import { useCreateParcelle, type ZoneAgricole } from "@/lib/parcelles";

const ZONES: Array<{ value: ZoneAgricole; label: string }> = [
  { value: "ZA", label: "Zone agricole" },
  { value: "ZP", label: "Zone des prairies" },
  { value: "ZM1", label: "Zone montagne I" },
  { value: "ZM2", label: "Zone montagne II" },
  { value: "ZM3", label: "Zone montagne III" },
  { value: "ZM4", label: "Zone montagne IV" },
  { value: "ZE", label: "Zone d'estivage" },
];

const formSchema = z.object({
  nom: z.string().min(1, "Le nom est obligatoire").max(120),
  surfaceM2: z.coerce
    .number({ invalid_type_error: "Surface invalide" })
    .positive("La surface doit être positive"),
  zone: z.enum(["ZA", "ZP", "ZM1", "ZM2", "ZM3", "ZM4", "ZE"]),
  identifiantCadastral: z.string().max(50).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewParcellePage() {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const createMutation = useCreateParcelle();

  useEffect(() => {
    if (isAuthenticated === false) router.replace("/login");
  }, [isAuthenticated, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nom: "",
      surfaceM2: 0,
      zone: "ZA",
      identifiantCadastral: "",
      notes: "",
    },
  });

  if (!isAuthenticated) return null;

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(
      {
        nom: values.nom,
        surfaceM2: values.surfaceM2,
        zone: values.zone,
        ...(values.identifiantCadastral
          ? { identifiantCadastral: values.identifiantCadastral }
          : {}),
        ...(values.notes ? { notes: values.notes } : {}),
      },
      {
        onSuccess: () => {
          router.push("/parcelles");
        },
      },
    );
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            href="/parcelles"
            className="rounded-md p-1.5 text-foreground/60 hover:bg-muted"
            aria-label="Retour"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">Nouvelle parcelle</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5 rounded-2xl border border-border bg-background p-6"
        >
          <Field label="Nom de la parcelle" error={errors.nom?.message}>
            <Input autoFocus placeholder="Champ du Loup" {...register("nom")} />
          </Field>

          <Field
            label="Surface (m²)"
            hint="1 hectare = 10 000 m²"
            error={errors.surfaceM2?.message}
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="12500"
              {...register("surfaceM2")}
            />
          </Field>

          <Field label="Zone agricole" error={errors.zone?.message}>
            <select
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
              {...register("zone")}
            >
              {ZONES.map((z) => (
                <option key={z.value} value={z.value}>
                  {z.value} — {z.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Identifiant cadastral (optionnel)"
            error={errors.identifiantCadastral?.message}
          >
            <Input placeholder="VD-1234-5678" {...register("identifiantCadastral")} />
          </Field>

          <Field label="Notes (optionnel)" error={errors.notes?.message}>
            <textarea
              className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
              placeholder="Observations particulières (drainage, exposition, …)"
              {...register("notes")}
            />
          </Field>

          {createMutation.isError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Impossible de créer la parcelle. Vérifie les valeurs et réessaie.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" size="lg" className="flex-1" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Création…" : "Créer la parcelle"}
            </Button>
            <Link href="/parcelles">
              <Button type="button" variant="ghost" size="lg">
                Annuler
              </Button>
            </Link>
          </div>
        </form>
      </main>
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
