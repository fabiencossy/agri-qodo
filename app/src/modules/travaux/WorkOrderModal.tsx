import { useMemo, useState } from 'react';
import { addWorkOrder, updateWorkOrder, useClients } from './travaux.store';
import { WORK_CATEGORY_LABELS, WORK_TYPES, getWorkType } from './travaux.catalog';
import {
  computeLineTotal,
  computeWorkOrderTotal,
  computeWorkOrderDuration,
  durationFromTimes,
  PRIORITY_LABELS,
  type WorkOrder,
  type WorkOrderLine,
  type WorkOrderPriority,
  type WorkOrderStatus,
  type WorkTimeEntry,
} from './travaux.types';
import { useUsers } from '../users/users.store';
import { useParcels } from '../parcellaire/parcellaire.store';
import { ParcelMultiPicker } from '../parcel-groups/ParcelMultiPicker';

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
  const parcels = useParcels();

  const [parcelPickerOpen, setParcelPickerOpen] = useState(false);

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
    userIds: initial?.userIds ?? [],
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
  const addLine = () => {
    const newLine: WorkOrderLine = {
      id: `WL-${Date.now()}-${Math.floor(performance.now())}`,
      workType: '',
      billingUnit: 'heure',
    };
    setDraft((d) => ({ ...d, lines: [...d.lines, newLine] }));
  };

  const updateLine = (id: string, patch: Partial<WorkOrderLine>) => {
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  };

  const onLineWorkTypeChange = (id: string, key: string) => {
    const wt = getWorkType(key);
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l) => {
        if (l.id !== id) return l;
        if (!wt) return { ...l, workType: key };
        const billing = l.billingUnit ?? wt.defaultBillingUnit;
        const rate =
          billing === 'hectare'
            ? wt.defaultPerHectareRateChf
            : billing === 'heure'
              ? wt.defaultHourlyRateChf
              : l.unitRateChf;
        return {
          ...l,
          workType: key,
          billingUnit: billing,
          unitRateChf: l.unitRateChf ?? rate,
        };
      }),
    }));
  };

  const removeLine = (id: string) => {
    setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.id !== id) }));
  };

  // ─── Saisies de temps ──────────────────────────────────────────────────
  const addTimeEntry = () => {
    const newEntry: WorkTimeEntry = {
      id: `WT-${Date.now()}-${Math.floor(performance.now())}`,
      operatorId: '',
      date: draft.date,
      durationHours: 0,
    };
    setDraft((d) => ({ ...d, timeEntries: [...d.timeEntries, newEntry] }));
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

  const removeParcel = (parcelId: string) => {
    setDraft((d) => ({
      ...d,
      parcelIds: (d.parcelIds ?? []).filter((id) => id !== parcelId),
    }));
  };

  const setParcels = (ids: ReadonlyArray<string>) => {
    setDraft((d) => ({ ...d, parcelIds: ids }));
    setParcelPickerOpen(false);
  };

  // Calcul surface totale des parcelles sélectionnées (affichage chips)
  const selectedParcelsInfo = useMemo(() => {
    const ids = draft.parcelIds ?? [];
    const items = parcels.filter((p) => ids.includes(p.id));
    const totalHa = items.reduce((sum, p) => sum + p.surfaceHa, 0);
    return { items, totalHa: Math.round(totalHa * 100) / 100 };
  }, [draft.parcelIds, parcels]);

  // ─── Totaux dérivés ────────────────────────────────────────────────────
  const totalChf = useMemo(() => computeWorkOrderTotal(draft), [draft]);
  const totalDuration = useMemo(() => computeWorkOrderDuration(draft), [draft]);

  const groupedTypes = useMemo(() => {
    const map = new Map<string, (typeof WORK_TYPES)[number][]>();
    for (const w of WORK_TYPES) {
      if (!w.active) continue;
      const arr = map.get(w.category) ?? [];
      arr.push(w);
      map.set(w.category, arr);
    }
    return [...map.entries()];
  }, []);

  // ─── Validation & submit ───────────────────────────────────────────────
  const isValid =
    Boolean(draft.clientId) &&
    Boolean(draft.date) &&
    draft.lines.length > 0 &&
    draft.lines.every((l) => Boolean(l.workType));

  const submit = () => {
    if (!isValid) return;
    if (isExisting) updateWorkOrder(draft.id, draft);
    else addWorkOrder(draft);
    onClose();
  };

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
          <span className="ml-3 text-[11px] text-(--color-muted)">
            {draft.lines.length} prestation{draft.lines.length > 1 ? 's' : ''} · {totalDuration} h ·{' '}
            {totalChf.toLocaleString('fr-CH')} CHF
          </span>
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
              <Field label="Priorité" hint="Mappé sur task.priority Odoo">
                <select
                  value={draft.priority}
                  onChange={(e) => setField('priority', e.target.value as WorkOrderPriority)}
                  className={fieldClass}
                >
                  {(['0', '1', '2', '3'] as WorkOrderPriority[]).map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </select>
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

            {/* Opérateurs assignés (task.user_ids) */}
            <div className="mt-3">
              <Field
                label="Opérateurs assignés"
                hint="Distinct des saisies de temps (qui a effectivement travaillé)"
              >
                <div className="flex flex-wrap gap-1.5 rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-2">
                  {users
                    .filter((u) => u.active)
                    .map((u) => {
                      const checked = draft.userIds.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() =>
                            setField(
                              'userIds',
                              checked
                                ? draft.userIds.filter((id) => id !== u.id)
                                : [...draft.userIds, u.id],
                            )
                          }
                          className={[
                            'inline-flex items-center gap-1 rounded-(--radius-pill) px-2 py-1 text-xs',
                            checked
                              ? 'bg-(--color-primary) text-white'
                              : 'border border-(--color-border) bg-(--color-surface) hover:bg-[#f8f8f5]',
                          ].join(' ')}
                        >
                          <span
                            aria-hidden
                            className="inline-block h-4 w-4 rounded-(--radius-pill) text-center text-[9px] font-semibold leading-4"
                            style={{
                              background: checked ? 'rgba(255,255,255,0.25)' : u.color,
                              color: checked ? 'white' : 'white',
                            }}
                          >
                            {u.initials}
                          </span>
                          {u.displayName}
                        </button>
                      );
                    })}
                </div>
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
                        className="inline-flex items-center gap-1 rounded-(--radius-pill) bg-(--color-primary)/10 py-0.5 pl-2 pr-1 text-xs text-(--color-primary)"
                        style={p.color ? { background: `${p.color}22`, color: p.color } : undefined}
                      >
                        <span className="max-w-[180px] truncate font-medium">{p.name}</span>
                        <span className="text-[10px] opacity-70">{p.surfaceHa.toFixed(1)} ha</span>
                        <button
                          type="button"
                          onClick={() => removeParcel(p.id)}
                          aria-label={`Retirer ${p.name}`}
                          className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-(--radius-pill) hover:bg-black/10"
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

          {/* ─── Lignes de prestation ─── */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="m-0 text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
                Prestations ({draft.lines.length})
              </h3>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex h-8 items-center gap-1 rounded-(--radius-sm) border border-(--color-primary) bg-(--color-primary)/10 px-2 text-xs font-medium text-(--color-primary) hover:bg-(--color-primary)/20"
              >
                + Ajouter une prestation
              </button>
            </div>

            {draft.lines.length === 0 ? (
              <div className="rounded-(--radius-sm) border border-dashed border-(--color-border) bg-[#fbfbf9] py-6 text-center text-[11px] text-(--color-muted)">
                Aucune prestation. Cliquez sur « + Ajouter une prestation ».
              </div>
            ) : (
              <ul className="m-0 list-none space-y-2 p-0">
                {draft.lines.map((line, idx) => {
                  const lineTotal = computeLineTotal(line);
                  return (
                    <li
                      key={line.id}
                      className="rounded-(--radius-sm) border border-(--color-border) bg-[#fbfbf9] p-3"
                    >
                      <div className="mb-2 flex items-baseline justify-between gap-2">
                        <span className="text-[11px] font-semibold text-(--color-muted)">
                          Ligne {idx + 1}
                        </span>
                        <span className="ml-auto text-xs font-medium tabular-nums">
                          {lineTotal.toLocaleString('fr-CH')} CHF
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          aria-label={`Supprimer la ligne ${idx + 1}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-(--radius-sm) text-(--color-error) hover:bg-[#fef2f2]"
                        >
                          ×
                        </button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="mb-0.5 block text-[11px] font-medium">
                            Type de prestation
                          </label>
                          <select
                            value={line.workType}
                            onChange={(e) => onLineWorkTypeChange(line.id, e.target.value)}
                            className={smallFieldClass}
                          >
                            <option value="">— Sélectionner —</option>
                            {groupedTypes.map(([cat, types]) => (
                              <optgroup key={cat} label={WORK_CATEGORY_LABELS[cat] ?? cat}>
                                {types.map((w) => (
                                  <option key={w.key} value={w.key}>
                                    {w.label}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-0.5 block text-[11px] font-medium">Durée (h)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={line.durationHours ?? ''}
                            onChange={(e) =>
                              updateLine(line.id, {
                                durationHours: e.target.value
                                  ? Math.max(0, Number(e.target.value))
                                  : undefined,
                              })
                            }
                            className={smallFieldClass}
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[11px] font-medium">
                            Surface (ha)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.surfaceHa ?? ''}
                            onChange={(e) =>
                              updateLine(line.id, {
                                surfaceHa: e.target.value
                                  ? Math.max(0, Number(e.target.value))
                                  : undefined,
                              })
                            }
                            className={smallFieldClass}
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[11px] font-medium">
                            Facturation
                          </label>
                          <select
                            value={line.billingUnit}
                            onChange={(e) =>
                              updateLine(line.id, {
                                billingUnit: e.target.value as WorkOrderLine['billingUnit'],
                              })
                            }
                            className={smallFieldClass}
                          >
                            <option value="heure">À l'heure</option>
                            <option value="hectare">À l'hectare</option>
                            <option value="forfait">Forfait</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[11px] font-medium">
                            Tarif unitaire (CHF)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitRateChf ?? ''}
                            onChange={(e) =>
                              updateLine(line.id, {
                                unitRateChf: e.target.value
                                  ? Math.max(0, Number(e.target.value))
                                  : undefined,
                              })
                            }
                            className={smallFieldClass}
                          />
                        </div>

                        <div className="sm:col-span-2">
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

          {/* ─── Saisies de temps ─── */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="m-0 text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
                Saisies de temps ({draft.timeEntries.length})
              </h3>
              <button
                type="button"
                onClick={addTimeEntry}
                className="inline-flex h-8 items-center gap-1 rounded-(--radius-sm) border border-(--color-primary) bg-(--color-primary)/10 px-2 text-xs font-medium text-(--color-primary) hover:bg-(--color-primary)/20"
              >
                + Ajouter une saisie
              </button>
            </div>

            {draft.timeEntries.length === 0 ? (
              <div className="rounded-(--radius-sm) border border-dashed border-(--color-border) bg-[#fbfbf9] py-6 text-center text-[11px] text-(--color-muted)">
                Aucune saisie. Plusieurs opérateurs peuvent intervenir sur le même bon.
              </div>
            ) : (
              <ul className="m-0 list-none space-y-2 p-0">
                {draft.timeEntries.map((entry, idx) => (
                  <li
                    key={entry.id}
                    className="rounded-(--radius-sm) border border-(--color-border) bg-[#fbfbf9] p-3"
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
                        onClick={() => removeTimeEntry(entry.id)}
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
                      <div className="md:col-span-2">
                        <label className="mb-0.5 block text-[11px] font-medium">
                          Liée à la prestation
                        </label>
                        <select
                          value={entry.lineId ?? ''}
                          onChange={(e) =>
                            updateTimeEntry(entry.id, { lineId: e.target.value || undefined })
                          }
                          className={smallFieldClass}
                        >
                          <option value="">— Bon entier —</option>
                          {draft.lines.map((l, i) => {
                            const wt = getWorkType(l.workType);
                            return (
                              <option key={l.id} value={l.id}>
                                Ligne {i + 1} : {wt?.label ?? l.workType ?? '(non défini)'}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                  </li>
                ))}
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

        <footer className="flex items-center gap-2 border-t border-(--color-border) p-3">
          <div className="text-sm">
            Total :{' '}
            <span className="font-semibold tabular-nums">
              {totalChf.toLocaleString('fr-CH')} CHF
            </span>{' '}
            · {totalDuration} h
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto inline-flex h-10 items-center rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-4 text-sm font-medium hover:bg-[#f8f8f5]"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!isValid}
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
