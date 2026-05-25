/**
 * Catalog global du FAB — secteurs et actions exhaustifs.
 *
 * Au clic FAB → niveau 1 = liste des secteurs. Clic secteur → niveau 2 = ses
 * actions. Chaque action prend (navigate) en paramètre, navigue vers la route
 * cible avec éventuellement un query param `?action=...` que la page peut
 * consommer pour pré-activer un outil.
 *
 * Volontairement exhaustif : Fabien doit pouvoir trier ce qu'il garde / enlève.
 */
import type { NavigateFunction } from 'react-router-dom';
import type { ReactNode } from 'react';

export type FabSectorAction = {
  id: string;
  label: string;
  icon: ReactNode;
  run: (nav: NavigateFunction) => void;
};

export type FabSector = {
  id: string;
  label: string;
  color: string;
  icon: ReactNode;
  actions: FabSectorAction[];
  /** Si défini, le clic sur le secteur exécute directement cette action au
   *  lieu d'ouvrir le sous-menu. Utilisé pour les secteurs "raccourci". */
  directRun?: (nav: NavigateFunction) => void;
};

/* ───── Icônes inline (Lucide-like) ───── */
const I = {
  pen: <path d="m4 20 4-1 11-11-3-3L5 16zM14 6l3 3" />,
  parcel: (
    <>
      <path d="M5 5 19 7l3 12-13 3L3 12z" />
      <circle cx="5" cy="5" r="1.3" fill="currentColor" />
      <circle cx="19" cy="7" r="1.3" fill="currentColor" />
      <circle cx="22" cy="19" r="1.3" fill="currentColor" />
      <circle cx="9" cy="22" r="1.3" fill="currentColor" />
      <circle cx="3" cy="12" r="1.3" fill="currentColor" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  cow: (
    <>
      <path d="M5 8c0-3 3-5 7-5s7 2 7 5v3c0 4-3 7-7 7s-7-3-7-7z" />
      <path d="M9 8h.01M15 8h.01" />
      <path d="M9 14c.5 1 1.5 2 3 2s2.5-1 3-2" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3h6M10 3v6L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-10V3" />
      <path d="M7 14h10" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  plant: (
    <>
      <path d="M12 21V11" />
      <path d="M12 11c-3 0-5-2-5-5 3 0 5 2 5 5z" />
      <path d="M12 11c3 0 5-2 5-5-3 0-5 2-5 5z" />
    </>
  ),
  truck: (
    <>
      <path d="M3 8h11v8H3zM14 11h4l3 3v2h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  scale: (
    <>
      <path d="M12 4v16M4 8h16" />
      <path d="m4 8-2 6c0 2 2 3 4 3s4-1 4-3l-2-6" />
      <path d="m20 8-2 6c0 2 2 3 4 3" />
    </>
  ),
  upload: (
    <>
      <path d="M12 4v12" />
      <path d="m6 10 6-6 6 6" />
      <path d="M4 20h16" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12" />
      <path d="m6 14 6 6 6-6" />
      <path d="M4 22h16" />
    </>
  ),
  warn: (
    <>
      <path d="M12 4 2 20h20z" />
      <path d="M12 10v5M12 18v.01" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M2 20c0-3 3-6 7-6s7 3 7 6" />
      <path d="M15 20c0-2 2-4 4-4s3 2 3 4" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2" />
    </>
  ),
  invoice: (
    <>
      <path d="M6 2h10l4 4v16H6z" />
      <path d="M16 2v4h4M9 11h6M9 15h6M9 7h2" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8h4l2-3h6l2 3h4v12H3z" />
      <circle cx="12" cy="14" r="4" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
    </>
  ),
  pin: (
    <>
      <path d="M12 22s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  cog: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </>
  ),
  group: (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M8 6h8M8 18h8M6 8v8M18 8v8" />
    </>
  ),
  swap: (
    <>
      <path d="M7 4 3 8l4 4M3 8h14a4 4 0 0 1 0 8h-3" />
      <path d="m17 20 4-4-4-4" />
    </>
  ),
  check: (
    <>
      <path d="M20 6 9 17l-5-5" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 3v18l3-2 3 2 3-2 3 2 3-2V3z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
};

/* ───── Helper navigation ───── */
const go =
  (path: string) =>
  (nav: NavigateFunction): void => {
    nav(path);
  };

/* ───── Catalogue ───── */
/**
 * Catalogue final FAB — uniquement actions fonctionnelles en MVP.
 * Toute action ici doit déclencher un comportement réel (modal, outil, filtre).
 * Les fonctions Phase 3 (photo GPS, voix, BDTA, etc.) sont délibérément absentes
 * pour éviter les clics morts.
 */
export const FAB_SECTORS: FabSector[] = [
  {
    id: 'carnet',
    label: 'Travaux des champs',
    color: '#2E7D32',
    icon: I.plant,
    actions: [
      {
        id: 'c-intervention',
        label: 'Créer une intervention',
        icon: I.pen,
        run: go('/carnet?action=new'),
      },
      {
        id: 'c-observation',
        label: 'Ajouter une observation',
        icon: I.eye,
        run: go('/carnet?action=new&type=observation'),
      },
      {
        id: 'c-danger',
        label: 'Signaler un danger (carte)',
        icon: I.warn,
        run: go('/parcellaire?action=add-marker&kind=danger'),
      },
    ],
  },
  {
    id: 'parcellaire',
    label: 'Parcellaire',
    color: '#0369a1',
    icon: I.parcel,
    actions: [
      {
        id: 'p-new',
        label: 'Nouvelle parcelle (dessin)',
        icon: I.parcel,
        run: go('/parcellaire?action=draw'),
      },
      {
        id: 'p-import-geojson',
        label: 'Importer GeoJSON',
        icon: I.upload,
        run: go('/parcellaire?action=import-geojson'),
      },
      {
        id: 'p-poi',
        label: 'Poser une balise GPS',
        icon: I.pin,
        run: go('/parcellaire?action=add-marker&kind=observation'),
      },
      {
        id: 'p-group',
        label: 'Grouper des parcelles',
        icon: I.group,
        run: go('/parcellaire?action=group-select'),
      },
    ],
  },
  {
    id: 'assolement',
    label: 'Assolement',
    color: '#65a30d',
    icon: I.calendar,
    actions: [
      {
        id: 'a-new',
        label: "Ajouter un segment d'assolement",
        icon: I.calendar,
        run: go('/assolement?action=new'),
      },
      {
        id: 'a-import',
        label: 'Importer plan de culture (GeoJSON)',
        icon: I.upload,
        run: go('/assolement?action=import'),
      },
    ],
  },
  {
    id: 'cheptel',
    label: 'Cheptel',
    color: '#a16207',
    icon: I.cow,
    actions: [
      {
        id: 't-add',
        label: 'Ajouter une catégorie animale',
        icon: I.cow,
        run: go('/troupeau?action=new'),
      },
    ],
  },
  {
    id: 'fumure',
    label: 'Bilan de fumure',
    color: '#7c3aed',
    icon: I.flask,
    actions: [
      {
        id: 'f-bilan',
        label: 'Voir le bilan (dashboard)',
        icon: I.scale,
        run: go('/fumure?action=bilan'),
      },
      {
        id: 'f-fiche',
        label: 'Besoins par parcelle (table)',
        icon: I.parcel,
        run: go('/fumure?action=fiche'),
      },
    ],
  },
  {
    id: 'travaux',
    label: 'Travaux agricoles',
    color: '#dc2626',
    icon: I.truck,
    actions: [
      { id: 'w-new', label: 'Nouveau bon de travail', icon: I.pen, run: go('/travaux?action=new') },
      {
        id: 'w-plan',
        label: 'Planifier une tâche (rapide)',
        icon: I.calendar,
        run: go('/travaux?action=plan'),
      },
      {
        id: 'w-validate',
        label: 'Valider travaux réalisés',
        icon: I.check,
        run: go('/travaux?action=validate'),
      },
    ],
  },
  {
    id: 'rh',
    label: 'RH & temps',
    color: '#0891b2',
    icon: I.clock,
    actions: [
      { id: 'r-presence', label: 'Saisir une présence', icon: I.clock, run: go('/rh/saisir') },
      { id: 'r-heures', label: 'Mes heures', icon: I.clock, run: go('/rh/heures') },
      { id: 'r-conge', label: 'Demande de congé', icon: I.calendar, run: go('/rh/conges') },
    ],
  },
  {
    id: 'annuaire',
    label: 'Clients',
    color: '#9333ea',
    icon: I.users,
    actions: [],
    directRun: go('/parametres/clients'),
  },
  {
    id: 'parametres',
    label: 'Paramètres',
    color: '#475569',
    icon: I.cog,
    actions: [],
    directRun: go('/parametres'),
  },
];
