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
}
