"use client";

import {
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  MapPin,
  Package,
  Send,
  Tractor,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { DetailHeader } from "@/components/app/detail-header";
import { Button } from "@/components/ui/button";
import { useOdooConnected } from "@/lib/odoo-config";
import {
  formatCHF,
  formatDuree,
  type PushTravailResult,
  STATUT_BADGE,
  STATUT_LABEL,
  totalHeuresCHF,
  totalProduitsCHF,
  totalTravailCHF,
  useCancelTravail,
  useDeleteTravail,
  usePushTravailOdoo,
  useTravail,
  useValidateTravail,
} from "@/lib/travaux";

function dateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function TravailDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const travail = useTravail(params.id);
  const validate = useValidateTravail();
  const cancel = useCancelTravail();
  const del = useDeleteTravail();
  const push = usePushTravailOdoo();
  const odoo = useOdooConnected();
  const [pushResult, setPushResult] = useState<PushTravailResult | null>(null);

  if (travail.isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-foreground/60">Chargement…</div>
    );
  }
  if (travail.isError || !travail.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Impossible de charger ce travail.
        </p>
        <Link href="/travaux" className="mt-3 inline-block text-sm underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  const t = travail.data;
  const totalP = totalProduitsCHF(t);
  const totalH = totalHeuresCHF(t);
  const total = totalTravailCHF(t);
  const totalDureeMin = t.lignesHeure.reduce((s, l) => s + l.dureeMinutes, 0);

  const handleDelete = async () => {
    if (!confirm("Supprimer définitivement ce travail ?")) return;
    await del.mutateAsync(t.id);
    router.push("/travaux");
  };

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/app" },
          { label: "Travaux pour tiers", href: "/travaux" },
          { label: t.titre },
        ]}
      />
      <div className="mx-auto max-w-3xl px-2 py-3 sm:px-4 sm:py-6">
        <DetailHeader
          backHref="/travaux"
          icon={Tractor}
          title={t.titre}
          subtitle={<span className="capitalize">{dateLong(t.date)}</span>}
          badges={
            <>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUT_BADGE[t.statut]}`}>
                {STATUT_LABEL[t.statut]}
              </span>
              {t.interne && (
                <span className="rounded bg-foreground/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide">
                  Interne
                </span>
              )}
            </>
          }
          {...(t.statut !== "INVOICED"
            ? { onEdit: () => router.push(`/travaux/new?edit=${t.id}` as never) }
            : {})}
          menuActions={
            t.statut === "DRAFT"
              ? [
                  {
                    label: "Supprimer",
                    icon: Trash2,
                    variant: "danger",
                    disabled: del.isPending,
                    onClick: handleDelete,
                  },
                ]
              : []
          }
        />

        <section className="mb-4 grid gap-3 rounded-2xl border border-border bg-background p-5 sm:grid-cols-2">
          <Info
            icon={MapPin}
            label="Parcelle"
            value={t.parcelle ? t.parcelle.nom : <span className="text-foreground/40">—</span>}
          />
          <Info
            icon={ClipboardList}
            label="Client"
            value={
              t.partenaire ? (
                t.partenaire.nom
              ) : t.odooPartnerId ? (
                <span>{t.odooPartnerName ?? `Client Odoo #${t.odooPartnerId}`}</span>
              ) : (
                <span className="text-foreground/40">Interne</span>
              )
            }
          />
          {t.notes && (
            <div className="sm:col-span-2">
              <p className="mb-1 text-xs uppercase tracking-wide text-foreground/50">Notes</p>
              <p className="whitespace-pre-wrap text-sm">{t.notes}</p>
            </div>
          )}
        </section>

        <section className="mb-4 rounded-2xl border border-border bg-background p-5">
          <div className="mb-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-foreground/60" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
              Produits ({t.lignesProduit.length})
            </h2>
          </div>
          {t.lignesProduit.length === 0 ? (
            <p className="text-sm text-foreground/40">Aucun produit.</p>
          ) : (
            <ul className="divide-y divide-border">
              {t.lignesProduit.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
                >
                  <span className="font-medium">{l.libelle}</span>
                  <span className="font-mono text-xs text-foreground/70">
                    {l.quantite} {l.unite}
                    {l.prixUnitaireCHF && (
                      <>
                        {" × "}
                        {formatCHF(Number(l.prixUnitaireCHF))} ={" "}
                        <span className="font-medium text-foreground">
                          {formatCHF(Number(l.quantite) * Number(l.prixUnitaireCHF))}
                        </span>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {totalP > 0 && (
            <p className="mt-2 text-right text-sm">
              Sous-total : <span className="font-mono font-semibold">{formatCHF(totalP)}</span>
            </p>
          )}
        </section>

        <section className="mb-4 rounded-2xl border border-border bg-background p-5">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-foreground/60" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
              Heures ({t.lignesHeure.length})
            </h2>
          </div>
          {t.lignesHeure.length === 0 ? (
            <p className="text-sm text-foreground/40">Aucune heure saisie.</p>
          ) : (
            <ul className="divide-y divide-border">
              {t.lignesHeure.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
                >
                  <span className="font-medium">
                    {l.user ? `${l.user.prenom} ${l.user.nom}` : "—"}
                  </span>
                  <span className="font-mono text-xs text-foreground/70">
                    {formatDuree(l.dureeMinutes)}
                    {l.tauxHoraireCHF && (
                      <>
                        {" × "}
                        {formatCHF(Number(l.tauxHoraireCHF))}/h ={" "}
                        <span className="font-medium text-foreground">
                          {formatCHF((l.dureeMinutes / 60) * Number(l.tauxHoraireCHF))}
                        </span>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {totalDureeMin > 0 && (
            <p className="mt-2 text-right text-sm">
              Sous-total : <span className="font-semibold">{formatDuree(totalDureeMin)}</span>
              {totalH > 0 && (
                <span className="ml-2 font-mono font-semibold">{formatCHF(totalH)}</span>
              )}
            </p>
          )}
        </section>

        {total > 0 && (
          <div className="mb-4 rounded-2xl border-2 border-green bg-green/5 p-4 text-right">
            <p className="text-sm text-foreground/60">Total HT</p>
            <p className="font-mono text-2xl font-bold text-green-dark">{formatCHF(total)}</p>
          </div>
        )}

        {/* Bandeau Odoo — push automatique au save (review 2026-05-04 :
            "je veux que le pousser vers odoo soit automatique"). On
            n'affiche plus de bouton manuel par défaut : juste l'état
            (succès / en attente). Bouton retry caché derrière "Réessayer
            le push" si jamais l'auto a échoué. */}
        {odoo.connected && t.statut !== "CANCELLED" && (
          <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 sm:px-5">
            {t.odooSaleOrderId || t.odooTaskId ? (
              <div className="flex flex-wrap items-center gap-3">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-amber-700" />
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-amber-900">
                    {t.odooSaleOrderId
                      ? `Devis Odoo créé · sale.order #${t.odooSaleOrderId}`
                      : `Tâche Odoo créée · project.task #${t.odooTaskId}`}
                  </p>
                  <p className="text-xs text-foreground/70">
                    {t.odooSaleOrderId
                      ? "Pour re-pousser, annule d'abord le devis dans Odoo."
                      : "La tâche contient le détail des heures et des employés."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Send className="h-5 w-5 flex-shrink-0 text-amber-700" />
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-amber-900">Push Odoo en attente</p>
                  <p className="text-xs text-foreground/70">
                    Le push se déclenche automatiquement au save quand le travail a au moins une
                    ligne (heure ou produit). Si rien n'est arrivé après quelques secondes, clique
                    "Réessayer".
                  </p>
                </div>
                <Button
                  onClick={() => push.mutate(t.id, { onSuccess: (r) => setPushResult(r) })}
                  disabled={push.isPending}
                  size="sm"
                  variant="ghost"
                >
                  <Send className="mr-1 h-4 w-4" />
                  {push.isPending ? "Envoi…" : "Réessayer"}
                </Button>
              </div>
            )}
          </div>
        )}

        {pushResult && (
          <div className="mb-4 rounded-xl border border-green/30 bg-green/5 p-4 text-sm">
            <p className="font-medium text-green-dark">
              {pushResult.odooKind === "project_task"
                ? `✓ Tâche Odoo créée : project.task #${pushResult.odooTaskId} (${pushResult.linesCount} ligne${pushResult.linesCount > 1 ? "s" : ""} d'heures)`
                : `✓ Devis créé : sale.order #${pushResult.odooSaleOrderId} (${pushResult.linesCount} lignes${pushResult.partnerCreated ? ", nouveau client créé" : ""}${pushResult.productsCreated > 0 ? `, ${pushResult.productsCreated} produit${pushResult.productsCreated > 1 ? "s" : ""} créé${pushResult.productsCreated > 1 ? "s" : ""}` : ""})`}
            </p>
            {pushResult.odooUrl && (
              <a
                href={pushResult.odooUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-green-dark underline"
              >
                Ouvrir dans Odoo
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
        {push.isError && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Push Odoo échoué :{" "}
            {push.error instanceof Error ? push.error.message : "erreur inconnue"}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {t.statut === "DRAFT" && (
            <Button onClick={() => validate.mutate(t.id)} disabled={validate.isPending}>
              <CheckCircle2 className="mr-1 h-4 w-4" />
              Valider
            </Button>
          )}
          {(t.statut === "DRAFT" || t.statut === "VALIDATED") && (
            <Button
              variant="secondary"
              onClick={() => cancel.mutate(t.id)}
              disabled={cancel.isPending}
            >
              <XCircle className="mr-1 h-4 w-4" />
              Annuler ce travail
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-foreground/50">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
