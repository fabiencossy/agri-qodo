"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Map, PencilLine } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type GeoJsonPolygon, useCreateParcelle, type ZoneAgricole } from "@/lib/parcelles";

// Leaflet n'est chargé que côté client (window required).
const ParcelleDrawMap = dynamic(() => import("@/components/maps/parcelle-draw-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[450px] items-center justify-center rounded-xl border border-border bg-muted text-sm text-foreground/60">
      Chargement de la carte…
    </div>
  ),
});

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
type Mode = "carte" | "manuel";

export default function NewParcellePage() {
  const router = useRouter();
  const createMutation = useCreateParcelle();
  const [mode, setMode] = useState<Mode>("carte");
  const [geom, setGeom] = useState<GeoJsonPolygon | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
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

  const onPolygonChange = (nextGeom: GeoJsonPolygon | null, surfaceM2: number) => {
    setGeom(nextGeom);
    if (nextGeom) {
      setValue("surfaceM2", Number(surfaceM2.toFixed(2)));
    }
  };

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
        ...(mode === "carte" && geom ? { geomGeoJson: geom } : {}),
      },
      {
        onSuccess: () => router.push("/parcelles"),
      },
    );
  };

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: "Parcelles", href: "/parcelles" },
          { label: "Nouvelle parcelle" },
        ]}
      />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Nouvelle parcelle</h1>

        <div className="mb-6 inline-flex rounded-lg border border-border bg-background p-1">
          <button
            type="button"
            onClick={() => setMode("carte")}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              mode === "carte" ? "bg-green text-white" : "text-foreground/70 hover:bg-muted"
            }`}
          >
            <Map className="h-4 w-4" />
            Dessiner sur la carte
          </button>
          <button
            type="button"
            onClick={() => setMode("manuel")}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              mode === "manuel" ? "bg-green text-white" : "text-foreground/70 hover:bg-muted"
            }`}
          >
            <PencilLine className="h-4 w-4" />
            Saisir manuellement
          </button>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5 rounded-2xl border border-border bg-background p-6"
        >
          {mode === "carte" && (
            <Field label="Tracé de la parcelle">
              <ParcelleDrawMap onPolygonChange={onPolygonChange} />
            </Field>
          )}

          <Field label="Nom de la parcelle" error={errors.nom?.message}>
            <Input autoFocus={mode === "manuel"} placeholder="Champ du Loup" {...register("nom")} />
          </Field>

          <Field
            label="Surface (m²)"
            hint={
              mode === "carte"
                ? "Calculée automatiquement depuis la carte"
                : "1 hectare = 10 000 m²"
            }
            error={errors.surfaceM2?.message}
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="12500"
              readOnly={mode === "carte" && geom !== null}
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
