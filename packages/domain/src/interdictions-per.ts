/**
 * Interdictions PER (M3v6) — calendrier des périodes interdites
 * d'épandage selon Méthode Agridea 1.18 + ORRChim.
 *
 * Règle générale :
 *   - FUMURE_ORGANIQUE interdite en hiver pour limiter le lessivage.
 *   - Plaine (ZA, ZP) : 15 nov → 15 fév
 *   - Montagne (ZM1-4) : 1 nov → 28 fév (variable selon canton)
 *   - Zone d'estivage (ZE) : 1 oct → 30 avr
 *
 * Les dates sont au format "MM-DD" pour faciliter la lecture.
 * Les périodes peuvent traverser le 1er janvier (ex: "11-15" → "02-15").
 */

export interface PeriodeInterdite {
  /** Format MM-DD (ex: "11-15" pour le 15 novembre). */
  debut: string;
  /** Format MM-DD (ex: "02-15" pour le 15 février). */
  fin: string;
  /** Raison affichée à l'utilisateur. */
  raison: string;
}

export interface InterdictionsPerConfig {
  /**
   * Périodes interdites pour FUMURE_ORGANIQUE par zone agricole.
   * Si zone non listée, pas d'interdiction calendaire automatique.
   */
  fumureOrganiqueParZone: Record<string, PeriodeInterdite[]>;
}

/**
 * Configuration par défaut alignée sur ORRChim + Méthode Agridea (Plateau).
 * À adapter par canton via le rule engine si besoin.
 */
export const DEFAULT_INTERDICTIONS_CONFIG: InterdictionsPerConfig = {
  fumureOrganiqueParZone: {
    ZA: [
      {
        debut: "11-15",
        fin: "02-15",
        raison: "Période hivernale interdite pour fumure organique (Plateau, ZA — ORRChim).",
      },
    ],
    ZP: [
      {
        debut: "11-15",
        fin: "02-15",
        raison: "Période hivernale interdite pour fumure organique (Prairies, ZP — ORRChim).",
      },
    ],
    ZM1: [
      {
        debut: "11-01",
        fin: "02-28",
        raison: "Période hivernale interdite pour fumure organique (Montagne I — ORRChim).",
      },
    ],
    ZM2: [
      {
        debut: "11-01",
        fin: "03-15",
        raison: "Période hivernale interdite pour fumure organique (Montagne II — ORRChim).",
      },
    ],
    ZM3: [
      {
        debut: "10-15",
        fin: "03-31",
        raison: "Période hivernale interdite pour fumure organique (Montagne III — ORRChim).",
      },
    ],
    ZM4: [
      {
        debut: "10-15",
        fin: "04-15",
        raison: "Période hivernale interdite pour fumure organique (Montagne IV — ORRChim).",
      },
    ],
    ZE: [
      {
        debut: "10-01",
        fin: "04-30",
        raison: "Estivage — fumure organique interdite hors saison de pâturage.",
      },
    ],
  },
};

export interface InterdictionResult {
  interdit: boolean;
  raison: string | null;
  /** Date de fin de l'interdiction (ISO YYYY-MM-DD), pour informer l'utilisateur. */
  prochaineFenetreOuverture: string | null;
}

/**
 * Vérifie si la fumure organique est interdite à `date` pour la `zone` donnée.
 *
 * @param date Date de l'épandage prévu.
 * @param zone Zone agricole ZA / ZP / ZM1-4 / ZE.
 */
export function estFumureOrganiqueInterdite(
  date: Date,
  zone: string,
  config: InterdictionsPerConfig = DEFAULT_INTERDICTIONS_CONFIG,
): InterdictionResult {
  const periodes = config.fumureOrganiqueParZone[zone];
  if (!periodes || periodes.length === 0) {
    return { interdit: false, raison: null, prochaineFenetreOuverture: null };
  }

  const month = date.getUTCMonth() + 1; // 1-12
  const day = date.getUTCDate();
  const mmdd = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  for (const periode of periodes) {
    if (estDansPeriode(mmdd, periode.debut, periode.fin)) {
      const finPeriodeIso = construireProchaineFenetre(date, periode.fin);
      return {
        interdit: true,
        raison: periode.raison,
        prochaineFenetreOuverture: finPeriodeIso,
      };
    }
  }
  return { interdit: false, raison: null, prochaineFenetreOuverture: null };
}

/**
 * `mmdd` est-il dans la période [debut, fin] ? Gère les périodes qui
 * traversent le 1er janvier (ex: "11-15" → "02-15").
 */
function estDansPeriode(mmdd: string, debut: string, fin: string): boolean {
  if (debut <= fin) {
    // Période simple dans l'année
    return mmdd >= debut && mmdd <= fin;
  }
  // Période qui traverse le nouvel an : actif si après debut OU avant fin
  return mmdd >= debut || mmdd <= fin;
}

/**
 * Calcule la date ISO de réouverture (lendemain de la fin d'interdiction).
 */
function construireProchaineFenetre(dateRef: Date, finMmDd: string): string {
  const [m, d] = finMmDd.split("-").map(Number);
  if (!m || !d) return "";
  const refMonth = dateRef.getUTCMonth() + 1;
  let year = dateRef.getUTCFullYear();
  // Si on est avant la fin dans la même année, c'est cette année.
  // Sinon (ex: novembre, fin = février), c'est l'année suivante.
  if (refMonth > m) year += 1;
  // Lendemain de fin (autorisé)
  const fin = new Date(Date.UTC(year, m - 1, d + 1));
  return fin.toISOString().slice(0, 10);
}
