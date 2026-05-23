import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useProducts, removeProduct } from '../../products/products.store';
import { ProductEditModal } from '../../products/ProductEditModal';
import type { Product, ProductType } from '../../products/products.types';
import { WORK_TYPES } from '../../travaux/travaux.catalog';
import type { WorkType } from '../../travaux/travaux.types';
import { useCan } from '../../users/permissions';
import { DataTable, type Column } from '../../../components/DataTable';
import { SearchBar, type FieldDescriptor, type SearchState } from '../../../components/SearchBar';
import type { ParametresOutletContext } from '../ParametresLayout';

type CatalogType = ProductType | 'prestation';

const TYPE_LABELS: Record<CatalogType, string> = {
  phyto: 'Phyto',
  fertilizer: 'Engrais',
  seed: 'Semences',
  prestation: 'Prestation',
};

const TYPE_BADGE_COLORS: Record<CatalogType, { bg: string; fg: string }> = {
  phyto: { bg: 'rgba(46, 125, 50, 0.10)', fg: '#166534' },
  fertilizer: { bg: 'rgba(124, 58, 237, 0.10)', fg: '#6d28d9' },
  seed: { bg: 'rgba(234, 88, 12, 0.10)', fg: '#c2410c' },
  prestation: { bg: 'rgba(220, 38, 38, 0.10)', fg: '#b91c1c' },
};

/**
 * Mapping fabricant → site web (engrais & semences). Permet de générer un
 * lien direct vers le site du fournisseur quand on connaît la marque.
 * Liste des principaux acteurs suisses ; complétable au fil de l'eau.
 */
/**
 * Catalogue produits par fournisseur. URLs pointent directement vers la page
 * produits/sortiment du site fabricant (plus utile que la racine corporate).
 * Note : aucun de ces sites n'expose un format URL stable pour lier
 * directement à une fiche produit via la ref → on lie au catalogue, l'agri
 * affine la recherche depuis le moteur du site.
 */
const MANUFACTURER_SITES: Record<string, string> = {
  // Engrais Suisse
  landor: 'https://www.landor.ch/sortiment',
  landi: 'https://www.landi.ch/landwirtschaft/duenger',
  agroline: 'https://www.agroline.ch/produkte/',
  hauert: 'https://www.hauert.com/de-CH/produkte',
  yara: 'https://www.yara.ch/fertilisation-vegetaux/produits/',
  'k+s': 'https://www.kpluss.com/fr-fr/produits/',
  ks: 'https://www.kpluss.com/fr-fr/produits/',
  icl: 'https://icl-sf.com/global-en/products/',
  everris: 'https://icl-sf.com/global-en/products/',
  // calmasil n'a pas de site officiel public — recherche Google en fallback
  // (la commande passe par les revendeurs Landi/Agroline/Hauert généralement).
  // Phyto
  bayer: 'https://agrar.bayer.ch/de-CH/Pflanzenschutz/Produkte%20A-Z',
  basf: 'https://www.agro.basf.ch/fr/Produits/',
  syngenta: 'https://www.syngenta.ch/produits',
  neudorff: 'https://www.neudorff.ch/produkte/',
  // Semences
  dsp: 'https://www.dsp-delley.ch/cms/sites/dsp/Varietes.html',
  'ufa semences': 'https://www.ufasamen.ch/de/produkte/',
  ufa: 'https://www.ufasamen.ch/de/produkte/',
  limagrain: 'https://www.lgseeds.ch/produits/',
  pioneer: 'https://www.pioneer.com/ch_FR/produits.html',
};

function manufacturerSite(manufacturer?: string): string | undefined {
  if (!manufacturer) return undefined;
  return MANUFACTURER_SITES[manufacturer.toLowerCase().trim()];
}

/**
 * Détecte le fournisseur depuis le préfixe d'une référence.
 * Convention : `FOURNISSEUR-XYZ`, `FOURNISSEUR:XYZ`, `FOURNISSEUR_XYZ`,
 * `FOURNISSEUR XYZ` ou `FOURNISSEUR/XYZ`. Préfixe matché case-insensitive
 * contre `MANUFACTURER_SITES`. Retourne `{ key, site }` ou undefined.
 *
 * Permet de lier auto sans que l'utilisateur saisisse le champ fabricant —
 * la ref seule suffit, ce qui colle avec un `default_code` Odoo standardisé.
 */
function detectManufacturerFromRef(ref?: string): { key: string; site: string } | undefined {
  if (!ref) return undefined;
  const trimmed = ref.trim();
  // Préfixe OFAG explicite → phyto (ex. "OFAG W-7239")
  const ofagMatch = /^OFAG[\s\-_:/]*W[\s\-_]?(\d+)/i.exec(trimmed);
  if (ofagMatch)
    return { key: 'ofag', site: `https://www.psm.admin.ch/fr/produkte/${ofagMatch[1]}` };
  // W-XXXX seul → phyto OFAG
  const wMatch = /^W[\s\-_]?(\d+)$/i.exec(trimmed);
  if (wMatch) return { key: 'ofag', site: `https://www.psm.admin.ch/fr/produkte/${wMatch[1]}` };
  // Préfixe alphanumérique suivi d'un séparateur, ex. "LANDOR-12345" → catalogue Landor
  const prefixMatch = /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9+&]*)\s*[-_:/\s]/.exec(trimmed);
  if (!prefixMatch) return undefined;
  const prefix = prefixMatch[1]!.toLowerCase();
  const site = MANUFACTURER_SITES[prefix];
  if (!site) return undefined;
  return { key: prefix, site };
}

/**
 * URL vers le catalogue produits du fournisseur. Si on connaît le site dans
 * MANUFACTURER_SITES, on y va directement (l'utilisateur affine la recherche
 * via le moteur du site). Sinon fallback Google ciblé `manufacturer + ref`.
 */
function manufacturerSearchUrl(manufacturer?: string, ref?: string): string | undefined {
  if (!manufacturer && !ref) return undefined;
  const site = manufacturerSite(manufacturer);
  if (site) return site;
  const q = [manufacturer, ref].filter(Boolean).join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/**
 * URL externe de vérification selon la référence.
 * - Phyto : fiche directe registre OFAG psm.admin.ch (numéro sans préfixe W-).
 * - Semences : registre Agroscope variétés grandes cultures (fallback).
 * - Engrais : site fabricant si connu, sinon recherche Google ciblée.
 */
function externalRefUrl(
  type: CatalogType,
  ref?: string,
  manufacturer?: string,
): string | undefined {
  if (!ref && !manufacturer) return undefined;
  // 1) Détection à partir du préfixe de la ref (convention `FOURNISSEUR-XYZ`).
  //    Couvre aussi OFAG W-XXXX → fiche phyto directe.
  const detected = detectManufacturerFromRef(ref);
  if (detected) {
    // Pour OFAG, `site` contient déjà l'URL de fiche directe ; sinon c'est
    // l'URL du catalogue fournisseur (déjà résolu via MANUFACTURER_SITES).
    return detected.site;
  }

  // 2) Fallback selon `type` + champ `manufacturer` (saisie manuelle existante).
  switch (type) {
    case 'phyto': {
      const numeric = ref?.replace(/^[wW]-?/, '').replace(/[^0-9]/g, '') ?? '';
      if (!numeric) return `https://www.psm.admin.ch/fr/produkte`;
      return `https://www.psm.admin.ch/fr/produkte/${numeric}`;
    }
    case 'fertilizer':
      return manufacturerSearchUrl(manufacturer, ref);
    case 'seed': {
      const site = manufacturerSite(manufacturer);
      if (site) return manufacturerSearchUrl(manufacturer, ref);
      return `https://www.agroscope.admin.ch/agroscope/fr/home/themes/production-vegetale/grandes-cultures/varietes-cereales.html`;
    }
    default:
      return undefined;
  }
}

function externalRefLabel(type: CatalogType, manufacturer?: string, ref?: string): string {
  // Détection prioritaire via ref.
  const detected = detectManufacturerFromRef(ref);
  if (detected) {
    if (detected.key === 'ofag') return 'OFAG';
    // Capitalise pour affichage
    return detected.key.charAt(0).toUpperCase() + detected.key.slice(1);
  }
  switch (type) {
    case 'phyto':
      return 'OFAG';
    case 'fertilizer':
    case 'seed': {
      const site = manufacturerSite(manufacturer);
      if (site && manufacturer) return manufacturer;
      return type === 'seed' ? 'Agroscope' : 'Fabricant';
    }
    default:
      return 'Réf.';
  }
}

interface CatalogRow {
  id: string;
  type: CatalogType;
  name: string;
  manufacturer?: string;
  subtitle: string;
  externalRef?: string;
  source: { kind: 'product'; product: Product } | { kind: 'work'; work: WorkType };
}

function productToRow(p: Product): CatalogRow {
  let subtitle: string;
  let externalRef: string | undefined;
  if (p.type === 'phyto') {
    subtitle = `${p.category} · délai ${p.withholdingDays}j`;
    externalRef = p.ofagNumber;
  } else if (p.type === 'fertilizer') {
    subtitle = `${p.category} · N/P/K = ${p.nPerUnit}/${p.pPerUnit}/${p.kPerUnit} (${p.defaultDoseUnit})`;
  } else {
    subtitle = `${p.cropName} · ${p.varietyName}${p.certified ? ' (certifiée)' : ''}`;
  }
  return {
    id: p.id,
    type: p.type,
    name: p.name,
    manufacturer: p.manufacturer,
    subtitle,
    externalRef,
    source: { kind: 'product', product: p },
  };
}

function workToRow(w: WorkType): CatalogRow {
  const unit = w.defaultBillingUnit;
  const rate =
    unit === 'hectare'
      ? w.defaultPerHectareRateChf
      : unit === 'heure'
        ? w.defaultHourlyRateChf
        : undefined;
  return {
    id: `wt-${w.key}`,
    type: 'prestation',
    name: w.label,
    subtitle: `${w.category} · ${unit}` + (rate !== undefined ? ` · ${rate.toFixed(0)} CHF` : ''),
    source: { kind: 'work', work: w },
  };
}

export function ProduitsSection() {
  const { mobileSelector } = useOutletContext<ParametresOutletContext>();
  const products = useProducts();
  const canWrite = useCan('parametres', 'admin');
  const [editing, setEditing] = useState<{
    initial?: Partial<Product>;
    defaultType?: ProductType;
  } | null>(null);

  const [searchState, setSearchState] = useState<SearchState>({
    facets: [],
    groupBy: [],
  });

  const allRows = useMemo<CatalogRow[]>(
    () => [...products.map(productToRow), ...WORK_TYPES.map(workToRow)],
    [products],
  );

  const fields: FieldDescriptor[] = useMemo(
    () => [
      {
        id: 'type',
        label: 'Type',
        type: 'select',
        options: (Object.keys(TYPE_LABELS) as CatalogType[]).map((k) => ({
          label: TYPE_LABELS[k],
          value: k,
        })),
        groupable: true,
      },
      { id: 'name', label: 'Nom', type: 'text' },
      { id: 'manufacturer', label: 'Fabricant', type: 'text' },
      { id: 'externalRef', label: 'Réf. externe', type: 'text' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const q = (searchState.query ?? '').toLowerCase().trim();
    return allRows.filter((r) => {
      if (q) {
        const hay =
          `${r.name} ${r.manufacturer ?? ''} ${r.externalRef ?? ''} ${r.subtitle}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      for (const facet of searchState.facets) {
        if (facet.values.length === 0) continue;
        if (facet.fieldId === 'type') {
          if (!facet.values.includes(r.type)) return false;
        } else if (facet.fieldId === 'name') {
          if (!facet.values.some((v) => r.name.toLowerCase().includes(String(v).toLowerCase())))
            return false;
        } else if (facet.fieldId === 'manufacturer') {
          if (
            !facet.values.some((v) =>
              (r.manufacturer ?? '').toLowerCase().includes(String(v).toLowerCase()),
            )
          )
            return false;
        } else if (facet.fieldId === 'externalRef') {
          if (
            !facet.values.some((v) =>
              (r.externalRef ?? '').toLowerCase().includes(String(v).toLowerCase()),
            )
          )
            return false;
        }
      }
      return true;
    });
  }, [allRows, searchState]);

  const typeFacet = searchState.facets.find((f) => f.fieldId === 'type');
  const activeType: CatalogType | 'all' =
    typeFacet && typeFacet.values.length === 1 ? (typeFacet.values[0] as CatalogType) : 'all';

  const handleDelete = (row: CatalogRow) => {
    if (row.source.kind !== 'product') return;
    if (confirm(`Supprimer le produit ${row.name} du catalogue ?`)) {
      removeProduct(row.source.product.id);
    }
  };

  const productsCount = allRows.filter((r) => r.type !== 'prestation').length;
  const prestationsCount = allRows.filter((r) => r.type === 'prestation').length;

  const newProductButton = canWrite ? (
    <button
      type="button"
      onClick={() => {
        const t = activeType === 'all' || activeType === 'prestation' ? 'phyto' : activeType;
        setEditing({ defaultType: t });
      }}
      aria-label="Nouveau produit"
      title="Nouveau produit"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius) bg-(--color-primary) text-white hover:bg-(--color-primary)/90 md:h-auto md:w-auto md:gap-1.5 md:px-3 md:py-2 md:text-xs md:font-semibold"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        width="18"
        height="18"
        aria-hidden="true"
        className="md:hidden"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span className="hidden md:inline">+ Nouveau produit</span>
    </button>
  ) : null;

  return (
    <div className="flex flex-col">
      {/* Toolbar desktop : titre + SearchBar + bouton inline */}
      <div className="sticky top-0 z-10 hidden items-center gap-3 border-b border-(--color-border) bg-(--color-bg) py-2 md:flex">
        <div className="shrink-0">
          <h2 className="m-0 text-sm font-semibold">Catalogue</h2>
          <span className="text-[11px] text-(--color-muted)">
            {productsCount} produits · {prestationsCount} prestations
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <SearchBar
            fields={fields}
            value={searchState}
            onChange={setSearchState}
            ariaLabel="Rechercher dans le catalogue"
          />
        </div>
        {newProductButton}
      </div>

      {/* Toolbar mobile : SearchBar + bouton + gear (toujours à droite) + compteurs */}
      <div className="sticky top-0 z-10 flex flex-col gap-1 border-b border-(--color-border) bg-(--color-bg) pt-1 pb-1.5 md:hidden">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SearchBar
              fields={fields}
              value={searchState}
              onChange={setSearchState}
              ariaLabel="Rechercher dans le catalogue"
            />
          </div>
          {newProductButton}
          {mobileSelector}
        </div>
        <span className="px-1 text-[10px] text-(--color-muted)">
          {productsCount} produits · {prestationsCount} prestations
        </span>
      </div>

      <div className="pt-1.5">
        <DataTable<CatalogRow>
          rows={filtered}
          getId={(r) => r.id}
          emptyMessage="Aucun élément pour ce filtre."
          entityLabel="élément"
          columns={catalogColumns({ canWrite, setEditing, handleDelete })}
          onRowClick={(row) => {
            if (row.source.kind === 'product') {
              setEditing({ initial: row.source.product });
            }
          }}
          renderMobileCard={(row, { checkbox }) => {
            const colors = TYPE_BADGE_COLORS[row.type];
            const refUrl = externalRefUrl(row.type, row.externalRef, row.manufacturer);
            const refLabel = externalRefLabel(row.type, row.manufacturer, row.externalRef);
            return (
              <>
                <div className="shrink-0 pt-0.5">{checkbox}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="rounded-(--radius-pill) px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase"
                      style={{ background: colors.bg, color: colors.fg }}
                    >
                      {TYPE_LABELS[row.type]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {row.name}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-(--color-muted)">
                    {row.manufacturer ? `${row.manufacturer} · ` : ''}
                    {row.subtitle}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    {row.externalRef && (
                      <span className="font-mono text-[11px] text-(--color-muted)">
                        {row.externalRef}
                      </span>
                    )}
                    {refUrl && (
                      <a
                        href={refUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[11px] font-medium text-(--color-primary) underline-offset-2 hover:underline"
                      >
                        {refLabel} ↗
                      </a>
                    )}
                  </div>
                </div>
              </>
            );
          }}
        />
      </div>

      {editing && (
        <ProductEditModal
          initial={editing.initial}
          defaultType={editing.defaultType}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/** Définition des colonnes de la table Catalogue. */
function catalogColumns(opts: {
  canWrite: boolean;
  setEditing: (e: { initial?: Partial<Product>; defaultType?: ProductType } | null) => void;
  handleDelete: (row: CatalogRow) => void;
}): Column<CatalogRow>[] {
  const { canWrite, setEditing, handleDelete } = opts;
  return [
    {
      key: 'type',
      label: 'Type',
      render: (row) => {
        const colors = TYPE_BADGE_COLORS[row.type];
        return (
          <span
            className="inline-flex items-center rounded-(--radius-pill) px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase"
            style={{ background: colors.bg, color: colors.fg }}
          >
            {TYPE_LABELS[row.type]}
          </span>
        );
      },
    },
    {
      key: 'name',
      label: 'Nom',
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{row.name}</div>
          {row.manufacturer && (
            <div className="truncate text-[11px] text-(--color-muted)">{row.manufacturer}</div>
          )}
        </div>
      ),
    },
    {
      key: 'detail',
      label: 'Détail',
      render: (row) => <span className="text-(--color-muted)">{row.subtitle}</span>,
    },
    {
      key: 'ref',
      label: 'Réf. externe',
      render: (row) =>
        row.externalRef ? (
          <span className="font-mono text-xs">{row.externalRef}</span>
        ) : (
          <span className="text-(--color-muted)">—</span>
        ),
    },
    {
      key: 'link',
      label: 'Lien',
      render: (row) => {
        const refUrl = externalRefUrl(row.type, row.externalRef, row.manufacturer);
        if (!refUrl) return <span className="text-(--color-muted)">—</span>;
        const label = externalRefLabel(row.type, row.manufacturer, row.externalRef);
        return (
          <a
            href={refUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={`Ouvrir ${label}`}
            className="inline-flex items-center gap-1 rounded-(--radius) border border-(--color-border) bg-white px-2 py-1 text-xs font-medium text-(--color-text) hover:bg-[#fbfbf9]"
          >
            <ExternalIcon /> {label}
          </a>
        );
      },
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => {
        if (row.source.kind !== 'product') {
          return (
            <span className="text-[10px] tracking-wider text-(--color-muted) uppercase">
              Lecture seule
            </span>
          );
        }
        return (
          <div
            className="flex items-center justify-end gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() =>
                setEditing({
                  initial: row.source.kind === 'product' ? row.source.product : undefined,
                })
              }
              disabled={!canWrite}
              className="rounded-(--radius) border border-(--color-border) bg-white px-2 py-1 text-xs font-medium hover:bg-[#fbfbf9] disabled:opacity-50"
            >
              Modifier
            </button>
            {canWrite && (
              <button
                type="button"
                onClick={() => handleDelete(row)}
                aria-label={`Supprimer ${row.name}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-(--radius) text-(--color-error) hover:bg-[#fef2f2]"
              >
                <TrashIcon />
              </button>
            )}
          </div>
        );
      },
    },
  ];
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

function ExternalIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={14}
      height={14}
      aria-hidden="true"
    >
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
      <path d="M14 4h6v6M10 14 20 4" />
    </svg>
  );
}
