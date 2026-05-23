/**
 * Catalogue des sections du module Paramètres.
 *
 * Layout style Odoo : sidebar gauche listant les groupes, zone centrale qui
 * affiche le contenu de la section active. Chaque section a une route propre
 * `/parametres/:slug`.
 */

import type { ModuleKey, PermissionLevel } from '../users/users.types';

export interface ParametresSection {
  slug: string;
  label: string;
  description?: string;
  group: 'general' | 'donnees' | 'integrations';
  /** Permission minimale requise sur le module ciblé pour voir la section. */
  module?: ModuleKey;
  requiredLevel?: PermissionLevel;
  icon: React.ReactNode;
}

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  width: 18,
  height: 18,
  'aria-hidden': true,
};

export const PARAMETRES_SECTIONS: ReadonlyArray<ParametresSection> = [
  {
    slug: 'exploitation',
    label: 'Exploitation',
    description: 'Identité, surfaces, numéro cantonal',
    group: 'general',
    module: 'parametres',
    requiredLevel: 'read',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M3 11 12 4l9 7" />
        <path d="M5 10v10h14V10" />
        <path d="M9 20v-6h6v6" />
      </svg>
    ),
  },
  {
    slug: 'utilisateurs',
    label: 'Utilisateurs & accès',
    description: 'Équipe, rôles, droits par module',
    group: 'general',
    module: 'parametres',
    requiredLevel: 'read',
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="9" cy="7" r="4" />
        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        <circle cx="17" cy="7" r="3" />
        <path d="M21 21v-2a4 4 0 0 0-3-3.8" />
      </svg>
    ),
  },
  {
    slug: 'preferences',
    label: 'Préférences',
    description: 'Langue, devise, unités, format dates',
    group: 'general',
    module: 'parametres',
    requiredLevel: 'read',
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </svg>
    ),
  },
  {
    slug: 'cultures',
    label: 'Cultures',
    description: 'Catalogue Agridéa, normes besoins',
    group: 'donnees',
    module: 'parametres',
    requiredLevel: 'read',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 22V8" />
        <path d="M16 10c0-4 4-4 4-8-4 0-4 4-4 8z" />
        <path d="M8 10c0-4-4-4-4-8 4 0 4 4 4 8z" />
        <path d="M5 22h14" />
      </svg>
    ),
  },
  {
    slug: 'produits',
    label: 'Catalogue',
    description: 'Phytos OFAG, engrais, semences, prestations',
    group: 'donnees',
    module: 'parametres',
    requiredLevel: 'read',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M3 7l9-4 9 4-9 4-9-4z" />
        <path d="M3 7v10l9 4 9-4V7" />
        <path d="M12 11v10" />
      </svg>
    ),
  },
  {
    slug: 'clients',
    label: 'Annuaire clients',
    description: 'Clients tiers facturés, mappés res.partner Odoo',
    group: 'donnees',
    module: 'parametres',
    requiredLevel: 'read',
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="9" cy="8" r="3.5" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M2 20c0-3 3-6 7-6s7 3 7 6" />
        <path d="M15 20c0-2 2-4 4-4s3 2 3 4" />
      </svg>
    ),
  },
  {
    slug: 'cheptel',
    label: 'Cheptel',
    description: 'Catégories animaux, normes UGB',
    group: 'donnees',
    module: 'parametres',
    requiredLevel: 'read',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M5 15c0-3 2-5 5-5s5 2 5 5v3H5z" />
        <circle cx="7" cy="9" r="1.5" />
        <circle cx="13" cy="9" r="1.5" />
        <path d="M16 12h4M16 16h3" />
      </svg>
    ),
  },
  {
    slug: 'odoo',
    label: 'Intégration Odoo',
    description: 'XML-RPC, mapping, synchronisations',
    group: 'integrations',
    module: 'parametres',
    requiredLevel: 'admin',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 7h16M4 12h16M4 17h16" />
        <circle cx="8" cy="7" r="2" />
        <circle cx="16" cy="12" r="2" />
        <circle cx="8" cy="17" r="2" />
      </svg>
    ),
  },
  {
    slug: 'meteo',
    label: 'MétéoSuisse',
    description: 'Auto-remplissage météo interventions',
    group: 'integrations',
    module: 'parametres',
    requiredLevel: 'admin',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M17.5 19a4.5 4.5 0 1 0 0-9 7 7 0 0 0-13.5 2.5A4 4 0 0 0 6 19z" />
      </svg>
    ),
  },
];

export const SECTION_GROUPS: ReadonlyArray<{
  key: ParametresSection['group'];
  label: string;
}> = [
  { key: 'general', label: 'Général' },
  { key: 'donnees', label: 'Données de référence' },
  { key: 'integrations', label: 'Intégrations' },
];
