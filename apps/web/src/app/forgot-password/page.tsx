"use client";

import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api<void>("/api/auth/password-reset/request", {
        method: "POST",
        body: { email: email.trim().toLowerCase() },
      });
      // Toujours success côté UI (même si l'email n'existe pas — anti-énum).
      setSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inattendue, réessaie plus tard.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 sm:p-8">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground/80"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la connexion
        </Link>

        <div className="mt-6 flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green/10 text-green">
            <Mail className="h-7 w-7" />
          </span>
        </div>

        <h1 className="mt-4 text-center text-xl font-bold">Mot de passe oublié&nbsp;?</h1>

        {sent ? (
          <div className="mt-6 space-y-4 text-sm">
            <div className="rounded-xl bg-green/10 p-4 text-green-dark">
              <p className="font-semibold">✓ Vérifie ta boîte mail</p>
              <p className="mt-1 text-foreground/80">
                Si <strong>{email}</strong> correspond à un compte, tu recevras un mail avec un lien
                pour réinitialiser ton mot de passe (valide 1 heure).
              </p>
            </div>
            <p className="text-xs text-foreground/60">
              Pas de mail dans 5 minutes&nbsp;? Vérifie tes spams ou{" "}
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
                className="font-medium text-green underline"
              >
                réessaie
              </button>
              .
            </p>
            <Link
              href="/login"
              className="mt-4 block rounded-lg bg-green px-4 py-3 text-center text-sm font-semibold text-white hover:bg-green-dark"
            >
              Revenir à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <p className="text-sm text-foreground/70">
              Saisis l&apos;e-mail de ton compte. Nous t&apos;enverrons un lien sécurisé pour
              choisir un nouveau mot de passe.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium">E-mail</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                className="h-11"
              />
            </div>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <Button type="submit" disabled={loading} size="lg" className="w-full">
              {loading ? "Envoi…" : "Envoyer le lien"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
