import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Polygon } from 'geojson';
import { useFabActions } from '../../layouts/useFab';
import { openFicheAction, useStandardFabActions } from '../../layouts/useStandardFabActions';
import { FabDrawIcon } from '../../layouts/fab-icons';
import { SearchBar, type FieldDescriptor, type SearchState } from '../../components/SearchBar';
import { ViewSwitcher, type ViewKey } from '../../components/ViewSwitcher';
import { ExportButton, type ExportColumn } from '../../components/ExportButton';
import { MapView, type MapTool } from '../../components/MapView';
import type { ParcelDetail } from './parcellaire.mocks';
import { addParcels, useParcels } from './parcellaire.store';
import {
  estimateSurfaceHa,
  featuresToParcels,
  parseGeojsonFile,
  parseShapefile,
} from './parcellaire.import';
import { ParcelleSummaryPanel } from './ParcelleSummaryPanel';
import { filterParcels } from './filtering';
import { ParcellaireTable } from './ParcellaireTable';
import {
  getActiveSegment,
  getAvailableYears,
  getDominantCulture,
  getSegmentsForParcelYear,
} from '../assolement/assolement.helpers';
import { useSegments } from '../assolement/assolement.store';
import { AssolementTimeline } from '../assolement/AssolementTimeline';
import { AssolementSegmentModal } from '../assolement/AssolementSegmentModal';
import type { AssolementSegment } from '../assolement/assolement.types';
import { cultureColor, listCultureGroups } from '../assolement/cultures';
import { useCurrentFarm } from '../farms/farms.store';
import { useIsCurrentFarmInvitee, findClientForFarm } from '../farms/farms.helpers';
import { useClients, useWorkOrders } from '../travaux/travaux.store';
import { QuickWorkOrderModal } from '../travaux/QuickWorkOrderModal';
import { WorkOrderModal } from '../travaux/WorkOrderModal';
import type { WorkOrder } from '../travaux/travaux.types';

const TODAY = new Date().toISOString().slice(0, 10);

const FIELDS: FieldDescriptor[] = [
  { id: 'name', label: 'Nom', type: 'text' },
  { id: 'code', label: 'Code', type: 'text' },
  { id: 'notes', label: 'Notes', type: 'text' },
  { id: 'variety', label: 'Variété', type: 'text' },
  {
    id: 'culture',
    label: 'Culture',
    type: 'select',
    // Groupes (Blé, Orge, Maïs, ...). Le détail "Blé d'automne" / "Blé dur" est
    // disponible dans le form d'édition du segment d'assolement.
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
  {
    id: 'year',
    label: 'Année',
    type: 'select',
    options: [
      { label: '2026', value: 2026 },
      { label: '2025', value: 2025 },
      { label: '2024', value: 2024 },
    ],
    groupable: true,
  },
];

/** Libellés FR des statuts pour les exports (le code interne reste 'active'/'fallow'/'archived'). */
const STATUS_FR: Record<NonNullable<ParcelDetail['status']>, string> = {
  active: 'Actif',
  fallow: 'Jachère',
  archived: 'Archivé',
};

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'id', label: 'Code' },
  { key: 'name', label: 'Nom' },
  { key: 'surfaceHa', label: 'Surface (ha)' },
  { key: 'culture', label: 'Culture' },
  { key: 'varietyName', label: 'Variété' },
  { key: 'status', label: 'Statut' },
  { key: 'year', label: 'Année' },
];

export default function ParcellairePage() {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewKey>('map');
  const [activeTool, setActiveTool] = useState<MapTool>('select');
  const [searchState, setSearchState] = useState<SearchState>({ facets: [], groupBy: [] });
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [quickWorkOrder, setQuickWorkOrder] = useState<{
    clientId?: string;
    parcelId?: string;
  } | null>(null);
  const [fullWorkOrder, setFullWorkOrder] = useState<Partial<WorkOrder> | null>(null);

  const currentFarm = useCurrentFarm();
  const isInvitee = useIsCurrentFarmInvitee();
  const allClients = useClients();
  const orders = useWorkOrders();
  const matchedClient = isInvitee ? findClientForFarm(currentFarm, allClients) : undefined;
  const parcels = useParcels();
  const allSegments = useSegments();
  // Année / campagne : visible uniquement en vue Timeline (assolement).
  const years = useMemo(() => getAvailableYears(allSegments), [allSegments]);
  const [year, setYear] = useState<number>(years[0] ?? new Date().getFullYear());
  const [editingSegment, setEditingSegment] = useState<
    AssolementSegment | { draft: true; parcelId: string; year: number } | null
  >(null);
  const geojsonInputRef = useRef<HTMLInputElement>(null);
  const shapefileInputRef = useRef<HTMLInputElement>(null);
  // Polygon dessiné en attente de configuration (dialog post draw-parcel).
  const [drawnDraft, setDrawnDraft] = useState<Polygon | null>(null);

  const handleGeojsonFile = async (file: File) => {
    try {
      const features = await parseGeojsonFile(file);
      const additions = featuresToParcels(features);
      if (additions.length === 0) {
        alert('Aucune parcelle exploitable (polygones requis) dans le fichier.');
        return;
      }
      addParcels(additions);
      alert(`${additions.length} parcelle(s) importée(s).`);
    } catch (err) {
      console.error(err);
      alert('Fichier GeoJSON invalide.');
    }
  };

  const handleShapefile = async (file: File) => {
    try {
      const features = await parseShapefile(file);
      const additions = featuresToParcels(features);
      if (additions.length === 0) {
        alert('Aucune parcelle exploitable (polygones requis) dans le fichier.');
        return;
      }
      addParcels(additions);
      alert(`${additions.length} parcelle(s) importée(s).`);
    } catch (err) {
      console.error(err);
      alert('Shapefile invalide. Fournir une archive .zip contenant .shp/.dbf/.shx.');
    }
  };

  // Masque le FAB sur mobile quand le bottom sheet de sélection est ouvert
  // (sinon le `+` chevauche le bouton Enregistrer du sheet).
  // FAB toujours visible, même quand un panel parcelle est ouvert (mobile
  // ou desktop). Le user a explicitement demandé que le FAB reste accessible
  // partout pour ne pas perdre l'action principale de la page.

  // Enrichissement : culture / variété / couleur dérivées du segment d'assolement
  // ACTIF à la date du jour. L'entité AssolementSegment (module dédié) pilote ces
  // propriétés agronomiques ; ParcelDetail conserve l'identité géographique seule.
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
  const selected = useMemo(
    () => (selectedId ? parcelsWithAssolement.find((p) => p.id === selectedId) : undefined),
    [parcelsWithAssolement, selectedId],
  );
  const totalSurface = filtered.reduce((s, p) => s + p.surfaceHa, 0);
  const summary = `${filtered.length} parcelles · ${totalSurface.toFixed(1)} ha`;

  // FAB unifié : 5 actions standards toujours présentes, avec mise en avant
  // contextuelle. Sur farm invitée, on remplace l'action "Créer une intervention"
  // par "Nouveau travail pour tiers" (seule action métier autorisée).
  const onCreateTravailTiers = useMemo(
    () => () =>
      setQuickWorkOrder({
        clientId: matchedClient?.id,
        parcelId: selectedId,
      }),
    [matchedClient?.id, selectedId],
  );

  const onNewParcel = useMemo(
    () => () => {
      setView('map');
      setActiveTool('draw-parcel');
    },
    [],
  );

  const extraActions = useMemo(() => {
    if (isInvitee) {
      // En mode invité/géré : actions = bon de travail + nouvelle parcelle
      // (essentiel pour gérer un client sans app) + ouvrir la fiche si parcelle
      // sélectionnée. Pas d'intervention/observation/segment (modules bloqués).
      const selectedName = selectedId
        ? (parcels.find((p) => p.id === selectedId)?.name ?? selectedId)
        : undefined;
      const actions = [
        {
          id: 'create-travaux-tiers',
          label: selectedName
            ? `Nouveau bon de travail sur ${selectedName}`
            : 'Nouveau bon de travail',
          variant: 'primary' as const,
          onClick: onCreateTravailTiers,
        },
        {
          id: 'invitee-new-parcel',
          label: 'Nouvelle parcelle (dessin)',
          variant: 'secondary' as const,
          icon: <FabDrawIcon />,
          onClick: onNewParcel,
        },
      ];
      if (selectedId) {
        actions.push(
          openFicheAction(selectedId, () => navigate(`/parcellaire/${selectedId}`)) as never,
        );
      }
      return actions;
    }
    return selectedId
      ? [openFicheAction(selectedId, () => navigate(`/parcellaire/${selectedId}`))]
      : [];
  }, [isInvitee, selectedId, navigate, onCreateTravailTiers, parcels, onNewParcel]);

  useFabActions(
    useStandardFabActions({
      // En mode invité/géré : SEULEMENT les extraActions (bon de travail +
      // nouvelle parcelle + ouvrir fiche). Pas d'intervention/observation/
      // segment/présence qui renvoient à des modules bloqués (trompeur).
      highlight: isInvitee ? 'parcelle' : selectedId ? 'intervention' : 'parcelle',
      parcelId: selectedId,
      onNewParcel: isInvitee ? undefined : onNewParcel,
      extraActions,
      onlyExtraActions: isInvitee,
    }),
  );

  // Données d'export : statuts traduits en FR (les colonnes sont juste des accesseurs,
  // donc le label sera bien rendu en français dans le PDF/Excel/CSV).
  const exportData = useMemo(
    () =>
      filtered.map((p) => ({
        ...p,
        status: STATUS_FR[p.status ?? 'active'] ?? p.status,
      })),
    [filtered],
  );

  const exportBtn = (
    <ExportButton
      data={exportData as unknown as ReadonlyArray<Record<string, unknown>>}
      columns={EXPORT_COLUMNS}
      filenameBase="parcelles"
      pdfMeta={{ title: 'Parcelles — Domaine Darval' }}
      extraActions={[
        {
          id: 'import-geojson',
          label: 'Importer GeoJSON…',
          onClick: () => geojsonInputRef.current?.click(),
        },
        {
          id: 'import-shapefile',
          label: 'Importer Shapefile (.zip)…',
          onClick: () => shapefileInputRef.current?.click(),
        },
      ]}
    />
  );

  // Top bar unique : 1 seule ligne mobile ET desktop avec titre + search + views + export
  const topBar = (
    <div className="flex w-full items-center gap-2">
      {/* Titre — desktop uniquement (mobile : déjà dans AppHeader) */}
      <div className="hidden shrink-0 items-baseline gap-2 md:flex">
        <h1 className="m-0 truncate text-base font-semibold">Parcellaire</h1>
        <span className="truncate text-xs text-(--color-muted)">{summary}</span>
      </div>
      {/* SearchBar prend toute la place restante */}
      <div className="min-w-0 flex-1">
        <SearchBar
          fields={FIELDS}
          value={searchState}
          onChange={setSearchState}
          ariaLabel="Rechercher dans le parcellaire"
        />
      </div>
      {/* Sélecteur Campagne — visible uniquement en vue Timeline (assolement). */}
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
      {/* Vues : dropdown icône seule sur mobile, segmented icon+label sur desktop. */}
      <div className="shrink-0 md:hidden">
        <ViewSwitcher
          views={['map', 'table', 'timeline', 'dashboard']}
          activeView={view}
          onChange={setView}
          layout="dropdown"
          display="icon-only"
        />
      </div>
      <div className="hidden shrink-0 md:block">
        <ViewSwitcher
          views={['map', 'table', 'timeline', 'dashboard']}
          activeView={view}
          onChange={setView}
          layout="segmented"
          display="icon-only"
        />
      </div>
      <div className="shrink-0">{exportBtn}</div>
    </div>
  );

  /* ============================================================
   * Layout unifié : top bar dans le flow pour TOUTES les vues
   * ============================================================ */
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Inputs cachés pour l'import fichier */}
      <input
        ref={geojsonInputRef}
        type="file"
        accept=".geojson,.json,application/geo+json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleGeojsonFile(f);
          e.target.value = '';
        }}
      />
      <input
        ref={shapefileInputRef}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleShapefile(f);
          e.target.value = '';
        }}
      />

      {/* Top bar identique partout, dans le flow */}
      <div className="flex-shrink-0 border-b border-(--color-border) bg-(--color-surface) px-3 py-2">
        {topBar}
      </div>

      {/* === CONTENU flex-1 === */}
      {view === 'map' ? (
        <div className="relative flex-1 overflow-hidden">
          <MapView
            parcels={filtered}
            selectedId={selectedId}
            onSelectionChange={(ids) => setSelectedId(ids[0])}
            activeTool={activeTool}
            onToolChange={setActiveTool}
            onDrawComplete={(e) => {
              if (e.tool === 'draw-parcel' && e.geometry.type === 'Polygon') {
                setDrawnDraft(e.geometry as Polygon);
                setActiveTool('select');
              }
            }}
            height="100%"
            className="!rounded-none !border-0"
          />
          {/* Panneau riche : aside desktop / bottom-sheet mobile */}
          {selected && (
            <div className="absolute inset-x-0 bottom-0 z-[1000] lg:top-0 lg:right-0 lg:bottom-0 lg:left-auto lg:w-[440px] lg:border-l lg:border-(--color-border) lg:shadow-(--shadow-popup)">
              <ParcelleSummaryPanel
                parcel={selected}
                onClose={() => setSelectedId(undefined)}
                onOpenFiche={() => navigate(`/parcellaire/${selected.id}`)}
                onOpenAssolement={() => navigate(`/assolement?parcel=${selected.id}`)}
                onOpenWorkOrder={(woId) => {
                  const wo = orders.find((o) => o.id === woId);
                  if (wo) setFullWorkOrder(wo);
                }}
              />
            </div>
          )}
          {/* Dialog post draw-parcel : configurer la parcelle dessinée */}
          {drawnDraft && (
            <NewParcelDialog
              geometry={drawnDraft}
              existingCount={parcels.length}
              onCancel={() => setDrawnDraft(null)}
              onCreate={(parcel) => {
                addParcels([parcel]);
                setDrawnDraft(null);
                setSelectedId(parcel.id);
              }}
            />
          )}
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
              onSelectSegment={(s) => setEditingSegment(s)}
              onAddSegment={(parcelId) => setEditingSegment({ draft: true, parcelId, year })}
            />
          ) : (
            <DashboardView parcels={filtered} />
          )}
        </div>
      )}

      {/* Modal d'édition segment réutilisable (commun aux vues map / timeline / table) */}
      {editingSegment && (
        <AssolementSegmentModal target={editingSegment} onClose={() => setEditingSegment(null)} />
      )}

      {/* Création rapide d'un travail pour tiers (utilisé en mode invité depuis le FAB).
       *  "Aller plus loin" : ferme le quick et ouvre le modal complet localement
       *  avec les valeurs déjà saisies (pas de navigation, l'utilisateur reste
       *  sur la carte). */}
      {quickWorkOrder && (
        <QuickWorkOrderModal
          initialClientId={quickWorkOrder.clientId}
          initialParcelId={quickWorkOrder.parcelId}
          onClose={() => setQuickWorkOrder(null)}
          onSwitchToFull={(draft) => {
            setQuickWorkOrder(null);
            setFullWorkOrder(draft);
          }}
        />
      )}

      {fullWorkOrder && (
        <WorkOrderModal initial={fullWorkOrder} onClose={() => setFullWorkOrder(null)} />
      )}
    </div>
  );
}

/* ============ Vue Timeline : Gantt 12 mois × parcelles (fusion v2 assolement) ============ */

const TIMELINE_TODAY = new Date().toISOString().slice(0, 10);

function TimelineView({
  parcels,
  year,
  segments,
  selectedId,
  onSelectParcel,
  onSelectSegment,
  onAddSegment,
}: {
  parcels: ReadonlyArray<ParcelDetail>;
  year: number;
  segments: ReadonlyArray<AssolementSegment>;
  selectedId?: string;
  onSelectParcel: (id: string) => void;
  onSelectSegment: (s: AssolementSegment) => void;
  onAddSegment: (parcelId: string) => void;
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
              <AssolementTimeline
                segments={parcelSegments}
                year={year}
                today={TIMELINE_TODAY}
                onSegmentClick={onSelectSegment}
              />
            </div>
            <button
              type="button"
              onClick={() => onAddSegment(p.id)}
              aria-label={`Ajouter un segment sur ${p.name}`}
              title="Ajouter un segment"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-(--radius-sm) border border-dashed border-(--color-border) text-(--color-muted) hover:border-(--color-primary) hover:bg-(--color-primary)/5 hover:text-(--color-primary)"
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
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ============ Dashboard simple ============ */
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
                    {ha.toFixed(1)} ha · {((ha / total) * 100).toFixed(0)} %
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-(--radius-pill) bg-[#f1f1ee]">
                  <div
                    className="h-full bg-(--color-primary)"
                    style={{ width: `${(ha / total) * 100}%` }}
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

/* ============ Dialog post draw-parcel ============ */

function NewParcelDialog({
  geometry,
  existingCount,
  onCancel,
  onCreate,
}: {
  geometry: Polygon;
  existingCount: number;
  onCancel: () => void;
  onCreate: (parcel: ParcelDetail) => void;
}) {
  const [name, setName] = useState(`Nouvelle parcelle ${existingCount + 1}`);
  const [code, setCode] = useState(`PF-${String(existingCount + 1).padStart(3, '0')}`);
  const [culture, setCulture] = useState<string>('Jachère');
  const [notes, setNotes] = useState('');
  const surfaceHa = useMemo(() => estimateSurfaceHa(geometry), [geometry]);
  const cultureOptions = listCultureGroups();
  const year = new Date().getFullYear();

  const submit = () => {
    if (!name.trim() || !code.trim()) return;
    onCreate({
      id: code.trim(),
      name: name.trim(),
      surfaceHa: Number(surfaceHa.toFixed(2)),
      culture,
      year,
      status: 'active',
      color: cultureColor(culture),
      notes: notes.trim() || undefined,
      geometry,
    });
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center md:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Configurer la nouvelle parcelle"
        className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-(--radius-lg) border border-(--color-border) bg-(--color-surface) shadow-(--shadow-popup) md:max-w-[480px] md:rounded-(--radius-lg)"
      >
        <header className="flex items-start gap-3 border-b border-(--color-border) px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-sm font-semibold">Nouvelle parcelle</h2>
            <p className="m-0 mt-0.5 text-xs text-(--color-muted)">
              Surface estimée : <strong>{surfaceHa.toFixed(2)} ha</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Annuler"
            className="inline-flex h-8 w-8 items-center justify-center rounded-(--radius-sm) text-(--color-muted) hover:bg-[#f1f1ee] hover:text-(--color-text)"
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
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <DialogField label="Nom">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className={dialogInput}
            />
          </DialogField>
          <DialogField label="Code">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={dialogInput}
            />
          </DialogField>
          <DialogField label="Culture initiale">
            <select
              value={culture}
              onChange={(e) => setCulture(e.target.value)}
              className={dialogInput}
            >
              {cultureOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="Jachère">Jachère</option>
            </select>
          </DialogField>
          <DialogField label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Observations…"
              className={dialogInput.replace('h-10', 'min-h-[60px] py-2')}
            />
          </DialogField>
        </div>
        <footer className="flex items-center gap-2 border-t border-(--color-border) p-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-4 text-sm font-medium hover:bg-[#f8f8f5]"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim() || !code.trim()}
            className="ml-auto inline-flex h-10 items-center rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-5 text-sm font-medium text-white hover:bg-(--color-primary-hover) disabled:opacity-50"
          >
            Créer la parcelle
          </button>
        </footer>
      </div>
    </div>
  );
}

const dialogInput =
  'h-10 w-full rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 text-sm focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/15';

function DialogField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}
