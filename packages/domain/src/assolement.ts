/**
 * Vérification de l'assolement régulier (PER §6 OPD).
 *
 * Règles simplifiées MVP :
 *   1. Pas la même espèce sur la même parcelle deux campagnes consécutives,
 *      sauf prairies (permanentes ou temporaires multi-annuelles).
 *   2. Sur les 5 dernières campagnes, au moins 4 espèces distinctes
 *      cultivées sur l'ensemble de la SAU (règle de diversité simplifiée).
 *
 * NOTE : Les vraies règles d'assolement OPD sont plus complexes (familles
 * botaniques, parts maximales par culture, exceptions zone montagne…).
 * Cette implémentation MVP couvre le cas commun grandes cultures plaine ;
 * V2 affinera selon les guides Agridea PER 2026.
 */

export interface CultureRecord {
  /** Identifiant de la parcelle (uuid). */
  parcelleId: string;
  /** Espèce normalisée : "ble_panifiable", "mais_grain", "prairie_perm"… */
  espece: string;
  /** Année de récolte. 2026 = saison cultivée pour récolte 2026. */
  campagne: number;
}

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

const PRAIRIE_PREFIXES = ["prairie_", "paturage_"];
const NB_CAMPAGNES_DIVERSITE = 5;
const MIN_ESPECES_DISTINCTES = 4;

function isPrairie(espece: string): boolean {
  return PRAIRIE_PREFIXES.some((prefix) => espece.startsWith(prefix));
}

/**
 * Vérifie l'assolement régulier sur un historique de cultures.
 * Renvoie tous les incidents détectés (pas court-circuit au premier).
 */
export function verifierAssolement(cultures: readonly CultureRecord[]): AssolementResult {
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
        !isPrairie(courante.espece)
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

  // Règle 2 : diversité sur les 5 dernières campagnes.
  if (cultures.length > 0) {
    const campagneMax = Math.max(...cultures.map((c) => c.campagne));
    const campagneMin = campagneMax - NB_CAMPAGNES_DIVERSITE + 1;
    const fenetre = cultures.filter((c) => c.campagne >= campagneMin && c.campagne <= campagneMax);
    const especesUniques = [...new Set(fenetre.map((c) => c.espece))];
    if (especesUniques.length < MIN_ESPECES_DISTINCTES) {
      const campagnesFenetre = [...new Set(fenetre.map((c) => c.campagne))].sort((a, b) => a - b);
      incidents.push({
        type: "diversite_insuffisante",
        campagnes: campagnesFenetre,
        especesUniques,
        minimumRequis: MIN_ESPECES_DISTINCTES,
      });
    }
  }

  return { ok: incidents.length === 0, incidents };
}
