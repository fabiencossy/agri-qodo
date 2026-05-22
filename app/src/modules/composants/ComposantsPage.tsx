/**
 * PAGE TEMPORAIRE — showcase des 4 vues de référence /parcellaire.
 *
 * RÉUTILISE EXACTEMENT les composants prod de ParcellairePage :
 *   - MapView (carte swisstopo + tools)
 *   - ParcellaireTable (table + checkbox bulk actions, responsive desktop/mobile)
 *   - AssolementTimeline (gantt 12 mois)
 *   - DashboardView (KPI cards + bar chart Par culture)
 *
 * Source data : stores `useParcels` + `useSegments` (mock data bootstrap).
 *
 * À supprimer une fois validé.
 */
import { useMemo, useRef, useState } from 'react';
import { ViewSwitcher, type ViewKey } from '../../components/ViewSwitcher';
import { SearchBar, type FieldDescriptor, type SearchState } from '../../components/SearchBar';
import { MapView } from '../../components/MapView';
import { ParcellaireTable } from '../parcellaire/ParcellaireTable';
import { useParcels } from '../parcellaire/parcellaire.store';
import { filterParcels } from '../parcellaire/filtering';
import {
  getActiveSegment,
  getAvailableYears,
  getDominantCulture,
  getSegmentsForParcelYear,
} from '../assolement/assolement.helpers';
import { useSegments } from '../assolement/assolement.store';
import { AssolementTimeline } from '../assolement/AssolementTimeline';
import { cultureColor, listCultureGroups } from '../assolement/cultures';
import type { ParcelDetail } from '../parcellaire/parcellaire.mocks';
import type { AssolementSegment } from '../assolement/assolement.types';

const TODAY = new Date().toISOString().slice(0, 10);

const FIELDS: FieldDescriptor[] = [
  { id: 'name', label: 'Nom', type: 'text' },
  { id: 'code', label: 'Code', type: 'text' },
  {
    id: 'culture',
    label: 'Culture',
    type: 'select',
    options: listCultureGroups().map((g) => ({ label: g, value: g })),
    groupable: true,
  },
  {
    id: 'status',
    label: 'Statut',
    type: 'select',
    options: [
      { label: 'Actif', value: 'active' },
      { label: 'Jachère', value: 'fallow' },
      { label: 'Archivé', value: 'archived' },
    ],
    groupable: true,
  },
];

export default function ComposantsPage() {
  const [view, setView] = useState<ViewKey>('map');
  const [searchState, setSearchState] = useState<SearchState>({ facets: [], groupBy: [] });
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const parcels = useParcels();
  const allSegments = useSegments();
  const years = useMemo(() => getAvailableYears(allSegments), [allSegments]);
  const [year, setYear] = useState<number>(years[0] ?? new Date().getFullYear());

  // Enrichissement assolement (même logique que ParcellairePage)
  const parcelsWithAssolement = useMemo<ParcelDetail[]>(
    () =>
      parcels.map((p) => {
        const s = getActiveSegment(p.id, TODAY);
        if (!s) return p;
        return {
          ...p,
          culture: s.culture,
          varietyName: s.varietyName ?? p.varietyName,
          sowingDate: s.startDate,
          color: cultureColor(s.culture),
        };
      }),
    [parcels],
  );

  const filtered = useMemo(
    () => filterParcels(parcelsWithAssolement, searchState),
    [parcelsWithAssolement, searchState],
  );

  const totalSurface = filtered.reduce((s, p) => s + p.surfaceHa, 0);
  const summary = `${filtered.length} parcelles · ${totalSurface.toFixed(1)} ha`;

  const topBar = (
    <div className="flex w-full items-center gap-2">
      <div className="hidden shrink-0 items-baseline gap-2 md:flex">
        <h1 className="m-0 truncate text-base font-semibold">Composants</h1>
        <span className="truncate text-xs text-(--color-muted)">{summary}</span>
      </div>
      <div className="min-w-0 flex-1">
        <SearchBar
          fields={FIELDS}
          value={searchState}
          onChange={setSearchState}
          ariaLabel="Rechercher"
        />
      </div>
      {view === 'timeline' && (
        <div className="shrink-0">
          <select
            aria-label="Campagne"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-9 rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-2 text-sm font-medium text-(--color-text) hover:bg-[#f8f8f5]"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="shrink-0 md:hidden">
        <ViewSwitcher
          views={['map', 'table', 'timeline', 'calendar', 'dashboard']}
          activeView={view}
          onChange={setView}
          layout="dropdown"
          display="icon-only"
        />
      </div>
      <div className="hidden shrink-0 md:block">
        <ViewSwitcher
          views={['map', 'table', 'timeline', 'calendar', 'dashboard']}
          activeView={view}
          onChange={setView}
          layout="segmented"
          display="icon-only"
        />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-(--color-border) bg-(--color-surface) px-3 py-2">
        {topBar}
      </div>

      {view === 'map' ? (
        <div className="relative flex-1 overflow-hidden">
          <MapView
            parcels={filtered}
            selectedId={selectedId}
            onSelectionChange={(ids) => setSelectedId(ids[0])}
            activeTool="select"
            height="100%"
            className="!rounded-none !border-0"
          />
        </div>
      ) : view === 'calendar' ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
          <CalendarShowcase parcels={filtered} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {view === 'table' ? (
            <ParcellaireTable parcels={filtered} selectedId={selectedId} onSelect={setSelectedId} />
          ) : view === 'timeline' ? (
            <TimelineView
              parcels={filtered}
              year={year}
              segments={allSegments}
              selectedId={selectedId}
              onSelectParcel={setSelectedId}
            />
          ) : (
            <DashboardView parcels={filtered} />
          )}
        </div>
      )}
    </div>
  );
}

/* ============ Vue Timeline (extrait verbatim de ParcellairePage) ============ */

const TIMELINE_TODAY = new Date().toISOString().slice(0, 10);

function TimelineView({
  parcels,
  year,
  segments,
  selectedId,
  onSelectParcel,
}: {
  parcels: ReadonlyArray<ParcelDetail>;
  year: number;
  segments: ReadonlyArray<AssolementSegment>;
  selectedId?: string;
  onSelectParcel: (id: string) => void;
}) {
  if (parcels.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-(--color-muted)">
        Aucune parcelle pour ces filtres.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-(--radius) border border-(--color-border) bg-(--color-surface)">
      {parcels.map((p, idx) => {
        const parcelSegments = getSegmentsForParcelYear(p.id, year, segments);
        const dominant = getDominantCulture(p.id, year, segments);
        return (
          <div
            key={p.id}
            className={[
              'flex items-center gap-3 px-3 py-3 transition-colors hover:bg-[#fbfbf9]',
              idx > 0 ? 'border-t border-(--color-border)' : '',
              selectedId === p.id ? 'bg-(--color-primary)/5' : '',
            ].join(' ')}
          >
            <button
              type="button"
              onClick={() => onSelectParcel(p.id)}
              className="w-40 shrink-0 self-center text-left"
            >
              <div className="truncate text-sm font-medium">{p.name}</div>
              <div className="font-mono text-[11px] text-(--color-muted)">
                {p.id} · {p.surfaceHa.toFixed(2)} ha
                {dominant ? ` · ${dominant.culture}` : ''}
              </div>
            </button>
            <div className="min-w-0 flex-1 self-center">
              <AssolementTimeline segments={parcelSegments} year={year} today={TIMELINE_TODAY} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============ Dashboard (extrait verbatim de ParcellairePage) ============ */

function DashboardView({ parcels }: { parcels: ReadonlyArray<ParcelDetail> }) {
  const byCulture = parcels.reduce<Record<string, number>>((acc, p) => {
    acc[p.culture ?? '—'] = (acc[p.culture ?? '—'] ?? 0) + p.surfaceHa;
    return acc;
  }, {});
  const total = parcels.reduce((s, p) => s + p.surfaceHa, 0);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <KpiCard label="Surface totale" value={`${total.toFixed(1)} ha`} />
      <KpiCard label="Parcelles" value={String(parcels.length)} />
      <div className="col-span-full rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-5">
        <h3 className="m-0 mb-3 text-sm font-semibold">Par culture</h3>
        <ul className="m-0 list-none space-y-2 p-0">
          {Object.entries(byCulture)
            .sort(([, a], [, b]) => b - a)
            .map(([culture, ha]) => (
              <li key={culture}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span>{culture}</span>
                  <span className="font-mono tabular-nums text-(--color-muted)">
                    {ha.toFixed(1)} ha · {total > 0 ? ((ha / total) * 100).toFixed(0) : 0} %
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-(--radius-pill) bg-[#f1f1ee]">
                  <div
                    className="h-full bg-(--color-primary)"
                    style={{ width: `${total > 0 ? (ha / total) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-5">
      <div className="text-xs tracking-wider text-(--color-muted) uppercase">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

/* ============================================================================
 * Vue Calendrier — fusion 3 modes :
 *   - Jour     = strip semaine (Pattern B) + grille heures du jour, drag/resize
 *   - Semaine  = grille 7 colonnes × heures (Pattern A), drag/resize cross-day
 *   - Mois     = grille mois compacte (Pattern C) + drawer droit du jour
 *
 * Drag/resize natifs (pointer events, snap 30min, pas de lib).
 * Events stockés en useState pour mutation locale (mock).
 * ============================================================================ */

type CalEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  startHour: number; // 8-19 (par pas de 0.5)
  durationH: number; // 0.5-6
  title: string;
  parcel: string;
  color: string;
  type: 'semis' | 'phyto' | 'paturage' | 'travail' | 'recolte';
};

const EVENT_TYPES: Array<CalEvent['type']> = ['semis', 'phyto', 'paturage', 'travail', 'recolte'];
const TYPE_LABEL: Record<CalEvent['type'], string> = {
  semis: 'Semis',
  phyto: 'Phyto',
  paturage: 'Pâturage',
  travail: 'Travail sol',
  recolte: 'Récolte',
};
const TYPE_COLOR: Record<CalEvent['type'], string> = {
  semis: '#2E7D32',
  phyto: '#0369a1',
  paturage: '#65a30d',
  travail: '#a16207',
  recolte: '#dc2626',
};

const HOUR_PX = 48; // hauteur 1h
const SNAP_MIN = 30; // snap 30 minutes
const DAY_START = 6;
const DAY_END = 20;
const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);

function buildMockEvents(parcels: ReadonlyArray<ParcelDetail>): CalEvent[] {
  const today = new Date();
  const base: CalEvent[] = parcels.slice(0, 20).map((p, i) => {
    const offset = (i % 21) - 10;
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    const type = EVENT_TYPES[i % EVENT_TYPES.length]!;
    const startHour = 8 + (i % 9);
    return {
      id: `ev-${p.id}-${i}`,
      date: d.toISOString().slice(0, 10),
      startHour,
      durationH: 1 + (i % 3),
      title: TYPE_LABEL[type],
      parcel: p.name,
      color: TYPE_COLOR[type],
      type,
    };
  });
  // Démo : journée chargée aujourd'hui avec chevauchements pour tester lanes
  const todayIso = today.toISOString().slice(0, 10);
  const cramped: CalEvent[] = parcels.slice(0, 8).map((p, i) => {
    const type = EVENT_TYPES[i % EVENT_TYPES.length]!;
    return {
      id: `cramp-${p.id}-${i}`,
      date: todayIso,
      // Chevauchements volontaires : startHour décalé 0.5h, durationH 1.5-2h
      startHour: 7 + i * 0.5,
      durationH: i % 2 === 0 ? 2 : 1.5,
      title: TYPE_LABEL[type],
      parcel: p.name,
      color: TYPE_COLOR[type],
      type,
    };
  });
  return [...base, ...cramped];
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay() === 0 ? 7 : r.getDay();
  r.setDate(r.getDate() - day + 1);
  return r;
}
function snap(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Calcule lanes pour events qui se chevauchent dans une même journée.
 * Algo : tri par startHour, clusters par chevauchement transitif, lanes greedy.
 * Retourne pour chaque event : lane (index colonne 0..N-1) + lanes (total colonnes du cluster).
 */
function layoutLanes(
  evs: ReadonlyArray<CalEvent>,
): Array<{ event: CalEvent; lane: number; lanes: number }> {
  if (evs.length === 0) return [];
  const sorted = [...evs].sort((a, b) => a.startHour - b.startHour);

  // 1. Clusters : événements qui se chevauchent transitivement
  const clusters: CalEvent[][] = [];
  let current: CalEvent[] = [];
  let currentMaxEnd = -Infinity;
  for (const e of sorted) {
    const end = e.startHour + e.durationH;
    if (e.startHour < currentMaxEnd) {
      current.push(e);
      currentMaxEnd = Math.max(currentMaxEnd, end);
    } else {
      if (current.length > 0) clusters.push(current);
      current = [e];
      currentMaxEnd = end;
    }
  }
  if (current.length > 0) clusters.push(current);

  // 2. Lanes greedy par cluster
  const result: Array<{ event: CalEvent; lane: number; lanes: number }> = [];
  for (const cluster of clusters) {
    const lanes: CalEvent[][] = [];
    const assignments = new Map<string, number>();
    for (const e of cluster) {
      let placed = false;
      for (let i = 0; i < lanes.length; i++) {
        const lane = lanes[i]!;
        const last = lane[lane.length - 1]!;
        if (e.startHour >= last.startHour + last.durationH) {
          lane.push(e);
          assignments.set(e.id, i);
          placed = true;
          break;
        }
      }
      if (!placed) {
        lanes.push([e]);
        assignments.set(e.id, lanes.length - 1);
      }
    }
    const total = lanes.length;
    for (const e of cluster) {
      result.push({ event: e, lane: assignments.get(e.id) ?? 0, lanes: total });
    }
  }
  return result;
}

export function CalendarShowcase({ parcels }: { parcels: ReadonlyArray<ParcelDetail> }) {
  const [mode, setMode] = useState<'day' | 'week' | 'month'>('day');
  const [cursor, setCursor] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalEvent[]>(() => buildMockEvents(parcels));
  const [openedEvent, setOpenedEvent] = useState<CalEvent | null>(null);

  const updateEvent = (id: string, patch: Partial<CalEvent>) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };
  const onEventClick = (e: CalEvent) => setOpenedEvent(e);

  const shift = (n: number) => {
    if (mode === 'day') setCursor(addDays(cursor, n));
    else if (mode === 'week') setCursor(addDays(cursor, n * 7));
    else {
      const d = new Date(cursor);
      d.setMonth(d.getMonth() + n);
      setCursor(d);
    }
  };

  const headerLabel = useMemo(() => {
    if (mode === 'day') {
      return cursor.toLocaleDateString('fr-CH', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    if (mode === 'week') {
      const start = startOfWeek(cursor);
      const end = addDays(start, 6);
      return `${start.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return cursor.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' });
  }, [cursor, mode]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Header nav unifié — 1 row mobile + desktop : ◀ [J|S|M] [label (clic=today)] ▶ */}
      <div className="flex items-center gap-2 rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-2 py-2 md:px-3">
        <button onClick={() => shift(-1)} className={navBtn} aria-label="Précédent">
          ◀
        </button>
        <div className="inline-flex shrink-0 overflow-hidden rounded-(--radius) border border-(--color-border)">
          {(['day', 'week', 'month'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={[
                'h-8 px-2 text-xs font-medium md:px-3',
                mode === m
                  ? 'bg-(--color-primary) text-white'
                  : 'bg-(--color-surface) text-(--color-text) hover:bg-[#f8f8f5]',
              ].join(' ')}
            >
              <span className="md:hidden">
                {m === 'day' ? 'Jour' : m === 'week' ? 'Sem.' : 'Mois'}
              </span>
              <span className="hidden md:inline">
                {m === 'day' ? 'Jour' : m === 'week' ? 'Semaine' : 'Mois'}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setCursor(new Date())}
          title="Revenir à aujourd'hui"
          className="min-w-0 flex-1 truncate rounded-(--radius) px-2 text-center text-sm font-medium capitalize hover:bg-[#f8f8f5]"
        >
          {headerLabel}
        </button>
        <button onClick={() => shift(1)} className={navBtn} aria-label="Suivant">
          ▶
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {mode === 'day' && (
          <DayMode
            cursor={cursor}
            setCursor={setCursor}
            events={events}
            updateEvent={updateEvent}
            onEventClick={onEventClick}
          />
        )}
        {mode === 'week' && (
          <WeekMode
            anchor={cursor}
            events={events}
            updateEvent={updateEvent}
            onEventClick={onEventClick}
          />
        )}
        {mode === 'month' && (
          <MonthMode anchor={cursor} events={events} onEventClick={onEventClick} />
        )}
      </div>

      {openedEvent && <EventDetailModal event={openedEvent} onClose={() => setOpenedEvent(null)} />}
    </div>
  );
}

/* ============ Modal détail événement — pattern identique InterventionForm ============ */
function EventDetailModal({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const startStr = `${String(Math.floor(event.startHour)).padStart(2, '0')}:${event.startHour % 1 ? '30' : '00'}`;
  const endH = event.startHour + event.durationH;
  const endStr = `${String(Math.floor(endH)).padStart(2, '0')}:${endH % 1 ? '30' : '00'}`;
  const dateStr = new Date(event.date).toLocaleDateString('fr-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center md:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Détail de l'événement"
        className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-(--radius-lg) border border-(--color-border) bg-(--color-surface) shadow-(--shadow-popup) md:max-w-[600px] md:rounded-(--radius-lg)"
      >
        <header
          className="flex items-start gap-3 border-b border-(--color-border) px-4 py-3 text-white"
          style={{ background: event.color }}
        >
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-base font-semibold">{event.title}</h2>
            <p className="m-0 mt-0.5 text-xs opacity-90">{event.parcel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-(--radius-sm) text-white hover:bg-white/20"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
          <section>
            <h3 className="m-0 mb-2 text-xs font-semibold tracking-wider text-(--color-muted) uppercase">
              Quand
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <DetailRow label="Date" value={dateStr} />
              <DetailRow label="Horaire" value={`${startStr} – ${endStr} (${event.durationH}h)`} />
            </div>
          </section>
          <section>
            <h3 className="m-0 mb-2 text-xs font-semibold tracking-wider text-(--color-muted) uppercase">
              Quoi
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <DetailRow label="Type" value={TYPE_LABEL[event.type]} />
              <DetailRow label="Statut" value="Planifié" />
            </div>
          </section>
          <section>
            <h3 className="m-0 mb-2 text-xs font-semibold tracking-wider text-(--color-muted) uppercase">
              Où
            </h3>
            <DetailRow label="Parcelle" value={event.parcel} />
          </section>
          <section>
            <h3 className="m-0 mb-2 text-xs font-semibold tracking-wider text-(--color-muted) uppercase">
              Notes
            </h3>
            <div className="rounded-(--radius) border border-(--color-border) bg-[#fbfbf9] p-3 text-xs text-(--color-muted) italic">
              Pas de notes pour cet événement (données mock — à brancher sur
              intervention/WO/planning réels).
            </div>
          </section>
        </div>
        <footer className="flex items-center gap-2 border-t border-(--color-border) p-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-4 text-sm font-medium hover:bg-[#f8f8f5]"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={() => alert('Suppression à brancher')}
            className="inline-flex h-10 items-center rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-4 text-sm font-medium text-(--color-danger,#dc2626) hover:bg-[#fef2f2]"
          >
            Supprimer
          </button>
          <button
            type="button"
            onClick={() => alert('Édition à brancher')}
            className="ml-auto inline-flex h-10 items-center rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-5 text-sm font-medium text-white hover:bg-(--color-primary-hover)"
          >
            Modifier
          </button>
        </footer>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-(--color-muted)">{label}</div>
      <div className="mt-0.5 font-medium capitalize">{value}</div>
    </div>
  );
}

const navBtn =
  'inline-flex h-8 w-8 items-center justify-center rounded-(--radius) border border-(--color-border) bg-(--color-surface) text-sm hover:bg-[#f8f8f5]';

/* ============ Mode JOUR : strip semaine + grille heures draggable ============ */

function DayMode({
  cursor,
  setCursor,
  events,
  updateEvent,
  onEventClick,
}: {
  cursor: Date;
  setCursor: (d: Date) => void;
  events: CalEvent[];
  updateEvent: (id: string, patch: Partial<CalEvent>) => void;
  onEventClick: (e: CalEvent) => void;
}) {
  const monday = startOfWeek(cursor);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const selectedIso = isoDay(cursor);
  const dayEvents = events.filter((e) => e.date === selectedIso);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Strip 7 jours — compact */}
      <div className="grid shrink-0 grid-cols-7 gap-1.5">
        {week.map((d) => {
          const iso = isoDay(d);
          const count = events.filter((e) => e.date === iso).length;
          const isSel = iso === selectedIso;
          const isToday = iso === isoDay(new Date());
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setCursor(d)}
              className={[
                'flex flex-col items-center justify-center gap-0.5 rounded-(--radius) border px-1 py-2 transition-colors',
                isSel
                  ? 'border-(--color-primary) bg-(--color-primary) text-white'
                  : isToday
                    ? 'border-(--color-primary) bg-(--color-surface)'
                    : 'border-(--color-border) bg-(--color-surface) hover:bg-[#f8f8f5]',
              ].join(' ')}
            >
              <span className="text-[10px] uppercase">
                {d.toLocaleDateString('fr-CH', { weekday: 'short' })}
              </span>
              <span className="text-sm font-semibold tabular-nums">{d.getDate()}</span>
              {count > 0 && (
                <span
                  className={[
                    'h-1.5 w-1.5 rounded-full',
                    isSel ? 'bg-white/80' : 'bg-(--color-primary)',
                  ].join(' ')}
                  aria-label={`${count} évt`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Grille heures draggable */}
      <HourGrid
        days={[cursor]}
        events={dayEvents}
        updateEvent={updateEvent}
        onEventClick={onEventClick}
        gridCols="3rem 1fr"
      />
    </div>
  );
}

/* ============ Mode SEMAINE : grille 7×heures draggable cross-day ============ */

function WeekMode({
  anchor,
  events,
  updateEvent,
  onEventClick,
}: {
  anchor: Date;
  events: CalEvent[];
  updateEvent: (id: string, patch: Partial<CalEvent>) => void;
  onEventClick: (e: CalEvent) => void;
}) {
  const monday = startOfWeek(anchor);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const weekIsos = week.map(isoDay);
  const weekEvents = events.filter((e) => weekIsos.includes(e.date));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <HourGrid
        days={week}
        events={weekEvents}
        updateEvent={updateEvent}
        onEventClick={onEventClick}
        gridCols={`3rem repeat(7, 1fr)`}
      />
    </div>
  );
}

/* ============ HourGrid : grille horaire commune (1 ou 7 jours), drag+resize ============ */

type DragState = {
  id: string;
  mode: 'move' | 'resize';
  startClientX: number;
  startClientY: number;
  startEvent: CalEvent;
  daysIsos: string[]; // colonnes possibles pour move horizontal
  colWidthPx: number;
  dragged: boolean; // true dès qu'un déplacement > 5px est observé
};

const CLICK_THRESHOLD_PX = 5;

function HourGrid({
  days,
  events,
  updateEvent,
  onEventClick,
  gridCols,
}: {
  days: Date[];
  events: CalEvent[];
  updateEvent: (id: string, patch: Partial<CalEvent>) => void;
  onEventClick: (e: CalEvent) => void;
  gridCols: string;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const todayIso = isoDay(new Date());
  const daysIsos = days.map(isoDay);

  const beginDrag = (e: React.PointerEvent, ev: CalEvent, mode: 'move' | 'resize') => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const grid = gridRef.current;
    if (!grid) return;
    // Largeur d'une colonne jour (hors gouttière 3rem)
    const rect = grid.getBoundingClientRect();
    const colWidthPx = (rect.width - 48) / days.length;
    setDrag({
      id: ev.id,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startEvent: ev,
      daysIsos,
      colWidthPx,
      dragged: false,
    });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    // Pas encore considéré comme drag tant que mouvement < seuil
    if (!drag.dragged && Math.hypot(dx, dy) < CLICK_THRESHOLD_PX) return;
    if (!drag.dragged) setDrag({ ...drag, dragged: true });
    const deltaH = snap((dy / HOUR_PX) * 60, SNAP_MIN) / 60;
    if (drag.mode === 'resize') {
      const newDur = Math.max(0.5, Math.min(6, drag.startEvent.durationH + deltaH));
      updateEvent(drag.id, { durationH: newDur });
      return;
    }
    // move
    const newStart = Math.max(
      DAY_START,
      Math.min(DAY_END - drag.startEvent.durationH, drag.startEvent.startHour + deltaH),
    );
    let newDate = drag.startEvent.date;
    if (days.length > 1) {
      const colDelta = Math.round(dx / drag.colWidthPx);
      const startIdx = drag.daysIsos.indexOf(drag.startEvent.date);
      const targetIdx = Math.max(0, Math.min(drag.daysIsos.length - 1, startIdx + colDelta));
      newDate = drag.daysIsos[targetIdx] ?? drag.startEvent.date;
    }
    updateEvent(drag.id, { startHour: newStart, date: newDate });
  };

  const endDrag = () => {
    if (drag && !drag.dragged && drag.mode === 'move') {
      onEventClick(drag.startEvent);
    }
    setDrag(null);
  };

  return (
    <div
      ref={gridRef}
      className="min-h-0 flex-1 overflow-auto rounded-(--radius) border border-(--color-border) bg-(--color-surface)"
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className={days.length > 1 ? 'min-w-[600px]' : 'w-full'}>
        {/* Header colonnes */}
        <div
          className="grid border-b border-(--color-border)"
          style={{ gridTemplateColumns: gridCols }}
        >
          <div />
          {days.map((d) => {
            const iso = isoDay(d);
            return (
              <div
                key={iso}
                className={[
                  'border-l border-(--color-border) px-1 py-1.5 text-center text-[11px]',
                  iso === todayIso ? 'bg-(--color-primary)/10 font-semibold' : '',
                ].join(' ')}
              >
                <div className="capitalize">
                  {days.length > 1
                    ? d.toLocaleDateString('fr-CH', { weekday: 'short' })
                    : d.toLocaleDateString('fr-CH', { weekday: 'long' })}
                </div>
                <div
                  className={[
                    'tabular-nums',
                    days.length > 1 ? 'text-(--color-muted)' : 'text-base font-semibold',
                  ].join(' ')}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Lignes heures */}
        {HOURS.map((h) => (
          <div
            key={h}
            className="grid"
            style={{ gridTemplateColumns: gridCols, height: `${HOUR_PX}px` }}
          >
            <div className="border-t border-(--color-border) pr-2 pt-0.5 text-right font-mono text-[10px] text-(--color-muted)">
              {String(h).padStart(2, '0')}:00
            </div>
            {days.map((d) => {
              const iso = isoDay(d);
              return (
                <div
                  key={iso}
                  className={[
                    'relative border-l border-t border-(--color-border)',
                    iso === todayIso ? 'bg-(--color-primary)/4' : '',
                  ].join(' ')}
                />
              );
            })}
          </div>
        ))}

        {/* Events absolute positioned au-dessus de la grille */}
        <div className="pointer-events-none absolute inset-0" />
        <EventLayer
          gridCols={gridCols}
          days={days}
          events={events}
          beginDrag={beginDrag}
          dragId={drag?.id}
        />
      </div>
    </div>
  );
}

/* Couche events : pos absolue dans chaque colonne, calc top/height depuis startHour/duration */

function EventLayer({
  gridCols,
  days,
  events,
  beginDrag,
  dragId,
}: {
  gridCols: string;
  days: Date[];
  events: CalEvent[];
  beginDrag: (e: React.PointerEvent, ev: CalEvent, mode: 'move' | 'resize') => void;
  dragId?: string;
}) {
  const totalHeight = HOURS.length * HOUR_PX;
  // Header colonne hauteur ≈ 36px (capturé visuellement) — pour le top offset des events
  // On rend les events DANS la grille (chaque colonne contient overlay), pas en surcouche absolue globale.
  // Astuce simple : on rerendere une grille parallèle vide avec events absolute dans chaque cell-day.
  return (
    <div
      className="relative -mt-[calc(var(--hours)*var(--hpx))]"
      style={
        {
          ['--hours']: HOURS.length,
          ['--hpx']: `${HOUR_PX}px`,
          height: `${totalHeight}px`,
        } as React.CSSProperties
      }
    >
      <div className="grid h-full" style={{ gridTemplateColumns: gridCols }}>
        <div />
        {days.map((d) => {
          const iso = isoDay(d);
          const dayEvents = events.filter((e) => e.date === iso);
          const laid = layoutLanes(dayEvents);
          return (
            <div key={iso} className="relative border-l border-transparent">
              {laid.map(({ event: e, lane, lanes }) => {
                const topPx = (e.startHour - DAY_START) * HOUR_PX;
                const heightPx = e.durationH * HOUR_PX;
                const isDragging = dragId === e.id;
                const widthPct = 100 / lanes;
                const leftPct = lane * widthPct;
                return (
                  <div
                    key={e.id}
                    onPointerDown={(p) => beginDrag(p, e, 'move')}
                    className={[
                      'absolute cursor-grab touch-none overflow-hidden rounded-(--radius-sm) px-1.5 py-1 text-[11px] font-medium text-white shadow-sm select-none',
                      isDragging
                        ? 'cursor-grabbing opacity-80 ring-2 ring-white/60'
                        : 'hover:opacity-90',
                    ].join(' ')}
                    style={{
                      top: `${topPx + 1}px`,
                      height: `${heightPx - 2}px`,
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                      background: e.color,
                    }}
                    title={`${e.title} · ${e.parcel} · ${String(e.startHour).padStart(2, '0')}:${e.startHour % 1 ? '30' : '00'} (${e.durationH}h)`}
                  >
                    <div className="truncate">{e.title}</div>
                    {days.length === 1 && lanes === 1 && (
                      <div className="truncate text-[10px] opacity-90">{e.parcel}</div>
                    )}
                    {/* Resize handle bas */}
                    <div
                      onPointerDown={(p) => beginDrag(p, e, 'resize')}
                      className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize touch-none"
                      title="Redimensionner"
                    >
                      <div className="mx-auto mt-0.5 h-1 w-6 rounded-full bg-white/60" />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============ Mode MOIS : grille + drawer (Pattern C) ============ */

function MonthMode({
  anchor,
  events,
  onEventClick,
}: {
  anchor: Date;
  events: CalEvent[];
  onEventClick: (e: CalEvent) => void;
}) {
  const [selected, setSelected] = useState<string | null>(isoDay(new Date()));
  const drawerEvents = selected
    ? events.filter((e) => e.date === selected).sort((a, b) => a.startHour - b.startHour)
    : [];
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 lg:grid lg:grid-cols-[1fr_320px]">
      {/* Grille mois — HAUTEUR FIXE, ne varie jamais */}
      <div className="flex shrink-0 flex-col overflow-hidden rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-2 lg:h-full lg:shrink lg:min-h-0">
        <MonthGridClickable
          anchor={anchor}
          events={events}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
      {/* Drawer — flex-1 prend reste, scroll interne si déborde */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-(--radius) border border-(--color-border) bg-(--color-surface)">
        <div className="border-b border-(--color-border) px-3 py-2 text-sm font-semibold capitalize">
          {selected
            ? new Date(selected).toLocaleDateString('fr-CH', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })
            : 'Sélectionne un jour'}
        </div>
        {drawerEvents.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-(--color-muted)">Aucun événement</div>
        ) : (
          <ul className="m-0 min-h-0 flex-1 list-none divide-y divide-(--color-border) overflow-y-auto p-0">
            {drawerEvents.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onEventClick(e)}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-[#fbfbf9]"
                >
                  <div className="w-12 shrink-0 pt-0.5 font-mono text-xs text-(--color-muted) tabular-nums">
                    {String(e.startHour).padStart(2, '0')}:00
                  </div>
                  <div
                    className="h-full w-1 shrink-0 rounded-full"
                    style={{ background: e.color, minHeight: '24px' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{e.title}</div>
                    <div className="truncate text-xs text-(--color-muted)">{e.parcel}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MonthGridClickable({
  anchor,
  events,
  selected,
  onSelect,
}: {
  anchor: Date;
  events: CalEvent[];
  selected: string | null;
  onSelect: (iso: string) => void;
}) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const startDay = first.getDay() === 0 ? 7 : first.getDay();
  const start = new Date(first);
  start.setDate(1 - (startDay - 1));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const todayIso = isoDay(new Date());
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid shrink-0 grid-cols-7 text-center text-[11px] font-medium text-(--color-muted)">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <div key={i} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid shrink-0 grid-cols-7 gap-0.5 lg:min-h-0 lg:flex-1 lg:auto-rows-fr">
        {cells.map((d, i) => {
          const iso = isoDay(d);
          const inMonth = d.getMonth() === anchor.getMonth();
          const dayEvents = events.filter((e) => e.date === iso);
          const isSel = iso === selected;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(iso)}
              className={[
                'flex min-h-[64px] flex-col items-stretch rounded-(--radius-sm) p-1 text-left text-[11px] transition-colors',
                inMonth ? 'bg-(--color-surface)' : 'bg-[#fafaf8] text-(--color-muted)',
                isSel ? 'ring-2 ring-(--color-primary)' : 'hover:bg-[#f8f8f5]',
              ].join(' ')}
            >
              <div
                className={[
                  'font-mono',
                  iso === todayIso ? 'font-bold text-(--color-primary)' : '',
                ].join(' ')}
              >
                {d.getDate()}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-0.5">
                {dayEvents.slice(0, 4).map((e) => (
                  <span
                    key={e.id}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: e.color }}
                  />
                ))}
                {dayEvents.length > 4 && (
                  <span className="text-[9px] text-(--color-muted)">+{dayEvents.length - 4}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
