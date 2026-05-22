/**
 * PAGE TEMPORAIRE — showcase des 7 vues V1 (ViewSwitcher).
 * Mock data hardcodé, zéro backend.
 *
 * But : Fabien valide le rendu de chaque vue (table/map/dashboard/kanban/list/calendar/timeline)
 * → ces patterns deviennent la référence définitive à réutiliser sur toute l'app.
 *
 * À supprimer une fois validé.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ViewSwitcher, type ViewKey } from '../../components/ViewSwitcher';

// ============================================================================
// MOCK DATA
// ============================================================================

type Intervention = {
  id: string;
  type: 'SEMIS' | 'PHYTO' | 'ENGRAIS' | 'RECOLTE' | 'TRAVAIL_SOL';
  parcelle: string;
  produit: string;
  date: string;
  surfaceHa: number;
  statut: 'VALIDEE' | 'EN_ATTENTE';
};

const TYPE_LABELS: Record<Intervention['type'], string> = {
  SEMIS: 'Semis',
  PHYTO: 'Traitement phyto',
  ENGRAIS: 'Épandage engrais',
  RECOLTE: 'Récolte',
  TRAVAIL_SOL: 'Travail du sol',
};

const TYPE_COLORS: Record<Intervention['type'], string> = {
  SEMIS: '#16a34a',
  PHYTO: '#3b82f6',
  ENGRAIS: '#f59e0b',
  RECOLTE: '#eab308',
  TRAVAIL_SOL: '#78716c',
};

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

const MOCK_INTERVENTIONS: Intervention[] = [
  {
    id: '1',
    type: 'SEMIS',
    parcelle: 'Pré du Moulin',
    produit: "Blé d'automne Arnold",
    date: daysAgo(2),
    surfaceHa: 2.4,
    statut: 'VALIDEE',
  },
  {
    id: '2',
    type: 'PHYTO',
    parcelle: 'Champ du Bois',
    produit: 'Glyphosate 360 g/L',
    date: daysAgo(3),
    surfaceHa: 1.8,
    statut: 'EN_ATTENTE',
  },
  {
    id: '3',
    type: 'ENGRAIS',
    parcelle: 'La Combe',
    produit: 'Nitrate ammoniacal 27%',
    date: daysAgo(5),
    surfaceHa: 3.1,
    statut: 'VALIDEE',
  },
  {
    id: '4',
    type: 'TRAVAIL_SOL',
    parcelle: 'Pré du Moulin',
    produit: 'Labour 25 cm',
    date: daysAgo(8),
    surfaceHa: 2.4,
    statut: 'VALIDEE',
  },
  {
    id: '5',
    type: 'RECOLTE',
    parcelle: 'La Combe',
    produit: 'Maïs ensilage',
    date: daysAgo(12),
    surfaceHa: 3.1,
    statut: 'VALIDEE',
  },
  {
    id: '6',
    type: 'PHYTO',
    parcelle: 'Champ du Bois',
    produit: 'Fongicide Prosaro',
    date: daysAgo(15),
    surfaceHa: 1.8,
    statut: 'VALIDEE',
  },
  {
    id: '7',
    type: 'SEMIS',
    parcelle: 'Champ du Bois',
    produit: 'Orge fourragère',
    date: daysAgo(18),
    surfaceHa: 1.8,
    statut: 'EN_ATTENTE',
  },
  {
    id: '8',
    type: 'ENGRAIS',
    parcelle: 'Pré du Moulin',
    produit: 'Lisier bovins 25 m³',
    date: daysAgo(22),
    surfaceHa: 2.4,
    statut: 'VALIDEE',
  },
  {
    id: '9',
    type: 'TRAVAIL_SOL',
    parcelle: 'La Combe',
    produit: 'Déchaumage',
    date: daysAgo(25),
    surfaceHa: 3.1,
    statut: 'VALIDEE',
  },
  {
    id: '10',
    type: 'RECOLTE',
    parcelle: 'Champ du Bois',
    produit: 'Blé moisson',
    date: daysAgo(28),
    surfaceHa: 1.8,
    statut: 'VALIDEE',
  },
  {
    id: '11',
    type: 'PHYTO',
    parcelle: 'Pré du Moulin',
    produit: 'Insecticide Karate Zeon',
    date: daysAgo(1),
    surfaceHa: 2.4,
    statut: 'EN_ATTENTE',
  },
  {
    id: '12',
    type: 'ENGRAIS',
    parcelle: 'La Combe',
    produit: 'PK 12-24',
    date: daysAgo(6),
    surfaceHa: 3.1,
    statut: 'VALIDEE',
  },
];

const MOCK_PARCELLES = [
  {
    nom: 'Pré du Moulin',
    couleur: '#16a34a',
    surfaceHa: 2.4,
    coords: [
      [6.935, 46.823],
      [6.945, 46.823],
      [6.946, 46.828],
      [6.934, 46.829],
      [6.935, 46.823],
    ],
  },
  {
    nom: 'Champ du Bois',
    couleur: '#f59e0b',
    surfaceHa: 1.8,
    coords: [
      [6.95, 46.821],
      [6.962, 46.822],
      [6.961, 46.827],
      [6.949, 46.826],
      [6.95, 46.821],
    ],
  },
  {
    nom: 'La Combe',
    couleur: '#3b82f6',
    surfaceHa: 3.1,
    coords: [
      [6.928, 46.83],
      [6.94, 46.831],
      [6.939, 46.836],
      [6.927, 46.835],
      [6.928, 46.83],
    ],
  },
];

// ============================================================================
// VIEWS
// ============================================================================

function TableView({ items }: { items: Intervention[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-(--color-border) bg-(--color-surface)">
      <table className="w-full text-sm">
        <thead className="border-b border-(--color-border) bg-(--color-bg)">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-(--color-muted)">
            <th className="px-3 py-2.5">Type</th>
            <th className="px-3 py-2.5">Parcelle</th>
            <th className="px-3 py-2.5">Produit</th>
            <th className="px-3 py-2.5 text-right">Surface</th>
            <th className="px-3 py-2.5">Date</th>
            <th className="px-3 py-2.5">Statut</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr
              key={it.id}
              className="border-b border-(--color-border) last:border-0 hover:bg-(--color-bg)"
            >
              <td className="px-3 py-2.5">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: TYPE_COLORS[it.type] }}
                  />
                  {TYPE_LABELS[it.type]}
                </span>
              </td>
              <td className="px-3 py-2.5 font-medium">{it.parcelle}</td>
              <td className="px-3 py-2.5 text-(--color-muted)">{it.produit}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                {it.surfaceHa.toFixed(1)} ha
              </td>
              <td className="px-3 py-2.5 tabular-nums">
                {new Date(it.date).toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' })}
              </td>
              <td className="px-3 py-2.5">
                {it.statut === 'EN_ATTENTE' ? (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    À valider
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    Validée
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListView({ items }: { items: Intervention[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-(--color-border) bg-(--color-surface)">
      {items.map((it, idx) => (
        <button
          key={it.id}
          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-(--color-bg) ${idx > 0 ? 'border-t border-(--color-border)' : ''}`}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white text-xs font-bold"
            style={{ background: TYPE_COLORS[it.type] }}
          >
            {TYPE_LABELS[it.type].slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-(--color-text)">{it.parcelle}</div>
            <div className="truncate text-sm text-(--color-muted)">
              {TYPE_LABELS[it.type]} · {it.produit}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono tabular-nums">{it.surfaceHa.toFixed(1)} ha</div>
            <div className="text-xs text-(--color-muted)">
              {new Date(it.date).toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' })}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function TimelineView({ items }: { items: Intervention[] }) {
  const sorted = [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return (
    <div className="relative pl-6">
      <div className="absolute bottom-0 left-2 top-0 w-px bg-(--color-border)" />
      {sorted.map((it) => (
        <div key={it.id} className="relative mb-5 last:mb-0">
          <div
            className="absolute -left-[18px] flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-(--color-bg)"
            style={{ background: TYPE_COLORS[it.type] }}
          />
          <div className="ml-2 rounded-lg border border-(--color-border) bg-(--color-surface) p-3 hover:bg-(--color-bg)">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-xs font-medium text-(--color-muted)">
                {new Date(it.date).toLocaleDateString('fr-CH', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </div>
              <div className="font-mono text-xs text-(--color-muted)">
                {it.surfaceHa.toFixed(1)} ha
              </div>
            </div>
            <div className="mt-1 font-medium">
              {TYPE_LABELS[it.type]} — {it.parcelle}
            </div>
            <div className="text-sm text-(--color-muted)">{it.produit}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function KanbanView({ items }: { items: Intervention[] }) {
  const grouped = items.reduce<Record<Intervention['type'], Intervention[]>>(
    (acc, it) => {
      (acc[it.type] = acc[it.type] || []).push(it);
      return acc;
    },
    {} as Record<Intervention['type'], Intervention[]>,
  );
  const types: Intervention['type'][] = ['SEMIS', 'PHYTO', 'ENGRAIS', 'TRAVAIL_SOL', 'RECOLTE'];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {types.map((t) => {
        const list = grouped[t] || [];
        return (
          <div key={t} className="rounded-lg border border-(--color-border) bg-(--color-bg) p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLORS[t] }} />
                <span className="text-sm font-semibold">{TYPE_LABELS[t]}</span>
              </div>
              <span className="rounded-full bg-(--color-surface) px-2 py-0.5 text-xs font-mono text-(--color-muted)">
                {list.length}
              </span>
            </div>
            <div className="space-y-2">
              {list.map((it) => (
                <div
                  key={it.id}
                  className="rounded-md border border-(--color-border) bg-(--color-surface) p-2.5 text-sm"
                >
                  <div className="font-medium">{it.parcelle}</div>
                  <div className="truncate text-xs text-(--color-muted)">{it.produit}</div>
                  <div className="mt-1.5 flex items-center justify-between text-xs">
                    <span className="text-(--color-muted)">
                      {new Date(it.date).toLocaleDateString('fr-CH', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                    <span className="font-mono text-(--color-muted)">
                      {it.surfaceHa.toFixed(1)} ha
                    </span>
                  </div>
                </div>
              ))}
              {list.length === 0 && (
                <div className="text-center text-xs text-(--color-muted)">—</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarView({ items }: { items: Intervention[] }) {
  // Mois courant
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = (firstDay.getDay() + 6) % 7; // lundi = 0
  const daysInMonth = lastDay.getDate();

  const byDay = new Map<string, Intervention[]>();
  items.forEach((it) => {
    const d = new Date(it.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const key = String(d.getDate());
      (byDay.get(key) ?? byDay.set(key, []).get(key)!).push(it);
    }
  });

  const cells: { day: number | null; events: Intervention[] }[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ day: null, events: [] });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, events: byDay.get(String(d)) ?? [] });

  return (
    <div className="overflow-hidden rounded-lg border border-(--color-border) bg-(--color-surface)">
      <div className="border-b border-(--color-border) bg-(--color-bg) px-4 py-2 text-sm font-semibold">
        {firstDay.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' })}
      </div>
      <div className="grid grid-cols-7 border-b border-(--color-border) text-xs font-semibold uppercase tracking-wide text-(--color-muted)">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
          <div
            key={d}
            className="border-r border-(--color-border) px-2 py-2 text-center last:border-0"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => (
          <div
            key={i}
            className="min-h-[80px] border-b border-r border-(--color-border) p-1.5 text-xs last:border-r-0"
          >
            {cell.day && (
              <>
                <div className="mb-1 text-(--color-muted)">{cell.day}</div>
                <div className="space-y-1">
                  {cell.events.slice(0, 2).map((e) => (
                    <div
                      key={e.id}
                      className="truncate rounded px-1.5 py-0.5 text-white text-[10px]"
                      style={{ background: TYPE_COLORS[e.type] }}
                      title={`${TYPE_LABELS[e.type]} — ${e.parcelle}`}
                    >
                      {e.parcelle}
                    </div>
                  ))}
                  {cell.events.length > 2 && (
                    <div className="text-[10px] text-(--color-muted)">
                      +{cell.events.length - 2}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MapViewSimple() {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current).setView([46.825, 6.94], 14);
    L.tileLayer(
      'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
      { attribution: '© swisstopo', maxZoom: 19 },
    ).addTo(map);
    const group = L.featureGroup();
    MOCK_PARCELLES.forEach((p) => {
      const layer = L.polygon(
        p.coords.map(([lng, lat]) => [lat, lng] as L.LatLngTuple),
        { color: p.couleur, weight: 2, fillColor: p.couleur, fillOpacity: 0.35 },
      );
      layer.bindPopup(`<strong>${p.nom}</strong><br/>${p.surfaceHa.toFixed(1)} ha`);
      group.addLayer(layer);
    });
    group.addTo(map);
    map.fitBounds(group.getBounds(), { padding: [30, 30] });
    return () => {
      map.remove();
    };
  }, []);
  return (
    <div
      ref={containerRef}
      className="h-[460px] w-full overflow-hidden rounded-lg border border-(--color-border)"
    />
  );
}

function DashboardView({ items }: { items: Intervention[] }) {
  const totalHa = MOCK_PARCELLES.reduce((s, p) => s + p.surfaceHa, 0);
  const pending = items.filter((it) => it.statut === 'EN_ATTENTE').length;
  const monthCount = items.filter((it) => {
    const d = new Date(it.date);
    return d.getMonth() === new Date().getMonth();
  }).length;

  // 7 derniers jours
  const days: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const count = items.filter((it) => it.date.slice(0, 10) === iso).length;
    days.push({ label: d.toLocaleDateString('fr-CH', { weekday: 'short' }), count });
  }
  const max = Math.max(1, ...days.map((d) => d.count));

  const kpis = [
    { label: 'Parcelles actives', value: String(MOCK_PARCELLES.length), color: '#16a34a' },
    { label: 'Surface totale', value: totalHa.toFixed(1), unit: 'ha', color: '#f59e0b' },
    { label: 'Interventions mois', value: String(monthCount), color: '#3b82f6' },
    { label: 'À valider', value: String(pending), color: '#dc2626' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-lg border border-(--color-border) bg-(--color-surface) p-4"
          >
            <div className="mb-1 h-1 w-8 rounded-full" style={{ background: k.color }} />
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums text-(--color-text)">{k.value}</span>
              {k.unit && <span className="text-sm text-(--color-muted)">{k.unit}</span>}
            </div>
            <div className="mt-0.5 text-sm text-(--color-muted)">{k.label}</div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-(--color-border) bg-(--color-surface) p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="font-medium text-(--color-text)">Interventions — 7 derniers jours</h3>
          <span className="text-xs text-(--color-muted)">
            {days.reduce((s, d) => s + d.count, 0)} total
          </span>
        </div>
        <div className="flex h-32 items-end gap-2">
          {days.map((d, idx) => (
            <div key={idx} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-full w-full items-end">
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    background: 'var(--color-primary)',
                    height: `${(d.count / max) * 100}%`,
                    minHeight: d.count > 0 ? '4px' : '0',
                  }}
                  title={`${d.count} intervention(s)`}
                />
              </div>
              <span className="text-xs text-(--color-muted)">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PAGE
// ============================================================================

const ALL_VIEWS: ViewKey[] = [
  'table',
  'list',
  'kanban',
  'timeline',
  'calendar',
  'map',
  'dashboard',
];

export default function ComposantsPage() {
  const [view, setView] = useState<ViewKey>('table');
  const items = useMemo(() => MOCK_INTERVENTIONS, []);

  return (
    <div className="min-h-screen bg-(--color-bg)">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-6">
          <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Page temporaire — à supprimer après validation
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-(--color-text) sm:text-3xl">
            Composants — référentiel des 7 vues
          </h1>
          <p className="mt-2 text-sm text-(--color-muted)">
            Mockup mock data pour valider chaque pattern de vue. Une fois validés, ces rendus
            deviennent la
            <strong> référence définitive</strong> à réutiliser sur toute l'app. Aucune variation
            sans demande explicite.
          </p>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <ViewSwitcher
            views={ALL_VIEWS}
            activeView={view}
            onChange={setView}
            ariaLabel="Choisir une vue"
          />
          <span className="text-sm text-(--color-muted)">
            {items.length} interventions · 3 parcelles
          </span>
        </div>

        <div className="rounded-xl border border-(--color-border) bg-(--color-surface)/40 p-3 sm:p-4">
          {view === 'table' && <TableView items={items} />}
          {view === 'list' && <ListView items={items} />}
          {view === 'kanban' && <KanbanView items={items} />}
          {view === 'timeline' && <TimelineView items={items} />}
          {view === 'calendar' && <CalendarView items={items} />}
          {view === 'map' && <MapViewSimple />}
          {view === 'dashboard' && <DashboardView items={items} />}
        </div>

        <footer className="mt-8 border-t border-(--color-border) pt-4 text-sm text-(--color-muted)">
          Page{' '}
          <code className="rounded bg-(--color-bg) px-1.5 py-0.5">
            src/modules/composants/ComposantsPage.tsx
          </code>{' '}
          · mock hardcodé · à supprimer après validation. Dis ce qu'on <strong>garde</strong>,{' '}
          <strong>change</strong>, ou <strong>retire</strong> sur chaque vue.
        </footer>
      </div>
    </div>
  );
}
