"use client";

import { Mail, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useMyProfile, useResendEmailVerification } from "@/lib/auth";

const DISMISS_KEY = "agriqodo:emailVerifBannerDismissedAt";

/**
 * Bannière non-intrusive en haut de l'app si le user n'a pas vérifié son
 * email. Bouton "Renvoyer le mail" + bouton fermer (dismiss 24h).
 */
export function EmailVerificationBanner() {
  const profil = useMyProfile();
  const resend = useResendEmailVerification();
  const [dismissed, setDismissed] = useState(true);
  const [resentAt, setResentAt] = useState<Date | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const at = window.localStorage.getItem(DISMISS_KEY);
    if (!at) {
      setDismissed(false);
      return;
    }
    const dismissedDate = new Date(at);
    const elapsed = Date.now() - dismissedDate.getTime();
    setDismissed(elapsed < 24 * 60 * 60 * 1000);
  }, []);

  if (!profil.data || profil.data.emailVerifiedAt || dismissed) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/30">
      <Mail className="h-4 w-4 flex-shrink-0 text-amber-700 dark:text-amber-300" />
      <span className="flex-1 text-foreground/80">
        Vérifie ton e-mail <strong>{profil.data.email}</strong> pour activer toutes les
        fonctionnalités.
      </span>
      <div className="flex items-center gap-2">
        {resentAt ? (
          <span className="text-xs text-green-dark">✓ Mail renvoyé</span>
        ) : (
          <button
            type="button"
            onClick={() =>
              resend.mutate(undefined, {
                onSuccess: () => setResentAt(new Date()),
              })
            }
            disabled={resend.isPending}
            className="rounded-lg bg-amber-700 px-3 py-1 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50"
          >
            {resend.isPending ? "Envoi…" : "Renvoyer le mail"}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, new Date().toISOString());
            setDismissed(true);
          }}
          className="rounded-md p-1 text-foreground/50 hover:bg-amber-100 hover:text-foreground dark:hover:bg-amber-900/30"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
