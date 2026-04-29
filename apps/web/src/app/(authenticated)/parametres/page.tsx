"use client";

import {
  Building2,
  Cog,
  Database,
  Handshake,
  KeyRound,
  type LucideIcon,
  Package,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { useCurrentTenant, useCurrentUser } from "@/lib/auth";

interface SettingsLink {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  ownerOnly?: boolean;
  badge?: string;
}

/**
 * Page d'accueil des Paramètres — point d'entrée unique pour tout ce qui
 * configure l'exploitation. Regroupe les écrans déjà existants et les
 * nouveaux ajoutés dans cette PR (ACL employés).
 *
 * On évite de tout mettre dans une seule page géante : chaque section
 * pointe vers un écran dédié, ce qui garde l'URL propre et permet de
 * partager un lien direct vers une sous-section.
 */
const EXPLOITATION_LINKS: SettingsLink[] = [
  {
    href: "/parametres/exploitation",
    label: "Mon exploitation",
    description: "Nom, canton, adresse, n° UFAM, n° BDTA, contact.",
    icon: Building2,
    ownerOnly: true,
  },
  {
    href: "/exploitation/odoo",
    label: "Connexion Odoo Enterprise",
    description: "URL, base, login, clé API. Synchronisation facturation et bons de commande.",
    icon: KeyRound,
    ownerOnly: true,
    badge: "M6",
  },
];

const COLLABORATION_LINKS: SettingsLink[] = [
  {
    href: "/utilisateurs",
    label: "Utilisateurs",
    description: "Comptes des collaborateurs (OWNER, salarié, comptable, conseiller).",
    icon: Users,
    ownerOnly: true,
  },
  {
    href: "/parametres/permissions",
    label: "Rôles et permissions employés",
    description: "Définir précisément ce que chaque employé peut consulter ou modifier.",
    icon: ShieldCheck,
    ownerOnly: true,
    badge: "Bientôt",
  },
  {
    href: "/partenaires",
    label: "Partenariats",
    description: "Donner accès à un partenaire (entrepreneur, conseiller, voisin).",
    icon: Handshake,
    ownerOnly: true,
  },
];

const REFERENTIELS_LINKS: SettingsLink[] = [
  {
    href: "/produits",
    label: "Catalogue produits",
    description: "Semences, engrais, phytos. Catalogue partagé + ajouts par exploitation.",
    icon: Package,
  },
  {
    href: "/veille",
    label: "Veille réglementaire",
    description: "Bibliothèque de fiches OPD/OPPh, recherche par mot-clé.",
    icon: Database,
  },
];

export default function ParametresPage() {
  const me = useCurrentUser();
  const tenant = useCurrentTenant();
  const isOwner = me.data?.role === "OWNER";

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Paramètres" }]} />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Cog className="h-7 w-7 text-green" />
            Paramètres
          </h1>
          {tenant.data && (
            <p className="mt-1 text-foreground/70">
              <span className="font-medium">{tenant.data.nom}</span>
              {" · "}
              <span className="font-mono text-sm">{tenant.data.code}</span>
            </p>
          )}
        </div>

        {!isOwner && (
          <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Tu n'es pas propriétaire de l'exploitation — certaines sections sont en lecture seule.
            Demande à l'OWNER pour modifier.
          </div>
        )}

        <Section title="Exploitation" links={EXPLOITATION_LINKS} isOwner={isOwner} />
        <Section title="Collaboration" links={COLLABORATION_LINKS} isOwner={isOwner} />
        <Section title="Référentiels" links={REFERENTIELS_LINKS} isOwner={isOwner} />
      </div>
    </>
  );
}

function Section({
  title,
  links,
  isOwner,
}: {
  title: string;
  links: SettingsLink[];
  isOwner: boolean;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground/60">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <SettingsCard key={link.href} link={link} disabled={!isOwner && !!link.ownerOnly} />
        ))}
      </div>
    </section>
  );
}

function SettingsCard({ link, disabled }: { link: SettingsLink; disabled: boolean }) {
  const Icon = link.icon;
  const content = (
    <div
      className={`flex h-full items-start gap-3 rounded-xl border bg-background p-4 transition-colors ${
        disabled ? "border-border opacity-60" : "border-border hover:border-green hover:bg-green/5"
      }`}
    >
      <div
        className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
          disabled ? "bg-muted text-foreground/40" : "bg-green/10 text-green"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{link.label}</span>
          {link.badge && (
            <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
              {link.badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-foreground/60">{link.description}</p>
      </div>
    </div>
  );
  if (disabled) {
    return <div title="Réservé au propriétaire (OWNER) de l'exploitation.">{content}</div>;
  }
  return <Link href={link.href as never}>{content}</Link>;
}
