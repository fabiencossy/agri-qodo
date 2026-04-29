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
  /**
   * Apport atmosphérique d'azote en kg N / ha / an.
   * Méthode Agridea : ~20 kg N/ha en Plateau, jusqu'à 30 en zones humides.
   * Source : OFAG/OFEV — déposition atmosphérique azote agriculture suisse.
   */
  apportAtmospheriqueN: number;
  /**
   * Fixation symbiotique d'azote par les légumineuses (kg N / ha / an).
   * Indexé par espèce. Le besoin N correspondant est annulé (la culture
   * fixe l'azote dont elle a besoin). Source : Guide Agridea 1.18.
   */
  fixationLegumineuses: Record<string, number>;
  /**
   * Pertes NH3 à l'épandage par technique (taux 0-1).
   * Source : Guide Agridea 1.18, table NH3-volatilisation.
   * Ne s'applique qu'aux FUMURE_ORGANIQUE (lisier, fumier).
   */
  pertesNH3ParTechnique: Record<string, number>;
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
  apportAtmospheriqueN: 20,
  fixationLegumineuses: {
    luzerne: 250,
    trefle_blanc: 150,
    trefle_violet: 200,
    soja: 100,
    pois_proteagineux: 80,
    feverole: 100,
    haricot: 60,
    prairie_legumineuse: 150,
  },
  pertesNH3ParTechnique: {
    EPANDEUR_CLASSIQUE: 0.3,
    RAMPE_PENDILLARDE: 0.15,
    TRAINEE_SOUPLE: 0.1,
    INJECTION: 0.05,
    FUMIER_SOLIDE: 0.25,
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
 *
 * `categorie` permet de séparer minéraux vs organiques achetés dans le
 * détail "origine des apports" du bilan PER.
 */
export interface ApportEngrais {
  parcelleId: string;
  kgN: number;
  kgP: number;
  categorie?: "ENGRAIS_MINERAL" | "ENGRAIS_ORGANIQUE";
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
  /** Apports d'engrais saisis sur la parcelle (kg N). */
  apportsN: number;
  /** Apports d'engrais saisis sur la parcelle (kg P). */
  apportsP: number;
  /** Solde N (apports - besoin) sur cette parcelle. */
  soldeN: number;
  /** Solde P (apports - besoin) sur cette parcelle. */
  soldeP: number;
}

/**
 * Décomposition des apports par origine — visible dans le bilan PER.
 * Tous en kg / an pour l'exploitation entière.
 */
export interface OrigineApports {
  /** Engrais minéraux (urée, NPK, etc.) saisis comme FUMURE_MINERALE. */
  engraisMinerauxN: number;
  engraisMinerauxP: number;
  /** Engrais organiques achetés (compost, lisier extérieur) saisis comme FUMURE_ORGANIQUE. */
  engraisOrganiquesAchetesN: number;
  engraisOrganiquesAchetesP: number;
  /** Déjections du cheptel (UGB × coeff Agridea, déjà nettes des pertes étable). */
  dejectionsCheptelN: number;
  dejectionsCheptelP: number;
  /** Apport atmosphérique (déposition azotée moyenne × surface totale). */
  atmospheriqueN: number;
  /** Fixation symbiotique des légumineuses (kg N par culture × surface). */
  fixationLegumineusesN: number;
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
  /** Décomposition des apports par origine (cheptel, engrais saisis, atmo, fixation). */
  origineApports: OrigineApports;
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

  // Apports saisis localisés par parcelle (engrais minéraux + organiques).
  const apportsParParcelle = new Map<string, { kgN: number; kgP: number }>();
  for (const a of input.apportsEngrais) {
    const cur = apportsParParcelle.get(a.parcelleId) ?? { kgN: 0, kgP: 0 };
    cur.kgN += a.kgN;
    cur.kgP += a.kgP;
    apportsParParcelle.set(a.parcelleId, cur);
  }

  // Besoins + détail par parcelle (avec apports localisés).
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
    const apport = apportsParParcelle.get(c.parcelleId) ?? { kgN: 0, kgP: 0 };
    besoinsN += besoinN;
    besoinsP += besoinP;
    details.push({
      parcelleId: c.parcelleId,
      parcelleNom: c.parcelleNom,
      surfaceHa: c.surfaceHa,
      espece: c.espece,
      besoinN: round1(besoinN),
      besoinP: round1(besoinP),
      apportsN: round1(apport.kgN),
      apportsP: round1(apport.kgP),
      soldeN: round1(apport.kgN - besoinN),
      soldeP: round1(apport.kgP - besoinP),
    });
  }

  // Décomposition des apports par origine (pour le bilan PER détaillé).
  let engraisMinerauxN = 0;
  let engraisMinerauxP = 0;
  let engraisOrganiquesAchetesN = 0;
  let engraisOrganiquesAchetesP = 0;
  for (const a of input.apportsEngrais) {
    if (a.categorie === "ENGRAIS_ORGANIQUE") {
      engraisOrganiquesAchetesN += a.kgN;
      engraisOrganiquesAchetesP += a.kgP;
    } else {
      // ENGRAIS_MINERAL ou non typé → catégorisé minéral par défaut
      engraisMinerauxN += a.kgN;
      engraisMinerauxP += a.kgP;
    }
  }

  let dejectionsCheptelN = 0;
  let dejectionsCheptelP = 0;
  for (const a of input.animaux) {
    const facteur = config.facteurUgb[a.categorie] ?? 0;
    const ugb = a.nombre * facteur;
    dejectionsCheptelN += ugb * (config.apportNParUgb[a.categorie] ?? 0);
    dejectionsCheptelP += ugb * (config.apportPParUgb[a.categorie] ?? 0);
  }

  // Apport atmosphérique : forfait par hectare cultivé.
  const surfaceTotaleHa = input.cultures.reduce((sum, c) => sum + c.surfaceHa, 0);
  const atmospheriqueN = config.apportAtmospheriqueN * surfaceTotaleHa;

  // Fixation symbiotique des légumineuses (azote uniquement).
  let fixationLegumineusesN = 0;
  for (const c of input.cultures) {
    const fix = config.fixationLegumineuses[c.espece];
    if (fix !== undefined) {
      fixationLegumineusesN += fix * c.surfaceHa;
    }
  }

  const apportsN =
    engraisMinerauxN +
    engraisOrganiquesAchetesN +
    dejectionsCheptelN +
    atmospheriqueN +
    fixationLegumineusesN;
  const apportsP = engraisMinerauxP + engraisOrganiquesAchetesP + dejectionsCheptelP;

  const soldeN = apportsN - besoinsN;
  const soldeP = apportsP - besoinsP;
  const seuilN = besoinsN * config.tolerance;
  const seuilP = besoinsP * config.tolerance;

  return {
    apportsN: round1(apportsN),
    apportsP: round1(apportsP),
    besoinsN: round1(besoinsN),
    besoinsP: round1(besoinsP),
    soldeN: round1(soldeN),
    soldeP: round1(soldeP),
    conformeN: soldeN <= seuilN,
    conformeP: soldeP <= seuilP,
    details,
    origineApports: {
      engraisMinerauxN: round1(engraisMinerauxN),
      engraisMinerauxP: round1(engraisMinerauxP),
      engraisOrganiquesAchetesN: round1(engraisOrganiquesAchetesN),
      engraisOrganiquesAchetesP: round1(engraisOrganiquesAchetesP),
      dejectionsCheptelN: round1(dejectionsCheptelN),
      dejectionsCheptelP: round1(dejectionsCheptelP),
      atmospheriqueN: round1(atmospheriqueN),
      fixationLegumineusesN: round1(fixationLegumineusesN),
    },
    culturesInconnues: [...culturesInconnuesSet],
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
