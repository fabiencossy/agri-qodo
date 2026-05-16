import { useMemo, useState } from 'react';
import { CULTURES, type CultureCategory } from '../../assolement/cultures';
import { SectionCard, EmptyState } from './_shared';
import { inputClass } from './_styles';

const CATEGORY_LABELS: Record<CultureCategory, string> = {
  cereal: 'Céréales',
  oilseed: 'Oléagineux',
  protein: 'Protéagineux',
  root: 'Sarclées / racines',
  forage: 'Prairies & fourrages',
  biodiversity: 'Biodiversité / SPB',
  special: 'Cultures spéciales',
  cover: 'Couverts végétaux',
  fallow: 'Jachères / sol nu',
  other: 'Autres',
};

export function CulturesSection() {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<CultureCategory | 'all'>('all');

  const filtered = useMemo(() => {
    const lc = search.toLowerCase().trim();
    return CULTURES.filter((c) => {
      if (cat !== 'all' && c.category !== cat) return false;
      if (!lc) return true;
      return c.label.toLowerCase().includes(lc) || c.key.toLowerCase().includes(lc);
    });
  }, [search, cat]);

  const byCategory = useMemo(() => {
    const map = new Map<CultureCategory, (typeof CULTURES)[number][]>();
    for (const c of filtered) {
      const arr = map.get(c.category) ?? [];
      arr.push(c);
      map.set(c.category, arr);
    }
    return map;
  }, [filtered]);

  return (
    <SectionCard
      title={`Catalogue Agridéa — ${filtered.length} cultures`}
      description="Cultures suisses de référence avec leur couleur d'affichage. Lecture seule en MVP (le catalogue est figé par Agridéa)."
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une culture"
          className={`${inputClass} max-w-xs`}
        />
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value as CultureCategory | 'all')}
          className={`${inputClass} max-w-xs`}
        >
          <option value="all">Toutes catégories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState>Aucune culture ne correspond à cette recherche.</EmptyState>
      ) : (
        <div className="space-y-5">
          {[...byCategory.entries()].map(([category, cultures]) => (
            <div key={category}>
              <h3 className="m-0 mb-2 text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
                {CATEGORY_LABELS[category]} ({cultures.length})
              </h3>
              <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 md:grid-cols-3">
                {cultures.map((c) => (
                  <li
                    key={c.key}
                    className="flex items-center gap-2 rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-xs"
                  >
                    <span
                      className="inline-block h-4 w-4 shrink-0 rounded-(--radius-pill) border border-black/10"
                      style={{ background: c.color }}
                      aria-hidden
                    />
                    <span className="truncate font-medium">{c.label}</span>
                    <span className="ml-auto truncate text-[10px] text-(--color-muted)">
                      {c.key}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
