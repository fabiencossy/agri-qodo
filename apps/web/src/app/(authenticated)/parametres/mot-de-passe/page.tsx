"use client";

import { Lock } from "lucide-react";
import { useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChangePassword } from "@/lib/auth";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const change = useChangePassword();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword.length < 8) {
      setError("Le nouveau mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setSuccess(true);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        },
        onError: (err: unknown) => {
          const msg =
            err instanceof Error ? err.message : "Mot de passe actuel incorrect ou erreur serveur.";
          setError(msg);
        },
      },
    );
  };

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/app" },
          { label: "Paramètres", href: "/parametres" },
          { label: "Mot de passe" },
        ]}
      />
      <div className="mx-auto max-w-md px-3 py-4 sm:py-8">
        <PageHeader
          title="Changer mon mot de passe"
          icon={Lock}
          subtitle="Le changement révoque les autres sessions ouvertes (autres appareils)."
        />

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-border bg-background p-4 sm:p-6"
        >
          <div>
            <label className="mb-1 block text-sm font-medium">Mot de passe actuel</label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-11"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Nouveau mot de passe</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="h-11"
            />
            <p className="mt-1 text-xs text-foreground/60">8 caractères minimum.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Confirmer le nouveau mot de passe
            </label>
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
          {success && (
            <p className="rounded-md bg-green/10 px-3 py-2 text-sm text-green-dark">
              ✓ Mot de passe changé avec succès.
            </p>
          )}

          <Button type="submit" disabled={change.isPending} className="w-full">
            {change.isPending ? "Mise à jour…" : "Mettre à jour"}
          </Button>
        </form>
      </div>
    </>
  );
}
