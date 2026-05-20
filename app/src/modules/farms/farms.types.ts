/**
 * Exploitations (farms) — multi-tenancy.
 *
 * Un utilisateur peut être rattaché à plusieurs exploitations (rôles différents).
 * Le `currentFarmId` du store filtre l'ensemble des données (parcelles, interventions,
 * segments, etc.) — pour le MVP, on stocke juste l'état actif sans encore filtrer
 * les données mockées (qui sont toutes Darval).
 *
 * En Phase 3, sera synchronisé avec Odoo : modèle custom `agri.farm` qui regroupe
 * `res.partner` (entité) + parcelles + employés.
 */

export interface Farm {
  id: string;
  /** Nom de l'exploitation (ex. "Domaine Darval"). */
  name: string;
  /** Localité (ex. "Échallens, VD"). */
  location?: string;
  /** Numéro d'exploitation cantonal (CH / Acorda). */
  cantonalNumber?: string;
  /** Surface totale (ha) — somme des parcelles, ou déclarée. */
  surfaceTotalHa?: number;
  /** Initiales pour l'avatar. */
  initials: string;
  /** Couleur d'avatar. */
  color: string;
  /** Référence Odoo `agri.farm` — Phase 3. */
  odooFarmId?: number;
  /** Notes internes libres. */
  notes?: string;
  /**
   * ID de l'utilisateur propriétaire de l'exploitation (= celui qui paie
   * l'abonnement). Pour les exploitations où l'utilisateur courant est juste
   * invité (lecture seule + droit cross-farm Travaux), ownerUserId pointe vers
   * un autre AppUser. Phase 3 : table farm_members(role='owner') sur Supabase.
   */
  ownerUserId?: string;
  /**
   * Vrai si l'utilisateur courant **gère** cette exploitation pour le compte
   * d'un client externe qui n'a pas (ou pas encore) l'app. Cas d'usage :
   * entrepreneur agricole qui saisit les parcelles, l'assolement, le carnet
   * de son client pour lui. Droits complets côté UI (édition tout), mais
   * **ne compte pas dans le forfait Solo/Multi** — c'est le client qui paiera
   * éventuellement plus tard quand il ouvrira son propre compte.
   */
  managedByCurrentUser?: boolean;
  /**
   * Lien vers `ThirdPartyClient.id` (catalogue Travaux pour tiers) quand
   * managedByCurrentUser === true. Permet de retrouver le client réel Odoo
   * (res.partner) auquel l'exploitation appartient, et de prérenseigner ce
   * client dans les bons de travaux concernant cette exploitation.
   */
  linkedClientId?: string;
}
