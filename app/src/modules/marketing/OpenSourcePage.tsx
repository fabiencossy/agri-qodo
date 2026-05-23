import { Link } from 'react-router-dom';

const GITHUB_URL = 'https://github.com/Qodo-Digital/agri-qodo';

export default function OpenSourcePage() {
  return (
    <>
      <section className="border-b border-(--color-border) bg-gradient-to-b from-(--color-bg) to-(--color-surface)/40 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-(--radius-pill) bg-(--color-primary)/10 px-3 py-1 text-xs font-semibold tracking-wider text-(--color-primary) uppercase">
            100 % Open source
          </span>
          <h1 className="m-0 mt-4 text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl">
            Pas de boîte noire pour votre exploitation
          </h1>
          <p className="m-0 mt-4 text-lg text-(--color-muted)">
            Tout le code d'AgriQodo est public et vérifiable. Vous savez exactement comment vos
            données sont traitées, et personne ne peut vous enfermer dans un service que vous ne
            pourriez plus quitter.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/login"
              className="inline-flex h-11 items-center gap-2 rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-5 text-sm font-semibold text-white hover:bg-(--color-primary-hover)"
            >
              Essayer la démo
            </Link>
            <Link
              to="/contact"
              className="inline-flex h-11 items-center gap-2 rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-5 text-sm font-semibold text-(--color-text) hover:bg-(--color-bg)"
            >
              Nous contacter
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="m-0 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            Pourquoi c'est important pour vous
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Bullet icon={<EyeIcon />} title="Vous voyez exactement ce qui se passe">
              Comment vos parcelles sont stockées, comment votre bilan de fumure est calculé, ce qui
              est envoyé où : tout est lisible publiquement. Votre conseiller agronomique peut
              auditer le code s'il veut.
            </Bullet>
            <Bullet icon={<LockIcon />} title="Aucun risque d'enfermement">
              Si un jour vous voulez partir, vous repartez avec toutes vos données — export CSV,
              Excel, GeoJSON natifs. Vos parcelles, vos interventions, votre catalogue restent les
              vôtres.
            </Bullet>
            <Bullet icon={<ShieldIcon />} title="Sécurité vérifiable, pas promise">
              N'importe quel expert peut auditer notre code et nos pratiques. Pas de « faites-nous
              confiance ». La preuve est dans le code public.
            </Bullet>
            <Bullet icon={<HeartIcon />} title="Pérennité garantie">
              Si Qodo Digital disparaissait demain, le code resterait accessible. Une coopérative ou
              un autre acteur pourrait reprendre la maintenance. Votre outil ne dépend pas de la
              santé d'une seule entreprise.
            </Bullet>
          </div>
        </div>
      </section>

      <section className="border-t border-(--color-border) bg-(--color-surface) px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="m-0 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            La transparence par défaut, pas en option
          </h2>
          <p className="mt-4 text-base text-(--color-muted)">
            Un logiciel qui touche à vos contrôles cantonaux, vos traitements phytosanitaires et
            votre bilan de fumure doit pouvoir être inspecté. C'est notre conviction.
          </p>
          <p className="mt-4 text-base text-(--color-muted)">
            Concrètement, vous bénéficiez d'AgriQodo comme de n'importe quel SaaS : on s'occupe de
            tout (hébergement en Suisse, mises à jour, sauvegardes, support). La différence, c'est
            que <strong className="text-(--color-text)">vous pouvez vérifier nos promesses</strong>{' '}
            au lieu de devoir les croire sur parole.
          </p>

          <div className="mt-8 rounded-(--radius-lg) border border-(--color-primary)/20 bg-(--color-primary)/5 p-6">
            <p className="m-0 text-sm font-semibold text-(--color-primary)">Licence AGPL v3</p>
            <p className="m-0 mt-2 text-sm text-(--color-muted)">
              AgriQodo est publié sous la GNU Affero General Public License v3 — la même licence que
              Mastodon, Nextcloud ou Element. Elle garantit que le projet restera ouvert quoi qu'il
              arrive, et qu'aucun acteur ne pourra le « privatiser ».
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-(--color-border) px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="m-0 text-sm text-(--color-muted)">
            Pour les curieux : le code source est sur GitHub. Coopératives, écoles d'agronomie ou
            exploitations isolées peuvent aussi héberger leur propre instance — un guide complet est
            disponible.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-4 text-sm font-medium text-(--color-muted) hover:bg-(--color-bg) hover:text-(--color-text)"
            >
              <GitHubIcon />
              Code source
            </a>
            <a
              href={`${GITHUB_URL}/blob/main/infra/supabase/README.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-4 text-sm font-medium text-(--color-muted) hover:bg-(--color-bg) hover:text-(--color-text)"
            >
              Guide auto-hébergement
            </a>
          </div>
        </div>
      </section>

      <section className="border-t border-(--color-border) bg-gradient-to-b from-(--color-surface)/40 to-(--color-bg) px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl rounded-(--radius-lg) border border-(--color-primary)/20 bg-(--color-primary)/5 p-8 text-center sm:p-10">
          <h2 className="m-0 text-3xl font-bold tracking-tight sm:text-4xl">
            La meilleure façon de juger : tester
          </h2>
          <p className="m-0 mt-3 text-base text-(--color-muted) sm:text-lg">
            Démo en 30 secondes, sans inscription. Vous voyez l'app sur de vraies parcelles.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/login"
              className="inline-flex h-11 items-center gap-2 rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-5 text-sm font-semibold text-white hover:bg-(--color-primary-hover)"
            >
              Lancer la démo
            </Link>
            <Link
              to="/fonctionnalites"
              className="inline-flex h-11 items-center gap-2 rounded-(--radius) border border-(--color-border) bg-(--color-bg) px-5 text-sm font-semibold text-(--color-text) hover:bg-(--color-surface)"
            >
              Voir les fonctionnalités
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Bullet({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-6">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-(--radius-pill) bg-(--color-primary)/12 text-(--color-primary)">
        {icon}
      </div>
      <p className="m-0 mt-4 text-base font-semibold">{title}</p>
      <p className="m-0 mt-2 text-sm text-(--color-muted)">{children}</p>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      width="20"
      height="20"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      width="20"
      height="20"
    >
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      width="20"
      height="20"
    >
      <path d="M12 2 4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      width="20"
      height="20"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.24 2.75.12 3.04.73.8 1.18 1.83 1.18 3.09 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.05.78 2.12 0 1.53-.01 2.77-.01 3.14 0 .31.21.67.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}
