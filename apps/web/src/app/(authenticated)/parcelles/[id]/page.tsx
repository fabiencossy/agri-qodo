"use client";

import { ArrowLeft, MapPin, Sprout } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  colorType,
  emojiType,
  formatDateFr,
  formatQuantite,
  libelleType,
  useInterventions,
} from "@/lib/interventions";
import { formatSurface, libelleZone, useParcelle } from "@/lib/parcelles";
import { formatKg, useSuisseBilanz } from "@/lib/suisse-bilanz";

const currentYear = new Date().getFullYear();

export default function ParcelleDetailPage() {
  const params = useParams<{ id: string }>();
  const parcelleId = params?.id;
  const parcelle = useParcelle(parcelleId);
  const interventions = useInterventions();
  const bilan = useSuisseBilanz(currentYear);

  // Interventions filtrées sur cette parcelle
  const ivOfParcelle = useMemo(
    () => interventions.data?.filter((iv) => iv.parcelleId === parcelleId) ?? [],
    [interventions.data, parcelleId],
  );

  // Détail bilan de cette parcelle (peut être absent si pas de culture)
  const detailBilan = useMemo(
    () => bilan.data?.details.find((d) => d.parcelleId === parcelleId),
    [bilan.data, parcelleId],
  );

  if (!parcelleId) return null;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: "Parcelles", href: "/parcelles" },
          { label: parcelle.data?.nom ?? "…" },
        ]}
      />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Link
          href="/parcelles"
          className="mb-4 inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux parcelles
        </Link>

        {parcelle.isLoading && <div className="text-foreground/60">Chargement…</div>}
        {parcelle.isError && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Impossible de charger la parcelle.
          </div>
        )}

        {parcelle.data && (
          <>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="flex items-center gap-2 text-3xl font-bold">
                  <MapPin className="h-7 w-7 text-green" />
                  {parcelle.data.nom}
                </h1>
                <p className="mt-1 text-foreground/70">
                  {formatSurface(parcelle.data.surfaceM2)} · {libelleZone(parcelle.data.zone)}
                  {parcelle.data.identifiantCadastral
                    ? ` · ${parcelle.data.identifiantCadastral}`
                    : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/interventions/new?parcelleId=${parcelleId}`}>
                  <Button>
                    <Sprout className="mr-2 h-4 w-4" />
                    Nouvelle intervention
                  </Button>
                </Link>
              </div>
            </div>

            {parcelle.data.notes && (
              <p className="mb-6 rounded-lg bg-foreground/5 px-4 py-3 text-sm text-foreground/70">
                {parcelle.data.notes}
              </p>
            )}

            {/* Bilan N/P de la parcelle (campagne courante) */}
            <section className="mb-6">
              <h2 className="mb-3 text-lg font-semibold">
                Bilan {currentYear} — apports / besoins / solde
              </h2>
              {detailBilan ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <BilanParcelleCard
                    titre="Azote (N)"
                    besoin={detailBilan.besoinN}
                    apport={detailBilan.apportsN}
                    solde={detailBilan.soldeN}
                    espece={detailBilan.espece}
                  />
                  <BilanParcelleCard
                    titre="Phosphore (P)"
                    besoin={detailBilan.besoinP}
                    apport={detailBilan.apportsP}
                    solde={detailBilan.soldeP}
                    espece={detailBilan.espece}
                  />
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-border p-6 text-sm text-foreground/60">
                  Pas de culture saisie pour {currentYear} sur cette parcelle. Le bilan apparaîtra
                  dès qu'un SEMIS sera enregistré.
                </div>
              )}
            </section>

            {/* Travaux : toutes les interventions sur la parcelle */}
            <section>
              <h2 className="mb-3 text-lg font-semibold">
                Travaux ({ivOfParcelle.length}{" "}
                {ivOfParcelle.length > 1 ? "interventions" : "intervention"})
              </h2>
              {ivOfParcelle.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-border p-6 text-sm text-foreground/60">
                  Aucune intervention enregistrée. Saisis ton premier travail via le bouton
                  ci-dessus.
                </div>
              ) : (
                <ul className="space-y-2">
                  {ivOfParcelle.map((iv) => {
                    const quantite = formatQuantite(iv.quantite, iv.unite);
                    return (
                      <li
                        key={iv.id}
                        className="flex items-start gap-3 rounded-lg border border-border bg-background p-3"
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl ${colorType(iv.type)}`}
                        >
                          {emojiType(iv.type)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-medium">{libelleType(iv.type)}</span>
                            <span className="text-xs text-foreground/60">
                              {formatDateFr(iv.dateOperation)}
                            </span>
                          </div>
                          <div className="text-sm text-foreground/70">
                            {iv.produit ?? "—"}
                            {quantite ? ` · ${quantite}` : ""}
                          </div>
                          {iv.notes && (
                            <p className="mt-1 text-xs text-foreground/60">{iv.notes}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}

function BilanParcelleCard({
  titre,
  besoin,
  apport,
  solde,
  espece,
}: {
  titre: string;
  besoin: number;
  apport: number;
  solde: number;
  espece: string;
}) {
  const surfertilise = solde > 0;
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{titre}</h3>
        <span className="text-xs text-foreground/50">{espece}</span>
      </div>
      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-foreground/70">Besoin</dt>
          <dd className="tabular-nums">{formatKg(besoin)} kg</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-foreground/70">Apports saisis</dt>
          <dd className="tabular-nums">{formatKg(apport)} kg</dd>
        </div>
        <div className="flex justify-between border-t border-border/60 pt-1.5">
          <dt className="font-medium">Solde</dt>
          <dd
            className={`font-semibold tabular-nums ${surfertilise ? "text-red-600" : "text-foreground"}`}
          >
            {solde > 0 ? "+" : ""}
            {formatKg(solde)} kg
          </dd>
        </div>
      </dl>
    </div>
  );
}
