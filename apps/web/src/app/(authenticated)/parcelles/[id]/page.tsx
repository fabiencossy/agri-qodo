"use client";

import { ArrowLeft, Calendar, Check, MapPin, Plus, Sprout, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  colorType,
  emojiType,
  formatDateFr,
  formatQuantite,
  libelleType,
  TECHNIQUE_LABEL,
  TECHNIQUES_ORDER,
  type TechniqueEpandage,
  useInterventions,
} from "@/lib/interventions";
import { formatSurface, libelleZone, useParcelle } from "@/lib/parcelles";
import {
  useCreatePlanApport,
  useDeletePlanApport,
  usePlanFumure,
  useRealiserPlan,
} from "@/lib/plan-fumure";
import { useProduits } from "@/lib/produits";
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

            {/* Plan de fumure prévisionnel */}
            <section className="mb-6">
              <PlanFumureSection parcelleId={parcelleId} campagne={currentYear} />
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

function PlanFumureSection({ parcelleId, campagne }: { parcelleId: string; campagne: number }) {
  const plan = usePlanFumure({ parcelleId, campagne });
  const realiser = useRealiserPlan();
  const remove = useDeletePlanApport();
  const [showAdd, setShowAdd] = useState(false);

  const apports = plan.data ?? [];
  const prevu = apports.filter((a) => !a.interventionId);
  const realise = apports.filter((a) => a.interventionId);

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Plan de fumure {campagne}</h2>
          <p className="text-xs text-foreground/60">
            Apports d'engrais prévus pour la campagne. Comparaison plan vs réalisé.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setShowAdd((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" />
          {showAdd ? "Annuler" : "Ajouter au plan"}
        </Button>
      </div>

      {showAdd && (
        <NewPlanApportForm
          parcelleId={parcelleId}
          campagne={campagne}
          onDone={() => setShowAdd(false)}
        />
      )}

      {plan.isLoading && <div className="text-sm text-foreground/60">Chargement…</div>}

      {!plan.isLoading && apports.length === 0 && !showAdd && (
        <div className="rounded-xl border-2 border-dashed border-border p-6 text-sm text-foreground/60">
          Aucun apport planifié. Le plan de fumure est obligatoire pour le PER — saisis ici tes
          apports prévus avant la saison.
        </div>
      )}

      {prevu.length > 0 && (
        <div className="mb-3 overflow-hidden rounded-xl border border-border bg-background">
          <table className="w-full text-sm">
            <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-foreground/60">
              <tr>
                <th className="px-3 py-2">Date prévue</th>
                <th className="px-3 py-2">Produit</th>
                <th className="px-3 py-2 text-right">Quantité</th>
                <th className="px-3 py-2 text-right">kg N</th>
                <th className="px-3 py-2 text-right">kg P</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {prevu.map((p) => (
                <tr key={p.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 text-foreground/70">
                    {p.datePrevue ? formatDateFr(p.datePrevue) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">
                      {p.produitRef?.libelle ?? p.produitLibre ?? "—"}
                    </div>
                    {p.technique && (
                      <div className="text-xs text-foreground/50">
                        {TECHNIQUE_LABEL[p.technique]}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {p.quantitePrevue ? `${Number(p.quantitePrevue)} ${p.unite ?? ""}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {p.kgNPrevu ? formatKg(Number(p.kgNPrevu)) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {p.kgPPrevu ? formatKg(Number(p.kgPPrevu)) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => realiser.mutate({ id: p.id })}
                        disabled={realiser.isPending}
                        title="Marquer comme réalisé (crée une intervention dans le carnet)"
                        className="inline-flex items-center gap-1 rounded-md bg-green/10 px-2 py-1 text-xs text-green hover:bg-green/20 disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" />
                        Réaliser
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Supprimer cet apport prévu ?")) remove.mutate(p.id);
                        }}
                        disabled={remove.isPending}
                        title="Supprimer"
                        className="rounded-md p-1.5 text-foreground/50 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {realise.length > 0 && (
        <details className="rounded-xl border border-border bg-background">
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-foreground/70">
            Réalisés ({realise.length}) ▾
          </summary>
          <ul className="divide-y divide-border text-sm">
            {realise.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2">
                <span className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-foreground/40" />
                  <span className="text-foreground/70">
                    {p.intervention
                      ? formatDateFr(p.intervention.dateOperation)
                      : p.datePrevue
                        ? formatDateFr(p.datePrevue)
                        : "—"}
                  </span>
                  <span>{p.produitRef?.libelle ?? p.produitLibre ?? "—"}</span>
                </span>
                <span className="text-xs text-foreground/50">
                  {p.kgNPrevu ? `${formatKg(Number(p.kgNPrevu))} kg N` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function NewPlanApportForm({
  parcelleId,
  campagne,
  onDone,
}: {
  parcelleId: string;
  campagne: number;
  onDone: () => void;
}) {
  const create = useCreatePlanApport();
  const produits = useProduits();
  const [produitId, setProduitId] = useState("");
  const [datePrevue, setDatePrevue] = useState("");
  const [quantitePrevue, setQuantitePrevue] = useState("");
  const [unite, setUnite] = useState("kg");
  const [technique, setTechnique] = useState<TechniqueEpandage | "">("");

  const engrais = useMemo(
    () =>
      (produits.data ?? [])
        .filter(
          (p) =>
            (p.categorie === "ENGRAIS_MINERAL" || p.categorie === "ENGRAIS_ORGANIQUE") && p.actif,
        )
        .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr")),
    [produits.data],
  );

  const selectedProduit = engrais.find((p) => p.id === produitId);
  const isOrganique = selectedProduit?.categorie === "ENGRAIS_ORGANIQUE";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        parcelleId,
        campagne,
        ...(produitId ? { produitId } : {}),
        ...(datePrevue ? { datePrevue } : {}),
        ...(quantitePrevue ? { quantitePrevue: Number(quantitePrevue) } : {}),
        ...(unite ? { unite } : {}),
        ...(technique ? { technique: technique as TechniqueEpandage } : {}),
      },
      { onSuccess: () => onDone() },
    );
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mb-3 grid gap-3 rounded-xl border border-border bg-background p-4 sm:grid-cols-2"
    >
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Date prévue</span>
        <Input type="date" value={datePrevue} onChange={(e) => setDatePrevue(e.target.value)} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Produit catalogue</span>
        <select
          value={produitId}
          onChange={(e) => setProduitId(e.target.value)}
          className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base"
        >
          <option value="">Aucun (saisie libre)</option>
          {engrais.map((p) => (
            <option key={p.id} value={p.id}>
              {p.libelle}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Quantité</span>
        <Input
          type="number"
          step="0.1"
          min="0"
          value={quantitePrevue}
          onChange={(e) => setQuantitePrevue(e.target.value)}
          placeholder="100"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Unité</span>
        <Input value={unite} onChange={(e) => setUnite(e.target.value)} placeholder="kg, L, m³…" />
      </label>
      {isOrganique && (
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Technique d'épandage prévue</span>
          <select
            value={technique}
            onChange={(e) => setTechnique(e.target.value as TechniqueEpandage | "")}
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base"
          >
            <option value="">Non précisée</option>
            {TECHNIQUES_ORDER.map((t) => (
              <option key={t} value={t}>
                {TECHNIQUE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" size="sm" disabled={create.isPending}>
          {create.isPending ? "Ajout…" : "Ajouter"}
        </Button>
      </div>
      {create.isError && (
        <p className="text-sm text-red-600 sm:col-span-2">Erreur, vérifie les valeurs.</p>
      )}
    </form>
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
