"use client";

import { CheckCircle2, FileUp, Upload, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";
import { type ZoneAgricole } from "@/lib/parcelles";

const ZONES: Array<{ value: ZoneAgricole; label: string }> = [
  { value: "ZA", label: "ZA — Zone agricole" },
  { value: "ZP", label: "ZP — Zone des prairies" },
  { value: "ZM1", label: "ZM1 — Montagne I" },
  { value: "ZM2", label: "ZM2 — Montagne II" },
  { value: "ZM3", label: "ZM3 — Montagne III" },
  { value: "ZM4", label: "ZM4 — Montagne IV" },
  { value: "ZE", label: "ZE — Estivage" },
];

interface GeoFeature {
  type: "Feature";
  properties: Record<string, unknown> | null;
  geometry: { type: string; coordinates: unknown };
}

interface ImportResult {
  total: number;
  created: number;
  /** Parcelles avec un SEMIS rétroactif créé via la property `culture` du GeoJSON. */
  cultures?: number;
  errors: Array<{ index: number; nom?: string; message: string }>;
}

export default function ImportPage() {
  const router = useRouter();
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [edits, setEdits] = useState<Record<number, { nom: string; zone: ZoneAgricole }>>({});
  const [defaultZone, setDefaultZone] = useState<ZoneAgricole>("ZA");
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const onFile = async (file: File) => {
    setParseError(null);
    setResult(null);
    try {
      const ext = file.name.toLowerCase().split(".").pop() ?? "";
      let parsed: { features?: unknown } | null = null;

      if (ext === "pdf") {
        throw new Error(
          "Le PDF n'est pas un format de données importable (c'est juste une image du plan). Dans Acorda, choisis l'export « Shape » (.zip) ou « KML ».",
        );
      } else if (ext === "kml") {
        const text = await file.text();
        const xml = new DOMParser().parseFromString(text, "text/xml");
        if (xml.getElementsByTagName("parsererror").length > 0) {
          throw new Error("Le fichier KML est mal formé.");
        }
        const { kml } = await import("@tmcw/togeojson");
        parsed = kml(xml) as { features?: unknown };
      } else if (ext === "zip") {
        const buffer = await file.arrayBuffer();
        const { default: shp } = await import("shpjs");
        const result = await shp(buffer);
        parsed = Array.isArray(result)
          ? { features: result.flatMap((fc) => fc.features ?? []) }
          : (result as { features?: unknown });
      } else if (ext === "geojson" || ext === "json") {
        const text = await file.text();
        const data = JSON.parse(text) as { type?: string; features?: unknown };
        if (data.type !== "FeatureCollection") {
          throw new Error("Le fichier n'est pas un GeoJSON FeatureCollection valide.");
        }
        parsed = data;
      } else {
        throw new Error(
          "Format non reconnu. Utilise l'export Shape (.zip) ou KML de ton portail cantonal.",
        );
      }

      const features = Array.isArray(parsed?.features) ? (parsed.features as GeoFeature[]) : [];
      const valid = features.filter(
        (f) =>
          f.type === "Feature" &&
          f.geometry &&
          (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"),
      );
      if (valid.length === 0) {
        throw new Error("Aucune parcelle Polygon/MultiPolygon trouvée dans le fichier.");
      }
      setFeatures(valid);
      setEdits({});
    } catch (err) {
      setParseError(
        err instanceof Error
          ? err.message
          : "Impossible de lire le fichier. Vérifie le format (Shape .zip, KML ou GeoJSON).",
      );
      setFeatures([]);
    }
  };

  const onSubmit = async () => {
    setSubmitting(true);
    setResult(null);
    try {
      const featureCollection = {
        type: "FeatureCollection" as const,
        features: features.map((f, i) => {
          const e = edits[i];
          if (!e) return f;
          return {
            ...f,
            properties: {
              ...(f.properties ?? {}),
              nom: e.nom,
              zone: e.zone,
            },
          };
        }),
      };
      const res = await api<ImportResult>("/api/parcelles/import", {
        method: "POST",
        body: { featureCollection, defaultZone },
      });
      setResult(res);
      if (res.created > 0 && res.errors.length === 0) {
        setTimeout(() => router.push("/parcelles"), 1500);
      }
    } catch (err) {
      setParseError(
        err instanceof ApiError
          ? `Erreur serveur (${err.status}) : ${(err.body as { message?: string })?.message ?? "import refusé"}`
          : "Échec de l'import. Vérifie ta connexion.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/app" },
          { label: "Parcelles", href: "/parcelles" },
          { label: "Importer" },
        ]}
      />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-bold">Importer mes parcelles depuis un fichier</h1>
        <p className="mb-6 text-sm text-foreground/70">
          Exporte ton parcellaire depuis ton portail cantonal (Acorda VD/GE/NE/JU, GELAN BE/FR/SO,
          Agriportal TI…) au format <strong>Shape (.zip)</strong>, <strong>KML</strong> ou{" "}
          <strong>GeoJSON</strong>, puis dépose le fichier ici. Toutes tes parcelles arriveront avec
          leurs limites officielles, surfaces et numéros cadastraux.
        </p>

        {features.length === 0 && !result && <UploadZone onFile={onFile} error={parseError} />}

        {features.length > 0 && !result && (
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-background p-4">
              <h2 className="mb-2 text-sm font-semibold">
                {features.length} parcelle{features.length > 1 ? "s" : ""} détectée
                {features.length > 1 ? "s" : ""}
              </h2>
              <label className="mt-2 block text-xs font-medium text-foreground/70">
                Zone agricole par défaut (si absente du fichier)
              </label>
              <select
                value={defaultZone}
                onChange={(e) => setDefaultZone(e.target.value as ZoneAgricole)}
                className="mt-1 h-10 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
              >
                {ZONES.map((z) => (
                  <option key={z.value} value={z.value}>
                    {z.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-lg border border-border bg-background">
              <ul className="divide-y divide-border">
                {features.map((f, i) => {
                  const props = f.properties ?? {};
                  const detectedNom =
                    edits[i]?.nom ??
                    pickStr(props, ["nom", "name", "NUMMER"]) ??
                    `Parcelle ${i + 1}`;
                  const detectedCadastre = pickStr(props, [
                    "egrid",
                    "EGRID",
                    "EGRIS_EGRID",
                    "NUMMER",
                  ]);
                  const detectedZone = (edits[i]?.zone ??
                    pickStr(props, ["zone", "ZONE"])?.toUpperCase() ??
                    defaultZone) as ZoneAgricole;
                  return (
                    <li key={i} className="grid gap-2 p-3 sm:grid-cols-[2fr_1fr_auto]">
                      <div>
                        <Input
                          value={detectedNom}
                          onChange={(e) =>
                            setEdits((s) => ({
                              ...s,
                              [i]: {
                                nom: e.target.value,
                                zone: s[i]?.zone ?? detectedZone,
                              },
                            }))
                          }
                          placeholder={`Parcelle ${i + 1}`}
                        />
                        {detectedCadastre && (
                          <div className="mt-1 font-mono text-xs text-foreground/50">
                            {detectedCadastre}
                          </div>
                        )}
                      </div>
                      <select
                        value={detectedZone}
                        onChange={(e) =>
                          setEdits((s) => ({
                            ...s,
                            [i]: {
                              nom: s[i]?.nom ?? detectedNom,
                              zone: e.target.value as ZoneAgricole,
                            },
                          }))
                        }
                        className="h-11 rounded-lg border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
                      >
                        {ZONES.map((z) => (
                          <option key={z.value} value={z.value}>
                            {z.value}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </div>

            {parseError && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {parseError}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                size="lg"
                className="flex-1"
                onClick={onSubmit}
                disabled={submitting}
              >
                <Upload className="mr-2 h-4 w-4" />
                {submitting
                  ? "Import en cours…"
                  : `Importer ${features.length} parcelle${features.length > 1 ? "s" : ""}`}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => {
                  setFeatures([]);
                  setEdits({});
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}

        {result && <ImportResultView result={result} />}
      </div>
    </>
  );
}

function UploadZone({ onFile, error }: { onFile: (f: File) => void; error: string | null }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <>
      <label
        htmlFor="geojson-file"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) void onFile(f);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
          dragOver ? "border-green bg-green/5" : "border-border hover:border-green hover:bg-muted"
        }`}
      >
        <FileUp className="h-12 w-12 text-foreground/40" />
        <div>
          <div className="font-semibold">
            Glisse-dépose ton fichier <span className="whitespace-nowrap">Shape (.zip)</span>, KML
            ou GeoJSON
          </div>
          <div className="mt-1 text-sm text-foreground/60">ou clique pour parcourir</div>
        </div>
        <input
          id="geojson-file"
          type="file"
          accept=".kml,.zip,.geojson,.json,application/vnd.google-earth.kml+xml,application/zip,application/geo+json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
      </label>
      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      <div className="mt-6 rounded-lg border border-border bg-muted/50 p-4 text-xs text-foreground/70">
        <strong className="text-foreground">Comment exporter ?</strong>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Acorda</strong> (VD/GE/NE/JU) : Mes données → Parcellaire → Exporter au format{" "}
            <strong>Shape</strong> (livré en .zip) ou <strong>KML</strong>. Le PDF n'est pas un
            export de données — c'est juste un plan imprimable, il ne peut pas être importé.
          </li>
          <li>
            <strong>GELAN</strong> (BE/FR/SO) : équivalent dans la section Parcellaire (Shape, KML
            ou GeoJSON)
          </li>
          <li>
            <strong>Agriportal</strong> (TI) : selon le canton
          </li>
        </ul>
        <p className="mt-2 text-xs text-foreground/50">
          Le fichier doit contenir des géométries Polygon ou MultiPolygon. Les Shapefiles sont
          reprojetés automatiquement en WGS84 (EPSG:4326) ; les GeoJSON/KML doivent déjà être en
          WGS84.
        </p>
      </div>
    </>
  );
}

function ImportResultView({ result }: { result: ImportResult }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-green bg-green/10 p-4">
        <CheckCircle2 className="h-8 w-8 text-green" />
        <div>
          <div className="text-lg font-semibold text-green-dark">
            {result.created} parcelle{result.created > 1 ? "s" : ""} importée
            {result.created > 1 ? "s" : ""}
          </div>
          <div className="text-sm text-foreground/60">
            sur {result.total} feature{result.total > 1 ? "s" : ""} dans le fichier
          </div>
          {result.cultures !== undefined && result.cultures > 0 && (
            <div className="mt-1 text-sm text-emerald-700">
              ✓ {result.cultures} assolement{result.cultures > 1 ? "s" : ""} pré-rempli
              {result.cultures > 1 ? "s" : ""} depuis la property{" "}
              <code className="rounded bg-emerald-100 px-1">culture</code>. Visualise{" "}
              <Link href="/assolement" className="underline">
                le plan d'assolement
              </Link>
              .
            </div>
          )}
        </div>
      </div>

      {result.errors.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            <span className="font-semibold text-red-800">
              {result.errors.length} erreur{result.errors.length > 1 ? "s" : ""}
            </span>
          </div>
          <ul className="space-y-1 text-sm text-red-700">
            {result.errors.slice(0, 10).map((e) => (
              <li key={e.index}>
                #{e.index + 1} {e.nom && `(${e.nom})`} : {e.message}
              </li>
            ))}
            {result.errors.length > 10 && (
              <li className="text-xs">
                … et {result.errors.length - 10} autre
                {result.errors.length - 10 > 1 ? "s" : ""}
              </li>
            )}
          </ul>
        </div>
      )}

      <Link href="/parcelles">
        <Button size="lg" className="w-full">
          Voir mes parcelles
        </Button>
      </Link>
    </div>
  );
}

function pickStr(props: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = props[key];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return undefined;
}
