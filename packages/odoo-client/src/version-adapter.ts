/**
 * Adapters par version Odoo.
 *
 * Le contrat business reste le même (créer un sale.order, lire des
 * res.partner, etc.) mais certaines signatures évoluent entre versions
 * majeures : nom de champ renommé, méthode déplacée, default value
 * changée. Plutôt que de saupoudrer le code métier de `if version >= 20`,
 * on encapsule ces différences dans un `VersionAdapter`.
 *
 * MVP : seul l'adapter v19 (= baseline Enterprise courante). Au prochain
 * support (v20, v21), on ajoutera un adapter et on enrichira le
 * `pickAdapter`.
 *
 * Pattern repris de qodo-clock/odoo_compat.py (cf mémoire projet
 * `project_odoo_multi_version`).
 */

export interface VersionAdapter {
  majorVersion: number;
  /** Nom Odoo du modèle "Bons de commande". v19+ : `sale.order`. */
  saleOrderModel: string;
  /** Nom du modèle des lignes de bon de commande. */
  saleOrderLineModel: string;
  /** Nom du wizard de facturation groupée. */
  invoiceWizardModel: string;
  /**
   * Quand on confirme un bon de commande, méthode à appeler.
   * v17+ : `action_confirm`. Plus ancien : `action_button_confirm`.
   */
  saleOrderConfirmMethod: string;
  /**
   * Champs à demander dans search_read pour un res.partner "client" type
   * — varie par version (ex: champ `vat` toujours là, mais `l10n_ch_isr`
   * apparaît à partir de l'install du module CH).
   */
  resPartnerStandardFields: string[];
}

/** Adapter v19 — baseline Enterprise courante. */
const ADAPTER_V19: VersionAdapter = {
  majorVersion: 19,
  saleOrderModel: "sale.order",
  saleOrderLineModel: "sale.order.line",
  invoiceWizardModel: "sale.advance.payment.inv",
  saleOrderConfirmMethod: "action_confirm",
  resPartnerStandardFields: [
    "id",
    "name",
    "display_name",
    "vat",
    "email",
    "phone",
    "street",
    "zip",
    "city",
    "country_id",
    "is_company",
    "customer_rank",
    "supplier_rank",
  ],
};

/** Adapter v20 — placeholder, identique à v19 jusqu'à preuve du contraire. */
const ADAPTER_V20: VersionAdapter = {
  ...ADAPTER_V19,
  majorVersion: 20,
};

/**
 * Sélectionne l'adapter pour une version Odoo donnée. Throw si la
 * version est strictement inférieure à 19 (MVP exige Enterprise v19+).
 */
export function pickAdapter(majorVersion: number): VersionAdapter {
  if (majorVersion < 19) {
    throw new Error(
      `Version Odoo ${majorVersion} non supportée. Agri Qodo requiert Odoo Enterprise 19 minimum.`,
    );
  }
  if (majorVersion >= 20) return ADAPTER_V20;
  return ADAPTER_V19;
}
