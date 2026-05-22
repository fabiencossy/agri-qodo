"use client";

/**
 * Landing publique — `/`. Visible par tout le monde, même non-loggé.
 *
 * Présente Agri Qodo, ses fonctionnalités principales, et propose deux
 * CTAs : "Tester l'application" (compte démo) et "Se connecter".
 *
 * Le dashboard authentifié a été déplacé à `/app` pour libérer la racine
 * pour le marketing (convention SaaS standard).
 */
import {
  ArrowRight,
  Beef,
  ClipboardList,
  Cog,
  FlaskConical,
  Handshake,
  KeyRound,
  Layers,
  Leaf,
  type LucideIcon,
  MapPin,
  Smartphone,
  Sprout,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useIsAuthenticated } from "@/lib/auth";

export default function LandingPage() {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();

  // Si déjà connecté, on file direct au dashboard. Évite de "tomber" sur
  // la landing à chaque rechargement de l'app.
  useEffect(() => {
    if (isAuthenticated === true) router.replace("/app");
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />
      <Features />
      <Modules />
      <Standalone />
      <CallToAction />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Leaf className="h-6 w-6 text-green" />
          <span className="text-lg font-bold">Agri Qodo</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="text-sm font-medium text-foreground/70 hover:text-foreground"
          >
            Se connecter
          </Link>
          <Link href="/signup">
            <Button size="sm">Créer mon exploitation</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-green">
            ERP des exploitations agricoles suisses
          </p>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
            Tout ton terrain, ton cheptel, ta paperasse PER —{" "}
            <span className="text-green">en une seule app</span>.
          </h1>
          <p className="mt-4 text-lg text-foreground/70">
            Carnet des champs, plan d'assolement spatial, Suisse-Bilanz, SRPA, traçabilité animale,
            partenariats entre exploitations. Pensé pour la saisie au champ, sur mobile, hors ligne.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/signup">
              <Button size="lg">
                Créer mon exploitation
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="secondary">
                Se connecter
              </Button>
            </Link>
          </div>
          <p className="mt-3 text-xs text-foreground/50">
            Compte démo : <code className="font-mono">demo@demo.ch</code> /{" "}
            <code className="font-mono">demo</code>
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/30 p-6">
          <div className="grid grid-cols-2 gap-3">
            <Stat value="100 %" label="Open source AGPL v3" />
            <Stat value="🇨🇭" label="Hébergé en Suisse" />
            <Stat value="50+" label="Cultures référencées" />
            <Stat value="0 CHF" label="L'intégration Odoo" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-background p-4">
      <div className="text-2xl font-bold text-green">{value}</div>
      <div className="mt-1 text-xs text-foreground/60">{label}</div>
    </div>
  );
}

function Features() {
  return (
    <section className="border-y border-border bg-muted/20 py-16">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="mb-2 text-center text-3xl font-bold">Conçu pour le terrain suisse</h2>
        <p className="mx-auto mb-10 max-w-2xl text-center text-foreground/70">
          Conformité OPD-CH-2026 et Guide Agridea 1.18 sortis d'usine. Pas besoin de comprendre le
          jargon — l'app fait les calculs et te dit ce qu'il manque.
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={Smartphone}
            title="Mobile-first, offline"
            description="Saisie d'intervention au champ avec dessin de la zone semée. Surface auto-recadrée à la parcelle. Synchronisation quand tu retrouves le réseau."
          />
          <FeatureCard
            icon={FlaskConical}
            title="Suisse-Bilanz live"
            description="Bilan N/P calculé en temps réel à mesure que tu saisis. Plus besoin d'attendre janvier pour découvrir un dépassement."
          />
          <FeatureCard
            icon={Layers}
            title="Plan d'assolement spatial"
            description="Carte coloriée par culture, dérivée de tes interventions SEMIS. Découpe une parcelle en zones distinctes."
          />
          <FeatureCard
            icon={Beef}
            title="Cheptel + UGB"
            description="Coefficients OPD-CH-2026 par défaut. Import CSV BDTA en attendant l'API AnimalTracing officielle."
          />
          <FeatureCard
            icon={Handshake}
            title="Partenariats"
            description="Lie ton exploitation à un entrepreneur ou un voisin. Annuaire de recherche par nom + adresse, opt-in privacy."
          />
          <FeatureCard
            icon={KeyRound}
            title="Odoo Enterprise (optionnel)"
            description="Branche ton instance Odoo pour facturer. Multi-version v19+ supportée. L'app fonctionne 100 % sans Odoo si tu n'en veux pas."
          />
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-green/10 text-green">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-foreground/70">{description}</p>
    </div>
  );
}

function Modules() {
  const modules = [
    { icon: MapPin, label: "Parcelles" },
    { icon: Sprout, label: "Carnet des champs" },
    { icon: Beef, label: "Cheptel" },
    { icon: ClipboardList, label: "SRPA" },
    { icon: Layers, label: "Plan d'assolement" },
    { icon: FlaskConical, label: "Suisse-Bilanz" },
    { icon: Handshake, label: "Partenaires" },
    { icon: KeyRound, label: "Odoo (factures)" },
    { icon: Cog, label: "Paramètres" },
  ];
  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="mb-8 text-center text-3xl font-bold">Couvre toute ta semaine</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <li
                key={m.label}
                className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3"
              >
                <Icon className="h-5 w-5 flex-shrink-0 text-green" />
                <span className="truncate text-sm font-medium">{m.label}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Standalone() {
  return (
    <section className="border-y border-border bg-green/5 py-16">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <h2 className="text-3xl font-bold">Avec ou sans Odoo</h2>
        <p className="mx-auto mt-4 text-lg text-foreground/70">
          Toutes les fonctions PER (carnet, Suisse-Bilanz, assolement, SRPA) marchent en standalone.
          Branche ton Odoo Enterprise quand tu veux passer à la facturation client groupée — pas
          avant. Et tu peux le débrancher quand tu veux, ça ne touche pas tes données terrain.
        </p>
      </div>
    </section>
  );
}

function CallToAction() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <h2 className="text-3xl font-bold">Tester en 30 secondes</h2>
        <p className="mx-auto mt-4 text-foreground/70">
          Connecte-toi avec un compte démo (3 parcelles, 46 animaux, données Suisse-Bilanz) ou crée
          ton exploitation. Aucun engagement, données stockées en Suisse.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/signup">
            <Button size="lg">Créer mon exploitation</Button>
          </Link>
          <a
            href="https://github.com/Qodo-Digital/agri-qodo"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="lg" variant="secondary">
              Voir le code (GitHub)
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-muted/20 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-foreground/60 sm:flex-row">
        <div className="flex items-center gap-2">
          <Leaf className="h-4 w-4 text-green" />
          <span>Agri Qodo · ERP open source agricole suisse</span>
        </div>
        <div className="flex gap-4">
          <a
            href="https://github.com/Qodo-Digital/agri-qodo"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            GitHub
          </a>
          <span>·</span>
          <span>AGPL v3</span>
          <span>·</span>
          <span>Hébergé 🇨🇭</span>
        </div>
      </div>
    </footer>
  );
}
