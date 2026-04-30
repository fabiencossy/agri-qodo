"use client";

import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";

/**
 * Page placeholder pour le reset du mot de passe.
 *
 * Implémentation complète à venir (token email + endpoint backend).
 * En attendant, on guide l'utilisateur vers son OWNER ou le support.
 */
export default function ForgotPasswordPage() {
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

        <div className="mt-6 space-y-4 text-sm text-foreground/80">
          <p>
            Le reset par e-mail arrive bientôt. En attendant, deux options pour récupérer
            l&apos;accès&nbsp;:
          </p>

          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="font-semibold">1. Demande à ton OWNER</p>
            <p className="mt-1 text-foreground/70">
              Le chef d&apos;exploitation peut réinitialiser ton mot de passe depuis{" "}
              <strong>Administration → Utilisateurs</strong>.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="font-semibold">2. Contact support</p>
            <p className="mt-1 text-foreground/70">
              Écris à{" "}
              <a
                href="mailto:support@qodo.ch"
                className="font-medium text-green underline hover:no-underline"
              >
                support@qodo.ch
              </a>{" "}
              en précisant ton e-mail et le code de ton exploitation (AQ-XX-…).
            </p>
          </div>
        </div>

        <Link
          href="/login"
          className="mt-6 block rounded-lg bg-green px-4 py-3 text-center text-sm font-semibold text-white hover:bg-green-dark"
        >
          Revenir à la connexion
        </Link>
      </div>
    </main>
  );
}
