import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { acceptInvitation } from './auth.store';

/**
 * Page d'acceptation d'invitation à rejoindre une exploitation.
 *
 * L'utilisateur arrive ici depuis le mail "invite-member.html" envoyé par
 * GoTrue. Le lien contient un token de récupération que Supabase détecte
 * automatiquement (`detectSessionInUrl: true`) et qui ouvre une session
 * temporaire. L'utilisateur choisit son mot de passe + nom, ce qui finalise
 * sa création de compte.
 *
 * Le rattachement à la `farm` cible est fait par la migration côté serveur
 * (trigger sur `farm_invitations` qui crée le row dans `farm_members` une
 * fois `accepted_at` rempli — à implémenter dans S4).
 */
export default function AcceptInvitePage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(() => !supabase);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (!data.session) {
        setError(
          "Lien d'invitation invalide ou expiré. Demandez à votre administrateur de vous renvoyer une invitation.",
        );
      } else {
        setEmail(data.session.user.email ?? null);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError('Indiquez votre nom complet.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    const res = await acceptInvitation(password, fullName);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Impossible de finaliser l'inscription.");
      return;
    }
    navigate('/parcellaire', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-(--color-bg)">
      <header className="flex items-center border-b border-(--color-border) bg-(--color-surface) px-4 py-3 sm:px-6">
        <img src="/agriqodo-mark.svg" alt="Qodo Digital" className="h-7" />
      </header>

      <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <h1 className="m-0 text-2xl font-semibold">Bienvenue sur AgriQodo</h1>
          <p className="m-0 mt-1 text-sm text-(--color-muted)">
            Vous êtes invité·e à rejoindre une exploitation. Choisissez un mot de passe pour
            finaliser votre compte.
          </p>

          {email && (
            <p className="m-0 mt-4 rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-xs text-(--color-muted)">
              Compte : <strong className="text-(--color-text)">{email}</strong>
            </p>
          )}

          {!isSupabaseConfigured && (
            <p className="m-0 mt-4 rounded-(--radius) border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Auth non configurée.
            </p>
          )}

          {ready && (
            <form onSubmit={handleSubmit} className="mt-5 space-y-3" noValidate>
              <Field label="Votre nom complet">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                  className={inputClass}
                />
              </Field>
              <Field label="Mot de passe">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Au moins 8 caractères"
                  required
                  minLength={8}
                  className={inputClass}
                />
              </Field>
              <Field label="Confirmation">
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className={inputClass}
                />
              </Field>

              {error && (
                <div
                  role="alert"
                  className="rounded-(--radius) border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !fullName.trim() || !password || !confirm}
                className="inline-flex h-11 w-full items-center justify-center rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-5 text-sm font-semibold text-white hover:bg-(--color-primary-hover) disabled:opacity-50"
              >
                {submitting ? '…' : "Rejoindre l'exploitation"}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

const inputClass =
  'h-11 w-full rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 text-sm focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/15';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-(--color-text)">{label}</label>
      {children}
    </div>
  );
}
