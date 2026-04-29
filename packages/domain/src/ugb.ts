/**
 * Conversion catégorie animale → Unité Gros Bétail (UGB).
 *
 * Référentiel : Annexe 1 OPD (Ordonnance fédérale sur les paiements
 * directs), version 2026. Coefficients officiels utilisés par l'OFAG
 * pour le calcul de la charge en bétail (UGB/SAU), les contributions
 * SRPA/SST, le plafond Suisse-Bilanz et les conversions Agridea.
 *
 * Le coefficient s'affine quand la date de naissance de l'animal est
 * connue (cas des bovins identifiés individuellement par n° BDTA).
 * Sinon, on retombe sur la valeur par défaut de la catégorie.
 *
 * Module pur (pas d'I/O, pas de framework) — réutilisable côté mobile
 * offline et testable sans base de données.
 */

export type AnimalCategorie =
  | "VACHE_LAITIERE"
  | "GENISSE"
  | "VEAU"
  | "TAUREAU"
  | "BOEUF"
  | "AUTRE_BOVIN"
  | "PORC"
  | "POULET"
  | "AUTRE";

/**
 * Coefficient UGB par défaut pour chaque catégorie (sans date de
 * naissance). Valeurs OPD-CH-2026 — moyenne pondérée représentative
 * pour les exploitations suisses standard. Pour AUTRE on retient 0 :
 * le coefficient est inconnu, l'utilisateur doit requalifier l'animal.
 */
export const DEFAULT_UGB_COEFFICIENTS: Record<AnimalCategorie, number> = {
  VACHE_LAITIERE: 1.0, // vache à lait standard (>= 600 kg)
  GENISSE: 0.6, // moyenne génisses tous âges confondus
  VEAU: 0.13, // veau d'élevage < 160 jours (par défaut)
  TAUREAU: 1.0, // taureau d'élevage adulte
  BOEUF: 0.6, // bœuf d'engraissement > 1 an
  AUTRE_BOVIN: 0.6, // bovin non précisé > 1 an
  PORC: 0.13, // porc d'engraissement standard
  POULET: 0.004, // poulet d'engraissement
  AUTRE: 0,
};

const MS_PAR_JOUR = 86_400_000;

/**
 * Coefficient UGB précis pour un animal, en tenant compte de sa date
 * de naissance si disponible. Affinage par âge appliqué uniquement aux
 * catégories où le barème OPD distingue des tranches (bovins).
 *
 * @param categorie catégorie enum Prisma
 * @param dateNaissance date de naissance (option : si absente, valeur par défaut)
 * @param reference date à laquelle on évalue l'âge (default : aujourd'hui)
 */
export function coefUgb(
  categorie: AnimalCategorie,
  dateNaissance?: Date | string | null,
  reference: Date = new Date(),
): number {
  if (!dateNaissance) return DEFAULT_UGB_COEFFICIENTS[categorie];

  const d = dateNaissance instanceof Date ? dateNaissance : new Date(dateNaissance);
  if (Number.isNaN(d.getTime())) return DEFAULT_UGB_COEFFICIENTS[categorie];

  const ageJours = Math.max(0, Math.floor((reference.getTime() - d.getTime()) / MS_PAR_JOUR));
  const ageAns = ageJours / 365.25;

  switch (categorie) {
    case "GENISSE":
      // OPD : > 2 ans = 0.70 ; 1-2 ans = 0.40 ; < 1 an (veau d'élevage) = 0.30
      if (ageAns >= 2) return 0.7;
      if (ageAns >= 1) return 0.4;
      return 0.3;

    case "VEAU":
      // OPD : < 160 jours = 0.13 ; 160 j à 1 an (veau d'élevage) = 0.30 ;
      // au-delà de 1 an, on quitte la catégorie veau → barème génisse/bœuf
      if (ageJours < 160) return 0.13;
      return 0.3;

    case "BOEUF":
    case "AUTRE_BOVIN":
      // OPD : < 1 an = 0.30 ; > 1 an = 0.60
      if (ageAns < 1) return 0.3;
      return 0.6;

    case "VACHE_LAITIERE":
    case "TAUREAU":
    case "PORC":
    case "POULET":
    case "AUTRE":
      // Pas de tranche d'âge dans le barème OPD pour ces catégories.
      return DEFAULT_UGB_COEFFICIENTS[categorie];
  }
}

/**
 * Une ligne d'animal pour le calcul du cheptel : catégorie + date de
 * naissance optionnelle. Volontairement minimal pour rester réutilisable
 * (Animal Prisma row, formulaire RHF, payload sync, etc.).
 */
export interface AnimalUgbInput {
  categorie: AnimalCategorie;
  dateNaissance?: Date | string | null;
}

export interface UgbParCategorie {
  categorie: AnimalCategorie;
  nombreAnimaux: number;
  /** Coefficient moyen pondéré sur les animaux de cette catégorie. */
  coefMoyen: number;
  /** UGB total pour cette catégorie. */
  ugbTotal: number;
}

export interface UgbExploitationResult {
  /** UGB total exploitation (somme par catégorie). */
  total: number;
  /** Détail par catégorie présente (filtrées : nombre > 0). */
  parCategorie: UgbParCategorie[];
}

/**
 * Calcule l'UGB total de l'exploitation à partir de la liste des
 * animaux actifs. Catégories absentes du tableau ne figurent pas dans
 * le résultat (vue allégée pour l'UI).
 */
export function calculerUgbExploitation(
  animaux: AnimalUgbInput[],
  reference: Date = new Date(),
): UgbExploitationResult {
  const buckets = new Map<AnimalCategorie, { nombre: number; ugb: number }>();

  for (const a of animaux) {
    const coef = coefUgb(a.categorie, a.dateNaissance, reference);
    const bucket = buckets.get(a.categorie) ?? { nombre: 0, ugb: 0 };
    bucket.nombre += 1;
    bucket.ugb += coef;
    buckets.set(a.categorie, bucket);
  }

  const parCategorie: UgbParCategorie[] = [];
  let total = 0;
  for (const [categorie, { nombre, ugb }] of buckets) {
    if (nombre === 0) continue;
    parCategorie.push({
      categorie,
      nombreAnimaux: nombre,
      coefMoyen: round3(ugb / nombre),
      ugbTotal: round3(ugb),
    });
    total += ugb;
  }

  parCategorie.sort((a, b) => b.ugbTotal - a.ugbTotal);

  return { total: round3(total), parCategorie };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
