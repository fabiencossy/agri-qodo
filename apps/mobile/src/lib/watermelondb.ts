/**
 * WatermelonDB — placeholder.
 *
 * Activation à l'étape 5+ avec les modèles métier (Parcelle, Intervention,
 * Animal, etc.). WatermelonDB nécessite des modules natifs : il faut
 * `expo prebuild` ou un dev client custom (incompatible Expo Go).
 *
 * En attendant, l'app fonctionne en mode online-first : les requêtes
 * touchent directement le backend. La couche offline arrive avec les
 * vrais modèles métier.
 */

export async function watermelondbHealthcheck(): Promise<boolean> {
  // Pas encore connecté à un vrai SQLite — on simule un OK.
  return true;
}
