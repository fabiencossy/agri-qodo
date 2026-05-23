/**
 * ExportButton — Export d'une liste/table en PDF / CSV / XLSX.
 * Spec : Phase0_Components/ExportButton/ExportButton_CHECKLIST.md
 *
 * - 1 format : bouton direct
 * - >1 format : dropdown menu
 * - PDF : logo Qodo + titre + filtres + timestamp
 * - CSV : séparateur ';' + BOM UTF-8 (compat Excel FR)
 */

export type ExportFormat = 'pdf' | 'csv' | 'xlsx';

export interface ExportColumn {
  /** Clé de la colonne dans `data`. */
  key: string;
  /** Libellé affiché en en-tête. */
  label: string;
  /** Formateur optionnel. */
  format?: (value: unknown, row: Record<string, unknown>) => string;
  /** Largeur en px (Excel/PDF). */
  widthPx?: number;
  /** Alignement (PDF/Excel). Défaut 'left'. */
  align?: 'left' | 'right' | 'center';
}

export interface ExportPdfMeta {
  /** Titre principal. */
  title: string;
  /** Sous-titre optionnel. */
  subtitle?: string;
  /** Libellés des filtres appliqués. */
  appliedFilters?: string[];
  /** URL du logo (path SVG/PNG ou dataURL). Défaut : logo Qodo bundled. */
  logoUrl?: string;
  /** Footer custom (sinon : pagination + timestamp). */
  footer?: string;
}

export interface ExportButtonProps {
  /** Données à exporter. */
  data: ReadonlyArray<Record<string, unknown>>;
  /** Colonnes à inclure. Si omis : toutes les clés du premier item. */
  columns?: ExportColumn[];
  /** Formats disponibles. Si 1 seul → bouton direct, sinon dropdown. Défaut : tous. */
  formats?: ExportFormat[];
  /** Préfixe de filename. Date YYYY-MM-DD ajoutée automatiquement. */
  filenameBase: string;
  /** Métadonnées PDF. */
  pdfMeta?: ExportPdfMeta;
  /** Désactive le bouton. */
  disabled?: boolean;
  /** Callback avant export (validation). Return false pour annuler. */
  onBeforeExport?: (format: ExportFormat) => boolean | Promise<boolean>;
  /** Callback après export réussi. */
  onExported?: (format: ExportFormat, filename: string) => void;
  /** Callback en cas d'erreur. */
  onError?: (format: ExportFormat, error: Error) => void;
  /** Label ARIA + tooltip du bouton. Défaut 'Exporter'. */
  label?: string;
  /** Classe CSS optionnelle. */
  className?: string;
  /** Items custom affichés au-dessus des formats d'export (séparateur entre). */
  extraActions?: ReadonlyArray<{
    id: string;
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  }>;
}

export const EXPORT_DEFAULTS = {
  formats: ['pdf', 'xlsx', 'csv'] as ExportFormat[],
  csvSeparator: ';' as ',' | ';',
  csvUtf8Bom: true,
};

export const FORMAT_LABELS: Record<ExportFormat, string> = {
  pdf: 'PDF',
  xlsx: 'Excel (.xlsx)',
  csv: 'CSV',
};

export const FORMAT_HINTS: Record<ExportFormat, string> = {
  pdf: 'mise en forme',
  xlsx: 'données',
  csv: 'brut',
};
