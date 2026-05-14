"use client";

import { Building2, MapPin, Tractor, Users } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Input } from "@/components/ui/input";
import { type ClientSummary, useClients } from "@/lib/clients";

function formatCHF(amount: number): string {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ClientsPage() {
  const clients = useClients();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const list = clients.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => [c.nom, c.canton ?? ""].join(" ").toLowerCase().includes(q));
  }, [clients.data, query]);

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Clients" }]} />
      <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:py-6">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-6 w-6 text-foreground/60" />
          <h1 className="text-2xl font-bold sm:text-3xl">Clients</h1>
        </div>
        <p className="mb-4 text-sm text-foreground/60">
          Partenaires Agri Qodo actifs + clients Odoo apparus dans tes travaux. Click sur un client
          pour voir ses parcelles et ses travaux.
        </p>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un client par nom ou canton…"
          className="mb-3 h-11"
        />

        {clients.isLoading ? (
          <p className="rounded-2xl border border-border bg-background p-6 text-center text-sm text-foreground/60">
            Chargement…
          </p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border bg-muted/20 p-10 text-center">
            <Building2 className="mx-auto mb-2 h-8 w-8 text-foreground/30" />
            <p className="text-sm text-foreground/60">
              {query
                ? `Aucun client ne correspond à « ${query} ».`
                : "Aucun client pour l'instant. Saisis un Travail pour tiers ou invite un partenaire pour démarrer."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-background">
            {filtered.map((c) => (
              <li key={`${c.type}-${c.id}`}>
                <Link
                  href={`/clients/${c.type}/${c.id}` as Route}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      c.type === "tenant"
                        ? "bg-green-50 text-green-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="truncate font-semibold">{c.nom}</span>
                      {c.canton && <span className="text-xs text-foreground/60">· {c.canton}</span>}
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
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-foreground/60">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {c.nbParcelles} parcelle{c.nbParcelles > 1 ? "s" : ""}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Tractor className="h-3 w-3" />
                        {c.nbTravaux} travail{c.nbTravaux > 1 ? "x" : ""}
                      </span>
                    </div>
                  </div>
                  {c.totalTravauxCHF > 0 && (
                    <span className="shrink-0 font-mono text-sm font-semibold text-foreground/80">
                      {formatCHF(c.totalTravauxCHF)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export type { ClientSummary };
