import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  AlertIcon,
  CheckIcon,
  FileCsvIcon,
  FilePdfIcon,
  FileXlsxIcon,
  MoreVerticalIcon,
} from './icons';
import { buildFilename, deriveColumns, exportCsv, exportPdf, exportXlsx } from './generators';
import {
  EXPORT_DEFAULTS,
  FORMAT_HINTS,
  FORMAT_LABELS,
  type ExportButtonProps,
  type ExportFormat,
} from './ExportButton.types';

const FORMAT_ICON: Record<ExportFormat, React.ComponentType<{ size?: number }>> = {
  pdf: FilePdfIcon,
  xlsx: FileXlsxIcon,
  csv: FileCsvIcon,
};

interface ToastMsg {
  kind: 'success' | 'error';
  text: string;
}

export function ExportButton({
  data,
  columns,
  formats = EXPORT_DEFAULTS.formats,
  filenameBase,
  pdfMeta,
  disabled = false,
  onBeforeExport,
  onExported,
  onError,
  label = 'Exporter',
  className,
  extraActions = [],
}: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [busyFormat, setBusyFormat] = useState<ExportFormat | null>(null);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const isBusy = busyFormat !== null;
  // Si on a des extraActions (ex. import), le menu reste ouvrable même sans data.
  const isDisabled = (disabled || data.length === 0) && extraActions.length === 0;

  // Fermer au clic extérieur / Esc
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const runExport = useCallback(
    async (format: ExportFormat) => {
      if (isDisabled || isBusy) return;
      if (onBeforeExport) {
        const ok = await onBeforeExport(format);
        if (ok === false) return;
      }

      const effectiveColumns = columns ?? deriveColumns(data);
      const filename = buildFilename(filenameBase, format);

      setBusyFormat(format);
      try {
        if (format === 'csv') {
          exportCsv(data, effectiveColumns, filename);
        } else if (format === 'pdf') {
          await exportPdf({
            data,
            columns: effectiveColumns,
            filename,
            title: pdfMeta?.title ?? filenameBase,
          });
        } else {
          await exportXlsx({ data, columns: effectiveColumns, filename });
        }
        setToast({ kind: 'success', text: `${filename} téléchargé` });
        onExported?.(format, filename);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setToast({ kind: 'error', text: error.message });
        onError?.(format, error);
      } finally {
        setBusyFormat(null);
        setOpen(false);
      }
    },
    [columns, data, filenameBase, isBusy, isDisabled, onBeforeExport, onError, onExported, pdfMeta],
  );

  /* ---------- Render ---------- */

  return (
    <div className={['relative inline-block', className ?? ''].join(' ')}>
      {/* Bouton kebab (3 dots) — même UI mobile et desktop */}
      <button
        ref={triggerRef}
        type="button"
        disabled={isDisabled || isBusy}
        aria-busy={isBusy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
        className={[
          'inline-flex h-10 w-10 items-center justify-center rounded-(--radius)',
          'border border-(--color-border) bg-(--color-surface) text-(--color-text)',
          'transition-colors hover:bg-[#f8f8f5]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          open ? 'bg-[#f1f1ee]' : '',
        ].join(' ')}
      >
        {isBusy ? <Spinner /> : <MoreVerticalIcon size={18} />}
      </button>

      {/* Dropdown menu (toujours visible quand open, single ou multi-format) */}
      {open && (
        <ul
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className="absolute right-0 z-[1200] mt-1 w-[260px] rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-1 shadow-(--shadow-popup)"
        >
          {extraActions.map((action) => (
            <li key={action.id}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  action.onClick();
                  setOpen(false);
                }}
                className="flex h-10 w-full items-center gap-2.5 rounded-(--radius-sm) px-3 text-sm hover:bg-[#f8f8f5]"
              >
                {action.icon && <span className="text-(--color-muted)">{action.icon}</span>}
                <span>{action.label}</span>
              </button>
            </li>
          ))}
          {extraActions.length > 0 && data.length > 0 && (
            <li aria-hidden="true" className="my-1 border-t border-(--color-border)" />
          )}
          {data.length > 0 &&
            formats.map((fmt) => {
              const Icon = FORMAT_ICON[fmt];
              return (
                <li key={fmt}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void runExport(fmt)}
                    className="flex h-10 w-full items-center gap-2.5 rounded-(--radius-sm) px-3 text-sm hover:bg-[#f8f8f5]"
                  >
                    <span className="text-(--color-muted)">
                      <Icon />
                    </span>
                    <span>{FORMAT_LABELS[fmt]}</span>
                    <span className="ml-auto text-xs text-(--color-muted)">
                      {FORMAT_HINTS[fmt]}
                    </span>
                  </button>
                </li>
              );
            })}
        </ul>
      )}

      {/* Toast */}
      {toast && (
        <div
          role={toast.kind === 'error' ? 'alert' : 'status'}
          className={[
            'mt-2 inline-flex items-center gap-2 rounded-(--radius) border px-3 py-2 text-xs',
            toast.kind === 'success'
              ? 'border-[#c9e3bb] bg-[#ecf6e6] text-[#1a5e1a]'
              : 'border-[#f4c2c2] bg-[#fdecec] text-[#8a1c1c]',
          ].join(' ')}
        >
          {toast.kind === 'success' ? <CheckIcon /> : <AlertIcon />}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 animate-spin rounded-(--radius-pill) border-2 border-current border-r-transparent"
    />
  );
}
