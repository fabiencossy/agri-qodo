/**
 * Utilisateurs de l'app Qodo Agri.
 *
 * En Phase 3, sera synchronisé avec :
 *   - Odoo `hr.employee` (référentiel employés exploitation)
 *   - Odoo `res.users` (comptes utilisateurs avec login)
 *
 * Pour l'instant, mocks Darval. Utilisé partout où un opérateur doit être
 * sélectionné (carnet des champs, RH, travaux…).
 */

export type UserRole = 'admin' | 'editor' | 'viewer';

/** Modules métier sur lesquels on contrôle l'accès. */
export type ModuleKey =
  | 'parcellaire'
  | 'carnet'
  | 'assolement'
  | 'fumure'
  | 'troupeau'
  | 'travaux'
  | 'rh'
  | 'parametres';

/**
 * Niveaux de droit (cumulatifs).
 *  - none  : invisible (route masquée)
 *  - read  : consultation seule (FAB / boutons d'édition masqués)
 *  - write : peut créer / modifier
 *  - admin : peut tout, y compris supprimer ou gérer les utilisateurs
 */
export type PermissionLevel = 'none' | 'read' | 'write' | 'admin';

export type ModulePermissions = Record<ModuleKey, PermissionLevel>;

export interface AppUser {
  id: string;
  /** Nom usuel pour affichage : "F. Cossy" (initiale + nom). */
  displayName: string;
  /** Nom complet : "Fabien Cossy". */
  fullName: string;
  /** Email (pour login Phase 3). */
  email?: string;
  /** Téléphone (format suisse, ex. "+41 79 123 45 67"). */
  phone?: string;
  /** Poste / fonction (ex. "Chef d'exploitation", "Tractoriste"). */
  jobTitle?: string;
  /** Date d'entrée (ISO). */
  hireDate?: string;
  /** Langue d'interface préférée. */
  language?: 'fr' | 'de' | 'it' | 'en';
  /** Rôle dans l'exploitation. */
  role: UserRole;
  /** Couleur d'avatar (chip / badge). */
  color: string;
  /** Initiales affichées dans l'avatar (max 2 lettres). */
  initials: string;
  /** Actif (false = ancien employé, conservé pour historique). */
  active: boolean;
  /** Droits explicites par module (override les défauts du rôle). */
  permissions?: ModulePermissions;
  /** Lié à l'employé Odoo (hr.employee.id) — Phase 3. */
  odooEmployeeId?: number;
  /** Lié à l'utilisateur Odoo (res.users.id) — Phase 3, uniquement si l'employé
   *  a un compte Odoo avec licence (rare). */
  odooUserId?: number;
  /**
   * Étiquette `project.tags` Odoo dédiée à cet employé (Field Service).
   *
   * Convention du projet : pour assigner une tâche FSM à un employé qui n'a
   * pas de compte Odoo (cas le plus fréquent), on crée une étiquette
   * `project.tags` portant son nom et on l'ajoute à `task.tag_ids`. Ce
   * champ stocke l'ID de cette étiquette pour le sync. Voir la doc dans
   * `modules/travaux/travaux.types.ts`.
   */
  odooTagId?: number;
}
