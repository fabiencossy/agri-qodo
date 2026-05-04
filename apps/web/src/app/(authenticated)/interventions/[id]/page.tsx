"use client";

import { Calendar, Check, MapPin, Sprout, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { DetailHeader } from "@/components/app/detail-header";
import {
  emojiType,
  formatDateFr,
  formatQuantite,
  libelleType,
  useDeleteIntervention,
  useIntervention,
  useRejectIntervention,
  useValidateIntervention,
} from "@/lib/interventions";

export default function InterventionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const intervention = useIntervention(params?.id);
  const validate = useValidateIntervention();
  const reject = useRejectIntervention();
  const del = useDeleteIntervention();

  if (intervention.isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-foreground/60">Chargement…</div>
    );
  }
  if (intervention.isError || !intervention.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Impossible de charger cette intervention.
        </p>
        <Link href="/interventions" className="mt-3 inline-block text-sm underline">
          Retour au carnet
        </Link>
      </div>
    );
  }

  const iv = intervention.data;
  const isPending = iv.validationStatus === "PENDING";
  const quantite = formatQuantite(iv.quantite, iv.unite);

  const handleDelete = async () => {
    if (!confirm("Supprimer définitivement cette intervention ?")) return;
    await del.mutateAsync(iv.id);
    router.push("/interventions");
  };
  const handleValidate = () => validate.mutate(iv.id);
  const handleReject = () => {
    const reason = prompt("Raison du refus (optionnel) :");
    if (reason === null) return;
    reject.mutate(reason.trim() ? { id: iv.id, reason: reason.trim() } : { id: iv.id });
  };

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/app" },
          { label: "Carnet des champs", href: "/interventions" },
          { label: libelleType(iv.type) },
        ]}
      />
      <div className="mx-auto max-w-3xl px-2 py-3 sm:px-4 sm:py-6">
        <DetailHeader
          backHref="/interventions"
          icon={Sprout}
          emoji={emojiType(iv.type)}
          title={libelleType(iv.type)}
          subtitle={
            <span>
              {iv.parcelle?.nom ?? "—"} · {formatDateFr(iv.dateOperation)}
              {quantite ? ` · ${quantite}` : ""}
            </span>
          }
          badges={
            isPending && (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                à valider
              </span>
            )
          }
          onEdit={() => router.push(`/interventions/new?edit=${iv.id}` as never)}
          menuActions={[
            {
              label: "Supprimer",
              icon: Trash2,
              variant: "danger",
              disabled: del.isPending,
              onClick: handleDelete,
            },
          ]}
        />

        {isPending && (
          <section className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="w-full text-sm text-amber-900">
              Cette intervention a été saisie par un partenaire — accepter ou refuser.
            </p>
            <button
              type="button"
              onClick={handleValidate}
              disabled={validate.isPending}
              className="inline-flex items-center gap-1 rounded-lg bg-green px-3 py-2 text-sm font-semibold text-white hover:bg-green-dark disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              Accepter
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={reject.isPending}
              className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-background px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Refuser
            </button>
          </section>
        )}

        <section className="mb-4 grid gap-3 rounded-2xl border border-border bg-background p-5 sm:grid-cols-2">
          <Info icon={MapPin} label="Parcelle" value={iv.parcelle?.nom ?? "—"} />
          <Info icon={Calendar} label="Date d'opération" value={formatDateFr(iv.dateOperation)} />
          {iv.produit && <Info icon={Sprout} label="Produit" value={iv.produit} />}
          {iv.materielRef && <Info icon={Sprout} label="Matériel" value={iv.materielRef.libelle} />}
          {quantite && <Info icon={Sprout} label="Quantité" value={quantite} />}
          {iv.surfaceTravailleeM2 && (
            <Info
              icon={MapPin}
              label="Surface travaillée"
              value={`${(Number(iv.surfaceTravailleeM2) / 10000).toFixed(2)} ha`}
            />
          )}
          {iv.culture && (
            <Info
              icon={Sprout}
              label="Culture"
              value={`${iv.culture.espece} (campagne ${iv.culture.campagne})`}
            />
          )}
          {iv.notes && (
            <div className="sm:col-span-2">
              <p className="mb-1 text-xs uppercase tracking-wide text-foreground/50">Notes</p>
              <p className="whitespace-pre-wrap text-sm">{iv.notes}</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground/40" />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-foreground/50">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}
