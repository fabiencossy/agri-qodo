import { useEffect, useRef, useState } from 'react';
import { addWorkOrder, updateWorkOrder, useClients } from './travaux.store';
import { getWorkType } from './travaux.catalog';
import {
  durationFromTimes,
  type WorkOrder,
  type WorkOrderLine,
  type WorkOrderStatus,
  type WorkTimeEntry,
} from './travaux.types';
import { useUsers } from '../users/users.store';
import { useCurrentUser } from '../users/permissions';
import { useParcels } from '../parcellaire/parcellaire.store';
import { ParcelMultiPicker } from '../parcel-groups/ParcelMultiPicker';
import { PrestationPicker } from './PrestationPicker';
import { isPerHectareUnit, type PrestationSource } from './prestation-source';
import { OperatorMultiPicker } from './OperatorMultiPicker';
import { useProducts } from '../products/products.store';

interface WorkOrderModalProps {
  initial?: Partial<WorkOrder>;
  onClose: () => void;
}

const STATUSES: WorkOrderStatus[] = ['planned', 'in-progress', 'done', 'invoiced', 'cancelled'];

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  planned: 'Planifié',
  'in-progress': 'En cours',
  done: 'Réalisé',
  invoiced: 'Facturé',
  cancelled: 'Annulé',
};

export function WorkOrderModal({ initial, onClose }: WorkOrderModalProps) {
  const isExisting = Boolean(initial?.id);
  const clients = useClients();
  const users = useUsers();
  const currentUser = useCurrentUser();
  const parcels = useParcels();
  const products = useProducts();

  const [parcelPickerOpen, setParcelPickerOpen] = useState(false);
  const [operatorPickerOpen, setOperatorPickerOpen] = useState(false);
  /** Cible du PrestationPicker : 'new' = ajout, string = édition de la ligne id. */
  const [prestationPickerTarget, setPrestationPickerTarget] = useState<'new' | string | null>(null);
  /** Ligne actuellement en mode édition (formulaire détaillé). Les autres sont
   * en carte compacte. Une seule à la fois pour densifier l'affichage. */
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const [draft, setDraft] = useState<WorkOrder>(() => ({
    id: initial?.id ?? `WO-${Date.now()}`,
    date: initial?.date ?? new Date().toISOString().slice(0, 10),
    deadline: initial?.deadline,
    clientId: initial?.clientId ?? '',
    parcelIds: initial?.parcelIds ?? [],
    machine: initial?.machine,
    description: initial?.description,
    status: initial?.status ?? 'planned',
    priority: initial?.priority ?? '1',
    // Préfill : l'utilisateur courant est assigné par défaut sur ses propres
    // bons (on présume que celui qui crée fera le travail). Édition d'un bon
    // existant : on respecte la liste actuelle.
    userIds: initial?.userIds ?? (currentUser ? [currentUser.id] : []),
    tagIds: initial?.tagIds,
    lines: initial?.lines ?? [],
    timeEntries: initial?.timeEntries ?? [],
    fsmDone: initial?.fsmDone,
    invoiceRef: initial?.invoiceRef,
    invoicedAt: initial?.invoicedAt,
    notes: initial?.notes,
  }));

  const setField = <K extends keyof WorkOrder>(k: K, v: WorkOrder[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  // ─── Lignes ────────────────────────────────────────────────────────────
  const updateLine = (id: string, patch: Partial<WorkOrderLine>) => {
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  };

  const removeLine = (id: string) => {
    setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.id !== id) }));
  };

  /** Applique une source PrestationSource à une ligne (nouvelle ou existante). */
  const applyPrestationSource = (lineId: 'new' | string, source: PrestationSource) => {
    const totalSurfaceHa = selectedParcelsInfo.totalHa;
    const prefillQty =
      isPerHectareUnit(source.unit) && totalSurfaceHa > 0 ? totalSurfaceHa : undefined;
    const base: Partial<WorkOrderLine> = {
      workType: source.kind === 'worktype' ? source.id : '',
      productId: source.kind === 'product' ? source.id : undefined,
      quantity: prefillQty,
      quantityUnit: source.unit,
      billingUnit: source.billingUnit ?? (isPerHectareUnit(source.unit) ? 'hectare' : 'forfait'),
      surfaceHa: isPerHectareUnit(source.unit) ? (prefillQty ?? undefined) : undefined,
      durationHours: source.unit === 'h' ? prefillQty : undefined,
      unitRateChf: source.defaultRateChf,
    };
    if (lineId === 'new') {
      const newLine: WorkOrderLine = {
        id: `WL-${Date.now()}-${Math.floor(performance.now())}`,
        workType: '',
        billingUnit: 'heure',
        ...base,
      };
      setDraft((d) => ({ ...d, lines: [...d.lines, newLine] }));
      setEditingLineId(newLine.id);
    } else {
      updateLine(lineId, base);
    }
  };

  /** Met à jour la quantité (et surface/durée miroir pour rétro-compat). */
  const setLineQuantity = (id: string, value: number | undefined) => {
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l) => {
        if (l.id !== id) return l;
        const unit = l.quantityUnit ?? '';
        return {
          ...l,
          quantity: value,
          surfaceHa: isPerHectareUnit(unit) ? value : l.surfaceHa,
          durationHours: unit === 'h' ? value : l.durationHours,
        };
      }),
    }));
  };

  // ─── Saisies de temps ──────────────────────────────────────────────────
  const addTimeEntry = () => {
    const newEntry: WorkTimeEntry = {
      id: `WT-${Date.now()}-${Math.floor(performance.now())}`,
      // Pré-sélectionne l'utilisateur courant comme opérateur — c'est lui qui
      // a créé le bon, c'est donc lui qui saisit ses heures par défaut.
      operatorId: currentUser?.id ?? '',
      date: draft.date,
      durationHours: 0,
    };
    setDraft((d) => ({ ...d, timeEntries: [...d.timeEntries, newEntry] }));
    setEditingEntryId(newEntry.id);
  };

  const updateTimeEntry = (id: string, patch: Partial<WorkTimeEntry>) => {
    setDraft((d) => ({
      ...d,
      timeEntries: d.timeEntries.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...patch };
        // Recalcul auto de la durée si start/end fournis (start < end strict)
        if (
          (patch.startTime !== undefined || patch.endTime !== undefined) &&
          next.startTime &&
          next.endTime
        ) {
          const dur = durationFromTimes(next.startTime, next.endTime);
          if (dur > 0) next.durationHours = dur;
        }
        // Garde-fou : pas de durée négative
        if (next.durationHours < 0) next.durationHours = 0;
        return next;
      }),
    }));
  };

  const removeTimeEntry = (id: string) => {
    setDraft((d) => ({ ...d, timeEntries: d.timeEntries.filter((t) => t.id !== id) }));
  };

  /**
   * Recalcule les `quantity` des lignes /ha en fonction des parcelles
   * sélectionnées (ajout/suppression/picker). On ne touche QUE les lignes
   * dont l'unité indique du /ha et dont la quantité actuelle correspond au
   * total des parcelles précédentes (signal qu'elle est issue du préfill —
   * si l'utilisateur a saisi une valeur custom, on n'écrase pas).
   */
  const reapplyHectareQuantity = (
    lines: ReadonlyArray<WorkOrderLine>,
    previousTotalHa: number,
    nextTotalHa: number,
  ): WorkOrderLine[] =>
    lines.map((l) => {
      const unit = l.quantityUnit ?? '';
      if (!isPerHectareUnit(unit)) return l;
      // Si quantity correspond à l'ancien total ou n'est pas définie → préfill auto
      const isAutofill = !l.quantity || Math.abs((l.quantity ?? 0) - previousTotalHa) < 0.01;
      if (!isAutofill) return l;
      return {
        ...l,
        quantity: nextTotalHa > 0 ? nextTotalHa : undefined,
        surfaceHa: nextTotalHa > 0 ? nextTotalHa : undefined,
      };
    });

  const totalHaFor = (ids: ReadonlyArray<string>): number => {
    const items = parcels.filter((p) => ids.includes(p.id));
    return Math.round(items.reduce((sum, p) => sum + p.surfaceHa, 0) * 100) / 100;
  };

  const removeParcel = (parcelId: string) => {
    setDraft((d) => {
      const previousIds = d.parcelIds ?? [];
      const nextIds = previousIds.filter((id) => id !== parcelId);
      const previousTotal = totalHaFor(previousIds);
      const nextTotal = totalHaFor(nextIds);
      return {
        ...d,
        parcelIds: nextIds,
        lines: reapplyHectareQuantity(d.lines, previousTotal, nextTotal),
      };
    });
  };

  const setParcels = (ids: ReadonlyArray<string>) => {
    setDraft((d) => {
      const previousTotal = totalHaFor(d.parcelIds ?? []);
      const nextTotal = totalHaFor(ids);
      return {
        ...d,
        parcelIds: ids,
        lines: reapplyHectareQuantity(d.lines, previousTotal, nextTotal),
      };
    });
    setParcelPickerOpen(false);
  };

  // Calcul surface totale des parcelles sélectionnées (auto-mémoïsé par React 19)
  const selectedParcelsInfo = (() => {
    const ids = draft.parcelIds ?? [];
    const items = parcels.filter((p) => ids.includes(p.id));
    const totalHa = items.reduce((sum, p) => sum + p.surfaceHa, 0);
    return { items, totalHa: Math.round(totalHa * 100) / 100 };
  })();

  // ─── Totaux dérivés ────────────────────────────────────────────────────

  /** Résout label + unité d'affichage d'une ligne (worktype ou product). */
  const resolveLineDisplay = (line: WorkOrderLine): { label: string; unit: string } => {
    if (line.productId) {
      const p = products.find((x) => x.id === line.productId);
      return {
        label: p?.name ?? '(produit retiré du catalogue)',
        unit: line.quantityUnit ?? p?.defaultDoseUnit ?? '',
      };
    }
    const wt = getWorkType(line.workType);
    const fallbackUnit =
      line.billingUnit === 'hectare' ? 'ha' : line.billingUnit === 'heure' ? 'h' : 'forfait';
    return {
      label: wt?.label ?? line.workType ?? '(prestation non définie)',
      unit: line.quantityUnit ?? fallbackUnit,
    };
  };

  // ─── Validation & submit ───────────────────────────────────────────────
  const isValid =
    Boolean(draft.clientId) &&
    Boolean(draft.date) &&
    draft.lines.length > 0 &&
    draft.lines.every((l) => Boolean(l.workType) || Boolean(l.productId));

  const submit = () => {
    if (!isValid) return;
    if (isExisting) updateWorkOrder(draft.id, draft);
    else addWorkOrder(draft);
    onClose();
  };

  /**
   * Cycle de vie statut :
   *  - planned → done (Réalisé) : tout opérateur ayant `travaux.write`
   *  - done → invoiced (Terminé/Validé) : superviseur ayant `travaux.admin`
   *  - invoiced est verrouillé. Pour modifier, passer par "Débloquer" qui repasse
   *    le statut à `done` (kebab menu).
   * Le hook `useCan` est lu via les permissions du current user.
   */
  const setStatus = (next: WorkOrderStatus) => {
    if (!isValid) return;
    const patched = { ...draft, status: next };
    setDraft(patched);
    if (isExisting) updateWorkOrder(patched.id, patched);
    else addWorkOrder(patched);
    onClose();
  };

  const isLocked = draft.status === 'invoiced';
  // En mode mockup, on suppose admin partout. Phase 3 : useCan('travaux','admin').
  const canValidate = isValid;

  const fieldClass =
    'h-10 w-full rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 text-sm';
  const smallFieldClass =
    'h-9 w-full rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) px-2 text-sm';

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center md:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isExisting ? 'Modifier le bon de travail' : 'Nouveau bon de travail'}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-(--radius-lg) border border-(--color-border) bg-(--color-surface) shadow-(--shadow-popup) md:max-w-3xl md:rounded-(--radius-lg)"
      >
        <header className="flex items-center gap-2 border-b border-(--color-border) px-4 py-3">
          <h2 className="m-0 text-sm font-semibold">
            {isExisting ? 'Modifier le bon de travail' : 'Nouveau bon de travail'}
          </h2>
          {/* Sélecteur de statut visuel (workflow Planifié → Réalisé → Terminé).
              Plus user-friendly que des boutons éparpillés dans le footer. */}
          {isExisting && (
            <StatusPicker
              status={draft.status}
              canValidate={canValidate}
              onChange={(s) => setStatus(s)}
            />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-(--radius-sm) text-(--color-muted) hover:bg-[#f1f1ee]"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {/* ─── En-tête du bon ─── */}
          <section>
            <h3 className="m-0 mb-2 text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
              Informations générales
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Date" required>
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => setField('date', e.target.value)}
                  className={fieldClass}
                />
              </Field>
              <Field label="Statut">
                <select
                  value={draft.status}
                  onChange={(e) => setField('status', e.target.value as WorkOrderStatus)}
                  className={fieldClass}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Client" required>
                <select
                  value={draft.clientId}
                  onChange={(e) => setField('clientId', e.target.value)}
                  className={fieldClass}
                >
                  <option value="">— Sélectionner —</option>
                  {clients
                    .filter((c) => c.active)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Machine globale">
                <input
                  type="text"
                  value={draft.machine ?? ''}
                  onChange={(e) => setField('machine', e.target.value || undefined)}
                  placeholder="Ex. JD 6155R + outil"
                  className={fieldClass}
                />
              </Field>
              <Field label="Échéance">
                <input
                  type="date"
                  value={draft.deadline ?? ''}
                  onChange={(e) => setField('deadline', e.target.value || undefined)}
                  className={fieldClass}
                />
              </Field>
            </div>

            {/* Opérateurs assignés (task.user_ids) — clic sur la zone =
                ouvre le picker plein écran (même UX que les Parcelles). */}
            <div className="mt-3">
              <Field
                label="Opérateurs assignés"
                hint="Distinct des saisies de temps (qui a effectivement travaillé)"
              >
                <button
                  type="button"
                  onClick={() => setOperatorPickerOpen(true)}
                  className="flex w-full flex-wrap items-center gap-2 rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-2 text-left hover:border-(--color-primary) hover:bg-[#fbfbf9]"
                  title="Cliquer pour modifier les opérateurs assignés"
                >
                  {draft.userIds.length === 0 ? (
                    <span className="px-1 text-[11px] text-(--color-muted)">
                      Aucun opérateur assigné — cliquer pour sélectionner
                    </span>
                  ) : (
                    users
                      .filter((u) => draft.userIds.includes(u.id))
                      .map((u) => (
                        <span
                          key={u.id}
                          className="inline-flex items-center gap-1.5 rounded-(--radius-pill) border border-(--color-border) bg-(--color-surface) py-0.5 pl-1.5 pr-2 text-xs text-(--color-text)"
                        >
                          <span
                            aria-hidden
                            className="inline-block h-5 w-5 shrink-0 rounded-(--radius-pill) text-center text-[10px] font-semibold leading-5 text-white"
                            style={{ background: u.color }}
                          >
                            {u.initials}
                          </span>
                          <span className="font-medium">{u.displayName}</span>
                        </span>
                      ))
                  )}
                </button>
              </Field>
            </div>

            <div className="mt-3">
              <Field label="Description / contexte">
                <textarea
                  value={draft.description ?? ''}
                  onChange={(e) => setField('description', e.target.value || undefined)}
                  rows={2}
                  className="w-full rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <div className="mt-3">
              <Field
                label="Parcelles concernées"
                hint={
                  selectedParcelsInfo.items.length > 0
                    ? `${selectedParcelsInfo.items.length} parcelle(s) · ${selectedParcelsInfo.totalHa} ha total`
                    : 'Aucune parcelle — cliquez sur « Sélectionner »'
                }
              >
                <div className="flex flex-wrap items-center gap-2 rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-2">
                  {selectedParcelsInfo.items.length === 0 ? (
                    <span className="px-1 text-[11px] text-(--color-muted)">
                      Aucune parcelle sélectionnée
                    </span>
                  ) : (
                    selectedParcelsInfo.items.map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1.5 rounded-(--radius-pill) border border-(--color-border) bg-(--color-surface) py-0.5 pl-1.5 pr-1 text-xs text-(--color-text)"
                      >
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-(--radius-pill)"
                          style={{ background: p.color ?? 'var(--color-primary)' }}
                        />
                        <span className="max-w-[180px] truncate font-medium">{p.name}</span>
                        <span className="text-[10px] text-(--color-muted)">
                          {p.surfaceHa.toFixed(2)} ha
                        </span>
                        <button
                          type="button"
                          onClick={() => removeParcel(p.id)}
                          aria-label={`Retirer ${p.name}`}
                          className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-(--radius-pill) text-(--color-muted) hover:bg-[#f1f1ee] hover:text-(--color-text)"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                  <button
                    type="button"
                    onClick={() => setParcelPickerOpen(true)}
                    className="ml-auto inline-flex h-8 items-center gap-1 rounded-(--radius-sm) border border-(--color-primary) bg-(--color-primary)/10 px-2 text-xs font-medium text-(--color-primary) hover:bg-(--color-primary)/20"
                  >
                    {selectedParcelsInfo.items.length > 0
                      ? 'Modifier'
                      : '+ Sélectionner des parcelles'}
                  </button>
                </div>
              </Field>
            </div>
          </section>

          {/* ─── Lignes de prestation ───
           * Affichage dense : lignes en carte compacte (cliquables) + une seule
           * ligne éditable à la fois (formulaire complet). Bouton header dual :
           * "+ Ajouter une prestation" quand rien en cours, "Enregistrer la
           * prestation" quand une ligne est en édition.
           */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="m-0 text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
                Prestations ({draft.lines.length})
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (editingLineId) {
                    setEditingLineId(null);
                  } else {
                    setPrestationPickerTarget('new');
                  }
                }}
                className={[
                  'inline-flex h-8 items-center gap-1 rounded-(--radius-sm) px-2 text-xs font-medium',
                  editingLineId
                    ? 'border border-(--color-primary) bg-(--color-primary) text-white hover:bg-(--color-primary-hover)'
                    : 'border border-(--color-primary) bg-(--color-primary)/10 text-(--color-primary) hover:bg-(--color-primary)/20',
                ].join(' ')}
              >
                {editingLineId ? 'Enregistrer la prestation' : '+ Ajouter une prestation'}
              </button>
            </div>

            {draft.lines.length === 0 ? (
              <div className="rounded-(--radius-sm) border border-dashed border-(--color-border) bg-[#fbfbf9] py-6 text-center text-[11px] text-(--color-muted)">
                Aucune prestation. Cliquez sur « + Ajouter une prestation ».
              </div>
            ) : (
              <ul className="m-0 list-none space-y-2 p-0">
                {draft.lines.map((line, idx) => {
                  const display = resolveLineDisplay(line);
                  const isPerHa = isPerHectareUnit(display.unit);
                  const isEditing = editingLineId === line.id;

                  if (!isEditing) {
                    // Carte compacte : titre + quantité + unité + ✎ + ×
                    return (
                      <li key={line.id}>
                        <div className="flex items-center gap-2 rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) px-3 py-2">
                          <button
                            type="button"
                            onClick={() => setEditingLineId(line.id)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                            title="Modifier cette prestation"
                          >
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                              {display.label}
                            </span>
                            <span className="shrink-0 text-xs tabular-nums text-(--color-text)">
                              {line.quantity ?? '—'}
                              <span className="ml-1 text-[10px] text-(--color-muted)">
                                {display.unit || ''}
                              </span>
                            </span>
                          </button>
                          {line.description && (
                            <span className="hidden max-w-[180px] truncate text-[11px] text-(--color-muted) md:inline">
                              · {line.description}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingLineId(line.id)}
                            aria-label={`Modifier la ligne ${idx + 1}`}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-(--radius-sm) text-(--color-muted) hover:bg-[#f1f1ee] hover:text-(--color-text)"
                            title="Modifier"
                          >
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
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (editingLineId === line.id) setEditingLineId(null);
                              removeLine(line.id);
                            }}
                            aria-label={`Supprimer la ligne ${idx + 1}`}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-(--radius-sm) text-(--color-error) hover:bg-[#fef2f2]"
                          >
                            ×
                          </button>
                        </div>
                      </li>
                    );
                  }

                  // Mode édition : formulaire complet
                  return (
                    <li
                      key={line.id}
                      className="rounded-(--radius-sm) border border-(--color-primary)/40 bg-(--color-primary)/5 p-3"
                    >
                      <div className="mb-2 flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => setPrestationPickerTarget(line.id)}
                          className="min-w-0 flex-1 rounded-(--radius-sm) border border-transparent px-2 py-1 text-left text-sm font-medium hover:border-(--color-border) hover:bg-(--color-surface)"
                          title="Changer la prestation"
                        >
                          <span className="block truncate">{display.label}</span>
                          <span className="mt-0.5 inline-flex items-center gap-1.5 text-[10px] text-(--color-muted)">
                            <span className="rounded-(--radius-pill) bg-[#f1f1ee] px-1.5 py-0.5 font-mono tabular-nums">
                              {display.unit || '—'}
                            </span>
                            <span>Cliquer pour changer</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLineId(null);
                            removeLine(line.id);
                          }}
                          aria-label={`Supprimer la ligne ${idx + 1}`}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-(--radius-sm) text-(--color-error) hover:bg-[#fef2f2]"
                        >
                          ×
                        </button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className="mb-0.5 block text-[11px] font-medium">
                            Quantité{display.unit ? ` (${display.unit})` : ''}
                            {isPerHa && selectedParcelsInfo.totalHa > 0 && (
                              <span className="ml-1 text-[10px] font-normal text-(--color-muted)">
                                pré-rempli depuis les parcelles
                              </span>
                            )}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.quantity ?? ''}
                            onChange={(e) =>
                              setLineQuantity(
                                line.id,
                                e.target.value ? Math.max(0, Number(e.target.value)) : undefined,
                              )
                            }
                            placeholder={isPerHa ? 'ex. surface totale ha' : ''}
                            className={smallFieldClass}
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[11px] font-medium">
                            Description / notes
                          </label>
                          <input
                            type="text"
                            value={line.description ?? ''}
                            onChange={(e) =>
                              updateLine(line.id, { description: e.target.value || undefined })
                            }
                            placeholder="Précision pour cette prestation"
                            className={smallFieldClass}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ─── Saisies de temps ───
           * Même pattern condensé que les prestations : carte compacte par
           * défaut, formulaire complet sur l'entrée éditée. Bouton header dual. */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="m-0 text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
                Saisies de temps ({draft.timeEntries.length})
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (editingEntryId) setEditingEntryId(null);
                  else addTimeEntry();
                }}
                className={[
                  'inline-flex h-8 items-center gap-1 rounded-(--radius-sm) px-2 text-xs font-medium',
                  editingEntryId
                    ? 'border border-(--color-primary) bg-(--color-primary) text-white hover:bg-(--color-primary-hover)'
                    : 'border border-(--color-primary) bg-(--color-primary)/10 text-(--color-primary) hover:bg-(--color-primary)/20',
                ].join(' ')}
              >
                {editingEntryId ? 'Enregistrer la saisie' : '+ Ajouter une saisie'}
              </button>
            </div>

            {draft.timeEntries.length === 0 ? (
              <div className="rounded-(--radius-sm) border border-dashed border-(--color-border) bg-[#fbfbf9] py-6 text-center text-[11px] text-(--color-muted)">
                Aucune saisie. Plusieurs opérateurs peuvent intervenir sur le même bon.
              </div>
            ) : (
              <ul className="m-0 list-none space-y-2 p-0">
                {draft.timeEntries.map((entry, idx) => {
                  const isEditing = editingEntryId === entry.id;
                  const operator = users.find((u) => u.id === entry.operatorId);
                  if (!isEditing) {
                    return (
                      <li key={entry.id}>
                        <div className="flex items-center gap-2 rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) px-3 py-2">
                          <button
                            type="button"
                            onClick={() => setEditingEntryId(entry.id)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                            title="Modifier cette saisie"
                          >
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                              {operator?.displayName ?? 'Opérateur non défini'}
                            </span>
                            <span className="shrink-0 text-xs text-(--color-muted)">
                              {entry.date ?? draft.date}
                            </span>
                            <span className="shrink-0 text-xs tabular-nums">
                              {entry.durationHours.toFixed(2)} h
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingEntryId(entry.id)}
                            aria-label={`Modifier la saisie ${idx + 1}`}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-(--radius-sm) text-(--color-muted) hover:bg-[#f1f1ee] hover:text-(--color-text)"
                            title="Modifier"
                          >
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
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (editingEntryId === entry.id) setEditingEntryId(null);
                              removeTimeEntry(entry.id);
                            }}
                            aria-label={`Supprimer la saisie ${idx + 1}`}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-(--radius-sm) text-(--color-error) hover:bg-[#fef2f2]"
                          >
                            ×
                          </button>
                        </div>
                      </li>
                    );
                  }
                  return (
                    <li
                      key={entry.id}
                      className="rounded-(--radius-sm) border border-(--color-primary)/40 bg-(--color-primary)/5 p-3"
                    >
                      <div className="mb-2 flex items-baseline justify-between gap-2">
                        <span className="text-[11px] font-semibold text-(--color-muted)">
                          Saisie {idx + 1}
                        </span>
                        <span className="ml-auto text-xs font-medium tabular-nums">
                          {entry.durationHours.toFixed(2)} h
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEntryId(null);
                            removeTimeEntry(entry.id);
                          }}
                          aria-label={`Supprimer la saisie ${idx + 1}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-(--radius-sm) text-(--color-error) hover:bg-[#fef2f2]"
                        >
                          ×
                        </button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                        <div className="md:col-span-2">
                          <label className="mb-0.5 block text-[11px] font-medium">Opérateur</label>
                          <select
                            value={entry.operatorId}
                            onChange={(e) =>
                              updateTimeEntry(entry.id, { operatorId: e.target.value })
                            }
                            className={smallFieldClass}
                          >
                            <option value="">— Sélectionner —</option>
                            {users
                              .filter((u) => u.active)
                              .map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.displayName}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[11px] font-medium">Date</label>
                          <input
                            type="date"
                            value={entry.date ?? ''}
                            onChange={(e) =>
                              updateTimeEntry(entry.id, { date: e.target.value || undefined })
                            }
                            className={smallFieldClass}
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[11px] font-medium">Durée (h)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={entry.durationHours || ''}
                            onChange={(e) =>
                              updateTimeEntry(entry.id, {
                                durationHours: e.target.value
                                  ? Math.max(0, Number(e.target.value))
                                  : 0,
                              })
                            }
                            className={smallFieldClass}
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[11px] font-medium">Début</label>
                          <input
                            type="time"
                            value={entry.startTime ?? ''}
                            onChange={(e) =>
                              updateTimeEntry(entry.id, { startTime: e.target.value || undefined })
                            }
                            className={smallFieldClass}
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[11px] font-medium">Fin</label>
                          <input
                            type="time"
                            value={entry.endTime ?? ''}
                            onChange={(e) =>
                              updateTimeEntry(entry.id, { endTime: e.target.value || undefined })
                            }
                            className={smallFieldClass}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ─── Facturation ─── */}
          {(draft.status === 'invoiced' || draft.invoiceRef) && (
            <section className="rounded-(--radius-sm) bg-(--color-primary)/5 p-3">
              <h3 className="m-0 mb-2 text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
                Facturation
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Référence facture">
                  <input
                    type="text"
                    value={draft.invoiceRef ?? ''}
                    onChange={(e) => setField('invoiceRef', e.target.value || undefined)}
                    placeholder="F2026-0123"
                    className={fieldClass}
                  />
                </Field>
                <Field label="Date de facturation">
                  <input
                    type="date"
                    value={draft.invoicedAt ?? ''}
                    onChange={(e) => setField('invoicedAt', e.target.value || undefined)}
                    className={fieldClass}
                  />
                </Field>
              </div>
            </section>
          )}

          {/* ─── Notes ─── */}
          <Field label="Notes internes">
            <textarea
              value={draft.notes ?? ''}
              onChange={(e) => setField('notes', e.target.value || undefined)}
              rows={2}
              className="w-full rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-(--color-border) p-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-4 text-sm font-medium hover:bg-[#f8f8f5]"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!isValid || isLocked}
            className="inline-flex h-10 items-center rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-5 text-sm font-medium text-white hover:bg-(--color-primary-hover) disabled:opacity-50"
          >
            {isExisting ? 'Enregistrer' : 'Créer'}
          </button>
        </footer>
      </div>

      {parcelPickerOpen && (
        <ParcelMultiPicker
          parcels={parcels}
          selectedIds={draft.parcelIds ?? []}
          onConfirm={(ids) => setParcels(ids)}
          onClose={() => setParcelPickerOpen(false)}
          allowEmpty
          title="Parcelles concernées par le bon"
        />
      )}

      {operatorPickerOpen && (
        <OperatorMultiPicker
          users={users}
          selectedIds={draft.userIds}
          onConfirm={(ids) => setField('userIds', ids)}
          onClose={() => setOperatorPickerOpen(false)}
        />
      )}

      {prestationPickerTarget !== null && (
        <PrestationPicker
          currentValue={(() => {
            if (prestationPickerTarget === 'new') return undefined;
            const l = draft.lines.find((x) => x.id === prestationPickerTarget);
            return l ? { workType: l.workType, productId: l.productId } : undefined;
          })()}
          onSelect={(source) => applyPrestationSource(prestationPickerTarget, source)}
          onClose={() => setPrestationPickerTarget(null)}
        />
      )}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
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

/**
 * Sélecteur de statut visuel dans le header — workflow Planifié → Réalisé → Terminé.
 * Plus user-friendly que des boutons éparpillés en footer. Cf. mémoire
 * project-workflow-validation-travaux.
 *
 * Comportement :
 *  - Affiche le chip du statut courant
 *  - Click → menu déroulant avec actions disponibles selon le statut
 *  - Si Terminé (verrouillé), seule action visible = Débloquer
 */
function StatusPicker({
  status,
  canValidate,
  onChange,
}: {
  status: WorkOrderStatus;
  canValidate: boolean;
  onChange: (next: WorkOrderStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const meta: Record<WorkOrderStatus, { label: string; bg: string; text: string }> = {
    planned: { label: 'Planifié', bg: 'bg-[#f1f1ee]', text: 'text-(--color-text)' },
    'in-progress': { label: 'En cours', bg: 'bg-[#fef3c7]', text: 'text-[#92400e]' },
    done: { label: 'Réalisé', bg: 'bg-[#dcfce7]', text: 'text-[#166534]' },
    invoiced: { label: 'Terminé', bg: 'bg-(--color-primary)/15', text: 'text-(--color-primary)' },
    cancelled: { label: 'Annulé', bg: 'bg-[#fee2e2]', text: 'text-[#991b1b]' },
  };
  const m = meta[status];

  const options: Array<{ value: WorkOrderStatus; label: string; isPrimary?: boolean }> = [];
  if (status === 'planned') {
    options.push({ value: 'done', label: 'Marquer comme Réalisé' });
    if (canValidate)
      options.push({ value: 'invoiced', label: 'Marquer comme Terminé', isPrimary: true });
  } else if (status === 'done') {
    options.push({ value: 'planned', label: 'Repasser en Planifié' });
    if (canValidate)
      options.push({ value: 'invoiced', label: 'Marquer comme Terminé', isPrimary: true });
  } else if (status === 'invoiced') {
    options.push({ value: 'done', label: 'Débloquer (repasser en Réalisé)' });
  }

  return (
    <div ref={ref} className="relative ml-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={[
          'inline-flex items-center gap-1.5 rounded-(--radius-pill) px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase',
          m.bg,
          m.text,
        ].join(' ')}
      >
        {m.label}
        {options.length > 0 && (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            width={12}
            height={12}
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        )}
      </button>
      {open && options.length > 0 && (
        <ul
          role="menu"
          className="absolute left-0 top-full z-[1300] mt-1 min-w-[220px] rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-1 shadow-(--shadow-popup)"
        >
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={[
                  'flex h-9 w-full items-center rounded-(--radius-sm) px-2.5 text-sm hover:bg-[#f8f8f5]',
                  o.isPrimary ? 'font-semibold text-(--color-primary)' : 'text-(--color-text)',
                ].join(' ')}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
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
