import { useMemo, useRef, useState } from 'react';
import { addWorkOrder, useClients } from './travaux.store';
import { useAllParcels } from '../parcellaire/parcellaire.store';
import { useFarms } from '../farms/farms.store';
import { findFarmForClient } from '../farms/farms.helpers';
import { PrestationPicker } from './PrestationPicker';
import { isPerHectareUnit, type PrestationSource } from './prestation-source';
import type { WorkOrder, WorkOrderLine, WorkOrderStatus } from './travaux.types';

interface QuickWorkOrderModalProps {
  onClose: () => void;
  /** Bascule vers le modal complet avec les valeurs déjà saisies. */
  onSwitchToFull: (draft: Partial<WorkOrder>) => void;
  /** Préfill du client (ex. quand on est sur une farm invitée, le client = propriétaire). */
  initialClientId?: string;
  /** Préfill de la parcelle (ex. parcelle sélectionnée sur la carte). */
  initialParcelId?: string;
}

/**
 * Création rapide d'un bon de travail : 3 champs (client + parcelle + travail)
 * et 2 boutons de soumission (Planifier / Enregistrer directement comme réalisé).
 *
 * Pensé pour la saisie terrain à un doigt — pas de durée, pas de tarif, pas
 * d'opérateurs : tout ça reste éditable depuis le modal complet via le lien
 * "Plus d'options".
 */
export function QuickWorkOrderModal({
  onClose,
  onSwitchToFull,
  initialClientId,
  initialParcelId,
}: QuickWorkOrderModalProps) {
  const clients = useClients();
  const allParcels = useAllParcels();
  const farms = useFarms();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState(today);
  const [scheduledTime, setScheduledTime] = useState('');
  const [clientId, setClientId] = useState(initialClientId ?? '');
  const [parcelId, setParcelId] = useState(initialParcelId ?? '');
  const [source, setSource] = useState<PrestationSource | null>(null);
  const [description, setDescription] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /** Seed initialisé une seule fois (init function = appelé hors render). */
  const [idSeed] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const idCounterRef = useRef(0);
  const nextId = (prefix: string) => {
    idCounterRef.current += 1;
    return `${prefix}-${idSeed}-${idCounterRef.current}`;
  };

  // Parcelles filtrées par client sélectionné : on n'affiche QUE celles de
  // l'exploitation du client (match nom Farm ↔ Client), pas du current farm
  // de l'utilisateur. Si aucun client → liste vide.
  const selectedClient = clients.find((c) => c.id === clientId);
  const clientFarm = useMemo(
    () => findFarmForClient(selectedClient, farms),
    [selectedClient, farms],
  );
  const parcels = useMemo(
    () => (clientFarm ? allParcels.filter((p) => p.farmId === clientFarm.id) : []),
    [allParcels, clientFarm],
  );
  // Dérive parcelId effectif : si plus dans la liste (changement de client), traite comme vide.
  const effectiveParcelId = parcels.some((p) => p.id === parcelId) ? parcelId : '';
  const selectedParcel = parcels.find((p) => p.id === effectiveParcelId);
  const attention = selectedParcel?.attentionNote;
  // Le quick ne sert qu'à PLANIFIER (futur, simple). Pour saisir un travail
  // réalisé avec détails (durée, opérateurs, tarif), passer par "Aller plus
  // loin" qui ouvre le modal complet.
  const canPlan = Boolean(clientId) && Boolean(source);
  // "Aller plus loin" : besoin au minimum d'un client pour avoir quelque chose
  // d'utile à reprendre dans le modal complet (le travail peut être ajouté là-bas).
  const canSwitchToFull = Boolean(clientId);

  /** Construit un draft avec ids fraîchement générés. À appeler uniquement dans
   * un event handler (Date.now n'est pas pur, interdit dans le render). */
  const buildDraft = (status: WorkOrderStatus, woId: string, lineId: string): WorkOrder => {
    const prefillQty =
      source && isPerHectareUnit(source.unit) && selectedParcel
        ? selectedParcel.surfaceHa
        : undefined;
    const line: WorkOrderLine | null = source
      ? {
          id: lineId,
          workType: source.kind === 'worktype' ? source.id : '',
          productId: source.kind === 'product' ? source.id : undefined,
          quantity: prefillQty,
          quantityUnit: source.unit,
          billingUnit:
            source.billingUnit ?? (isPerHectareUnit(source.unit) ? 'hectare' : 'forfait'),
          surfaceHa: isPerHectareUnit(source.unit) ? prefillQty : undefined,
          unitRateChf: source.defaultRateChf,
        }
      : null;
    return {
      id: woId,
      date,
      scheduledTime: scheduledTime || undefined,
      clientId,
      parcelIds: effectiveParcelId ? [effectiveParcelId] : [],
      description: description || undefined,
      status,
      priority: '1',
      userIds: [],
      lines: line ? [line] : [],
      timeEntries: [],
    };
  };

  const submit = (status: WorkOrderStatus) => {
    if (!canPlan) return;
    setSubmitting(true);
    addWorkOrder(buildDraft(status, nextId('WO'), nextId('WL')));
    onClose();
  };

  const switchToFull = () => {
    if (!canSwitchToFull) return;
    onSwitchToFull(buildDraft('planned', nextId('WO'), nextId('WL')));
  };

  const fieldClass =
    'h-11 w-full rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 text-sm focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/15';

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center md:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Création rapide d'un bon de travail"
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-(--radius-lg) border border-(--color-border) bg-(--color-surface) shadow-(--shadow-popup) md:max-w-md md:rounded-(--radius-lg)"
      >
        <header className="flex items-center gap-2 border-b border-(--color-border) px-4 py-3">
          <h2 className="m-0 text-sm font-semibold">Planifier un travail</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-(--radius-sm) text-(--color-muted) hover:bg-[#f1f1ee]"
          >
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
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {attention && (
            <div className="flex gap-2 rounded-(--radius-sm) border border-(--color-warning)/40 bg-(--color-warning)/10 p-3">
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
                className="mt-0.5 shrink-0 text-[#92400e]"
              >
                <path d="M10.3 3.86a2 2 0 0 1 3.4 0l8.57 14.7A2 2 0 0 1 20.57 21H3.43a2 2 0 0 1-1.7-2.94z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 text-[10px] font-semibold tracking-wider text-[#92400e] uppercase">
                  Point d'attention sur {selectedParcel?.name}
                </div>
                <p className="m-0 text-[12px] whitespace-pre-line text-[#92400e]">{attention}</p>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="qwo-client" className="mb-1 block text-xs font-medium">
              Client <span className="text-(--color-error)">*</span>
            </label>
            <select
              id="qwo-client"
              autoFocus
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setParcelId('');
              }}
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
          </div>

          <div>
            <label htmlFor="qwo-parcel" className="mb-1 block text-xs font-medium">
              Parcelle{' '}
              <span className="text-[10px] font-normal text-(--color-muted)">(facultatif)</span>
            </label>
            <select
              id="qwo-parcel"
              value={effectiveParcelId}
              onChange={(e) => setParcelId(e.target.value)}
              className={fieldClass}
            >
              <option value="">— Aucune (travail hors parcelle) —</option>
              {parcels.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.surfaceHa.toFixed(2)} ha
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">
              Travail à faire <span className="text-(--color-error)">*</span>
            </label>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className={`${fieldClass} flex items-center justify-between text-left`}
            >
              {source ? (
                <>
                  <span className="min-w-0 flex-1 truncate">{source.label}</span>
                  <span className="ml-2 shrink-0 rounded-(--radius-pill) bg-[#f1f1ee] px-2 py-0.5 font-mono text-[10px] tabular-nums text-(--color-muted)">
                    {source.unit}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-(--color-muted)">
                    — Choisir une prestation ou produit —
                  </span>
                  <span className="ml-2 text-(--color-primary)">›</span>
                </>
              )}
            </button>
            {source && isPerHectareUnit(source.unit) && selectedParcel && (
              <p className="m-0 mt-1 text-[11px] text-(--color-muted)">
                Quantité pré-remplie : {selectedParcel.surfaceHa.toFixed(2)} ha (surface parcelle)
              </p>
            )}
          </div>

          <div>
            <label htmlFor="qwo-desc" className="mb-1 block text-xs font-medium">
              Notes{' '}
              <span className="text-[10px] font-normal text-(--color-muted)">(facultatif)</span>
            </label>
            <input
              id="qwo-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Précision pour ce travail"
              className={fieldClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="qwo-date" className="mb-1 block text-xs font-medium">
                Date
              </label>
              <input
                id="qwo-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="qwo-time" className="mb-1 block text-xs font-medium">
                Heure prévue{' '}
                <span className="text-[10px] font-normal text-(--color-muted)">(facultatif)</span>
              </label>
              <input
                id="qwo-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>
        </div>

        <footer className="flex flex-col gap-2 border-t border-(--color-border) p-3">
          {/* Ligne 1 : Annuler à gauche, Planifier à droite (le quick ne sert
              QU'À planifier — pour un réalisé avec détails, "Aller plus loin"). */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-4 text-sm font-medium hover:bg-[#f8f8f5] sm:order-1"
            >
              Annuler
            </button>
            <div className="flex flex-1 justify-end">
              <button
                type="button"
                onClick={() => submit('planned')}
                disabled={!canPlan || submitting}
                className="inline-flex h-10 items-center justify-center rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-5 text-sm font-medium text-white hover:bg-(--color-primary-hover) disabled:opacity-50"
                title={
                  canPlan
                    ? 'Planifier ce travail'
                    : 'Renseignez le client et le travail à faire pour planifier'
                }
              >
                Planifier
              </button>
            </div>
          </div>

          {/* Ligne 2 : aller plus loin (modal complet) — pour saisir un réalisé
              avec durée, opérateurs, tarif, ou tout ajustement avancé. */}
          <button
            type="button"
            onClick={switchToFull}
            disabled={!canSwitchToFull}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-(--radius) border border-(--color-primary)/40 bg-(--color-primary)/5 px-4 text-sm font-medium text-(--color-primary) hover:bg-(--color-primary)/10 disabled:opacity-50"
            title="Ouvre le modal complet pour saisir un réalisé, ajouter durée, opérateurs, tarif, saisies de temps…"
          >
            Aller plus loin (durée, opérateurs, tarif…)
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
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </footer>
      </div>

      {pickerOpen && (
        <PrestationPicker
          currentValue={
            source
              ? {
                  workType: source.kind === 'worktype' ? source.id : undefined,
                  productId: source.kind === 'product' ? source.id : undefined,
                }
              : undefined
          }
          onSelect={(s) => setSource(s)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
