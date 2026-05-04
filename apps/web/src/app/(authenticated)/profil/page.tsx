"use client";

import { Lock, LogOut, Mail, Shield, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogout, useMyProfile, useUpdateProfile } from "@/lib/auth";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Propriétaire",
  EMPLOYE: "Employé",
  COMPTABLE: "Comptable",
  CONSULTANT: "Consultant",
};

function getInitiales(prenom: string, nom: string): string {
  return `${prenom?.[0] ?? ""}${nom?.[0] ?? ""}`.toUpperCase();
}

/**
 * Page "Mon profil" — édition des infos perso + accès rapide aux sections
 * sécurité (mot de passe, sessions). Avatar = initiales pour MVP, upload
 * fichier viendra plus tard.
 */
export default function ProfilPage() {
  const profil = useMyProfile();
  const update = useUpdateProfile();
  const logout = useLogout();

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [langue, setLangue] = useState("fr");
  const [theme, setTheme] = useState("system");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!profil.data) return;
    setPrenom(profil.data.prenom);
    setNom(profil.data.nom);
    setTelephone(profil.data.telephone ?? "");
    const prefs = (profil.data.preferences as Record<string, string> | null) ?? {};
    setLangue(prefs.langue ?? "fr");
    setTheme(prefs.theme ?? "system");
  }, [profil.data]);

  const onSubmitInfos = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate(
      {
        prenom: prenom.trim(),
        nom: nom.trim(),
        telephone: telephone.trim(),
      },
      { onSuccess: () => setSavedAt(new Date()) },
    );
  };

  const onSubmitPrefs = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate({ preferences: { langue, theme } }, { onSuccess: () => setSavedAt(new Date()) });
  };

  if (profil.isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-3 py-8 text-sm text-foreground/60">Chargement…</div>
    );
  }

  if (!profil.data) {
    return (
      <div className="mx-auto max-w-3xl px-3 py-8 text-sm text-red-700">
        Impossible de charger le profil.
      </div>
    );
  }

  const initiales = getInitiales(profil.data.prenom, profil.data.nom);

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Mon profil" }]} />
      <div className="mx-auto max-w-3xl px-3 py-4 sm:py-8">
        <PageHeader
          title="Mon profil"
          icon={User}
          subtitle="Gère tes infos, préférences et sécurité."
        />

        {/* Header avatar + identité */}
        <section className="mb-4 flex items-center gap-4 rounded-2xl border border-border bg-background p-4 sm:p-5">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-green text-2xl font-bold text-white sm:h-20 sm:w-20">
            {initiales || <User className="h-8 w-8" />}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold sm:text-xl">
              {profil.data.prenom} {profil.data.nom}
            </h2>
            <p className="flex items-center gap-1.5 text-sm text-foreground/70">
              <Mail className="h-3.5 w-3.5" />
              <span className="truncate">{profil.data.email}</span>
            </p>
            <p className="mt-0.5 text-xs">
              <span className="rounded-full bg-green/10 px-2 py-0.5 font-medium text-green">
                {ROLE_LABEL[profil.data.role] ?? profil.data.role}
              </span>
            </p>
          </div>
        </section>

        {/* Infos perso */}
        <form
          onSubmit={onSubmitInfos}
          className="mb-4 space-y-4 rounded-2xl border border-border bg-background p-4 sm:p-5"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
            Infos personnelles
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Prénom</label>
              <Input value={prenom} onChange={(e) => setPrenom(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Nom</label>
              <Input value={nom} onChange={(e) => setNom(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Téléphone (optionnel)</label>
            <Input
              type="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="+41 79 123 45 67"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">E-mail</label>
            <Input value={profil.data.email} disabled />
            <p className="mt-1 text-xs text-foreground/50">
              Le changement d&apos;e-mail viendra avec la vérification par mail.
            </p>
          </div>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>

        {/* Préférences */}
        <form
          onSubmit={onSubmitPrefs}
          className="mb-4 space-y-4 rounded-2xl border border-border bg-background p-4 sm:p-5"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
            Préférences
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Langue</label>
              <select
                value={langue}
                onChange={(e) => setLangue(e.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
              >
                <option value="fr">Français</option>
                <option value="de" disabled>
                  Deutsch (bientôt)
                </option>
                <option value="it" disabled>
                  Italiano (bientôt)
                </option>
                <option value="en" disabled>
                  English (bientôt)
                </option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Thème</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
              >
                <option value="system">Auto (système)</option>
                <option value="light">Clair</option>
                <option value="dark">Sombre</option>
              </select>
            </div>
          </div>
          <Button type="submit" disabled={update.isPending}>
            Enregistrer les préférences
          </Button>
        </form>

        {savedAt && (
          <div className="mb-4 rounded-md bg-green/10 px-3 py-2 text-sm text-green-dark">
            ✓ Enregistré à{" "}
            {savedAt.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}

        {/* Sécurité — accès rapide */}
        <section className="mb-4 rounded-2xl border border-border bg-background">
          <h2 className="px-4 pt-4 text-sm font-semibold uppercase tracking-wide text-foreground/60 sm:px-5 sm:pt-5">
            Sécurité
          </h2>
          <ul className="divide-y divide-border">
            <li>
              <Link
                href="/parametres/mot-de-passe"
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 sm:px-5"
              >
                <Lock className="h-4 w-4 text-foreground/60" />
                <span className="flex-1 text-sm">Changer mon mot de passe</span>
                <span className="text-xs text-foreground/50">→</span>
              </Link>
            </li>
            <li>
              <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <Shield className="h-4 w-4 text-foreground/60" />
                <span className="flex-1 text-sm text-foreground/60">
                  Authentification à deux facteurs
                </span>
                <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs">Bientôt</span>
              </div>
            </li>
          </ul>
        </section>

        {/* Déconnexion */}
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-background px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          {logout.isPending ? "Déconnexion…" : "Se déconnecter"}
        </button>
      </div>
    </>
  );
}
