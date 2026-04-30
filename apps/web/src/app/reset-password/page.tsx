"use client";

import { ArrowLeft, KeyRound } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="text-sm">
        <p className="rounded-md bg-red-50 px-3 py-3 text-red-700">
          Lien invalide — il manque le token. Refais une demande sur{" "}
          <Link href="/forgot-password" className="font-medium underline">
            mot de passe oublié
          </Link>
          .
        </p>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      await api<void>("/api/auth/password-reset/confirm", {
        method: "POST",
        body: { token, newPassword },
      });
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Lien invalide ou expiré. Refais une demande.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-4 text-sm">
        <div className="rounded-xl bg-green/10 p-4 text-green-dark">
          <p className="font-semibold">✓ Mot de passe mis à jour</p>
          <p className="mt-1 text-foreground/80">Tu vas être redirigé vers la page de connexion…</p>
        </div>
        <Link
          href="/login"
          className="block rounded-lg bg-green px-4 py-3 text-center text-sm font-semibold text-white hover:bg-green-dark"
        >
          Se connecter maintenant
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-foreground/70">Choisis ton nouveau mot de passe.</p>
      <div>
        <label className="mb-1 block text-sm font-medium">Nouveau mot de passe</label>
        <Input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          autoFocus
          className="h-11"
        />
        <p className="mt-1 text-xs text-foreground/60">8 caractères minimum.</p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Confirmer le nouveau mot de passe</label>
        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
          className="h-11"
        />
      </div>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Button type="submit" disabled={loading} size="lg" className="w-full">
        {loading ? "Mise à jour…" : "Mettre à jour mon mot de passe"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 sm:p-8">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground/80"
        >
          <ArrowLeft className="h-4 w-4" />
          Connexion
        </Link>

        <div className="mt-6 flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green/10 text-green">
            <KeyRound className="h-7 w-7" />
          </span>
        </div>

        <h1 className="mt-4 text-center text-xl font-bold">Réinitialiser le mot de passe</h1>

        <div className="mt-6">
          <Suspense fallback={<p className="text-sm text-foreground/60">Chargement…</p>}>
            <ResetPasswordInner />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
