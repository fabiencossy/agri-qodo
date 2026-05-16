import type { AppUser } from './users.types';

/**
 * Utilisateurs mock du Domaine Darval.
 * À remplacer par fetch Odoo `hr.employee` + `res.users` en Phase 3.
 *
 * `permissions` est laissé indéfini quand le rôle suffit (ROLE_DEFAULTS).
 * Sophie a un override d'écriture sur le carnet (cas d'usage : observatrice
 * mais autorisée à saisir des observations).
 */
export const USERS: ReadonlyArray<AppUser> = [
  {
    id: 'U-001',
    displayName: 'F. Cossy',
    fullName: 'Fabien Cossy',
    email: 'fabien.cossy@hofer-groupe.ch',
    phone: '+41 79 123 45 67',
    jobTitle: 'Chef d’exploitation',
    hireDate: '2018-04-01',
    language: 'fr',
    role: 'admin',
    color: '#2d5016',
    initials: 'FC',
    active: true,
    odooEmployeeId: 1,
    odooUserId: 1,
  },
  {
    id: 'U-002',
    displayName: 'M. Dubois',
    fullName: 'Marc Dubois',
    email: 'marc.dubois@darval.ch',
    phone: '+41 79 222 33 44',
    jobTitle: 'Tractoriste',
    hireDate: '2020-09-15',
    language: 'fr',
    role: 'editor',
    color: '#875a7b',
    initials: 'MD',
    active: true,
    odooEmployeeId: 2,
  },
  {
    id: 'U-003',
    displayName: 'L. Genton',
    fullName: 'Lucas Genton',
    email: 'lucas.genton@darval.ch',
    jobTitle: 'Saisonnier',
    hireDate: '2024-03-01',
    language: 'fr',
    role: 'editor',
    color: '#a16207',
    initials: 'LG',
    active: true,
    odooEmployeeId: 3,
  },
  {
    id: 'U-004',
    displayName: 'S. Bovay',
    fullName: 'Sophie Bovay',
    email: 'sophie.bovay@darval.ch',
    jobTitle: 'Comptabilité',
    language: 'fr',
    role: 'viewer',
    color: '#0284c7',
    initials: 'SB',
    active: true,
    odooEmployeeId: 4,
    permissions: {
      parcellaire: 'read',
      assolement: 'read',
      carnet: 'write',
      fumure: 'read',
      troupeau: 'read',
      travaux: 'read',
      rh: 'admin',
      parametres: 'none',
    },
  },
  {
    id: 'U-005',
    displayName: 'Entrepreneur Genton SA',
    fullName: 'Entrepreneur Genton SA (tiers)',
    jobTitle: 'Prestataire externe',
    language: 'fr',
    role: 'viewer',
    color: '#6b7280',
    initials: 'EG',
    active: true,
  },
];
