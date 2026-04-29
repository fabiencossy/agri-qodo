/**
 * Parsing d'un export CSV BDTA / Identitas en attendant la mise en
 * place du contrat d'interface AnimalTracing (cf docs/identitas/).
 *
 * L'agriculteur télécharge l'extraction de son cheptel sur le portail
 * Agate ; on l'importe ici. Le format n'est pas figé (Excel CH par
 * défaut `;`, parfois `,` pour les exports anglo-saxons), donc :
 *   - on auto-détecte le séparateur
 *   - on auto-détecte les colonnes via mots-clés FR/DE/EN
 *   - on parse les dates au format DD.MM.YYYY (CH) ou ISO
 *
 * Module pur (pas d'I/O) — réutilisable côté mobile offline et
 * testable sans base de données.
 */

import type { AnimalCategorie } from "./ugb";

const COLONNES = {
  numeroBoucle: ["boucle", "ohrmarke", "ohrmark", "ear", "marque"],
  sexe: ["sexe", "geschlecht", "sex"],
  dateNaissance: ["naissance", "geburt", "birth"],
  race: ["race", "rasse", "breed"],
  nom: ["nom", "name"],
} as const;

export type ColonneBdta = keyof typeof COLONNES;

export interface BdtaImportRow {
  numeroBoucle: string;
  /** Catégorie déduite de sexe + âge ; AUTRE_BOVIN en fallback. */
  categorie: AnimalCategorie;
  nom: string | null;
  dateNaissance: Date | null;
  race: string | null;
  /** Numéro de ligne dans le CSV source (1-indexé sans le header). */
  ligne: number;
}

export interface BdtaImportError {
  ligne: number;
  raison: string;
  contenu: string;
}

export interface BdtaImportResult {
  separateur: ";" | ",";
  colonnes: Partial<Record<ColonneBdta, number>>;
  rows: BdtaImportRow[];
  errors: BdtaImportError[];
}

/** Auto-détection du séparateur sur la première ligne non vide. */
export function detecterSeparateur(csv: string): ";" | "," {
  const premiere = csv.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const semis = (premiere.match(/;/g) ?? []).length;
  const virgules = (premiere.match(/,/g) ?? []).length;
  return semis >= virgules ? ";" : ",";
}

/** Parse une ligne CSV en respectant les guillemets. */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

/** Repère l'index de chaque colonne attendue dans le header normalisé. */
function detecterColonnes(header: string[]): Partial<Record<ColonneBdta, number>> {
  const norm = header.map((h) => h.toLowerCase().trim());
  const out: Partial<Record<ColonneBdta, number>> = {};
  for (const [colKey, motsCles] of Object.entries(COLONNES) as [ColonneBdta, readonly string[]][]) {
    const idx = norm.findIndex((h) => motsCles.some((mc) => h.includes(mc)));
    if (idx >= 0) out[colKey] = idx;
  }
  return out;
}

/** Date DD.MM.YYYY (CH/DE), DD/MM/YYYY (FR), YYYY-MM-DD (ISO). */
export function parseDateBdta(s: string): Date | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const ch = /^(\d{2})[./](\d{2})[./](\d{4})$/.exec(trimmed);
  if (ch) {
    const d = new Date(`${ch[3]}-${ch[2]}-${ch[1]}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Normalise sexe BDTA : M/F/MALE/FEMELLE/MÄNNLICH/WEIBLICH → "M" | "F" | null. */
export function parseSexe(s: string): "M" | "F" | null {
  const v = s.trim().toLowerCase();
  if (!v) return null;
  if (v.startsWith("m")) return "M";
  if (v.startsWith("f") || v.startsWith("w")) return "F";
  return null;
}

/**
 * Mapping sexe + âge → catégorie bovine selon l'usage courant (la BDTA
 * ne distingue pas vache laitière/allaitante ; l'utilisateur ajuste
 * après import si besoin via l'UI cheptel).
 */
export function mapperCategorie(
  sexe: "M" | "F" | null,
  dateNaissance: Date | null,
  reference: Date = new Date(),
): AnimalCategorie {
  if (!sexe || !dateNaissance) return "AUTRE_BOVIN";
  const ageAns = (reference.getTime() - dateNaissance.getTime()) / (365.25 * 86_400_000);
  if (ageAns < 1) return "VEAU";
  if (sexe === "M") {
    return "BOEUF"; // pas de moyen de distinguer taureau d'élevage côté CSV BDTA
  }
  if (ageAns < 2) return "GENISSE";
  return "VACHE_LAITIERE";
}

export interface ParseBdtaOptions {
  reference?: Date;
}

export function parseBdtaCsv(csv: string, options: ParseBdtaOptions = {}): BdtaImportResult {
  const reference = options.reference ?? new Date();
  const separateur = detecterSeparateur(csv);
  const lignes = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);

  const headerLine = lignes[0];
  if (lignes.length < 2 || !headerLine) {
    return { separateur, colonnes: {}, rows: [], errors: [] };
  }

  const headerCells = splitCsvLine(headerLine, separateur);
  const colonnes = detecterColonnes(headerCells);

  const rows: BdtaImportRow[] = [];
  const errors: BdtaImportError[] = [];

  if (colonnes.numeroBoucle === undefined) {
    return {
      separateur,
      colonnes,
      rows: [],
      errors: [
        {
          ligne: 1,
          raison: "Colonne 'n° de boucle / Ohrmarke / ear tag' introuvable dans l'en-tête CSV.",
          contenu: headerLine,
        },
      ],
    };
  }

  for (let i = 1; i < lignes.length; i++) {
    const ligneSource = lignes[i] ?? "";
    const cells = splitCsvLine(ligneSource, separateur);
    const numeroBoucle = (cells[colonnes.numeroBoucle] ?? "").trim();
    if (!numeroBoucle) {
      errors.push({ ligne: i, raison: "n° de boucle vide", contenu: ligneSource });
      continue;
    }
    const sexe = colonnes.sexe !== undefined ? parseSexe(cells[colonnes.sexe] ?? "") : null;
    const dateNaissance =
      colonnes.dateNaissance !== undefined
        ? parseDateBdta(cells[colonnes.dateNaissance] ?? "")
        : null;
    const race = colonnes.race !== undefined ? cells[colonnes.race]?.trim() || null : null;
    const nom = colonnes.nom !== undefined ? cells[colonnes.nom]?.trim() || null : null;
    rows.push({
      numeroBoucle,
      categorie: mapperCategorie(sexe, dateNaissance, reference),
      nom,
      dateNaissance,
      race,
      ligne: i,
    });
  }

  return { separateur, colonnes, rows, errors };
}
