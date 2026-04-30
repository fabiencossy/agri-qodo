"use client";

import { Check, Copy, Eye, EyeOff, Handshake, Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentTenant } from "@/lib/auth";
import {
  type DirectoryHit,
  NIVEAU_LIBELLE,
  type PartnerLinkView,
  STATUS_LIBELLE,
  useAcceptPartner,
  useInvitePartner,
  useLookupTenant,
  usePartnerLinks,
  useRevokePartner,
  useSearchDirectory,
} from "@/lib/partner-links";
import { useTenantDetail, useUpdateTenant } from "@/lib/tenants";

export default function PartenairesPage() {
  const tenant = useCurrentTenant();
  const detail = useTenantDetail();
  const updateTenant = useUpdateTenant();
  const links = usePartnerLinks();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const visible = detail.data?.visibleInDirectory ?? false;
  const toggleVisibility = () => {
    updateTenant.mutate({ visibleInDirectory: !visible });
  };

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
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Partenaires" }]} />
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
          <div className="mb-6 grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-green/30 bg-green/5 p-4">
              <p className="text-sm font-semibold">Mon code Agri Qodo</p>
              <p className="mt-1 text-xs text-foreground/60">
                Partage ce code à un partenaire pour qu'il puisse t'inviter directement.
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
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                {visible ? (
                  <Eye className="h-4 w-4 text-emerald-700" />
                ) : (
                  <EyeOff className="h-4 w-4 text-foreground/50" />
                )}
                Visibilité dans l'annuaire
              </p>
              <p className="mt-1 text-xs text-foreground/60">
                {visible
                  ? "Tu apparais dans la recherche d'autres exploitations (nom + adresse). Désactive si tu ne veux plus recevoir d'invitations."
                  : "Tu n'es pas trouvable par recherche. Active pour permettre à d'autres agriculteurs de t'inviter sans avoir à demander ton code."}
              </p>
              <Button
                variant="secondary"
                className="mt-3"
                onClick={toggleVisibility}
                disabled={updateTenant.isPending || !detail.data}
              >
                {visible ? "Me retirer de l'annuaire" : "M'ajouter à l'annuaire"}
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
  const [tab, setTab] = useState<"search" | "code">("search");
  const invite = useInvitePartner();
  const [error, setError] = useState<string | null>(null);

  const handleInvite = (partnerCode: string) => {
    setError(null);
    invite.mutate(
      { partnerCode },
      {
        onSuccess: () => onClose(),
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
        className="w-full max-w-lg rounded-2xl bg-background p-5 shadow-xl"
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

        <div className="mt-3 flex gap-1 rounded-lg bg-muted p-1 text-sm">
          <button
            type="button"
            onClick={() => setTab("search")}
            className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${
              tab === "search" ? "bg-background font-medium shadow-sm" : "text-foreground/70"
            }`}
          >
            <Search className="mr-1 inline h-3.5 w-3.5" />
            Rechercher
          </button>
          <button
            type="button"
            onClick={() => setTab("code")}
            className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${
              tab === "code" ? "bg-background font-medium shadow-sm" : "text-foreground/70"
            }`}
          >
            Code direct
          </button>
        </div>

        {tab === "search" ? (
          <DirectorySearch onInvite={handleInvite} inviting={invite.isPending} error={error} />
        ) : (
          <DirectCodeInvite onInvite={handleInvite} inviting={invite.isPending} error={error} />
        )}

        <div className="mt-5 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}

function DirectorySearch({
  onInvite,
  inviting,
  error,
}: {
  onInvite: (code: string) => void;
  inviting: boolean;
  error: string | null;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(handle);
  }, [query]);

  const search = useSearchDirectory(debounced);

  return (
    <>
      <p className="mt-3 text-sm text-foreground/70">
        Tape le nom de l'exploitation ou de l'agriculteur, ou la localité. Seules les exploitations
        qui ont accepté d'apparaître dans l'annuaire sont visibles.
      </p>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
        <Input
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Bob Rolet, Sévery, Ferme du Loup…"
          autoFocus
        />
      </div>

      {debounced.length >= 2 && (
        <div className="mt-3 max-h-72 overflow-y-auto">
          {search.isLoading ? (
            <p className="text-sm text-foreground/50">Recherche…</p>
          ) : (search.data?.length ?? 0) === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Aucune exploitation visible ne correspond. Demande à ton partenaire de coter
              "M'ajouter à l'annuaire" dans sa page Partenaires, ou utilise l'onglet "Code direct".
            </p>
          ) : (
            <ul className="space-y-2">
              {search.data?.map((hit) => (
                <DirectoryHitRow
                  key={hit.id}
                  hit={hit}
                  onInvite={() => onInvite(hit.code)}
                  inviting={inviting}
                />
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </>
  );
}

function DirectoryHitRow({
  hit,
  onInvite,
  inviting,
}: {
  hit: DirectoryHit;
  onInvite: () => void;
  inviting: boolean;
}) {
  const ownerLabel =
    hit.ownerPrenom || hit.ownerNom
      ? `${hit.ownerPrenom ?? ""} ${hit.ownerNom ?? ""}`.trim()
      : null;
  const adresseLabel = [hit.adresse, [hit.npa, hit.localite].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background p-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {hit.nom}
          <span className="ml-2 text-xs text-foreground/50">({hit.canton})</span>
        </p>
        {ownerLabel && <p className="text-sm text-foreground/70">{ownerLabel}</p>}
        {adresseLabel && <p className="text-xs text-foreground/60">{adresseLabel}</p>}
        <p className="mt-0.5 font-mono text-[10px] text-foreground/40">{hit.code}</p>
      </div>
      <Button size="sm" onClick={onInvite} disabled={inviting}>
        Inviter
      </Button>
    </li>
  );
}

function DirectCodeInvite({
  onInvite,
  inviting,
  error,
}: {
  onInvite: (code: string) => void;
  inviting: boolean;
  error: string | null;
}) {
  const [code, setCode] = useState("");
  const [debouncedCode, setDebouncedCode] = useState("");
  const lookup = useLookupTenant(debouncedCode, debouncedCode.length >= 8);

  const onCodeChange = (value: string) => {
    setCode(value.toUpperCase());
    setTimeout(() => setDebouncedCode(value.toUpperCase()), 300);
  };

  return (
    <>
      <p className="mt-3 text-sm text-foreground/70">
        Saisis le code Agri Qodo communiqué par ton partenaire (format{" "}
        <code className="font-mono text-xs">AQ-VD-1234-A1B2</code> ou{" "}
        <code className="font-mono text-xs">VD-1234567</code>).
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
          Aucune exploitation avec ce code.
        </p>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end">
        <Button onClick={() => onInvite(code)} disabled={inviting || !lookup.data}>
          {inviting ? "…" : "Inviter"}
        </Button>
      </div>
    </>
  );
}
