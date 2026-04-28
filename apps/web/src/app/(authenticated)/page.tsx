"use client";

import { ClipboardList, MapPin, Sprout } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { useCurrentTenant } from "@/lib/auth";

export default function HomePage() {
  const tenant = useCurrentTenant();
  const prenom = tenant.data?.nom?.split(" ")[0] ?? "agriculteur";

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold">Bonjour {prenom} 👋</h1>
      <p className="mb-10 text-foreground/70">Que souhaitez-vous faire ?</p>

      <div className="grid gap-4 md:grid-cols-3">
        <ActionCard
          href="/interventions/new"
          icon={<Sprout className="h-8 w-8" />}
          title="Saisir une intervention"
          subtitle="Semis, fumure, phyto, récolte"
          primary
        />
        <ActionCard
          href="/parcelles"
          icon={<MapPin className="h-8 w-8" />}
          title="Mes parcelles"
          subtitle="Voir et gérer le parcellaire"
        />
        <ActionCard
          href="/srpa"
          icon={<ClipboardList className="h-8 w-8" />}
          title="SRPA aujourd'hui"
          subtitle="Journal des sorties au pâturage"
        />
      </div>

      <p className="mt-12 text-xs text-foreground/40">
        Astuce : utilise le bouton <span className="font-bold text-green">+</span> en bas à droite
        pour créer rapidement une parcelle ou saisir une intervention depuis n'importe quelle page.
      </p>
    </div>
  );
}

function ActionCard({
  href,
  icon,
  title,
  subtitle,
  primary = false,
}: {
  href: Route;
  icon: ReactNode;
  title: string;
  subtitle: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-3 rounded-2xl border p-6 transition-colors ${
        primary
          ? "border-green bg-green text-white hover:bg-green-dark"
          : "border-border bg-background hover:border-green hover:bg-muted"
      }`}
    >
      <div className={primary ? "text-white" : "text-green"}>{icon}</div>
      <div>
        <div className="text-xl font-semibold">{title}</div>
        <div className={`mt-1 text-sm ${primary ? "text-white/80" : "text-foreground/60"}`}>
          {subtitle}
        </div>
      </div>
    </Link>
  );
}
