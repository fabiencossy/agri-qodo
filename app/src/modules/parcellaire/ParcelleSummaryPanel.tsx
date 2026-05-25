import { useMemo, useState } from 'react';
import { DetailPanel } from '../../components/DetailPanel';
import type { ParcelDetail } from './parcellaire.mocks';
import { AssolementTimeline } from '../assolement/AssolementTimeline';
import { AssolementSegmentModal } from '../assolement/AssolementSegmentModal';
import { getActiveSegment, getSegmentsForParcelYear } from '../assolement/assolement.helpers';
import { useSegments } from '../assolement/assolement.store';
import { cultureColor } from '../assolement/cultures';
import type { AssolementSegment } from '../assolement/assolement.types';
import { useIsCurrentFarmInvitee } from '../farms/farms.helpers';
import { useWorkOrders, useClients } from '../travaux/travaux.store';
import { getWorkType } from '../travaux/travaux.catalog';
import {
  USER_MARKER_KIND_COLORS,
  USER_MARKER_KIND_LABELS,
  useUserMarkers,
  type UserMarker,
} from './userMarkers.store';
import { UserMarkerModal } from './UserMarkerModal';

const TODAY = new Date().toISOString().slice(0, 10);

interface ParcelleSummaryPanelProps {
  parcel: ParcelDetail;
  onClose: () => void;
  onOpenFiche: () => void;
  onOpenAssolement: () => void;
  /** Optionnel : callback pour ouvrir un travail dans le modal complet. */
  onOpenWorkOrder?: (workOrderId: string) => void;
}

/**
 * Panneau riche affiché au clic sur une parcelle dans la carte du Parcellaire.
 * Synthèse : assolement courant, dernières interventions (mock), notes.
 * Footer avec bouton pour ouvrir la fiche complète.
 *
 * Les blocs "Stade phénologique" et "Bilan de fumure" mock ont été retirés —
 * le bilan de fumure réel est dans la fiche parcelle (FumureSection branchée
 * au Carnet via fertilizerSummary).
 */
export function ParcelleSummaryPanel({
  parcel,
  onClose,
  onOpenFiche,
  onOpenAssolement,
  onOpenWorkOrder,
}: ParcelleSummaryPanelProps) {
  const year = parcel.year;
  const isInvitee = useIsCurrentFarmInvitee();
  const allSegments = useSegments();
  const segments = useMemo(
    () => getSegmentsForParcelYear(parcel.id, year, allSegments),
    [parcel.id, year, allSegments],
  );
  const active = useMemo(
    () => getActiveSegment(parcel.id, TODAY, allSegments),
    [parcel.id, allSegments],
  );
  const [editingSegment, setEditingSegment] = useState<
    AssolementSegment | { draft: true; parcelId: string; year: number } | null
  >(null);
  const [editingMarker, setEditingMarker] = useState<UserMarker | null>(null);

  // Balises GPS rattachées à cette parcelle
  const allMarkers = useUserMarkers();
  const markers = useMemo(
    () => allMarkers.filter((m) => m.parcelId === parcel.id),
    [allMarkers, parcel.id],
  );

  // Mocks Phase 2.5 (interventions à brancher au Carnet réel — Phase 3)
  const interventions = mockInterventions(parcel.id);

  // En mode invité, le panel est minimal :
  //  - pas d'assolement, pas d'interventions, pas de notes (info privée du client)
  //  - point d'attention visible (sécurité, contraintes opérationnelles)
  //  - section "Travaux effectués" : MES bons sur cette parcelle
  //  - footer = action principale "Nouveau travail pour tiers" (si fournie)
  if (isInvitee) {
    return (
      <DetailPanel
        title={parcel.name}
        subtitle={`${parcel.surfaceHa.toFixed(2)} ha`}
        onClose={onClose}
        footer={
          <button
            type="button"
            onClick={onOpenFiche}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-4 text-sm font-medium text-white hover:bg-(--color-primary-hover)"
          >
            Ouvrir la fiche de la parcelle
            <ArrowRightIcon />
          </button>
        }
      >
        {parcel.attentionNote && <AttentionBanner note={parcel.attentionNote} />}
        <div className="rounded-(--radius-sm) border border-(--color-border) bg-[#fbfbf9] p-3 text-[12px] text-(--color-muted)">
          Vous êtes invité sur cette exploitation. Seule la position de la parcelle est visible —
          ses données agronomiques (assolement, fertilisation, traitements) appartiennent au
          propriétaire.
        </div>
        <WorkOrdersForParcel parcelId={parcel.id} onOpen={onOpenWorkOrder} />
      </DetailPanel>
    );
  }

  return (
    <DetailPanel
      title={`${parcel.id} — ${parcel.name}`}
      subtitle={`${parcel.surfaceHa.toFixed(2)} ha${active ? ` · ${active.culture}` : ''}`}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onOpenFiche}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-4 text-sm font-medium text-white hover:bg-(--color-primary-hover)"
        >
          Ouvrir la fiche complète
          <ArrowRightIcon />
        </button>
      }
    >
      {/* Point d'attention (priorité visuelle, en tête) */}
      {parcel.attentionNote && <AttentionBanner note={parcel.attentionNote} />}

      {/* Assolement */}
      <Section title="Plan d'assolement">
        {/* Culture EN PLACE aujourd'hui — pas de "dominant" inutile. */}
        <div className="mb-3 rounded-(--radius-sm) border border-(--color-border) bg-[#fbfbf9] p-2.5">
          {active ? (
            <div className="flex items-center gap-2 text-sm font-medium">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 shrink-0 rounded-(--radius-pill)"
                style={{ background: cultureColor(active.culture) }}
              />
              <span className="truncate">
                {active.culture}
                {active.varietyName ? ` · ${active.varietyName}` : ''}
              </span>
              <span className="ml-auto shrink-0 font-mono text-[11px] text-(--color-muted)">
                {fmtDate(active.startDate)} → {fmtDate(active.endDate)}
              </span>
            </div>
          ) : (
            <p className="m-0 text-sm text-(--color-muted)">Aucune culture en place aujourd'hui.</p>
          )}
        </div>

        {/* Timeline cliquable + gros bouton "Ajouter un segment" via onAdd (variant detail) */}
        <AssolementTimeline
          segments={segments}
          year={year}
          variant="detail"
          today={TODAY}
          onSegmentClick={(s) => setEditingSegment(s)}
          onAdd={() => setEditingSegment({ draft: true, parcelId: parcel.id, year })}
        />

        {/* Liste des segments éditables (pattern de l'éditeur d'assolement) */}
        {segments.length > 0 && (
          <div className="mt-4">
            <h3 className="m-0 mb-2 text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
              Segments
            </h3>
            <ul className="m-0 space-y-1.5 list-none p-0">
              {segments.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setEditingSegment(s)}
                    className="flex w-full items-center gap-2 rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) px-2.5 py-2 text-left text-sm hover:bg-[#fbfbf9]"
                  >
                    <span
                      aria-hidden="true"
                      className="inline-block h-3 w-3 shrink-0 rounded-(--radius-pill)"
                      style={{ background: cultureColor(s.culture) }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{s.culture}</span>
                      {s.varietyName && (
                        <span className="text-(--color-muted)"> · {s.varietyName}</span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-(--color-muted)">
                      {fmtDate(s.startDate)} → {fmtDate(s.endDate)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-2 text-right">
          <button
            type="button"
            onClick={onOpenAssolement}
            className="text-[11px] font-medium text-(--color-primary) hover:underline"
          >
            Voir le plan complet →
          </button>
        </div>
      </Section>

      {/* Dernières interventions */}
      <Section title="Dernières interventions" actionLabel="Carnet" onAction={onOpenFiche}>
        {interventions.length > 0 ? (
          <ul className="m-0 list-none space-y-1.5 p-0">
            {interventions.map((it) => (
              <li
                key={it.id}
                className="flex items-start gap-2.5 rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) px-2.5 py-2"
              >
                <span
                  aria-hidden="true"
                  className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-(--radius-pill)"
                  style={{ background: it.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{it.label}</span>
                    <span className="shrink-0 font-mono text-[11px] text-(--color-muted)">
                      {it.date}
                    </span>
                  </div>
                  {it.detail && (
                    <p className="m-0 truncate text-xs text-(--color-muted)">{it.detail}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Aucune intervention enregistrée.</Empty>
        )}
      </Section>

      {/* Balises GPS rattachées */}
      {markers.length > 0 && (
        <Section title={`Balises GPS — ${markers.length}`}>
          <ul className="m-0 list-none space-y-1.5 p-0">
            {markers.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setEditingMarker(m)}
                  className="flex w-full items-start gap-2.5 rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) px-2.5 py-2 text-left hover:bg-[#fbfbf9]"
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-(--radius-pill)"
                    style={{
                      background: `${USER_MARKER_KIND_COLORS[m.kind]}1a`,
                      color: USER_MARKER_KIND_COLORS[m.kind],
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width={12}
                      height={12}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.75}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 22s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {m.label || USER_MARKER_KIND_LABELS[m.kind]}
                      </span>
                      <span className="shrink-0 text-[10px] tracking-wider text-(--color-muted) uppercase">
                        {USER_MARKER_KIND_LABELS[m.kind]}
                      </span>
                    </div>
                    {m.notes && (
                      <p className="m-0 line-clamp-2 text-[11px] text-(--color-muted)">{m.notes}</p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Notes */}
      {parcel.notes && (
        <Section title="Notes">
          <p className="m-0 rounded-(--radius-sm) border border-(--color-border) bg-[#fbfbf9] p-3 text-sm whitespace-pre-line text-(--color-text)">
            {parcel.notes}
          </p>
        </Section>
      )}

      {/* Modal d'édition de segment — accessible depuis le panel sans quitter la carte. */}
      {editingSegment && (
        <AssolementSegmentModal target={editingSegment} onClose={() => setEditingSegment(null)} />
      )}

      {editingMarker && (
        <UserMarkerModal
          key={editingMarker.id}
          marker={editingMarker}
          onClose={() => setEditingMarker(null)}
        />
      )}
    </DetailPanel>
  );
}

/* ============ Sous-composants ============ */

function Section({
  title,
  children,
  actionLabel,
  onAction,
}: {
  title: string;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="m-0 text-[11px] font-semibold tracking-wider text-(--color-muted) uppercase">
          {title}
        </h3>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="text-[11px] font-medium text-(--color-primary) hover:underline"
          >
            {actionLabel}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="m-0 text-xs text-(--color-muted)">{children}</p>;
}

/** Bandeau d'attention (jaune chaud) — affiché quand parcel.attentionNote existe.
 *  Visible côté propriétaire ET côté invité (les contraintes opérationnelles
 *  sont importantes pour tout opérateur de terrain). */
function AttentionBanner({ note }: { note: string }) {
  return (
    <div className="mb-4 flex gap-2 rounded-(--radius-sm) border border-(--color-warning)/40 bg-(--color-warning)/10 p-3">
      <span aria-hidden className="mt-0.5 shrink-0 text-[#92400e]">
        <AttentionIcon />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 text-[10px] font-semibold tracking-wider text-[#92400e] uppercase">
          Point d'attention
        </div>
        <p className="m-0 text-[12px] whitespace-pre-line text-[#92400e]">{note}</p>
      </div>
    </div>
  );
}

/** Section "Travaux effectués" — liste les WorkOrder où la parcelle est listée.
 *  Affichée dans le panel invité pour rappeler l'historique de mes interventions
 *  chez ce client. */
function WorkOrdersForParcel({
  parcelId,
  onOpen,
}: {
  parcelId: string;
  onOpen?: (workOrderId: string) => void;
}) {
  const orders = useWorkOrders();
  const clients = useClients();
  const related = useMemo(
    () =>
      orders
        .filter((o) => (o.parcelIds ?? []).includes(parcelId))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [orders, parcelId],
  );

  return (
    <Section title="Travaux effectués sur cette parcelle">
      {related.length === 0 ? (
        <Empty>Aucun travail enregistré pour cette parcelle.</Empty>
      ) : (
        <ul className="m-0 list-none space-y-1.5 p-0">
          {related.slice(0, 8).map((wo) => {
            const client = clients.find((c) => c.id === wo.clientId);
            const firstLine = wo.lines[0];
            const workTypeLabel = firstLine ? (getWorkType(firstLine.workType)?.label ?? '') : '';
            const content = (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {workTypeLabel ||
                      `${wo.lines.length} prestation${wo.lines.length > 1 ? 's' : ''}`}
                    {wo.lines.length > 1 && workTypeLabel && (
                      <span className="text-(--color-muted)"> +{wo.lines.length - 1}</span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-(--color-muted)">
                    {fmtDate(wo.date)}
                  </span>
                </div>
                <div className="truncate text-[11px] text-(--color-muted)">
                  {client?.name ?? '—'}
                  {' · '}
                  <span className="capitalize">
                    {wo.status === 'planned'
                      ? 'planifié'
                      : wo.status === 'done'
                        ? 'réalisé'
                        : wo.status === 'invoiced'
                          ? 'facturé'
                          : wo.status}
                  </span>
                </div>
              </>
            );
            return (
              <li key={wo.id}>
                {onOpen ? (
                  <button
                    type="button"
                    onClick={() => onOpen(wo.id)}
                    className="block w-full rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) px-2.5 py-2 text-left transition-colors hover:border-(--color-primary) hover:bg-[#fbfbf9]"
                  >
                    {content}
                  </button>
                ) : (
                  <div className="rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) px-2.5 py-2">
                    {content}
                  </div>
                )}
              </li>
            );
          })}
          {related.length > 8 && (
            <li className="px-2.5 text-[11px] text-(--color-muted)">
              + {related.length - 8} travaux plus anciens
            </li>
          )}
        </ul>
      )}
    </Section>
  );
}

function AttentionIcon() {
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
      <path d="M10.3 3.86a2 2 0 0 1 3.4 0l8.57 14.7A2 2 0 0 1 20.57 21H3.43a2 2 0 0 1-1.7-2.94z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function ArrowRightIcon() {
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
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

function fmtDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y!.slice(2)}`;
}

/* ============ Mocks à brancher au Carnet réel (Phase 3) ============ */

function mockInterventions(parcelId: string): Array<{
  id: string;
  label: string;
  detail?: string;
  date: string;
  color: string;
}> {
  // Génère 3 interventions plausibles, pseudo-aléatoires sur l'id.
  const seed = parcelId.length;
  return [
    {
      id: `${parcelId}-i1`,
      label: 'Fertilisation azotée',
      detail: '60 kg N/ha (Nitrate ammoniacal)',
      date: `${10 + (seed % 5)}/04/26`,
      color: '#16a34a',
    },
    {
      id: `${parcelId}-i2`,
      label: 'Herbicide post-levée',
      detail: 'Sulfonylurée 25 g/ha',
      date: `${5 + (seed % 7)}/04/26`,
      color: '#f59e0b',
    },
    {
      id: `${parcelId}-i3`,
      label: 'Observation terrain',
      detail: 'Tallage régulier, sol ressuyé',
      date: `28/03/26`,
      color: '#3b82f6',
    },
  ];
}
