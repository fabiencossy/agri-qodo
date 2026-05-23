import type { ReactNode } from 'react';
import { useParametresMobileSelector } from '../parametres.context';

export function SectionCard({
  title,
  description,
  children,
  actions,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const mobileSelector = useParametresMobileSelector();
  const hasHeader = Boolean(title || actions);
  return (
    <section className="relative rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-5">
      {/* Engrenage paramètres : top-right absolu, hors flux du header pour ne
          pas se mélanger aux `actions` ni wrapper sur viewport étroit. */}
      {mobileSelector && (
        <div className="absolute right-3 top-3 z-10 md:hidden">{mobileSelector}</div>
      )}
      {hasHeader && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2 pr-12 md:pr-0">
          <div>
            {title && (
              <h2 className="m-0 text-sm font-semibold tracking-wider text-(--color-muted) uppercase">
                {title}
              </h2>
            )}
            {description && (
              <p className="m-0 mt-0.5 text-xs text-(--color-muted)">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium">
        {label}
        {required && <span className="text-(--color-error)"> *</span>}
      </label>
      {children}
      {hint && <p className="m-0 mt-1 text-[11px] text-(--color-muted)">{hint}</p>}
    </div>
  );
}

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={[
        'inline-flex h-9 items-center gap-1.5 rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-3 text-xs font-medium text-white hover:bg-(--color-primary-hover) disabled:opacity-50',
        props.className ?? '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={[
        'inline-flex h-9 items-center gap-1.5 rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 text-xs font-medium hover:bg-[#f8f8f5] disabled:opacity-50',
        props.className ?? '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={[
        'inline-flex h-9 items-center gap-1.5 rounded-(--radius) border border-(--color-error)/30 bg-[#fef2f2] px-3 text-xs font-medium text-(--color-error) hover:bg-[#fee2e2] disabled:opacity-50',
        props.className ?? '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="m-0 py-10 text-center text-sm text-(--color-muted)">{children}</p>;
}
