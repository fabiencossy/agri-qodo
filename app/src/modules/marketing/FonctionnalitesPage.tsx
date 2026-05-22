import { Link } from 'react-router-dom';
import DeviceSwitcher from './DeviceSwitcher';

export default function FonctionnalitesPage() {
  return (
    <>
      <section className="border-b border-(--color-border) bg-gradient-to-b from-(--color-bg) to-(--color-surface)/40 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-(--radius-pill) bg-(--color-primary)/10 px-3 py-1 text-xs font-semibold tracking-wider text-(--color-primary) uppercase">
            Ce que ça fait
          </span>
          <h1 className="m-0 mt-4 text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl">
            Simple. Sur tous vos écrans.
          </h1>
          <p className="m-0 mt-4 text-lg text-(--color-muted)">
            Sur chaque fonctionnalité, basculez entre la vue{' '}
            <strong className="text-(--color-text)">ordinateur</strong> et la vue{' '}
            <strong className="text-(--color-text)">téléphone</strong> avec les boutons à côté des
            images.
          </p>
        </div>
      </section>

      <Feature
        eyebrow="Cartographie"
        title="Toutes vos parcelles sur une carte"
        description="Vue satellite suisse. Vous voyez l'ensemble de votre exploitation d'un coup d'œil. Chaque parcelle est colorée selon la culture en place."
        bullets={[
          'Vue satellite de qualité suisse',
          'Couleurs automatiques selon ce qui pousse',
          'Cliquez sur une parcelle pour voir ses détails',
          'Importez vos parcelles depuis GELAN ou Acorda',
        ]}
        desktop={{
          src: '/screenshots/01_Hero/H3_Hero_Desktop_-_Panel__droite.png',
          alt: 'Carte des parcelles avec panneau de détail (ordinateur)',
        }}
        mobile={{
          src: '/screenshots/01_Hero/H4_Hero_Mobile_-_Bottom_sheet.png',
          alt: 'Carte des parcelles avec panneau coulissant (téléphone)',
        }}
      />

      <Feature
        eyebrow="Fiche parcelle"
        title="Toute l'histoire d'une parcelle, au même endroit"
        description="En ouvrant une parcelle, vous voyez immédiatement la culture en place, les dernières interventions, le résumé de la fumure et une mini-carte. Tout est rangé par onglets clairs."
        bullets={[
          'Onglets : Aperçu, Carnet, Assolement, Statistiques, Carte',
          "Un résumé visuel dès l'ouverture",
          'Mini-carte de la parcelle directement intégrée',
          'Lien pour aller au champ via Google Maps',
        ]}
        desktop={{
          src: '/screenshots/03_DetailParcelle/D1_Detail_-_Aperu.png',
          alt: "Fiche détaillée d'une parcelle (ordinateur)",
        }}
        mobile={{
          src: '/screenshots/03_DetailParcelle/D2_Detail_Mobile_-_Aperu.png',
          alt: "Fiche détaillée d'une parcelle (téléphone)",
        }}
      />

      <Feature
        eyebrow="Carnet des champs"
        title="Toujours en règle, sans efforts"
        description="Toutes vos interventions enregistrées au bon format. Quand un contrôleur passe ou que vous devez exporter pour les autorités, tout est prêt."
        bullets={[
          'Liste complète, filtrable par date, parcelle, type',
          "Numéro d'homologation des produits enregistré automatiquement",
          'Date de récolte autorisée calculée pour vous',
          'Export PDF / Excel à tout moment',
        ]}
        desktop={{
          src: '/screenshots/04_Carnet/C1_Carnet_-_Table_interventions.png',
          alt: 'Liste des interventions du carnet (ordinateur)',
        }}
        mobile={{
          src: '/screenshots/04_Carnet/C2_Carnet_Mobile_-_Cards.png',
          alt: 'Liste des interventions du carnet (téléphone)',
        }}
        reverse
      />

      <Feature
        eyebrow="Plan de fumure"
        title="Bilan N / P / K en temps réel"
        description="Chaque apport saisi met à jour automatiquement votre bilan de fumure selon les normes OEngrais 2024. Plus besoin d'attendre janvier pour découvrir un dépassement."
        bullets={[
          'Coefficients OEngrais appliqués automatiquement',
          'Besoins par culture selon la rotation',
          'Précédent cultural pris en compte',
          'Historique chronologique de tous les apports',
        ]}
        desktop={{
          src: '/screenshots/03_DetailParcelle/D5_Detail_-_Fumure.png',
          alt: 'Bilan de fumure N/P/K (ordinateur)',
        }}
        mobile={{
          src: '/screenshots/02_Parcellaire/P2_Parcellaire_Mobile_-_Cards.png',
          alt: 'Vue parcellaire mobile (téléphone)',
        }}
      />

      <section className="border-t border-(--color-border) bg-(--color-bg) px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-8 text-center shadow-(--shadow-card)">
          <span className="inline-block rounded-(--radius-pill) bg-(--color-accent)/10 px-3 py-1 text-xs font-semibold tracking-wider text-(--color-accent) uppercase">
            Intégration
          </span>
          <h2 className="m-0 mt-3 text-2xl font-bold sm:text-3xl">Connecté à votre Odoo</h2>
          <p className="m-0 mt-3 text-base text-(--color-muted)">
            Si vous avez déjà{' '}
            <a
              href="https://www.odoo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-(--color-primary) hover:underline"
            >
              Odoo
            </a>{' '}
            pour la gestion de votre exploitation, AgriQodo s'y branche directement.
          </p>
        </div>
      </section>

      <section className="border-t border-(--color-border) bg-gradient-to-b from-(--color-surface)/40 to-(--color-bg) px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl rounded-(--radius-lg) border border-(--color-primary)/20 bg-(--color-primary)/5 p-8 text-center sm:p-10">
          <h2 className="m-0 text-3xl font-bold tracking-tight sm:text-4xl">
            Essayez l'app maintenant
          </h2>
          <p className="m-0 mt-3 text-base text-(--color-muted) sm:text-lg">
            Pas d'inscription. Vous arrivez directement sur un vrai domaine, avec de vraies
            parcelles. En 30 secondes.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/login"
              className="inline-flex h-11 items-center gap-2 rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-5 text-sm font-semibold text-white hover:bg-(--color-primary-hover)"
            >
              Lancer la démo
            </Link>
            <Link
              to="/contact"
              className="inline-flex h-11 items-center gap-2 rounded-(--radius) border border-(--color-border) bg-(--color-bg) px-5 text-sm font-semibold text-(--color-text) hover:bg-(--color-surface)"
            >
              Nous contacter
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Feature({
  eyebrow,
  title,
  description,
  bullets,
  desktop,
  mobile,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  desktop: { src: string; alt: string };
  mobile: { src: string; alt: string };
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
          <DeviceSwitcher desktop={desktop} mobile={mobile} />
        </div>
      </div>
    </section>
  );
}
