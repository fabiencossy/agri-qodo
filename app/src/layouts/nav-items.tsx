export interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    path: '/parcellaire',
    label: 'Parcellaire',
    icon: (
      <>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
        <path d="M9 3v15M15 6v15" />
      </>
    ),
  },
  {
    path: '/carnet',
    label: 'Carnet des champs',
    icon: (
      <>
        <path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4V4z" />
        <path d="M4 4v16M8 8h8M8 12h8M8 16h5" />
      </>
    ),
  },
  {
    path: '/travaux',
    label: 'Travaux',
    icon: (
      <>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 3v4M8 3v4M2 13h20" />
      </>
    ),
  },
  {
    path: '/troupeau',
    label: 'Troupeau',
    icon: (
      <>
        <path d="M19 5c-1.5 0-2.8 1-3 2.5-.4-1.5-1.7-2.5-3-2.5s-2.6 1-3 2.5C9.6 6 8.3 5 7 5 5.3 5 4 6.3 4 8c0 4 4 7 8 11 4-4 8-7 8-11 0-1.7-1.3-3-3-3z" />
      </>
    ),
  },
  {
    path: '/fumure',
    label: 'Plan de fumure',
    icon: (
      <>
        <path d="M12 22V8" />
        <path d="M16 10c0-4 4-4 4-8-4 0-4 4-4 8z" />
        <path d="M8 10c0-4-4-4-4-8 4 0 4 4 4 8z" />
        <path d="M5 22h14" />
      </>
    ),
  },
  {
    path: '/rh',
    label: 'RH',
    icon: (
      <>
        <circle cx="9" cy="7" r="4" />
        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        <circle cx="17" cy="7" r="3" />
        <path d="M21 21v-2a4 4 0 0 0-3-3.8" />
      </>
    ),
  },
  {
    path: '/parametres',
    label: 'Paramètres',
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </>
    ),
  },
];
