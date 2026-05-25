import { useMemo, useState } from 'react';
import type { Intervention, InterventionCategory } from './carnet.types';
import { PhotoGallery } from '../photos/PhotoGallery';
import { CATEGORY_COLORS, CATEGORY_LABELS } from './carnet.helpers';
import { InterventionTypeIcon } from './InterventionTypeIcon';
import type { ParcelDetail } from '../parcellaire/parcellaire.mocks';
import { ProductPicker } from '../products/ProductPicker';
import { getProductById } from '../products/products.store';
import type { Product, ProductType } from '../products/products.types';
import { UserSelect } from '../users/UserSelect';
import { getUserById } from '../users/users.store';
import { ParcelLink } from '../../components/EntityLink/ParcelLink';
import { ParcelMultiPicker } from '../parcel-groups/ParcelMultiPicker';

interface InterventionFormProps {
  /** Intervention en cours d'édition. Si fournie sans id, c'est un nouveau brouillon. */
  initial?: Partial<Intervention>;
  /** Liste des parcelles disponibles pour le sélecteur. */
  parcels: ReadonlyArray<ParcelDetail>;
  /** Parcelle pré-sélectionnée et verrouillée (utile depuis ParcelleDetailPage). */
  lockedParcelId?: string;
  onSave: (intervention: Intervention) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const CATEGORIES: InterventionCategory[] = [
  'sowing',
  'fertilization',
  'phyto',
  'tillage',
  'cultural',
  'harvest',
  'observation',
  'irrigation',
  'other',
];

const TODAY = new Date().toISOString().slice(0, 10);

/** Quelles catégories utilisent un produit du catalogue, et de quel type. */
const CATEGORY_PRODUCT_TYPE: Partial<Record<InterventionCategory, ProductType>> = {
  sowing: 'seed',
  fertilization: 'fertilizer',
  phyto: 'phyto',
};

export function InterventionForm({
  initial,
  parcels,
  lockedParcelId,
  onSave,
  onCancel,
  onDelete,
}: InterventionFormProps) {
  const isNew = !initial?.id;
  // ID stable pour PhotoGallery — généré au mount si nouvelle intervention.
  const [stableId] = useState<string>(
    () => initial?.id ?? `INT-${initial?.parcelId ?? lockedParcelId ?? 'X'}-${Date.now()}`,
  );
  const [draft, setDraft] = useState<Partial<Intervention>>({
    parcelId: lockedParcelId ?? parcels[0]?.id ?? '',
    date: TODAY,
    category: 'observation',
    ...initial,
    id: initial?.id ?? stableId,
  });
  const [bbchHelpOpen, setBbchHelpOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  // Multi-sélection : N parcelles dans une même intervention (1 enregistrement par parcelle).
  // La 1re est la principale (= draft.parcelId pour les calculs). Au submit, on crée 1
  // intervention par id avec doseValue × surface réelle de chaque parcelle.
  // Init lazy : exécuté une seule fois au mount (compatible react-hooks/purity).
  const [allSelectedIds, setAllSelectedIds] = useState<ReadonlyArray<string>>(() => {
    if (initial?.parcelId) return [initial.parcelId];
    if (lockedParcelId) return [lockedParcelId];
    return [];
  });
  const [parcelPickerOpen, setParcelPickerOpen] = useState(false);

  const setField = <K extends keyof Intervention>(key: K, value: Intervention[K] | undefined) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const category = draft.category ?? 'observation';
  const parcel = parcels.find((p) => p.id === draft.parcelId);
  const productType = CATEGORY_PRODUCT_TYPE[category];

  /** Auto-fill quand un produit est sélectionné. */
  const handleProductChange = (product: Product | undefined) => {
    if (!product) {
      setDraft((d) => ({
        ...d,
        productId: undefined,
        productName: undefined,
        ofagNumber: undefined,
      }));
      return;
    }
    setDraft((d) => {
      const next: Partial<Intervention> = {
        ...d,
        productId: product.id,
        productName: product.name,
        // L'unité est TOUJOURS pilotée par le produit (cohérence stricte des calculs).
        doseUnit: product.defaultDoseUnit,
      };
      if (product.type === 'phyto') {
        next.ofagNumber = product.ofagNumber;
        next.phytoType = product.category;
        next.withholdingDays = product.withholdingDays;
        next.doseValue = next.doseValue ?? product.defaultDoseValue;
      } else if (product.type === 'fertilizer') {
        next.fertilizationType = product.category;
        // Réinitialiser N/P/K — sera recalculé avec la nouvelle composition.
        // Calcul : nKgPerHa = doseValue × nPerUnit (cf. FertilizerProduct.nPerUnit).
        if (next.doseValue !== undefined) {
          next.nKgPerHa = Math.round(next.doseValue * product.nPerUnit);
          next.pKgPerHa = Math.round(next.doseValue * product.pPerUnit);
          next.kKgPerHa = Math.round(next.doseValue * product.kPerUnit);
        } else {
          next.nKgPerHa = undefined;
          next.pKgPerHa = undefined;
          next.kKgPerHa = undefined;
        }
      } else if (product.type === 'seed') {
        next.doseValue = next.doseValue ?? product.defaultDoseValue;
      }
      return next;
    });
  };

  const handleOperatorChange = (userId: string | undefined) => {
    const user = getUserById(userId);
    setDraft((d) => ({
      ...d,
      operatorId: userId,
      operator: user?.displayName,
    }));
  };

  /** Recalcule N/P/K si la dose change (pour engrais avec produit lié). */
  const handleDoseChange = (value: number | undefined) => {
    setDraft((d) => {
      const next: Partial<Intervention> = { ...d, doseValue: value };
      if (d.productId && value !== undefined) {
        const product = getProductById(d.productId);
        if (product?.type === 'fertilizer') {
          next.nKgPerHa = Math.round(value * product.nPerUnit);
          next.pKgPerHa = Math.round(value * product.pPerUnit);
          next.kKgPerHa = Math.round(value * product.kPerUnit);
        }
      }
      return next;
    });
  };

  /** Date de récolte autorisée = date intervention + délai d'attente. */
  const harvestAllowedDate = useMemo(() => {
    if (category !== 'phyto' || !draft.date || !draft.withholdingDays) return undefined;
    const d = new Date(`${draft.date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + draft.withholdingDays);
    return d.toISOString().slice(0, 10);
  }, [category, draft.date, draft.withholdingDays]);

  const submit = () => {
    if (!draft.parcelId || !draft.date || !draft.category) return;
    // baseId : on garde stableId pour préserver le lien avec les photos uploadées
    // pendant la création (l'utilisateur peut prendre des photos avant submit).
    const baseId = draft.id ?? stableId;
    const intervention: Intervention = {
      id: baseId,
      parcelId: draft.parcelId,
      date: draft.date,
      category: draft.category,
      subType: draft.subType,
      productId: draft.productId,
      productName: draft.productName,
      ofagNumber: draft.ofagNumber,
      surfaceTreatedHa: draft.surfaceTreatedHa,
      doseValue: draft.doseValue,
      doseUnit: draft.doseUnit,
      nKgPerHa: draft.nKgPerHa,
      pKgPerHa: draft.pKgPerHa,
      kKgPerHa: draft.kKgPerHa,
      fertilizationType: draft.fertilizationType,
      phytoType: draft.phytoType,
      withholdingDays: draft.withholdingDays,
      bbchStage: draft.bbchStage,
      yieldValue: draft.yieldValue,
      yieldUnit: draft.yieldUnit,
      operatorId: draft.operatorId,
      operator: draft.operator,
      durationHours: draft.durationHours,
      weather: draft.weather,
      notes: draft.notes,
    };
    onSave(intervention);
    // Multi-sélection : crée une copie identique pour chaque parcelle additionnelle
    // (toutes celles dans allSelectedIds sauf la principale = draft.parcelId).
    // Le caller délègue à addInterventions via le store.
    const additionalIds = allSelectedIds.filter((id) => id !== draft.parcelId);
    for (const otherParcelId of additionalIds) {
      onSave({
        ...intervention,
        id: `${baseId}-${otherParcelId}`,
        parcelId: otherParcelId,
      });
    }
  };

  /**
   * Validation visuelle des champs requis. Au lieu de désactiver le bouton
   * (qui peut bloquer l'utilisateur sans qu'il sache pourquoi), on indique
   * clairement ce qui manque dans un message contextuel.
   */
  const missingFields: string[] = [];
  if (!draft.parcelId?.trim()) missingFields.push('Parcelle');
  if (!draft.date) missingFields.push('Date');
  if (!draft.category) missingFields.push('Catégorie');
  const canSubmit = missingFields.length === 0;

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center md:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? 'Nouvelle intervention' : 'Modifier intervention'}
        className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-(--radius-lg) border border-(--color-border) bg-(--color-surface) shadow-(--shadow-popup) md:max-w-[600px] md:rounded-(--radius-lg)"
      >
        <header className="flex items-start gap-3 border-b border-(--color-border) px-4 py-3">
          <InterventionTypeIcon category={category} size={18} withBackground />
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-sm font-semibold">
              {isNew ? 'Nouvelle intervention' : 'Modifier intervention'}
            </h2>
            <p className="m-0 mt-0.5 text-xs text-(--color-muted)">
              Carnet des champs — {CATEGORY_LABELS[category]}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Annuler"
            className="inline-flex h-8 w-8 items-center justify-center rounded-(--radius-sm) text-(--color-muted) hover:bg-[#f1f1ee] hover:text-(--color-text)"
          >
            <CloseIcon />
          </button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* Sélecteur visuel de catégorie — grille d'icônes cliquables */}
          <FormField label="Catégorie">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {CATEGORIES.map((c) => {
                const selected = c === category;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setField('category', c)}
                    aria-pressed={selected}
                    className={[
                      'group flex flex-col items-center gap-1 rounded-(--radius) border px-2 py-2 text-center text-[11px] font-medium transition-colors',
                      selected
                        ? 'border-(--color-primary) bg-(--color-primary)/8 text-(--color-text)'
                        : 'border-(--color-border) bg-(--color-surface) text-(--color-muted) hover:border-(--color-text)/30 hover:text-(--color-text)',
                    ].join(' ')}
                    style={selected ? { borderColor: CATEGORY_COLORS[c] } : undefined}
                  >
                    <InterventionTypeIcon category={c} size={18} withBackground={selected} />
                    <span className="leading-tight">{CATEGORY_LABELS[c]}</span>
                  </button>
                );
              })}
            </div>
          </FormField>

          {/* Parcelle(s) — multi-sélection directe avec support des groupes */}
          <FormField label={allSelectedIds.length > 1 ? 'Parcelles' : 'Parcelle'}>
            {lockedParcelId ? (
              /* Verrouillée : pas de sélection possible (depuis ParcelleDetailPage) */
              <div className="flex items-center gap-2">
                <div className={inputClass + ' flex items-center'}>
                  {parcel?.name ?? lockedParcelId}
                </div>
                <ParcelLink
                  parcelId={lockedParcelId}
                  variant="compact-button"
                  beforeNavigate={onCancel}
                />
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setParcelPickerOpen(true)}
                  className={[
                    'flex h-10 w-full items-center gap-2 rounded-(--radius) border bg-(--color-surface) px-3 text-left text-sm transition-colors hover:bg-[#fbfbf9]',
                    allSelectedIds.length > 0
                      ? 'border-(--color-border)'
                      : 'border-dashed border-(--color-border) text-(--color-muted)',
                  ].join(' ')}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {allSelectedIds.length === 0
                      ? 'Sélectionner les parcelles…'
                      : allSelectedIds.length === 1
                        ? (parcels.find((p) => p.id === allSelectedIds[0])?.name ??
                          allSelectedIds[0])
                        : `${allSelectedIds.length} parcelles sélectionnées`}
                  </span>
                  <span className="shrink-0 text-(--color-muted)">
                    <ChevronIcon />
                  </span>
                </button>
                {/* Chips removables si > 1 parcelle */}
                {allSelectedIds.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {allSelectedIds.map((pid, idx) => {
                      const p = parcels.find((x) => x.id === pid);
                      const isPrincipal = idx === 0;
                      return (
                        <span
                          key={pid}
                          className={[
                            'inline-flex items-center gap-1.5 rounded-(--radius-pill) border py-1 pr-1 pl-2.5 text-xs',
                            isPrincipal
                              ? 'border-(--color-primary) bg-(--color-primary)/10 text-(--color-primary)'
                              : 'border-(--color-border) bg-[#fbfbf9]',
                          ].join(' ')}
                        >
                          <span className="font-medium">{p?.name ?? pid}</span>
                          {isPrincipal && (
                            <span className="text-[9px] font-semibold tracking-wider uppercase">
                              principale
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const next = allSelectedIds.filter((x) => x !== pid);
                              setAllSelectedIds(next);
                              setField('parcelId', next[0]);
                            }}
                            aria-label={`Retirer ${p?.name ?? pid}`}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-(--radius-pill) text-(--color-muted) hover:bg-[#f1f1ee] hover:text-(--color-text)"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              width={10}
                              height={10}
                              aria-hidden="true"
                            >
                              <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                {allSelectedIds.length > 1 && (
                  <p className="m-0 mt-1 text-[11px] text-(--color-muted)">
                    {allSelectedIds.length} interventions seront créées (1 par parcelle,
                    identiques). La 1<sup>re</sup> est la principale (utilisée pour les calculs).
                  </p>
                )}
              </>
            )}
          </FormField>

          {/* Modal multi-sélection avec support des groupes */}
          {parcelPickerOpen && !lockedParcelId && (
            <ParcelMultiPicker
              parcels={parcels}
              selectedIds={allSelectedIds}
              onConfirm={(ids) => {
                setAllSelectedIds(ids);
                setField('parcelId', ids[0]);
                setParcelPickerOpen(false);
              }}
              onClose={() => setParcelPickerOpen(false)}
            />
          )}

          {/* Date */}
          <FormField label="Date">
            <input
              type="date"
              value={draft.date ?? TODAY}
              onChange={(e) => setField('date', e.target.value)}
              className={inputClass}
            />
          </FormField>

          {/* Produit (depuis catalogue) — pour sowing / fertilization / phyto */}
          {productType && (
            <FormField label={productLabel(productType)}>
              <button
                type="button"
                onClick={() => setProductPickerOpen(true)}
                className={[
                  'flex h-10 w-full items-center gap-2 rounded-(--radius) border bg-(--color-surface) px-3 text-left text-sm transition-colors hover:bg-[#fbfbf9]',
                  draft.productName
                    ? 'border-(--color-border)'
                    : 'border-dashed border-(--color-border) text-(--color-muted)',
                ].join(' ')}
              >
                <span className="min-w-0 flex-1 truncate">
                  {draft.productName ?? `Sélectionner ${productLabel(productType).toLowerCase()}…`}
                </span>
                <span className="shrink-0 text-(--color-muted)">
                  <ChevronIcon />
                </span>
              </button>
              {draft.ofagNumber && (
                <p className="m-0 mt-1 font-mono text-[11px] text-(--color-muted)">
                  Homologation OFAG : <strong>{draft.ofagNumber}</strong>
                </p>
              )}
            </FormField>
          )}

          {/* Modal ProductPicker (plein écran mobile / grand desktop) */}
          {productType && productPickerOpen && (
            <ProductPicker
              type={productType}
              authorizedForCrop={productType === 'phyto' ? parcel?.culture : undefined}
              currentValue={draft.productId}
              onSelect={(product) => {
                handleProductChange(product);
                setProductPickerOpen(false);
              }}
              onClose={() => setProductPickerOpen(false)}
            />
          )}

          {/* Champs spécifiques par catégorie */}
          {category === 'phyto' && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField label="Type">
                  <select
                    value={draft.phytoType ?? 'herbicide'}
                    onChange={(e) =>
                      setField('phytoType', e.target.value as Intervention['phytoType'])
                    }
                    className={inputClass}
                  >
                    <option value="herbicide">Herbicide</option>
                    <option value="fungicide">Fongicide</option>
                    <option value="insecticide">Insecticide</option>
                    <option value="growth-regulator">Régulateur de croissance</option>
                    <option value="molluscicide">Molluscicide (anti-limaces)</option>
                    <option value="other">Autre</option>
                  </select>
                </FormField>
                <FormField label="Délai d'attente (jours)">
                  <input
                    type="number"
                    value={draft.withholdingDays ?? ''}
                    onChange={(e) =>
                      setField(
                        'withholdingDays',
                        e.target.value ? Number(e.target.value) : undefined,
                      )
                    }
                    className={inputClass}
                  />
                </FormField>
              </div>
              {/* Date récolte autorisée */}
              {harvestAllowedDate && (
                <div className="rounded-(--radius-sm) border border-(--color-success)/30 bg-(--color-success)/8 px-3 py-2 text-xs">
                  <strong className="text-(--color-success)">Récolte autorisée à partir du</strong>{' '}
                  <span className="font-mono tabular-nums">{fmtDate(harvestAllowedDate)}</span>
                  <span className="ml-2 text-(--color-muted)">
                    (date + {draft.withholdingDays} j de délai d'attente)
                  </span>
                </div>
              )}
            </>
          )}

          {category === 'fertilization' && (
            <>
              <FormField label="Type">
                <select
                  value={draft.fertilizationType ?? 'mineral'}
                  onChange={(e) =>
                    setField(
                      'fertilizationType',
                      e.target.value as Intervention['fertilizationType'],
                    )
                  }
                  className={inputClass}
                >
                  <option value="mineral">Minéral</option>
                  <option value="organic">Organique</option>
                  <option value="amendment">Amendement</option>
                </select>
              </FormField>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="N (kg/ha)">
                  <input
                    type="number"
                    value={draft.nKgPerHa ?? ''}
                    onChange={(e) =>
                      setField('nKgPerHa', e.target.value ? Number(e.target.value) : undefined)
                    }
                    className={inputClass}
                  />
                </FormField>
                <FormField label="P₂O₅ (kg/ha)">
                  <input
                    type="number"
                    value={draft.pKgPerHa ?? ''}
                    onChange={(e) =>
                      setField('pKgPerHa', e.target.value ? Number(e.target.value) : undefined)
                    }
                    className={inputClass}
                  />
                </FormField>
                <FormField label="K₂O (kg/ha)">
                  <input
                    type="number"
                    value={draft.kKgPerHa ?? ''}
                    onChange={(e) =>
                      setField('kKgPerHa', e.target.value ? Number(e.target.value) : undefined)
                    }
                    className={inputClass}
                  />
                </FormField>
              </div>
              {draft.productId && (
                <p className="m-0 -mt-2 text-[11px] text-(--color-muted)">
                  Apports calculés automatiquement depuis le titre du produit et la dose.
                </p>
              )}
            </>
          )}

          {/* Dose */}
          {(category === 'sowing' ||
            category === 'fertilization' ||
            category === 'phyto' ||
            category === 'irrigation') && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Dose">
                  <input
                    type="number"
                    step="0.1"
                    value={draft.doseValue ?? ''}
                    onChange={(e) =>
                      handleDoseChange(e.target.value ? Number(e.target.value) : undefined)
                    }
                    className={inputClass}
                  />
                </FormField>
                <FormField label="Unité">
                  <select
                    value={draft.doseUnit ?? 'kg/ha'}
                    onChange={(e) => setField('doseUnit', e.target.value)}
                    className={inputClass}
                  >
                    <option value="kg/ha">kg/ha</option>
                    <option value="L/ha">L/ha</option>
                    <option value="g/ha">g/ha</option>
                    <option value="mL/ha">mL/ha</option>
                    <option value="kg">kg</option>
                    <option value="L">L</option>
                    <option value="grains/ha">grains/ha</option>
                    <option value="m³/ha">m³/ha</option>
                    <option value="t/ha">t/ha</option>
                  </select>
                </FormField>
              </div>
              {/* Total calculé : dose × surface (parcelle ou surface traitée si précisée) */}
              {(() => {
                const total = computeDoseTotal(
                  draft.doseValue,
                  draft.doseUnit,
                  draft.surfaceTreatedHa ?? parcel?.surfaceHa,
                );
                if (!total) return null;
                return (
                  <div className="rounded-(--radius-sm) border border-(--color-border) bg-[#fbfbf9] px-3 py-2 text-xs">
                    <span className="text-(--color-muted)">Total estimé : </span>
                    <strong className="font-mono tabular-nums">{total.formatted}</strong>
                    <span className="ml-2 text-(--color-muted)">
                      ({draft.doseValue} {draft.doseUnit} × {total.surfaceHa.toFixed(2)} ha)
                    </span>
                  </div>
                );
              })()}
            </>
          )}

          {/* Récolte */}
          {category === 'harvest' && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Rendement">
                <input
                  type="number"
                  step="0.1"
                  value={draft.yieldValue ?? ''}
                  onChange={(e) =>
                    setField('yieldValue', e.target.value ? Number(e.target.value) : undefined)
                  }
                  className={inputClass}
                />
              </FormField>
              <FormField label="Unité">
                <select
                  value={draft.yieldUnit ?? 'q/ha'}
                  onChange={(e) => setField('yieldUnit', e.target.value)}
                  className={inputClass}
                >
                  <option value="q/ha">q/ha (quintaux)</option>
                  <option value="t/ha">t/ha</option>
                  <option value="t MS/ha">t MS/ha (matière sèche)</option>
                  <option value="kg/ha">kg/ha</option>
                </select>
              </FormField>
            </div>
          )}

          {/* Stade BBCH avec aide-bulle */}
          {(category === 'sowing' ||
            category === 'fertilization' ||
            category === 'phyto' ||
            category === 'observation') && (
            <FormField
              label="Stade BBCH (0–99)"
              help={
                <button
                  type="button"
                  onClick={() => setBbchHelpOpen((o) => !o)}
                  aria-expanded={bbchHelpOpen}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-(--radius-pill) bg-[#f1f1ee] text-[11px] font-bold text-(--color-muted) hover:bg-[#e5e5e0] hover:text-(--color-text)"
                  title="Qu'est-ce que l'échelle BBCH ?"
                >
                  ?
                </button>
              }
            >
              <input
                type="number"
                min={0}
                max={99}
                value={draft.bbchStage ?? ''}
                onChange={(e) =>
                  setField('bbchStage', e.target.value ? Number(e.target.value) : undefined)
                }
                className={inputClass}
              />
              {bbchHelpOpen && <BbchHelp />}
            </FormField>
          )}

          {/* Surface traitée */}
          <FormField label="Surface traitée (ha) — vide si parcelle entière">
            <input
              type="number"
              step="0.01"
              value={draft.surfaceTreatedHa ?? ''}
              onChange={(e) =>
                setField('surfaceTreatedHa', e.target.value ? Number(e.target.value) : undefined)
              }
              className={inputClass}
            />
          </FormField>

          {/* Opérateur + durée travail */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Opérateur">
              <UserSelect
                value={draft.operatorId}
                onChange={handleOperatorChange}
                ariaLabel="Sélectionner l'opérateur"
              />
            </FormField>
            <FormField label="Durée travail (heures)" help={<TimeBadge />}>
              <input
                type="number"
                step="0.25"
                min={0}
                value={draft.durationHours ?? ''}
                onChange={(e) =>
                  setField('durationHours', e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="Ex. 2.5"
                className={inputClass}
              />
            </FormField>
          </div>

          {/* Météo */}
          <FormField label="Météo" help={<MeteoSuissePlaceholderBadge />}>
            <input
              type="text"
              value={draft.weather ?? ''}
              onChange={(e) => setField('weather', e.target.value || undefined)}
              placeholder="Ex. Ensoleillé, 18°C"
              className={inputClass}
            />
          </FormField>

          {/* Notes */}
          <FormField label="Notes">
            <textarea
              value={draft.notes ?? ''}
              onChange={(e) => setField('notes', e.target.value || undefined)}
              rows={3}
              placeholder="Observations, contexte, suivi…"
              className={inputClass.replace('h-10', 'min-h-[72px] py-2')}
            />
          </FormField>

          {/* Photos terrain */}
          <FormField label="Photos">
            <PhotoGallery entityType="intervention" entityId={stableId} title="" />
          </FormField>
        </div>
        <footer className="flex flex-wrap items-center gap-2 border-t border-(--color-border) p-3">
          {!canSubmit && (
            <span className="basis-full text-[11px] font-medium text-(--color-warning)">
              Champs requis manquants : {missingFields.join(', ')}
            </span>
          )}
          {!isNew && onDelete && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Supprimer cette intervention ?')) onDelete();
              }}
              className="inline-flex h-10 items-center rounded-(--radius) border border-(--color-error) bg-(--color-surface) px-3 text-sm font-medium text-(--color-error) hover:bg-[#fef2f2]"
            >
              Supprimer
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="ml-auto inline-flex h-10 items-center rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-4 text-sm font-medium hover:bg-[#f8f8f5]"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex h-10 items-center rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-5 text-sm font-medium text-white hover:bg-(--color-primary-hover) disabled:opacity-50"
          >
            {isNew ? 'Créer' : 'Enregistrer'}
          </button>
        </footer>
      </div>
    </div>
  );
}

const inputClass =
  'h-10 w-full rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 text-sm focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/15 disabled:bg-[#fbfbf9] disabled:text-(--color-muted)';

function FormField({
  label,
  help,
  children,
}: {
  label: string;
  help?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <label className="block text-xs font-medium text-(--color-text)">{label}</label>
        {help}
      </div>
      {children}
    </div>
  );
}

function productLabel(type: ProductType): string {
  switch (type) {
    case 'phyto':
      return 'Produit phyto (catalogue OFAG)';
    case 'fertilizer':
      return 'Engrais / amendement (catalogue)';
    case 'seed':
      return 'Semence (catalogue)';
  }
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Calcule le total absolu d'une dose appliquée sur une surface.
 *
 * Si l'unité est "par hectare" (kg/ha, L/ha, grains/ha, m³/ha, t/ha, g/ha, mL/ha),
 * multiplie par la surface pour obtenir le total. Si l'unité est déjà absolue
 * (kg, L sans /ha), retourne null car le total est égal à la dose.
 *
 * Le label formaté gère les grandes valeurs (séparateur de milliers) et
 * conserve la précision adaptée (entiers pour grains/g, 1 décimale sinon).
 */
function computeDoseTotal(
  doseValue: number | undefined,
  doseUnit: string | undefined,
  surfaceHa: number | undefined,
): { formatted: string; surfaceHa: number } | null {
  if (!doseValue || !doseUnit || !surfaceHa || surfaceHa <= 0) return null;
  if (!doseUnit.includes('/ha')) return null; // dose absolue, total = dose
  const total = doseValue * surfaceHa;
  const baseUnit = doseUnit.replace('/ha', '');
  const isInteger = baseUnit === 'grains' || baseUnit === 'g' || baseUnit === 'mL';
  const formatted = `${isInteger ? Math.round(total).toLocaleString('fr-CH') : total.toLocaleString('fr-CH', { maximumFractionDigits: 1 })} ${baseUnit}`;
  return { formatted, surfaceHa };
}

function MeteoSuissePlaceholderBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-(--radius-pill) bg-[#f1f1ee] px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-(--color-muted) uppercase"
      title="Auto-remplissage depuis MétéoSuisse prévu Phase 3"
    >
      MétéoSuisse à venir
    </span>
  );
}

function TimeBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-(--radius-pill) bg-[#f1f1ee] px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-(--color-muted) uppercase"
      title="Heures décimales : 1.5 = 1h30. Lié à hr.attendance Odoo (Phase 3)"
    >
      RH / Travaux tiers
    </span>
  );
}

function BbchHelp() {
  return (
    <div
      role="note"
      className="mt-2 space-y-1 rounded-(--radius-sm) border border-(--color-border) bg-[#fbfbf9] p-3 text-[11px] text-(--color-muted)"
    >
      <p className="m-0 text-(--color-text)">
        <strong>Échelle BBCH</strong> : code international standardisé des stades de croissance des
        plantes (0–99).
      </p>
      <ul className="m-0 list-none space-y-0.5 p-0">
        <li>
          <strong>0–9</strong> : germination / levée
        </li>
        <li>
          <strong>10–19</strong> : développement des feuilles
        </li>
        <li>
          <strong>20–29</strong> : tallage (céréales) / pousses latérales
        </li>
        <li>
          <strong>30–39</strong> : montaison / élongation tige
        </li>
        <li>
          <strong>40–49</strong> : gonflement de l'épi / boutons floraux
        </li>
        <li>
          <strong>50–59</strong> : épiaison / apparition inflorescence
        </li>
        <li>
          <strong>60–69</strong> : floraison
        </li>
        <li>
          <strong>70–79</strong> : développement des grains / fruits
        </li>
        <li>
          <strong>80–89</strong> : maturation
        </li>
        <li>
          <strong>90–99</strong> : sénescence
        </li>
      </ul>
    </div>
  );
}

function CloseIcon() {
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
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function ChevronIcon() {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
