"use client";

import { Check, ClipboardCheck, X } from "lucide-react";
import { useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  emojiType,
  libelleType,
  type PendingIntervention,
  useInterventionsPending,
  useRejectIntervention,
  useValidateIntervention,
} from "@/lib/interventions";

/**
 * Page de validation des interventions PENDING reçues d'un partenaire.
 *
 * Quand un prestataire saisit une intervention sur ma parcelle (cas B),
 * elle apparaît ici en attente : je peux ACCEPTER (passe à VALIDATED,
 * entre dans mon carnet), REFUSER (passe à REJECTED, le devis Odoo du
 * prestataire est annulé) ou MODIFIER avant accept (ouvre /interventions/[id]).
 */
export default function InterventionsPendingPage() {
  const pending = useInterventionsPending();
  const validate = useValidateIntervention();
  const reject = useRejectIntervention();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleReject = (id: string) => {
    const reason = rejectReason.trim();
    reject.mutate(reason ? { id, reason } : { id }, {
      onSuccess: () => {
        setRejectingId(null);
        setRejectReason("");
      },
    });
  };

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/app" },
          { label: "Activités", href: "/activites" },
          { label: "Interventions à valider" },
        ]}
      />
      <div className="mx-auto max-w-3xl px-2 py-4 sm:px-4 sm:py-8">
        <PageHeader
          title="Interventions à valider"
          icon={ClipboardCheck}
          subtitle="Interventions saisies par un partenaire sur tes parcelles. Accepte pour les enregistrer dans ton carnet, refuse si le travail n'a pas été fait comme indiqué."
        />

        {pending.isLoading && <div className="text-sm text-foreground/60">Chargement…</div>}

        {pending.data && pending.data.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-foreground/60">
            <ClipboardCheck className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">Rien à valider — tu es à jour.</p>
            <p className="mt-1 text-xs">
              Les interventions saisies par tes partenaires sur tes parcelles apparaîtront ici.
            </p>
          </div>
        )}

        {pending.data && pending.data.length > 0 && (
          <div className="space-y-4">
            {pending.data.map((it) => (
              <PendingCard
                key={it.id}
                intervention={it}
                isValidating={validate.isPending}
                isRejecting={reject.isPending}
                onValidate={() => validate.mutate(it.id)}
                rejectingId={rejectingId}
                rejectReason={rejectReason}
                onStartReject={() => {
                  setRejectingId(it.id);
                  setRejectReason("");
                }}
                onCancelReject={() => {
                  setRejectingId(null);
                  setRejectReason("");
                }}
                onChangeReason={setRejectReason}
                onConfirmReject={() => handleReject(it.id)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

interface PendingCardProps {
  intervention: PendingIntervention;
  isValidating: boolean;
  isRejecting: boolean;
  onValidate: () => void;
  rejectingId: string | null;
  rejectReason: string;
  onStartReject: () => void;
  onCancelReject: () => void;
  onChangeReason: (s: string) => void;
  onConfirmReject: () => void;
}

function PendingCard({
  intervention: it,
  isValidating,
  isRejecting,
  onValidate,
  rejectingId,
  rejectReason,
  onStartReject,
  onCancelReject,
  onChangeReason,
  onConfirmReject,
}: PendingCardProps) {
  const isThisRejecting = rejectingId === it.id;
  return (
    <article className="overflow-hidden rounded-2xl border-2 border-amber-300/60 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
      <header className="flex flex-wrap items-start gap-3 px-4 py-3 sm:px-5">
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-background text-2xl shadow-sm">
          {emojiType(it.type)}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold leading-tight">
            {libelleType(it.type)} sur <strong>{it.parcelle.nom}</strong>
          </h2>
          <p className="mt-0.5 text-xs text-foreground/70">
            Saisi par <strong>{it.authorTenant.nom}</strong> le{" "}
            {new Date(it.dateOperation).toLocaleDateString("fr-CH")}
          </p>
        </div>
      </header>

      <div className="border-t border-amber-300/40 bg-background px-4 py-3 text-sm sm:px-5 dark:border-amber-800/40">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {it.materielRef && (
            <>
              <dt className="text-foreground/60">Matériel</dt>
              <dd className="font-medium">{it.materielRef.libelle}</dd>
            </>
          )}
          {it.surfaceHa && (
            <>
              <dt className="text-foreground/60">Surface</dt>
              <dd className="font-mono tabular-nums">{Number(it.surfaceHa).toFixed(2)} ha</dd>
            </>
          )}
          {it.produitRef && (
            <>
              <dt className="text-foreground/60">Produit</dt>
              <dd>
                {it.produitRef.libelle}
                {it.quantite && ` — ${Number(it.quantite)} ${it.unite ?? ""}`}
              </dd>
            </>
          )}
          {it.notes && (
            <>
              <dt className="text-foreground/60">Notes</dt>
              <dd className="text-foreground/80">{it.notes}</dd>
            </>
          )}
        </dl>
      </div>

      {isThisRejecting ? (
        <div className="border-t border-amber-300/40 bg-red-50 px-4 py-3 sm:px-5 dark:border-amber-800/40 dark:bg-red-950/20">
          <label className="block text-xs font-semibold uppercase tracking-wider text-red-900 dark:text-red-200">
            Raison du refus (optionnel)
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => onChangeReason(e.target.value)}
            placeholder="Ex: pas la bonne parcelle, surface incorrecte…"
            rows={2}
            className="mt-1 w-full rounded-lg border border-red-300 bg-background px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-red-800"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={onConfirmReject}
              disabled={isRejecting}
              size="sm"
              className="bg-red-600 hover:bg-red-700"
            >
              <X className="mr-1 h-4 w-4" />
              Confirmer le refus
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onCancelReject}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-amber-300/40 px-4 py-3 sm:px-5 dark:border-amber-800/40">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onStartReject}
            disabled={isValidating || isRejecting}
            className="border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
          >
            <X className="mr-1 h-4 w-4" />
            Refuser
          </Button>
          <Button
            type="button"
            onClick={onValidate}
            disabled={isValidating || isRejecting}
            size="sm"
            className="bg-green hover:bg-green-dark"
          >
            <Check className="mr-1 h-4 w-4" />
            {isValidating ? "Validation…" : "Accepter"}
          </Button>
        </div>
      )}
    </article>
  );
}
