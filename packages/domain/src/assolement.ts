/**
 * Vérification de l'assolement régulier (PER §6 OPD).
 *
 * Règles simplifiées MVP :
 *   1. Pas la même espèce sur la même parcelle deux campagnes consécutives,
 *      sauf prairies (permanentes ou temporaires multi-annuelles).
 *   2. Sur les N dernières campagnes (par défaut 5), au moins K espèces
 *      distinctes cultivées sur l'ensemble de la SAU (par défaut 4).
 *
 * Configuration via `AssolementConfig` — résolu côté backend par le
 * `RuleEngineService` depuis le template OPD-CH-2026 ou un override
 * tenant. Voir docs/adr/ADR-003-rule-engine.md.
 *
 * Le module reste pur (pas de dépendance à Prisma / NestJS) pour rester
 * testable sans I/O et utilisable côté mobile (offline).
 */

export interface CultureRecord {
  /** Identifiant de la parcelle (uuid). */
  parcelleId: string;
  /** Espèce normalisée : "ble_panifiable", "mais_grain", "prairie_perm"… */
  espece: string;
  /** Année de récolte. 2026 = saison cultivée pour récolte 2026. */
  campagne: number;
}

export interface AssolementConfig {
  /** Nombre de campagnes consécutives sur lesquelles évaluer la diversité. */
  nbCampagnesDiversite: number;
  /** Nombre minimum d'espèces distinctes dans la fenêtre. */
  minEspecesDistinctes: number;
  /** Préfixes d'espèces considérées comme prairies (exemption rotation). */
  prairiePrefixes: string[];
}

/**
 * Configuration par défaut alignée sur le template OPD-CH-2026 (cf
 * `prisma/seed-rules.ts`). Utilisée comme fallback si le RuleEngine
 * n'est pas disponible (tests purs domain, exécution offline mobile).
 */
export const DEFAULT_ASSOLEMENT_CONFIG: AssolementConfig = {
  nbCampagnesDiversite: 5,
  minEspecesDistinctes: 4,
  prairiePrefixes: ["prairie_", "paturage_"],
};

export interface AssolementResult {
  ok: boolean;
  /** Liste des incidents détectés (vide si ok). */
  incidents: AssolementIncident[];
}

export type AssolementIncident =
  | {
      type: "monoculture_consecutive";
      parcelleId: string;
      espece: string;
      campagnes: [number, number];
    }
  | {
      type: "diversite_insuffisante";
      campagnes: number[];
      especesUniques: string[];
      minimumRequis: number;
    };

function isPrairie(espece: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => espece.startsWith(prefix));
}

/**
 * Vérifie l'assolement régulier sur un historique de cultures.
 * Renvoie tous les incidents détectés (pas court-circuit au premier).
 *
 * @param cultures Historique des cultures (toutes parcelles).
 * @param config Configuration des seuils (défaut : OPD-CH-2026 standard).
 *               Côté backend, fourni par `RuleEngineService.getMany()`.
 */
export function verifierAssolement(
  cultures: readonly CultureRecord[],
  config: AssolementConfig = DEFAULT_ASSOLEMENT_CONFIG,
): AssolementResult {
  const incidents: AssolementIncident[] = [];

  // Règle 1 : pas la même espèce 2 campagnes consécutives sur la même parcelle.
  const parParcelle = new Map<string, CultureRecord[]>();
  for (const c of cultures) {
    const list = parParcelle.get(c.parcelleId) ?? [];
    list.push(c);
    parParcelle.set(c.parcelleId, list);
  }

  for (const [parcelleId, parcelleCultures] of parParcelle) {
    const trie = [...parcelleCultures].sort((a, b) => a.campagne - b.campagne);
    for (let i = 1; i < trie.length; i++) {
      const prec = trie[i - 1];
      const courante = trie[i];
      if (!prec || !courante) continue;
      if (
        courante.campagne === prec.campagne + 1 &&
        courante.espece === prec.espece &&
        !isPrairie(courante.espece, config.prairiePrefixes)
      ) {
        incidents.push({
          type: "monoculture_consecutive",
          parcelleId,
          espece: courante.espece,
          campagnes: [prec.campagne, courante.campagne],
        });
      }
    }
  }

  // Règle 2 : diversité sur les N dernières campagnes.
  if (cultures.length > 0) {
    const campagneMax = Math.max(...cultures.map((c) => c.campagne));
    const campagneMin = campagneMax - config.nbCampagnesDiversite + 1;
    const fenetre = cultures.filter((c) => c.campagne >= campagneMin && c.campagne <= campagneMax);
    const especesUniques = [...new Set(fenetre.map((c) => c.espece))];
    if (especesUniques.length < config.minEspecesDistinctes) {
      const campagnesFenetre = [...new Set(fenetre.map((c) => c.campagne))].sort((a, b) => a - b);
      incidents.push({
        type: "diversite_insuffisante",
        campagnes: campagnesFenetre,
        especesUniques,
        minimumRequis: config.minEspecesDistinctes,
      });
    }
  }

  return { ok: incidents.length === 0, incidents };
}
