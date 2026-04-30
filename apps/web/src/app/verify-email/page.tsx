"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Lien invalide — il manque le token.");
      return;
    }
    api<void>("/api/auth/email/verify", { method: "POST", body: { token } })
      .then(() => setStatus("success"))
      .catch((err: unknown) => {
        setStatus("error");
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Lien invalide ou expiré. Redemande un nouveau mail.",
        );
      });
  }, [token]);

  if (status === "verifying") {
    return <p className="text-center text-sm text-foreground/70">Vérification en cours…</p>;
  }

  if (status === "success") {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-green" />
        <p className="text-sm font-semibold text-green-dark">
          ✓ Adresse e-mail vérifiée avec succès
        </p>
        <p className="text-sm text-foreground/70">
          Tu peux maintenant utiliser toutes les fonctionnalités d&apos;Agri Qodo.
        </p>
        <Link
          href="/app"
          className="inline-block rounded-lg bg-green px-4 py-3 text-sm font-semibold text-white hover:bg-green-dark"
        >
          Aller à l&apos;application
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-center">
      <XCircle className="mx-auto h-14 w-14 text-red-500" />
      <p className="text-sm font-semibold text-red-700">{errorMsg}</p>
      <Link
        href="/login"
        className="inline-block rounded-lg bg-green px-4 py-3 text-sm font-semibold text-white hover:bg-green-dark"
      >
        Retour à la connexion
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 sm:p-8">
        <h1 className="mb-6 text-center text-xl font-bold">Vérification e-mail</h1>
        <Suspense fallback={<p className="text-center text-sm text-foreground/60">Chargement…</p>}>
          <VerifyEmailInner />
        </Suspense>
      </div>
    </main>
  );
}
