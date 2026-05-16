import { useMemo, useState } from 'react';
import { useProducts, removeProduct } from '../../products/products.store';
import { ProductEditModal } from '../../products/ProductEditModal';
import type { Product, ProductType } from '../../products/products.types';
import { useCan } from '../../users/permissions';
import { SectionCard, PrimaryButton, SecondaryButton, DangerButton, EmptyState } from './_shared';
import { inputClass, selectClass } from './_styles';

const TYPE_LABELS: Record<ProductType, string> = {
  phyto: 'Phyto',
  fertilizer: 'Engrais',
  seed: 'Semences',
};

export function ProduitsSection() {
  const products = useProducts();
  const canWrite = useCan('parametres', 'admin');
  const [typeFilter, setTypeFilter] = useState<ProductType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{
    initial?: Partial<Product>;
    defaultType?: ProductType;
  } | null>(null);

  const filtered = useMemo(() => {
    const lc = search.toLowerCase().trim();
    return products
      .filter((p) => (typeFilter === 'all' ? true : p.type === typeFilter))
      .filter((p) => {
        if (!lc) return true;
        return (
          p.name.toLowerCase().includes(lc) ||
          (p.manufacturer ?? '').toLowerCase().includes(lc) ||
          (p.type === 'phyto' && p.ofagNumber.toLowerCase().includes(lc))
        );
      });
  }, [products, typeFilter, search]);

  const handleDelete = (p: Product) => {
    if (confirm(`Supprimer le produit ${p.name} du catalogue ?`)) {
      removeProduct(p.id);
    }
  };

  return (
    <SectionCard
      title={`${filtered.length} produit${filtered.length > 1 ? 's' : ''}`}
      actions={
        canWrite && (
          <PrimaryButton
            onClick={() =>
              setEditing({
                defaultType: typeFilter === 'all' ? 'phyto' : typeFilter,
              })
            }
          >
            + Nouveau produit
          </PrimaryButton>
        )
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (nom, fabricant, OFAG)"
          className={`${inputClass} max-w-sm`}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ProductType | 'all')}
          className={`${selectClass} max-w-xs`}
          aria-label="Filtrer par type"
        >
          <option value="all">Tous les types</option>
          <option value="phyto">Phyto</option>
          <option value="fertilizer">Engrais</option>
          <option value="seed">Semences</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState>Aucun produit pour ce filtre.</EmptyState>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) p-3"
            >
              <span
                className="inline-flex shrink-0 items-center rounded-(--radius-pill) bg-(--color-primary)/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-(--color-primary) uppercase"
                title={p.type}
              >
                {TYPE_LABELS[p.type]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {p.name}
                  {p.manufacturer && (
                    <span className="ml-1 text-(--color-muted)">· {p.manufacturer}</span>
                  )}
                </div>
                <div className="truncate text-[11px] text-(--color-muted)">
                  {productSubtitle(p)}
                </div>
              </div>
              <SecondaryButton onClick={() => setEditing({ initial: p })} disabled={!canWrite}>
                Modifier
              </SecondaryButton>
              {canWrite && (
                <DangerButton
                  onClick={() => handleDelete(p)}
                  aria-label={`Supprimer ${p.name}`}
                  className="!h-9 !w-9 !px-0 !justify-center"
                >
                  <TrashIcon />
                </DangerButton>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ProductEditModal
          initial={editing.initial}
          defaultType={editing.defaultType}
          onClose={() => setEditing(null)}
        />
      )}
    </SectionCard>
  );
}

function productSubtitle(p: Product): string {
  if (p.type === 'phyto') {
    return `${p.category} · OFAG ${p.ofagNumber} · délai ${p.withholdingDays}j`;
  }
  if (p.type === 'fertilizer') {
    const npk = `${p.nPerUnit}/${p.pPerUnit}/${p.kPerUnit}`;
    return `${p.category} · N/P/K = ${npk} (${p.defaultDoseUnit})`;
  }
  return `${p.cropName} · ${p.varietyName}${p.certified ? ' (certifiée)' : ''}`;
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
