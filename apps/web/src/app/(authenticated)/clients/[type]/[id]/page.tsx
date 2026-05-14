"use client";

import { Building2, ChevronRight, Mail, MapPin, Phone, Tractor } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useParams } from "next/navigation";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { type ClientType, useClient } from "@/lib/clients";

function formatCHF(amount: number): string {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function ClientDetailPage() {
  const params = useParams<{ type: string; id: string }>();
  const type = (params?.type as ClientType) || "tenant";
  const id = params?.id ?? "";
  const client = useClient(type, id);

  if (client.isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-sm text-foreground/60">Chargement…</div>
    );
  }
  if (client.isError || !client.data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Client introuvable.</p>
        <Link href="/clients" className="mt-3 inline-block text-sm underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  const c = client.data;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/app" },
          { label: "Clients", href: "/clients" },
          { label: c.nom },
        ]}
      />
      <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:py-6">
        {/* En-tête */}
        <div className="mb-6 rounded-2xl border border-border bg-background p-5">
          <div className="flex flex-wrap items-start gap-3">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                c.type === "tenant" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              <Building2 className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold sm:text-3xl">{c.nom}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground/60">
                {c.canton && <span>Canton {c.canton}</span>}
                {c.numeroExploitant && (
                  <span className="font-mono text-xs">{c.numeroExploitant}</span>
                )}
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    c.type === "tenant"
                      ? "border-green-300 bg-green-50 text-green-700"
                      : "border-amber-300 bg-amber-50 text-amber-700"
                  }`}
                >
                  {c.type === "tenant" ? "Partenaire AQ" : "Client Odoo"}
                </span>
              </div>
              {(c.emailContact || c.telephone) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {c.emailContact && (
                    <a
                      href={`mailto:${c.emailContact}`}
                      className="inline-flex items-center gap-1 text-foreground/70 hover:text-foreground hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {c.emailContact}
                    </a>
                  )}
                  {c.telephone && (
                    <a
                      href={`tel:${c.telephone}`}
                      className="inline-flex items-center gap-1 text-foreground/70 hover:text-foreground hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {c.telephone}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            <KPI label="Parcelles" value={c.nbParcelles.toString()} />
            <KPI label="Travaux" value={c.nbTravaux.toString()} />
            <KPI label="Total" value={formatCHF(c.totalTravauxCHF)} mono />
          </div>
        </div>

        {/* Parcelles */}
        <section className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-foreground/60" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
              Parcelles ({c.parcelles.length})
            </h2>
          </div>
          {c.parcelles.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-foreground/50">
              Aucune parcelle liée à ce client.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-background">
              {c.parcelles.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/parcelles/${p.id}` as Route}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.nom}</span>
                      {p.cultureActuelle && (
                        <span className="block truncate text-xs text-foreground/60">
                          {p.cultureActuelle}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-xs text-foreground/70">
                      {p.surfaceHa.toFixed(2)} ha
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-foreground/40" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Travaux */}
        <section className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <Tractor className="h-4 w-4 text-foreground/60" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
              Travaux ({c.travaux.length})
            </h2>
          </div>
          {c.travaux.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-foreground/50">
              Aucun travail saisi pour ce client.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-background">
              {c.travaux.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/travaux/${t.id}` as Route}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{t.titre}</span>
                      <span className="block truncate text-xs text-foreground/60">
                        {new Date(t.date).toLocaleDateString("fr-CH")} · {t.nbProduits} produit
                        {t.nbProduits > 1 ? "s" : ""} · {t.nbHeures} ligne
                        {t.nbHeures > 1 ? "s" : ""} d'heures
                      </span>
                    </div>
                    <span className="hidden rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground/60 sm:inline-block">
                      {t.statut}
                    </span>
                    {t.totalCHF > 0 && (
                      <span className="shrink-0 font-mono text-sm font-semibold text-foreground/80">
                        {formatCHF(t.totalCHF)}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-foreground/40" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function KPI({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground/50">
        {label}
      </p>
      <p
        className={`mt-0.5 text-lg font-bold sm:text-xl ${
          mono ? "font-mono text-base sm:text-lg" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
