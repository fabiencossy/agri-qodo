"use client";

import { ClipboardList, MapPin, Sprout } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SyncIndicator } from "@/components/sync-indicator";
import { useCurrentTenant, useIsAuthenticated, useLogout } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const tenant = useCurrentTenant();
  const logout = useLogout();

  useEffect(() => {
    if (isAuthenticated === false) router.replace("/login");
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const prenom = tenant.data?.nom?.split(" ")[0] ?? "agriculteur";

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-green">🌱 Agri Qodo</span>
            {tenant.data && (
              <span className="hidden text-sm text-foreground/60 md:inline">
                · {tenant.data.nom}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <SyncIndicator />
            <Button variant="ghost" size="sm" onClick={() => logout.mutate()}>
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12">
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
          Pages métier à venir aux étapes 5-6. La connexion + stockage local sont opérationnels.
        </p>
      </main>
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
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href as never}
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
