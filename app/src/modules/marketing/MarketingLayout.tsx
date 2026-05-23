import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';

/**
 * Layout des pages marketing publiques (accueil, fonctionnalités, tarifs,
 * contact, mentions, confidentialité). Header transparent + footer Qodo.
 *
 * Pas de sidebar app, pas d'auth requise. Le bouton "Essayer la démo"
 * route vers /login (qui propose le bouton "Mode démo").
 */

const NAV = [
  { path: '/fonctionnalites', label: 'Fonctionnalités' },
  { path: '/open-source', label: 'Transparence' },
  { path: '/tarifs', label: 'Tarifs' },
  { path: '/contact', label: 'Contact' },
];

export default function MarketingLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  // Ferme le menu mobile au changement de route
  useState(() => {
    setOpen(false);
    return undefined;
  });

  return (
    <div className="flex min-h-screen flex-col bg-(--color-bg) text-(--color-text)">
      <header className="sticky top-0 z-50 border-b border-(--color-border) bg-(--color-bg)/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <img src="/agriqodo-mark.svg" alt="" className="h-8 w-8" />
            <span className="wordmark-agriqodo text-lg text-(--color-text)">AgriQodo</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  'rounded-(--radius) px-3 py-2 text-sm font-medium transition-colors ' +
                  (isActive
                    ? 'bg-(--color-primary)/10 text-(--color-primary)'
                    : 'text-(--color-muted) hover:bg-(--color-surface) hover:text-(--color-text)')
                }
              >
                {item.label}
              </NavLink>
            ))}
            <Link
              to="/login"
              className="ml-2 inline-flex h-9 items-center gap-2 rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-4 text-sm font-semibold text-white hover:bg-(--color-primary-hover)"
            >
              Essayer la démo
            </Link>
          </nav>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-(--radius) border border-(--color-border) md:hidden"
            aria-label="Menu"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="20"
              height="20"
            >
              {open ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
        </div>

        {open && (
          <nav className="border-t border-(--color-border) bg-(--color-bg) px-4 py-3 md:hidden">
            <ul className="space-y-1">
              {NAV.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      'block rounded-(--radius) px-3 py-2 text-sm font-medium ' +
                      (isActive
                        ? 'bg-(--color-primary)/10 text-(--color-primary)'
                        : 'text-(--color-text) hover:bg-(--color-surface)')
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
              <li>
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="mt-2 flex h-11 items-center justify-center rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-4 text-sm font-semibold text-white"
                >
                  Essayer la démo
                </Link>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <main className="flex-1" key={location.pathname}>
        <Outlet />
      </main>

      <footer className="border-t border-(--color-border) bg-(--color-surface) px-4 py-10 sm:px-6">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <img src="/agriqodo-mark.svg" alt="" className="h-8 w-8" />
              <span className="wordmark-agriqodo text-lg text-(--color-text)">AgriQodo</span>
            </div>
            <p className="m-0 mt-2 max-w-md text-sm text-(--color-muted)">
              Gestion d'exploitation agricole pour les agriculteurs suisses. Parcellaire, carnet des
              champs, plan de fumure. Mobile-first, intégré{' '}
              <a
                href="https://www.odoo.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-(--color-primary) hover:underline"
              >
                Odoo
              </a>
              .
            </p>
          </div>

          <div>
            <h3 className="m-0 text-xs font-semibold tracking-wider text-(--color-muted) uppercase">
              Produit
            </h3>
            <ul className="m-0 mt-3 list-none space-y-2 p-0 text-sm">
              <li>
                <Link to="/fonctionnalites" className="hover:text-(--color-primary)">
                  Fonctionnalités
                </Link>
              </li>
              <li>
                <Link to="/open-source" className="hover:text-(--color-primary)">
                  Transparence
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-(--color-primary)">
                  Essayer la démo
                </Link>
              </li>
              <li>
                <Link to="/tarifs" className="hover:text-(--color-primary)">
                  Tarifs
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/Qodo-Digital/agri-qodo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-(--color-primary)"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="m-0 text-xs font-semibold tracking-wider text-(--color-muted) uppercase">
              Société
            </h3>
            <ul className="m-0 mt-3 list-none space-y-2 p-0 text-sm">
              <li>
                <Link to="/contact" className="hover:text-(--color-primary)">
                  Contact
                </Link>
              </li>
              <li>
                <a href="https://qodo.ch" className="hover:text-(--color-primary)">
                  Qodo Digital
                </a>
              </li>
              <li>
                <a href="mailto:info@qodo.ch" className="hover:text-(--color-primary)">
                  info@qodo.ch
                </a>
              </li>
              <li>
                <a href="tel:+41219000479" className="hover:text-(--color-primary)">
                  +41 21 900 04 79
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-6xl border-t border-(--color-border) pt-6 text-center text-xs text-(--color-muted)">
          <p className="m-0">
            © {new Date().getFullYear()} Qodo Digital · Ch. des Halles 3, 1510 Moudon (VD, Suisse)
          </p>
          <p className="m-0 mt-2 space-x-3">
            <Link to="/mentions-legales" className="hover:text-(--color-text)">
              Mentions légales
            </Link>
            <span>·</span>
            <Link to="/confidentialite" className="hover:text-(--color-text)">
              Politique de confidentialité
            </Link>
            <span>·</span>
            <span>Données hébergées en Suisse</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
