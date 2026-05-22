import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <>
      <section className="border-b border-(--color-border) bg-gradient-to-b from-(--color-bg) via-(--color-bg) to-(--color-surface)/40 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="inline-block rounded-(--radius-pill) bg-(--color-primary)/10 px-3 py-1 text-xs font-semibold tracking-wider text-(--color-primary) uppercase">
              Pour les agriculteurs suisses
            </span>
            <h1 className="m-0 mt-4 text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Votre exploitation dans une seule app
            </h1>
            <p className="m-0 mt-4 text-lg text-(--color-muted) sm:text-xl">
              Voir vos parcelles sur la carte, noter vos interventions au champ, suivre votre carnet
              — tout est au même endroit. Sur votre téléphone et au bureau.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/login"
                className="inline-flex h-11 items-center gap-2 rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-5 text-sm font-semibold text-white hover:bg-(--color-primary-hover)"
              >
                Essayer la démo
              </Link>
              <Link
                to="/fonctionnalites"
                className="inline-flex h-11 items-center gap-2 rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-5 text-sm font-semibold text-(--color-text) hover:bg-(--color-bg)"
              >
                Voir les fonctionnalités
              </Link>
            </div>
          </div>
          <div className="rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-2 shadow-(--shadow-card)">
            <img
              src="/screenshots/01_Hero/H1_Hero_Desktop_-_Carte_dzoome.png"
              alt="Vue d'ensemble de AgriQodo avec carte satellite des parcelles"
              className="w-full rounded-[4px]"
              loading="eager"
            />
          </div>
        </div>
      </section>

      <FeatureGrid />

      <FeatureSection
        eyebrow="Vos parcelles sur une carte"
        title="Comme Google Maps, mais pour votre exploitation"
        description="Vue satellite suisse. Chaque parcelle prend la couleur de sa culture du jour. Vous voyez tout d'un coup d'œil."
        bullets={[
          'Vue satellite suisse de qualité',
          "Couleurs automatiques selon ce qui pousse aujourd'hui",
          'Cliquez sur une parcelle pour voir tous ses détails',
          'Importez vos parcelles depuis GELAN ou Acorda',
        ]}
        image="/screenshots/01_Hero/H3_Hero_Desktop_-_Panel__droite.png"
        alt="Carte des parcelles avec panneau de détail à droite"
      />

      <FeatureSection
        eyebrow="Fiche parcelle complète"
        title="Toute l'histoire d'une parcelle, à portée de main"
        description="Culture en place, interventions passées, rendements, statistiques. Tout est rangé par onglets clairs."
        bullets={[
          "Un résumé visuel dès l'ouverture",
          'Onglets : Aperçu, Carnet, Assolement, Statistiques, Carte',
          'Mini-carte de la parcelle directement intégrée',
          'Lien direct pour aller au champ via Google Maps',
        ]}
        image="/screenshots/03_DetailParcelle/D1_Detail_-_Aperu.png"
        alt="Fiche détaillée d'une parcelle"
      />

      <FeatureSection
        eyebrow="Carnet des champs"
        title="Vos interventions, prêtes pour les contrôles"
        description="Tout ce que vous faites sur vos parcelles est enregistré au bon format. Quand un contrôleur passe, vous avez tout sous la main."
        bullets={[
          'Liste complète, filtrable par date, parcelle, type',
          "Numéro d'homologation des produits enregistré automatiquement",
          'Date de récolte autorisée calculée pour vous',
          'Export PDF / Excel quand vous voulez',
        ]}
        image="/screenshots/04_Carnet/C1_Carnet_-_Table_interventions.png"
        alt="Liste des interventions du carnet des champs"
        reverse
      />

      <section className="border-t border-(--color-border) bg-(--color-bg) px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-8 text-center shadow-(--shadow-card)">
          <span className="inline-block rounded-(--radius-pill) bg-(--color-accent)/10 px-3 py-1 text-xs font-semibold tracking-wider text-(--color-accent) uppercase">
            Intégration
          </span>
          <h2 className="m-0 mt-3 text-2xl font-bold sm:text-3xl">Connecté à votre Odoo</h2>
          <p className="m-0 mt-3 text-base text-(--color-muted)">
            Si vous utilisez déjà{' '}
            <a
              href="https://www.odoo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-(--color-primary) hover:underline"
            >
              Odoo
            </a>{' '}
            pour votre comptabilité ou vos employés, AgriQodo s'y branche directement. Pas de double
            saisie : ce que vous notez ici remonte automatiquement dans votre Odoo.
          </p>
        </div>
      </section>

      <section className="border-t border-(--color-border) bg-(--color-surface) px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-(--radius-pill) bg-(--color-primary)/10 px-3 py-1 text-xs font-semibold tracking-wider text-(--color-primary) uppercase">
            Transparence
          </span>
          <h2 className="m-0 mt-3 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            Pas de boîte noire. Vos données restent les vôtres.
          </h2>
          <p className="m-0 mt-4 text-base text-(--color-muted) sm:text-lg">
            Tout le code d'AgriQodo est public et vérifiable. Aucun risque d'enfermement : vous
            pouvez à tout moment exporter toutes vos données (CSV, Excel, GeoJSON).
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <MiniBullet title="Audit possible">
              Votre conseiller agronomique peut vérifier comment vos données sont traitées.
            </MiniBullet>
            <MiniBullet title="Sécurité prouvée">
              Pas de « faites-nous confiance ». N'importe quel expert peut auditer le code.
            </MiniBullet>
            <MiniBullet title="Pérennité garantie">
              Si Qodo disparaît, le projet reste accessible. Votre outil ne dépend pas d'une seule
              entreprise.
            </MiniBullet>
          </div>
          <div className="mt-7">
            <Link
              to="/open-source"
              className="inline-flex h-11 items-center gap-2 rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-5 text-sm font-semibold text-white hover:bg-(--color-primary-hover)"
            >
              Notre engagement de transparence
            </Link>
          </div>
        </div>
      </section>

      <CTASection
        title="Essayez en 30 secondes"
        subtitle="Pas d'inscription. Vous arrivez directement sur un vrai domaine, avec de vraies parcelles."
      />
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Composants locaux (sous-sections de la landing)
// ──────────────────────────────────────────────────────────────────────

const BENEFITS = [
  {
    title: 'Toutes vos parcelles sur une carte',
    description: 'Vue satellite suisse. Vos parcelles colorées selon la culture en place.',
  },
  {
    title: 'Saisie en quelques secondes',
    description: 'Notez une intervention en 3 taps depuis votre téléphone, même avec des gants.',
  },
  {
    title: 'Carnet des champs en règle',
    description: 'Toutes vos interventions enregistrées et prêtes pour les contrôles.',
  },
  {
    title: 'Une vue complète de chaque parcelle',
    description: "Toute l'histoire de la parcelle en un coup d'œil.",
  },
];

function FeatureGrid() {
  return (
    <section className="border-b border-(--color-border) bg-(--color-surface) px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="m-0 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            Ce que AgriQodo fait pour vous
          </h2>
          <p className="m-0 mt-4 text-base text-(--color-muted)">
            Conçue avec un exploitant suisse, pour les exploitants suisses.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="rounded-(--radius-lg) border border-(--color-border) bg-(--color-bg) p-5 shadow-(--shadow-card)"
            >
              <h3 className="m-0 text-base font-semibold">{b.title}</h3>
              <p className="m-0 mt-2 text-sm text-(--color-muted)">{b.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureSection({
  eyebrow,
  title,
  description,
  bullets,
  image,
  alt,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  image: string;
  alt: string;
  reverse?: boolean;
}) {
  return (
    <section className="border-t border-(--color-border) bg-(--color-surface) px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div
          className={
            'grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ' +
            (reverse ? 'lg:[&>*:first-child]:order-2' : '')
          }
        >
          <div>
            <span className="inline-block rounded-(--radius-pill) bg-(--color-primary)/10 px-3 py-1 text-xs font-semibold tracking-wider text-(--color-primary) uppercase">
              {eyebrow}
            </span>
            <h2 className="m-0 mt-3 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
              {title}
            </h2>
            <p className="m-0 mt-4 text-base text-(--color-muted)">{description}</p>
            <ul className="m-0 mt-5 list-none space-y-2 p-0 text-sm">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-(--radius-pill) bg-(--color-primary)/15 text-(--color-primary)">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      width="12"
                      height="12"
                      aria-hidden="true"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-(--radius-lg) border border-(--color-border) bg-(--color-bg) p-2 shadow-(--shadow-card)">
            <img src={image} alt={alt} className="w-full rounded-[4px]" loading="lazy" />
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniBullet({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-(--radius-lg) border border-(--color-border) bg-(--color-bg) p-4 text-left">
      <p className="m-0 text-sm font-semibold">{title}</p>
      <p className="m-0 mt-1 text-xs text-(--color-muted)">{children}</p>
    </div>
  );
}

function CTASection({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="border-t border-(--color-border) bg-gradient-to-b from-(--color-surface)/40 to-(--color-bg) px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl rounded-(--radius-lg) border border-(--color-primary)/20 bg-(--color-primary)/5 p-8 text-center sm:p-10">
        <h2 className="m-0 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
        <p className="m-0 mt-3 text-base text-(--color-muted) sm:text-lg">{subtitle}</p>
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
  );
}
