/**
 * Source unifiée d'une prestation : soit un type de prestation du catalogue
 * Travaux (WorkType → product.product service Odoo), soit un Product du
 * catalogue (phyto/engrais/semence → product.product consu Odoo).
 *
 * L'unité (`unit`) sert à la fois pour l'affichage et pour l'auto-fill de la
 * quantité depuis les parcelles (si elle finit par '/ha' ou vaut 'ha').
 */
export interface PrestationSource {
  kind: 'worktype' | 'product';
  /** WorkType.key ou Product.id selon kind. */
  id: string;
  label: string;
  description?: string;
  /** Unité affichée et utilisée pour la quantité. Ex. 'ha', 'h', 'kg/ha', 'L/ha'. */
  unit: string;
  /** Catégorie pour le regroupement visuel. */
  category: string;
  /** Pour rétro-compat WorkOrderLine.billingUnit. */
  billingUnit?: 'heure' | 'hectare' | 'forfait';
  /** Tarif par défaut conservé dans la ligne (non affiché, utile pour le calcul Odoo). */
  defaultRateChf?: number;
}

/** Vrai si l'unité d'une PrestationSource impose un préfill par la surface. */
export function isPerHectareUnit(unit: string): boolean {
  return unit === 'ha' || unit.endsWith('/ha');
}
