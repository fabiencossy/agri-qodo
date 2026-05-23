import { EXPORT_DEFAULTS, type ExportColumn } from './ExportButton.types';

/* ============================================================
 * Helpers communs
 * ============================================================ */

/** Construit le filename avec date du jour. */
export function buildFilename(
  base: string,
  format: 'pdf' | 'csv' | 'xlsx',
  hasFilters = false,
): string {
  const date = new Date().toISOString().slice(0, 10);
  const suffix = hasFilters ? '_filtered' : '';
  return `${base}_${date}${suffix}.${format}`;
}

/** Déduit les colonnes à partir des clés du premier item. */
export function deriveColumns(data: ReadonlyArray<Record<string, unknown>>): ExportColumn[] {
  if (data.length === 0) return [];
  const first = data[0]!;
  return Object.keys(first).map((key) => ({ key, label: key }));
}

/** Échappe une cellule CSV en respectant RFC 4180. */
function escapeCsvCell(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  const text = raw instanceof Date ? raw.toISOString() : String(raw);
  // Double les guillemets ; entoure si caractère spécial
  if (/[";\n,\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/* ============================================================
 * CSV — génération native (pas de dépendance)
 * ============================================================ */

export function generateCsv(
  data: ReadonlyArray<Record<string, unknown>>,
  columns: ExportColumn[],
  separator: ',' | ';' = EXPORT_DEFAULTS.csvSeparator,
): string {
  const header = columns.map((c) => escapeCsvCell(c.label)).join(separator);
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const raw = row[col.key];
        const formatted = col.format ? col.format(raw, row) : raw;
        return escapeCsvCell(formatted);
      })
      .join(separator),
  );
  return [header, ...rows].join('\r\n');
}

/** Déclenche un téléchargement navigateur depuis un Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Petit délai pour assurer le téléchargement avant revoke
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCsv(
  data: ReadonlyArray<Record<string, unknown>>,
  columns: ExportColumn[],
  filename: string,
  options: { separator?: ',' | ';'; bom?: boolean } = {},
): void {
  const sep = options.separator ?? EXPORT_DEFAULTS.csvSeparator;
  const bom = options.bom ?? EXPORT_DEFAULTS.csvUtf8Bom;
  const csv = generateCsv(data, columns, sep);
  const content = bom ? '﻿' + csv : csv;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, filename);
}

/* ============================================================
 * PDF — jspdf + jspdf-autotable
 * ============================================================ */

function formatCell(raw: unknown, row: Record<string, unknown>, col: ExportColumn): string {
  const value = col.format ? col.format(raw, row) : raw;
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

export async function exportPdf(args: {
  data: ReadonlyArray<Record<string, unknown>>;
  columns: ExportColumn[];
  filename: string;
  title?: string;
}): Promise<void> {
  // Imports dynamiques : libs PDF chargées seulement au premier export.
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const { data, columns, filename, title } = args;

  // Orientation auto : portrait si ≤ 5 colonnes, sinon paysage.
  const orientation: 'portrait' | 'landscape' = columns.length > 5 ? 'landscape' : 'portrait';
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 32;

  // En-tête
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title ?? filename.replace(/\.pdf$/i, ''), margin, 36);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  const subtitle = `${data.length} ligne(s) — généré le ${new Date().toLocaleString('fr-CH')}`;
  doc.text(subtitle, margin, 50);
  doc.setTextColor(0, 0, 0);

  // Tableau
  const head = [columns.map((c) => c.label)];
  const body = data.map((row) => columns.map((col) => formatCell(row[col.key], row, col)));

  autoTable(doc, {
    startY: 64,
    head,
    body,
    margin: { left: margin, right: margin },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [46, 125, 50], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 246] },
    columnStyles: Object.fromEntries(
      columns.map((c, i) => [
        i,
        {
          halign: c.align === 'right' ? 'right' : c.align === 'center' ? 'center' : 'left',
        },
      ]),
    ),
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      const page = data.pageNumber;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(
        `Agri Qodo · page ${page} / ${pageCount}`,
        pageWidth - margin,
        doc.internal.pageSize.getHeight() - 16,
        { align: 'right' },
      );
      doc.setTextColor(0, 0, 0);
    },
  });

  doc.save(filename);
}

/* ============================================================
 * XLSX — stub (lib exceljs à brancher)
 * ============================================================ */

export async function exportXlsx(_args: {
  data: ReadonlyArray<Record<string, unknown>>;
  columns: ExportColumn[];
  filename: string;
}): Promise<void> {
  // TODO Phase 1 : intégrer exceljs.
  await new Promise((r) => setTimeout(r, 400));
  throw new Error('Export Excel pas encore implémenté (lib exceljs à brancher).');
}
