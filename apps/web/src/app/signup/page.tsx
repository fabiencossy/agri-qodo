"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Sprout } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { useIsAuthenticated, useRegister } from "@/lib/auth";

const CANTONS = [
  "VD",
  "GE",
  "FR",
  "NE",
  "JU",
  "VS",
  "BE",
  "ZH",
  "AG",
  "SO",
  "LU",
  "TG",
  "SG",
  "GR",
  "TI",
  "BL",
  "BS",
  "SH",
  "AR",
  "AI",
  "GL",
  "NW",
  "OW",
  "SZ",
  "UR",
  "ZG",
] as const;

const signupSchema = z.object({
  prenom: z.string().min(1, "Prénom requis").max(60),
  nom: z.string().min(1, "Nom requis").max(60),
  email: z.string().email("E-mail invalide").max(120),
  password: z.string().min(8, "8 caractères minimum").max(120),
  exploitationNom: z.string().min(2, "Donne un nom à ton exploitation").max(120),
  canton: z.enum(CANTONS),
});

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const register = useRegister();

  useEffect(() => {
    if (isAuthenticated) router.push("/app");
  }, [isAuthenticated, router]);

  const {
    register: rhfRegister,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { canton: "VD" },
  });

  const onSubmit = (data: SignupForm) => register.mutate(data);

  const errorMessage =
    register.error instanceof ApiError && register.error.status === 409
      ? "Un compte existe déjà avec cet email."
      : register.error
        ? "Inscription impossible. Réessayer plus tard."
        : null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <h1 className="flex items-center justify-center gap-2 text-3xl font-bold text-green">
            <Sprout className="h-7 w-7" />
            Agri Qodo
          </h1>
          <p className="mt-2 text-sm text-foreground/70">
            Crée ta nouvelle exploitation en 30 secondes
          </p>
        </header>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6"
        >
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/50">
              Toi
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="prenom" className="mb-1 block text-sm font-medium">
                  Prénom
                </label>
                <Input id="prenom" autoComplete="given-name" {...rhfRegister("prenom")} />
                {errors.prenom && (
                  <p className="mt-1 text-xs text-red-600">{errors.prenom.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="nom" className="mb-1 block text-sm font-medium">
                  Nom
                </label>
                <Input id="nom" autoComplete="family-name" {...rhfRegister("nom")} />
                {errors.nom && <p className="mt-1 text-xs text-red-600">{errors.nom.message}</p>}
              </div>
            </div>

            <div className="mt-3">
              <label htmlFor="email" className="mb-1 block text-sm font-medium">
                E-mail
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="marie@ferme-rolet.ch"
                {...rhfRegister("email")}
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div className="mt-3">
              <label htmlFor="password" className="mb-1 block text-sm font-medium">
                Mot de passe
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="8 caractères minimum"
                {...rhfRegister("password")}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/50">
              Ton exploitation
            </h2>
            <div>
              <label htmlFor="exploitationNom" className="mb-1 block text-sm font-medium">
                Nom de l'exploitation
              </label>
              <Input
                id="exploitationNom"
                placeholder="Ferme du Rolet"
                {...rhfRegister("exploitationNom")}
              />
              {errors.exploitationNom && (
                <p className="mt-1 text-xs text-red-600">{errors.exploitationNom.message}</p>
              )}
            </div>

            <div className="mt-3">
              <label htmlFor="canton" className="mb-1 block text-sm font-medium">
                Canton
              </label>
              <select
                id="canton"
                {...rhfRegister("canton")}
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
              >
                {CANTONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {errors.canton && (
                <p className="mt-1 text-xs text-red-600">{errors.canton.message}</p>
              )}
            </div>
          </div>

          {errorMessage && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={register.isPending}>
            {register.isPending ? "Création…" : "Créer mon exploitation"}
          </Button>

          <p className="text-center text-xs text-foreground/60">
            Déjà un compte ?{" "}
            <Link href="/login" className="font-medium text-green underline">
              Se connecter
            </Link>
          </p>
        </form>

        <p className="mt-4 text-center text-xs text-foreground/50">
          Open source AGPL v3 · Hébergé en Suisse · 100 % gratuit
        </p>
      </div>
    </main>
  );
}
