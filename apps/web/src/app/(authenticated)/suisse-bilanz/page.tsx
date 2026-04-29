"use client";

import { AlertTriangle, CheckCircle2, FlaskConical, XCircle } from "lucide-react";
import { useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { type BilanResponse, formatHa, formatKg, useSuisseBilanz } from "@/lib/suisse-bilanz";

const currentYear = new Date().getFullYear();
const ANNEES = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

export default function SuisseBilanzPage() {
  const [annee, setAnnee] = useState(currentYear);
  const bilan = useSuisseBilanz(annee);

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Suisse-Bilanz" }]} />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <FlaskConical className="h-7 w-7 text-green" />
              Suisse-Bilanz
            </h1>
            <p className="mt-1 text-foreground/70">
              Bilan azote / phosphore simplifié — flux annuel sur l'exploitation.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium">Campagne</span>
            <select
              value={annee}
              onChange={(e) => setAnnee(Number(e.target.value))}
              className="h-10 rounded-lg border border-border bg-background px-3 text-base"
            >
              {ANNEES.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>

        {bilan.isLoading && (
          <div className="rounded-2xl border border-border bg-background p-10 text-center text-foreground/60">
            Chargement du bilan…
          </div>
        )}
        {bilan.isError && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Impossible de charger le bilan. Vérifie la connexion.
          </div>
        )}
        {bilan.data && <BilanContent bilan={bilan.data} />}
      </div>
    </>
  );
}

function BilanContent({ bilan }: { bilan: BilanResponse }) {
  const empty =
    bilan.besoinsN === 0 && bilan.apportsN === 0 && bilan.besoinsP === 0 && bilan.apportsP === 0;

  if (empty) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
        <FlaskConical className="mx-auto h-10 w-10 text-foreground/30" />
        <h2 className="mt-4 text-lg font-semibold">Pas encore de données pour {bilan.annee}</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Saisis les cultures de la campagne et le cheptel actif pour voir le bilan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <BilanCard
          titre="Azote (N)"
          besoins={bilan.besoinsN}
          apports={bilan.apportsN}
          solde={bilan.soldeN}
          conforme={bilan.conformeN}
        />
        <BilanCard
          titre="Phosphore (P)"
          besoins={bilan.besoinsP}
          apports={bilan.apportsP}
          solde={bilan.soldeP}
          conforme={bilan.conformeP}
        />
      </div>

      {bilan.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="mb-2 flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Points d'attention
          </div>
          <ul className="ml-6 list-disc space-y-1">
            {bilan.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {bilan.details.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Détail par parcelle</h2>
          <p className="mb-3 text-sm text-foreground/60">
            Apports = engrais saisis sur la parcelle (les déjections animales sont comptées au
            niveau global).
          </p>
          <div className="overflow-x-auto rounded-xl border border-border bg-background">
            <table className="w-full text-sm">
              <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-foreground/60">
                <tr>
                  <th className="px-3 py-2">Parcelle</th>
                  <th className="px-3 py-2">Culture</th>
                  <th className="px-3 py-2 text-right">Ha</th>
                  <th className="px-3 py-2 text-right">Besoin N</th>
                  <th className="px-3 py-2 text-right">Apport N</th>
                  <th className="px-3 py-2 text-right">Solde N</th>
                  <th className="px-3 py-2 text-right">Besoin P</th>
                  <th className="px-3 py-2 text-right">Apport P</th>
                  <th className="px-3 py-2 text-right">Solde P</th>
                </tr>
              </thead>
              <tbody>
                {bilan.details.map((d) => (
                  <tr key={d.parcelleId} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{d.parcelleNom}</td>
                    <td className="px-3 py-2 text-foreground/70">{d.espece}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatHa(d.surfaceHa)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatKg(d.besoinN)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatKg(d.apportsN)}</td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        d.soldeN > 0 ? "font-medium text-red-600" : "text-foreground/70"
                      }`}
                    >
                      {d.soldeN > 0 ? "+" : ""}
                      {formatKg(d.soldeN)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatKg(d.besoinP)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatKg(d.apportsP)}</td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        d.soldeP > 0 ? "font-medium text-red-600" : "text-foreground/70"
                      }`}
                    >
                      {d.soldeP > 0 ? "+" : ""}
                      {formatKg(d.soldeP)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function BilanCard({
  titre,
  besoins,
  apports,
  solde,
  conforme,
}: {
  titre: string;
  besoins: number;
  apports: number;
  solde: number;
  conforme: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{titre}</h2>
        <ConformiteBadge conforme={conforme} />
      </div>
      <dl className="space-y-2 text-sm">
        <Row label="Besoins (cultures)" value={`${formatKg(besoins)} kg`} />
        <Row label="Apports (cheptel + engrais)" value={`${formatKg(apports)} kg`} />
        <Row
          label="Solde apports − besoins"
          value={`${solde > 0 ? "+" : ""}${formatKg(solde)} kg`}
          strong
          danger={solde > 0 && !conforme}
        />
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  danger,
}: {
  label: string;
  value: string;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0">
      <dt className="text-foreground/70">{label}</dt>
      <dd
        className={`tabular-nums ${strong ? "font-semibold" : ""} ${danger ? "text-red-600" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function ConformiteBadge({ conforme }: { conforme: boolean }) {
  if (conforme) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green/10 px-2.5 py-1 text-xs font-medium text-green">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Conforme
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
      <XCircle className="h-3.5 w-3.5" />
      Hors tolérance
    </span>
  );
}
