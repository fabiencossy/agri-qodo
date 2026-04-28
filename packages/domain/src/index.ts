/**
 * @agri-qodo/domain — logique métier pure.
 *
 * Aucune dépendance d'I/O, framework ou base de données.
 * Cible 100% de couverture de tests.
 *
 * Modules à implémenter :
 *  - suisse-bilanz : calcul flux N et P selon Guide Agridea 1.18
 *  - ugb : conversion catégorie animale → unité gros bétail
 *  - assolement : vérification rotation régulière (livré étape 5a)
 *  - parcelle : validation surface, géométrie, zone agricole
 */

export const PACKAGE_NAME = "@agri-qodo/domain" as const;

export {
  DEFAULT_ASSOLEMENT_CONFIG,
  type AssolementConfig,
  type AssolementIncident,
  type AssolementResult,
  type CultureRecord,
  verifierAssolement,
} from "./assolement";

export {
  type ApportEngrais,
  type BilanInput,
  type BilanResult,
  calculerBilan,
  type ComptageAnimaux,
  type CultureParcelle,
  DEFAULT_SUISSE_BILANZ_CONFIG,
  type DetailParcelle,
  type SuisseBilanzConfig,
} from "./suisse-bilanz";
