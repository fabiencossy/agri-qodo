/**
 * Export CSV générique compatible Excel (CH/FR).
 *
 * - Séparateur **point-virgule** (Excel européen ouvre un .csv en colonnes
 *   séparées par ; alors que , casse l'affichage en France/Suisse).
 * - **BOM UTF-8** en tête (codepoint U+FEFF) → Excel détecte l'encodage
 *   et affiche correctement les accents.
 * - Échappement RFC 4180 : valeurs avec `;`, `"`, `\n` → encadrées de `"`,
 *   `"` interne doublé en `""`.
 * - Téléchargement via Blob + lien temporaire (pas de dépendance lib).
 */

const BOM_UTF8 = "﻿";

export interface CsvColumn<T> {
  /** En-tête de la colonne dans le fichier exporté. */
  header: string;
  /** Extrait la valeur depuis l'item. Renvoie string | number | null/undef. */
  value: (item: T) => string | number | null | undefined;
}

function escapeCell(raw: unknown): string {
  if (raw == null) return "";
  const s = String(raw);
  // Si la cellule contient un séparateur, un guillemet, un retour ligne,
  // on l'encadre de guillemets et on double les " internes.
  if (/[;"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Construit le contenu CSV (avec BOM) à partir d'une liste typée. */
export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const headerLine = columns.map((c) => escapeCell(c.header)).join(";");
  const dataLines = rows.map((r) => columns.map((c) => escapeCell(c.value(r))).join(";"));
  return BOM_UTF8 + [headerLine, ...dataLines].join("\r\n");
}

/**
 * Déclenche un téléchargement immédiat du fichier CSV.
 * `baseFilename` : sans extension. La date du jour est ajoutée
 * automatiquement (ex: `parcelles-2026-04-30.csv`).
 */
export function downloadCsv<T>(baseFilename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const csv = buildCsv(rows, columns);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const today = new Date().toISOString().slice(0, 10);
  const filename = `${baseFilename}-${today}.csv`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
