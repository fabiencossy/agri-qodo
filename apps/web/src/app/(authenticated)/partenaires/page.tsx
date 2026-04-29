"use client";

import { Check, Copy, Handshake, Plus, X } from "lucide-react";
import { useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentTenant } from "@/lib/auth";
import {
  NIVEAU_LIBELLE,
  type PartnerLinkView,
  STATUS_LIBELLE,
  useAcceptPartner,
  useInvitePartner,
  useLookupTenant,
  usePartnerLinks,
  useRevokePartner,
} from "@/lib/partner-links";

export default function PartenairesPage() {
  const tenant = useCurrentTenant();
  const links = usePartnerLinks();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const onCopyCode = () => {
    if (!tenant.data?.code) return;
    void navigator.clipboard.writeText(tenant.data.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const linksData = links.data ?? [];
  const recus = linksData.filter((l) => l.status === "PENDING" && l.role === "partner");
  const envoyes = linksData.filter((l) => l.status === "PENDING" && l.role === "owner");
  const actifs = linksData.filter((l) => l.status === "ACTIVE");
  const revoques = linksData.filter((l) => l.status === "REVOKED");

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Partenaires" }]} />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <Handshake className="h-7 w-7 text-green" />
              Partenaires
            </h1>
            <p className="mt-1 text-foreground/70">
              Lie ton exploitation à celle d'un entrepreneur, d'un voisin ou d'un conseiller. Une
              intervention saisie par le partenaire apparaît automatiquement dans ton carnet.
            </p>
          </div>
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Inviter un partenaire
          </Button>
        </div>

        {tenant.data && (
          <div className="mb-6 rounded-2xl border border-green/30 bg-green/5 p-4">
            <p className="text-sm font-semibold">Mon code Agri Qodo</p>
            <p className="mt-1 text-xs text-foreground/60">
              Partage ce code à un partenaire pour qu'il puisse t'inviter.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <code className="flex-1 rounded-lg bg-background px-3 py-2 font-mono text-base">
                {tenant.data.code}
              </code>
              <Button variant="secondary" onClick={onCopyCode}>
                {copied ? (
                  <>
                    <Check className="mr-1 h-4 w-4" />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-4 w-4" />
                    Copier
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {recus.length > 0 && (
          <Section title={`Demandes reçues (${recus.length})`}>
            {recus.map((l) => (
              <PartnerCard key={l.id} link={l} variant="recue" />
            ))}
          </Section>
        )}

        {envoyes.length > 0 && (
          <Section title={`Demandes envoyées (${envoyes.length})`}>
            {envoyes.map((l) => (
              <PartnerCard key={l.id} link={l} variant="envoyee" />
            ))}
          </Section>
        )}

        <Section title={`Partenariats actifs (${actifs.length})`}>
          {actifs.length === 0 ? (
            <p className="text-sm text-foreground/60">Aucun partenariat actif pour le moment.</p>
          ) : (
            actifs.map((l) => <PartnerCard key={l.id} link={l} variant="actif" />)
          )}
        </Section>

        {revoques.length > 0 && (
          <Section title={`Historique (${revoques.length})`}>
            {revoques.map((l) => (
              <PartnerCard key={l.id} link={l} variant="revoque" />
            ))}
          </Section>
        )}

        <InvitePartnerDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/60">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

type CardVariant = "recue" | "envoyee" | "actif" | "revoque";

function PartnerCard({ link, variant }: { link: PartnerLinkView; variant: CardVariant }) {
  const accept = useAcceptPartner();
  const revoke = useRevokePartner();

  const onRevoke = () => {
    const verb =
      variant === "envoyee"
        ? "annuler cette invitation"
        : variant === "recue"
          ? "refuser cette invitation"
          : "révoquer ce partenariat";
    if (confirm(`Veux-tu ${verb} ?`)) revoke.mutate(link.id);
  };

  const scopeLibelle =
    link.scope.parcelles === "all"
      ? "toutes les parcelles"
      : `${link.scope.parcelles.length} parcelle(s)`;

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-background p-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {link.partner.nom}
          <span className="ml-2 text-xs text-foreground/50">({link.partner.canton})</span>
        </p>
        <p className="mt-0.5 font-mono text-xs text-foreground/60">{link.partner.code}</p>
        <p className="mt-1 text-xs text-foreground/70">
          {STATUS_LIBELLE[link.status]} · {NIVEAU_LIBELLE[link.niveau]} · {scopeLibelle}
          {link.role === "owner" ? " · invité par moi" : " · m'a invité"}
        </p>
      </div>
      <div className="flex flex-shrink-0 gap-2">
        {variant === "recue" && (
          <>
            <Button size="sm" onClick={() => accept.mutate(link.id)} disabled={accept.isPending}>
              <Check className="mr-1 h-4 w-4" />
              Accepter
            </Button>
            <Button size="sm" variant="ghost" onClick={onRevoke} disabled={revoke.isPending}>
              <X className="mr-1 h-4 w-4" />
              Refuser
            </Button>
          </>
        )}
        {(variant === "envoyee" || variant === "actif") && (
          <Button size="sm" variant="ghost" onClick={onRevoke} disabled={revoke.isPending}>
            <X className="mr-1 h-4 w-4" />
            {variant === "envoyee" ? "Annuler" : "Révoquer"}
          </Button>
        )}
      </div>
    </div>
  );
}

function InvitePartnerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [debouncedCode, setDebouncedCode] = useState("");
  const lookup = useLookupTenant(debouncedCode, debouncedCode.length >= 8);
  const invite = useInvitePartner();
  const [error, setError] = useState<string | null>(null);

  // Debounce simple : on relance le lookup quand l'utilisateur arrête de taper.
  const onCodeChange = (value: string) => {
    setCode(value.toUpperCase());
    setError(null);
    setTimeout(() => setDebouncedCode(value.toUpperCase()), 300);
  };

  const onInvite = () => {
    setError(null);
    invite.mutate(
      { partnerCode: code },
      {
        onSuccess: () => {
          setCode("");
          setDebouncedCode("");
          onClose();
        },
        onError: (err: unknown) => {
          setError(err instanceof Error ? err.message : "Échec de l'invitation");
        },
      },
    );
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Inviter un partenaire</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-muted"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-foreground/70">
          Saisis le code Agri Qodo de l'exploitation à inviter (format{" "}
          <code className="font-mono text-xs">AQ-VD-1234-A1B2</code>).
        </p>
        <Input
          className="mt-4 font-mono"
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          placeholder="AQ-XX-XXXX-XXXX"
          maxLength={40}
          autoFocus
        />
        {lookup.data && (
          <div className="mt-3 rounded-lg bg-green/10 px-3 py-2 text-sm">
            <p className="font-medium">{lookup.data.nom}</p>
            <p className="text-xs text-foreground/60">{lookup.data.canton}</p>
          </div>
        )}
        {lookup.isError && debouncedCode && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Aucune exploitation avec ce code (ou code invalide).
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={onInvite} disabled={invite.isPending || !lookup.data}>
            {invite.isPending ? "…" : "Inviter"}
          </Button>
        </div>
      </div>
    </div>
  );
}
