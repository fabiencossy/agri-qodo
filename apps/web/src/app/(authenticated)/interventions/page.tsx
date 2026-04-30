"use client";

import { Download, Plus, Sprout, Trash2 } from "lucide-react";
import Link from "next/link";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/export-csv";
import {
  colorType,
  emojiType,
  formatDateFr,
  formatQuantite,
  libelleType,
  useDeleteIntervention,
  useInterventions,
} from "@/lib/interventions";

export default function InterventionsPage() {
  const interventions = useInterventions();
  const deleteMutation = useDeleteIntervention();

  const onDelete = (id: string, label: string) => {
    if (confirm(`Supprimer cette ${label} ? Cette action est définitive.`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Carnet des champs" }]} />
      <div className="mx-auto max-w-5xl px-2 py-4 sm:px-4 sm:py-8">
        <PageHeader
          title="Carnet des champs"
          icon={Sprout}
          subtitle={
            interventions.data
              ? `${interventions.data.length} intervention${interventions.data.length > 1 ? "s" : ""}`
              : "Chargement…"
          }
          menuActions={[
            {
              label: "Exporter en CSV",
              icon: Download,
              disabled: !interventions.data || interventions.data.length === 0,
              onClick: () => {
                if (!interventions.data) return;
                downloadCsv("interventions", interventions.data, [
                  {
                    header: "Date",
                    value: (iv) => new Date(iv.dateOperation).toISOString().slice(0, 10),
                  },
                  { header: "Type", value: (iv) => libelleType(iv.type) },
                  { header: "Parcelle", value: (iv) => iv.parcelle?.nom ?? "" },
                  { header: "Produit", value: (iv) => iv.produit ?? "" },
                  { header: "Quantité", value: (iv) => iv.quantite ?? "" },
                  { header: "Unité", value: (iv) => iv.unite ?? "" },
                  {
                    header: "Surface travaillée (m²)",
                    value: (iv) => iv.surfaceTravailleeM2 ?? "",
                  },
                  { header: "Notes", value: (iv) => iv.notes ?? "" },
                ]);
              },
            },
          ]}
        />

        {interventions.isError && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Impossible de charger les interventions. Vérifie ta connexion.
          </div>
        )}

        {interventions.data && interventions.data.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
            <Sprout className="mx-auto h-10 w-10 text-foreground/30" />
            <h2 className="mt-4 text-lg font-semibold">Aucune intervention pour l'instant</h2>
            <p className="mt-1 text-sm text-foreground/60">
              Saisissez vos opérations terrain au fil de l'eau.
            </p>
            <Link href="/interventions/new" className="mt-6 inline-block">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Saisir ma première intervention
              </Button>
            </Link>
          </div>
        )}

        {interventions.data && interventions.data.length > 0 && (
          <ul className="space-y-3">
            {interventions.data.map((iv) => {
              const quantite = formatQuantite(iv.quantite, iv.unite);
              return (
                <li key={iv.id} className="rounded-2xl border border-border bg-background p-4">
                  <header className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${colorType(iv.type)}`}
                      >
                        {emojiType(iv.type)}
                      </span>
                      <div>
                        <div className="font-semibold">
                          {libelleType(iv.type)}
                          {iv.produit && (
                            <span className="ml-2 font-normal text-foreground/70">
                              · {iv.produit}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-foreground/60">
                          {iv.parcelle.nom} · {formatDateFr(iv.dateOperation)}
                          {quantite && ` · ${quantite}`}
                        </div>
                        {iv.culture && (
                          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-green/10 px-2 py-0.5 text-xs text-green">
                            <Sprout className="h-3 w-3" />
                            Culture {iv.culture.espece} · campagne {iv.culture.campagne}
                          </div>
                        )}
                        {iv.notes && <p className="mt-1 text-sm text-foreground/70">{iv.notes}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => onDelete(iv.id, libelleType(iv.type).toLowerCase())}
                      disabled={deleteMutation.isPending}
                      className="rounded-md p-1.5 text-foreground/50 hover:bg-red-50 hover:text-red-600"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </header>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
