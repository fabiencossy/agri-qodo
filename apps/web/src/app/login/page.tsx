"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { useIsAuthenticated, useLogin } from "@/lib/auth";

/**
 * Comptes démo pré-configurés pour faciliter les tests rapides en preview.
 *
 * - **Admin** : compte sans données (vide), accès complet (rôle OWNER) à
 *   un tenant Admin neutre — pratique pour tester les écrans Paramètres,
 *   utilisateurs, configuration Odoo, etc. sans polluer la démo.
 * - **Démo** : compte EMPLOYE sur le tenant Démo (3 parcelles, 46 animaux,
 *   interventions). Permet de voir l'app peuplée mais avec un user limité
 *   (les écrans ownerOnly sont visibles en lecture seule).
 */
const DEMO_ACCOUNTS = [
  {
    key: "admin",
    label: "Admin",
    icon: ShieldCheck,
    email: "admin@admin.ch",
    password: "admin",
    description: "Accès complet — exploitation vide, parfait pour tester les paramètres",
  },
  {
    key: "demo",
    label: "Démo",
    icon: Sparkles,
    email: "demo@demo.ch",
    password: "demo",
    description: "Compte limité (EMPLOYE) — exploitation peuplée pour voir l'app en action",
  },
] as const;

const loginSchema = z.object({
  email: z.string().email("E-mail invalide"),
  password: z.string().min(4, "4 caractères minimum"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const login = useLogin();

  useEffect(() => {
    if (isAuthenticated) router.push("/app");
  }, [isAuthenticated, router]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: LoginForm) => login.mutate(data);

  const fillDemo = (email: string, password: string) => {
    setValue("email", email);
    setValue("password", password);
    // Login direct au clic — l'utilisateur veut juste tester, pas s'arrêter
    // pour relire les credentials qu'il vient lui-même de cocher.
    login.mutate({ email, password });
  };

  const errorMessage =
    login.error instanceof ApiError && login.error.status === 401
      ? "E-mail ou mot de passe incorrect."
      : login.error
        ? "Connexion impossible. Réessayer plus tard."
        : null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-green">🌱 Agri Qodo</h1>
          <p className="mt-2 text-sm text-foreground/70">Connectez-vous à votre exploitation</p>
        </header>

        <div className="mb-4 rounded-2xl border border-dashed border-green/40 bg-green/5 p-4">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-green-dark">
            Tester rapidement
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((acc) => {
              const Icon = acc.icon;
              return (
                <button
                  key={acc.key}
                  type="button"
                  onClick={() => fillDemo(acc.email, acc.password)}
                  disabled={login.isPending}
                  className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background px-3 py-2.5 text-center transition-colors hover:border-green hover:bg-green/5 disabled:opacity-50"
                  title={acc.description}
                >
                  <Icon className="h-5 w-5 text-green" />
                  <span className="text-sm font-semibold">{acc.label}</span>
                  <span className="hidden font-mono text-[10px] text-foreground/50 sm:inline">
                    {acc.email}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-[11px] text-foreground/60">
            Aucune donnée saisie n'est conservée — tu peux casser ce que tu veux.
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 rounded-2xl border border-border bg-background p-6 shadow-sm"
        >
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              E-mail
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="marie@ferme-rolet.ch"
              {...register("email")}
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Mot de passe
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          {errorMessage && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
            {login.isPending ? "Connexion…" : "Se connecter"}
          </Button>

          <div className="text-center">
            <Link
              href="/forgot-password"
              className="text-xs text-foreground/60 underline hover:text-foreground/80"
            >
              Mot de passe oublié ?
            </Link>
          </div>
        </form>

        <p className="mt-6 text-center text-sm">
          Pas encore de compte ?{" "}
          <Link href="/signup" className="font-medium text-green underline">
            Créer mon exploitation
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-foreground/50">
          Stockage local des données — vous pouvez travailler hors ligne.
        </p>
      </div>
    </main>
  );
}
