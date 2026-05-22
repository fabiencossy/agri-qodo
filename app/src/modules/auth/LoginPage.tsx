import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  enterDemoMode,
  sendPasswordReset,
  signInWithPassword,
  signUpWithPassword,
} from './auth.store';

type Tab = 'signin' | 'signup' | 'forgot';

// Inscription publique désactivée par défaut. Doit matcher la variable
// serveur DISABLE_SIGNUP de GoTrue : sinon l'UI propose un signup que le
// serveur refusera, mauvaise UX. En B2B agricole, les comptes se créent
// par invitation (cf. /accept-invite).
const SIGNUP_ENABLED = import.meta.env.VITE_DISABLE_SIGNUP !== 'true';

/**
 * Page de connexion / inscription / mot de passe oublié.
 *
 * Le bouton "Démo" reste mis en avant (haut + bas) car la majorité des
 * visiteurs prospect arrivent ici via le site marketing.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleDemo = () => {
    enterDemoMode();
    navigate('/parcellaire', { replace: true });
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim()) return;
    if (tab !== 'forgot' && !password) return;
    if (tab === 'signup' && !SIGNUP_ENABLED) {
      setError(
        'La création de compte publique est désactivée. Demandez à votre administrateur de vous envoyer une invitation.',
      );
      return;
    }
    if (tab === 'signup' && password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }

    setSubmitting(true);
    try {
      if (tab === 'signin') {
        const res = await signInWithPassword(email, password);
        if (!res.ok) {
          setError(res.error ?? 'Connexion impossible.');
          return;
        }
        navigate('/parcellaire', { replace: true });
      } else if (tab === 'signup') {
        const res = await signUpWithPassword(email, password);
        if (!res.ok) {
          setError(res.error ?? 'Inscription impossible.');
          return;
        }
        setInfo(
          'Compte créé. Vérifiez votre boîte de réception pour confirmer votre adresse email.',
        );
      } else {
        const res = await sendPasswordReset(email);
        if (!res.ok) {
          setError(res.error ?? 'Envoi impossible.');
          return;
        }
        setInfo('Email envoyé. Vérifiez votre boîte de réception.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submitDisabled =
    submitting || !email.trim() || (tab !== 'forgot' && !password) || !isSupabaseConfigured;

  const submitLabel = submitting
    ? '…'
    : tab === 'signin'
      ? 'Se connecter'
      : tab === 'signup'
        ? 'Créer mon compte'
        : 'Envoyer le lien';

  return (
    <div className="flex min-h-screen flex-col bg-(--color-bg)">
      <header className="flex items-center justify-between border-b border-(--color-border) bg-(--color-surface) px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <img src="/agriqodo-mark.svg" alt="" className="h-9 w-9" />
          <span className="wordmark-agriqodo text-lg text-(--color-text)">AgriQodo</span>
        </div>
        <button
          type="button"
          onClick={handleDemo}
          className="inline-flex h-10 items-center gap-2 rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-4 text-sm font-semibold text-white hover:bg-(--color-primary-hover)"
        >
          <PlayIcon />
          Essayer la démo
        </button>
      </header>

      <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <h1 className="m-0 text-2xl font-semibold">
            {tab === 'signup'
              ? 'Créer un compte'
              : tab === 'forgot'
                ? 'Mot de passe oublié'
                : 'Bienvenue'}
          </h1>
          <p className="m-0 mt-1 text-sm text-(--color-muted)">
            {tab === 'signup'
              ? 'Commencez avec votre exploitation en quelques secondes.'
              : tab === 'forgot'
                ? 'Indiquez votre email, on vous envoie un lien pour réinitialiser.'
                : 'Connectez-vous à votre exploitation.'}
          </p>

          {SIGNUP_ENABLED && (
            <div className="mt-5 flex gap-1 rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-1">
              <TabButton active={tab === 'signin'} onClick={() => switchTab('signin')}>
                Connexion
              </TabButton>
              <TabButton active={tab === 'signup'} onClick={() => switchTab('signup')}>
                Inscription
              </TabButton>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-3" noValidate>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="vous@exploitation.ch"
                required
                className={inputClass}
              />
            </Field>

            {tab !== 'forgot' && (
              <Field label="Mot de passe">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                  placeholder={tab === 'signup' ? 'Au moins 8 caractères' : '••••••••'}
                  required
                  minLength={tab === 'signup' ? 8 : undefined}
                  className={inputClass}
                />
              </Field>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-(--radius) border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
              >
                {error}
              </div>
            )}
            {info && (
              <div
                role="status"
                className="rounded-(--radius) border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800"
              >
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={submitDisabled}
              className="inline-flex h-11 w-full items-center justify-center rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-5 text-sm font-semibold text-white hover:bg-(--color-primary-hover) disabled:opacity-50"
            >
              {submitLabel}
            </button>

            {tab === 'signin' && (
              <button
                type="button"
                onClick={() => switchTab('forgot')}
                className="m-0 block w-full text-center text-xs text-(--color-muted) hover:text-(--color-text) hover:underline"
              >
                Mot de passe oublié ?
              </button>
            )}
            {tab === 'forgot' && (
              <button
                type="button"
                onClick={() => switchTab('signin')}
                className="m-0 block w-full text-center text-xs text-(--color-muted) hover:text-(--color-text) hover:underline"
              >
                Retour à la connexion
              </button>
            )}
          </form>

          {!isSupabaseConfigured && (
            <p className="m-0 mt-3 rounded-(--radius) border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Auth non configurée. Renseignez <code>VITE_SUPABASE_URL</code> et{' '}
              <code>VITE_SUPABASE_ANON_KEY</code> dans <code>.env.local</code>. En attendant,
              utilisez le mode démo.
            </p>
          )}

          <div className="mt-6 rounded-(--radius) border border-dashed border-(--color-border) bg-(--color-surface) p-4 text-center">
            <p className="m-0 text-xs text-(--color-muted)">
              Pas de compte ? Découvrez l'app sur les données réelles du Domaine Darval.
            </p>
            <button
              type="button"
              onClick={handleDemo}
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-(--radius) border border-(--color-primary)/30 bg-(--color-primary)/8 px-4 text-sm font-medium text-(--color-primary) hover:bg-(--color-primary)/14"
            >
              <PlayIcon />
              Mode démo
            </button>
          </div>
        </div>
      </main>

      <footer className="border-t border-(--color-border) bg-(--color-surface) px-4 py-3 text-center text-xs text-(--color-muted)">
        AgriQodo v2 ·{' '}
        <a href="https://qodo.ch" className="hover:underline">
          Qodo Digital
        </a>
      </footer>
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'h-9 flex-1 rounded-[calc(var(--radius)-2px)] px-3 text-sm font-medium transition-colors ' +
        (active
          ? 'bg-(--color-bg) text-(--color-text) shadow-(--shadow-card)'
          : 'text-(--color-muted) hover:text-(--color-text)')
      }
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={14} height={14} aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
