/**
 * Suisse-Bilanz simplifié (M3) — calcul des flux d'azote (N) et de
 * phosphore (P) sur l'exploitation pour vérifier le respect PER.
 *
 * Méthode simplifiée vs Guide Agridea 1.18 :
 *   APPORTS  = engrais minéraux saisis (interventions FUMURE_MINERALE)
 *            + déjections des animaux (UGB × coefficient par catégorie)
 *            + engrais organiques saisis (FUMURE_ORGANIQUE)
 *   BESOINS  = somme par parcelle (surface_ha × besoin_par_culture)
 *   SOLDE    = APPORTS - BESOINS
 *
 * Conformité PER : SOLDE ≤ tolerance × BESOINS (par défaut 10%).
 *
 * NOTE : la vraie méthode Guide Agridea 1.18 est plus fine (pertes,
 * rétroactions sol, formes d'azote NH4/NO3, etc.). Ici on couvre le
 * cas quotidien pour donner à l'agriculteur une indication temps réel.
 * V2 : intégration des règles complètes selon dernières publications
 * Agridea + OFAG.
 *
 * Configuration via SuisseBilanzConfig — résolu côté backend par
 * RuleEngineService depuis le template OPD-CH-2026 (cf ADR-003).
 */

export interface SuisseBilanzConfig {
  /** Besoins N par hectare et par culture (kg N / ha). */
  besoinNParCulture: Record<string, number>;
  /** Besoins P par hectare et par culture (kg P / ha). */
  besoinPParCulture: Record<string, number>;
  /** Apports N par UGB et catégorie animale (kg N / UGB / an). */
  apportNParUgb: Record<string, number>;
  /** Apports P par UGB et catégorie animale (kg P / UGB / an). */
  apportPParUgb: Record<string, number>;
  /** Facteur UGB par catégorie animale (UGB par tête). */
  facteurUgb: Record<string, number>;
  /** Tolérance sur le solde (0.10 = 10%). */
  tolerance: number;
}

/**
 * Configuration par défaut alignée sur Guide Agridea 1.18 (couverture
 * partielle pour MVP — les principales cultures grandes cultures + bovins).
 * Chaque clé est aussi exposée dans le seed `OPD-CH-2026`.
 */
export const DEFAULT_SUISSE_BILANZ_CONFIG: SuisseBilanzConfig = {
  besoinNParCulture: {
    ble_panifiable: 140,
    ble_fourrager: 130,
    orge: 110,
    mais_grain: 180,
    mais_ensilage: 160,
    colza: 130,
    tournesol: 80,
    pomme_de_terre: 120,
    betterave_sucre: 130,
    prairie_temporaire: 130,
    prairie_permanente: 110,
    paturage_extensif: 50,
    paturage_intensif: 130,
  },
  besoinPParCulture: {
    ble_panifiable: 35,
    ble_fourrager: 35,
    orge: 30,
    mais_grain: 50,
    mais_ensilage: 45,
    colza: 35,
    tournesol: 30,
    pomme_de_terre: 50,
    betterave_sucre: 50,
    prairie_temporaire: 30,
    prairie_permanente: 25,
    paturage_extensif: 15,
    paturage_intensif: 30,
  },
  apportNParUgb: {
    VACHE_LAITIERE: 105,
    GENISSE: 75,
    VEAU: 35,
    TAUREAU: 90,
    BOEUF: 80,
    AUTRE_BOVIN: 75,
    PORC: 90,
    POULET: 60,
    AUTRE: 70,
  },
  apportPParUgb: {
    VACHE_LAITIERE: 18,
    GENISSE: 14,
    VEAU: 6,
    TAUREAU: 16,
    BOEUF: 14,
    AUTRE_BOVIN: 14,
    PORC: 30,
    POULET: 25,
    AUTRE: 14,
  },
  facteurUgb: {
    VACHE_LAITIERE: 1.0,
    GENISSE: 0.7,
    VEAU: 0.4,
    TAUREAU: 1.2,
    BOEUF: 0.9,
    AUTRE_BOVIN: 0.6,
    PORC: 0.15,
    POULET: 0.01,
    AUTRE: 0.5,
  },
  tolerance: 0.1,
};

/** Une culture située sur une parcelle, avec sa surface. */
export interface CultureParcelle {
  parcelleId: string;
  parcelleNom: string;
  surfaceHa: number;
  espece: string;
}

/**
 * Comptage d'animaux par catégorie présents sur l'exploitation pour
 * l'année considérée. Pour MVP on prend une moyenne annuelle simple.
 */
export interface ComptageAnimaux {
  categorie: string;
  nombre: number;
}

/**
 * Apport d'engrais saisi via une intervention (FUMURE_MINERALE ou
 * FUMURE_ORGANIQUE) — exprimé en kg N et kg P déjà calculés en amont
 * (ex: 100 kg d'urée 46% N → 46 kg N).
 */
export interface ApportEngrais {
  parcelleId: string;
  kgN: number;
  kgP: number;
}

export interface BilanInput {
  cultures: CultureParcelle[];
  animaux: ComptageAnimaux[];
  apportsEngrais: ApportEngrais[];
}

export interface DetailParcelle {
  parcelleId: string;
  parcelleNom: string;
  surfaceHa: number;
  espece: string;
  besoinN: number;
  besoinP: number;
}

export interface BilanResult {
  apportsN: number;
  apportsP: number;
  besoinsN: number;
  besoinsP: number;
  soldeN: number;
  soldeP: number;
  conformeN: boolean;
  conformeP: boolean;
  details: DetailParcelle[];
  /** Cultures sans coefficient connu (à compléter dans le rule engine). */
  culturesInconnues: string[];
}

/**
 * Calcule le Suisse-Bilanz simplifié pour l'exploitation.
 *
 * @param input cultures + animaux + apports d'engrais
 * @param config coefficients (défaut : Agridea 1.18 simplifié)
 */
export function calculerBilan(
  input: BilanInput,
  config: SuisseBilanzConfig = DEFAULT_SUISSE_BILANZ_CONFIG,
): BilanResult {
  const culturesInconnuesSet = new Set<string>();

  // Besoins par parcelle (apport théorique nécessaire)
  let besoinsN = 0;
  let besoinsP = 0;
  const details: DetailParcelle[] = [];
  for (const c of input.cultures) {
    const bN = config.besoinNParCulture[c.espece];
    const bP = config.besoinPParCulture[c.espece];
    if (bN === undefined || bP === undefined) {
      culturesInconnuesSet.add(c.espece);
    }
    const besoinN = (bN ?? 0) * c.surfaceHa;
    const besoinP = (bP ?? 0) * c.surfaceHa;
    besoinsN += besoinN;
    besoinsP += besoinP;
    details.push({
      parcelleId: c.parcelleId,
      parcelleNom: c.parcelleNom,
      surfaceHa: c.surfaceHa,
      espece: c.espece,
      besoinN: Math.round(besoinN * 10) / 10,
      besoinP: Math.round(besoinP * 10) / 10,
    });
  }

  // Apports : engrais saisis + déjections animaux
  let apportsN = 0;
  let apportsP = 0;
  for (const a of input.apportsEngrais) {
    apportsN += a.kgN;
    apportsP += a.kgP;
  }
  for (const a of input.animaux) {
    const facteur = config.facteurUgb[a.categorie] ?? 0;
    const ugb = a.nombre * facteur;
    apportsN += ugb * (config.apportNParUgb[a.categorie] ?? 0);
    apportsP += ugb * (config.apportPParUgb[a.categorie] ?? 0);
  }

  const soldeN = apportsN - besoinsN;
  const soldeP = apportsP - besoinsP;
  const seuilN = besoinsN * config.tolerance;
  const seuilP = besoinsP * config.tolerance;

  return {
    apportsN: Math.round(apportsN * 10) / 10,
    apportsP: Math.round(apportsP * 10) / 10,
    besoinsN: Math.round(besoinsN * 10) / 10,
    besoinsP: Math.round(besoinsP * 10) / 10,
    soldeN: Math.round(soldeN * 10) / 10,
    soldeP: Math.round(soldeP * 10) / 10,
    conformeN: soldeN <= seuilN,
    conformeP: soldeP <= seuilP,
    details,
    culturesInconnues: [...culturesInconnuesSet],
  };
}
