import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageContainer } from '../_shared/PageContainer';
import { MapView } from '../../components/MapView';
import { useFabActions, useHideFab } from '../../layouts/useFab';
import { useStandardFabActions } from '../../layouts/useStandardFabActions';
import { type ParcelDetail } from './parcellaire.mocks';
import { useParcels } from './parcellaire.store';
import {
  USER_MARKER_KIND_COLORS,
  USER_MARKER_KIND_LABELS,
  useUserMarkers,
  type UserMarker,
} from './userMarkers.store';
import { UserMarkerModal } from './UserMarkerModal';
import { PhotoGallery } from '../photos/PhotoGallery';
import { AssolementTimeline } from '../assolement/AssolementTimeline';
import { AssolementSegmentModal } from '../assolement/AssolementSegmentModal';
import { getActiveSegment, getSegmentsForParcelYear } from '../assolement/assolement.helpers';
import { useSegments } from '../assolement/assolement.store';
import { cultureColor } from '../assolement/cultures';
import type { AssolementSegment } from '../assolement/assolement.types';
import { Tabs, TabPanel, type TabDescriptor } from '../../components/Tabs';
import { ParcelleStats } from './ParcelleStats';
import { FumurePanel } from '../fumure/FumurePanel';
import { computeFumureBalance } from '../fumure/fumure.helpers';
import { InterventionList } from '../carnet/InterventionList';
import { InterventionForm } from '../carnet/InterventionForm';
import {
  addInterventions,
  removeIntervention,
  updateIntervention,
  useInterventions,
} from '../carnet/carnet.store';
import { getInterventionsForParcel } from '../carnet/carnet.helpers';
import type { Intervention } from '../carnet/carnet.types';
import { findClientForFarm, useIsCurrentFarmInvitee } from '../farms/farms.helpers';
import { useCurrentFarm } from '../farms/farms.store';
import { useClients } from '../travaux/travaux.store';
import { QuickWorkOrderModal } from '../travaux/QuickWorkOrderModal';
import { WorkOrderModal } from '../travaux/WorkOrderModal';
import { useWorkOrders } from '../travaux/travaux.store';
import { getWorkType } from '../travaux/travaux.catalog';
import type { WorkOrder } from '../travaux/travaux.types';

const TODAY = new Date().toISOString().slice(0, 10);

/** URL Google Maps en mode itinéraire vers le centroïde de la parcelle. */
function googleMapsDirUrl(parcel: ParcelDetail): string {
  const [lng, lat] = computeCentroid(parcel);
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** Calcule le centroïde d'un polygone (moyenne des points du ring extérieur). */
function computeCentroid(parcel: ParcelDetail): [number, number] {
  const ring =
    parcel.geometry.type === 'Polygon'
      ? parcel.geometry.coordinates[0]!
      : parcel.geometry.coordinates[0]![0]!;
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    // ignorer le dernier point (= premier point pour fermer le ring)
    sumX += ring[i]![0]!;
    sumY += ring[i]![1]!;
    count++;
  }
  return [sumX / count, sumY / count];
}

const STATUS_LABELS: Record<NonNullable<ParcelDetail['status']>, string> = {
  active: 'Actif',
  fallow: 'Jachère',
  archived: 'Archivé',
};

/** Liste des onglets de la fiche parcelle. Ordre = priorité d'usage.
 *  En mode invité, seuls Aperçu (simplifié) + Localisation restent —
 *  les données agronomiques du client ne sont pas partagées. */
function parcelleTabs(_parcelId: string, isInvitee: boolean): ReadonlyArray<TabDescriptor> {
  if (isInvitee) {
    return [
      { key: 'overview', label: 'Aperçu' },
      { key: 'map', label: 'Localisation' },
    ];
  }
  return [
    { key: 'overview', label: 'Aperçu' },
    { key: 'carnet', label: 'Carnet' },
    { key: 'assolement', label: 'Assolement' },
    { key: 'fumure', label: 'Fumure' },
    { key: 'stats', label: 'Statistiques' },
    { key: 'map', label: 'Localisation' },
  ];
}

const STATUS_STYLES: Record<NonNullable<ParcelDetail['status']>, string> = {
  active: 'bg-(--color-success)/12 text-[#166534]',
  fallow: 'bg-(--color-warning)/12 text-[#92400e]',
  archived: 'bg-[#e5e5e5] text-(--color-muted)',
};

export default function ParcelleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const parcels = useParcels();
  const isInvitee = useIsCurrentFarmInvitee();
  const initial = useMemo(() => parcels.find((p) => p.id === id), [parcels, id]);
  const [draft, setDraft] = useState<ParcelDetail | undefined>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [editingIntervention, setEditingIntervention] = useState<
    Intervention | 'new' | 'observation' | null
  >(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [editingMarker, setEditingMarker] = useState<UserMarker | null>(null);

  // Balises GPS rattachées à cette parcelle (observation / danger / note)
  const allUserMarkers = useUserMarkers();
  const parcelMarkers = useMemo(
    () => allUserMarkers.filter((m) => m.parcelId === id),
    [allUserMarkers, id],
  );
  const [quickWorkOrder, setQuickWorkOrder] = useState<{
    clientId?: string;
    parcelId?: string;
  } | null>(null);
  const [fullWorkOrder, setFullWorkOrder] = useState<Partial<WorkOrder> | null>(null);

  const currentFarm = useCurrentFarm();
  const allClients = useClients();
  const matchedClient = isInvitee ? findClientForFarm(currentFarm, allClients) : undefined;

  // FAB unifié — la fiche met en avant "Créer une intervention" (action principale
  // sur une parcelle). En mode invité, on n'expose PAS d'actions standard
  // (Carnet/Fumure/Troupeau bloqués) ; un bouton "Nouveau travail pour tiers"
  // dans le header de la page sert de CTA principal à la place.
  const onAddIntervention = useMemo(() => () => setEditingIntervention('new'), []);
  const onAddObservation = useMemo(() => () => setEditingIntervention('observation'), []);
  useFabActions(
    useStandardFabActions(
      isInvitee
        ? {
            highlight: 'parcelle',
            parcelId: id,
            // En mode invité/managed : SEULE action = nouveau bon de travail.
            // onlyExtraActions=true masque intervention/observation/segment/présence
            // qui pointeraient vers des modules bloqués (trompeur).
            onlyExtraActions: true,
            extraActions: [
              {
                id: 'invitee-travaux-tiers',
                label: 'Nouveau bon de travail',
                variant: 'primary' as const,
                onClick: () => setQuickWorkOrder({ clientId: matchedClient?.id, parcelId: id }),
              },
            ],
          }
        : {
            highlight: 'intervention',
            parcelId: id,
            onAddIntervention,
            onAddObservation,
          },
    ),
  );

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  // Le FAB ("Créer une intervention") cède la place au footer sticky d'enregistrement
  // quand il y a des modifications à sauvegarder (sinon ils se chevauchent).
  // Aussi masqué quand le formulaire d'intervention est ouvert.
  useHideFab(dirty || editingIntervention !== null);

  if (!initial || !draft) {
    return (
      <PageContainer>
        <div className="mx-auto max-w-2xl rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-8 text-center">
          <h1 className="m-0 text-lg font-semibold">Parcelle introuvable</h1>
          <p className="m-0 mt-2 text-sm text-(--color-muted)">
            Le code <strong>{id}</strong> ne correspond à aucune parcelle.
          </p>
          <button
            type="button"
            onClick={() => navigate('/parcellaire')}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-4 text-sm font-medium text-white hover:bg-(--color-primary-hover)"
          >
            <BackIcon /> Retour au parcellaire
          </button>
        </div>
      </PageContainer>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    // TODO Phase 2.5 : persist via Odoo / API. Pour l'instant juste UI.
    setSavedAt(new Date());
    setSaving(false);
  };

  const setField = <K extends keyof ParcelDetail>(key: K, value: ParcelDetail[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };

  return (
    <PageContainer>
      <header className="mb-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/parcellaire')}
          aria-label="Retour au parcellaire"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius-sm) text-(--color-text) hover:bg-[#f1f1ee]"
        >
          <BackIcon />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 truncate text-xl font-semibold">
            {draft.id} — {draft.name}
          </h1>
          <p className="m-0 mt-0.5 truncate text-sm text-(--color-muted)">
            {draft.surfaceHa.toFixed(2)} ha
            {(() => {
              const active = getActiveSegment(draft.id, TODAY);
              return active ? ` · ${active.culture}` : '';
            })()}
          </p>
        </div>
        {draft.status && (
          <span
            className={[
              'hidden shrink-0 items-center rounded-(--radius-pill) px-2.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase sm:inline-flex',
              STATUS_STYLES[draft.status],
            ].join(' ')}
          >
            {STATUS_LABELS[draft.status]}
          </span>
        )}
        {/* Icône fine "Itinéraire" — accès rapide à Google Maps */}
        <a
          href={googleMapsDirUrl(draft)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Itinéraire (Google Maps)"
          title="Itinéraire vers la parcelle"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius-sm) text-(--color-muted) hover:bg-[#f1f1ee] hover:text-(--color-text)"
        >
          <GoogleMapsIcon />
        </a>
        {/* Kebab : actions secondaires */}
        <KebabMenu
          actions={[
            {
              id: 'duplicate',
              label: 'Dupliquer',
              onClick: () => alert('Duplication de parcelle (à brancher Phase 2.5).'),
            },
            {
              id: 'archive',
              label: draft.status === 'archived' ? 'Désarchiver' : 'Archiver',
              onClick: () =>
                setField('status', draft.status === 'archived' ? 'active' : 'archived'),
            },
            {
              id: 'delete',
              label: 'Supprimer',
              variant: 'danger',
              onClick: () =>
                confirm(`Supprimer la parcelle ${draft.id} ?`) && navigate('/parcellaire'),
            },
          ]}
        />
      </header>

      <Tabs
        tabs={parcelleTabs(draft.id, isInvitee)}
        activeKey={activeTab}
        onChange={setActiveTab}
        className="mb-5"
        ariaLabel="Sections de la parcelle"
      />

      <TabPanel tabKey="overview" active={activeTab}>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Identification */}
          <section className="rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-5 lg:col-span-2">
            <h2 className="m-0 mb-4 text-sm font-semibold tracking-wider text-(--color-muted) uppercase">
              Identification
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Code" htmlFor="f-code">
                <input
                  id="f-code"
                  type="text"
                  value={draft.id}
                  readOnly
                  className={readonlyClass}
                />
              </Field>
              <Field label="Nom" htmlFor="f-name">
                <input
                  id="f-name"
                  type="text"
                  value={draft.name}
                  onChange={(e) => setField('name', e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Surface (ha)" htmlFor="f-surf">
                <input
                  id="f-surf"
                  type="number"
                  step="0.01"
                  value={draft.surfaceHa}
                  onChange={(e) => setField('surfaceHa', Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
              <Field label="Année" htmlFor="f-year">
                <input
                  id="f-year"
                  type="number"
                  value={draft.year}
                  onChange={(e) => setField('year', Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
              <Field label="Statut" htmlFor="f-status">
                <select
                  id="f-status"
                  value={draft.status ?? 'active'}
                  onChange={(e) => setField('status', e.target.value as ParcelDetail['status'])}
                  className={inputClass}
                >
                  <option value="active">Actif</option>
                  <option value="fallow">Jachère</option>
                  <option value="archived">Archivé</option>
                </select>
              </Field>
            </div>
          </section>

          {/* Mini-carte */}
          <section className="overflow-hidden rounded-(--radius) border border-(--color-border) bg-(--color-surface)">
            <div className="flex items-center justify-between gap-2 border-b border-(--color-border) px-4 py-2">
              <h2 className="m-0 text-sm font-semibold tracking-wider text-(--color-muted) uppercase">
                Localisation
              </h2>
              <button
                type="button"
                onClick={() => setActiveTab('map')}
                className="text-[11px] font-medium text-(--color-primary) hover:underline"
              >
                Agrandir →
              </button>
            </div>
            <MapView
              parcels={[draft]}
              selectedId={draft.id}
              onSelectionChange={() => {
                /* lecture seule */
              }}
              center={computeCentroid(draft)}
              zoom={16}
              enabledTools={[]}
              showBasemapToggle={false}
              showLegend={false}
              height="260px"
              className="!rounded-none !border-0"
            />
          </section>

          {/* Résumés cliquables — naviguent vers l'onglet correspondant */}
          {!isInvitee && <OverviewSummaries parcel={draft} onNavigate={setActiveTab} />}

          {/* Photos de la parcelle */}
          {!isInvitee && (
            <section className="rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-5 lg:col-span-3">
              <PhotoGallery entityType="parcel" entityId={draft.id} title="Photos parcelle" />
            </section>
          )}

          {/* Balises GPS rattachées à la parcelle (observation / danger / note) */}
          {!isInvitee && parcelMarkers.length > 0 && (
            <section className="rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-5 lg:col-span-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="m-0 text-sm font-semibold tracking-wider text-(--color-muted) uppercase">
                  Balises GPS — {parcelMarkers.length}
                </h2>
                <span className="text-[11px] text-(--color-muted)">
                  Cliquer une balise pour modifier ou supprimer
                </span>
              </div>
              <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {parcelMarkers.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setEditingMarker(m)}
                      className="flex w-full items-start gap-3 rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 py-2.5 text-left text-sm hover:bg-[#fbfbf9]"
                    >
                      <span
                        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-(--radius-pill)"
                        style={{
                          background: `${USER_MARKER_KIND_COLORS[m.kind]}1a`,
                          color: USER_MARKER_KIND_COLORS[m.kind],
                        }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width={14}
                          height={14}
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
                        <div className="flex items-baseline gap-2">
                          <span className="truncate font-medium text-(--color-text)">
                            {m.label || USER_MARKER_KIND_LABELS[m.kind]}
                          </span>
                          {m.label && (
                            <span className="shrink-0 text-[10px] tracking-wider text-(--color-muted) uppercase">
                              {USER_MARKER_KIND_LABELS[m.kind]}
                            </span>
                          )}
                        </div>
                        {m.notes && (
                          <p className="m-0 mt-0.5 line-clamp-2 text-[11px] text-(--color-muted)">
                            {m.notes}
                          </p>
                        )}
                        <p className="m-0 mt-1 font-mono text-[10px] text-(--color-muted)">
                          {m.lat.toFixed(5)}, {m.lng.toFixed(5)}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* En mode invité, on remplace les cards agronomiques par un résumé
           * des travaux que J'AI effectués sur cette parcelle (cliquables). */}
          {isInvitee && (
            <InviteeWorkOrdersSection
              parcelId={draft.id}
              onOpenWorkOrder={(wo) => setFullWorkOrder(wo)}
            />
          )}

          {/* Point d'attention (parcelle) — visible aussi en mode invité (lecture
           * seule via le panel carte), éditable uniquement par le propriétaire ici */}
          {!isInvitee && (
            <section className="rounded-(--radius) border border-(--color-warning)/40 bg-(--color-warning)/5 p-5 lg:col-span-3">
              <div className="mb-3 flex items-center gap-2">
                <span aria-hidden className="text-[#92400e]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    width={16}
                    height={16}
                  >
                    <path d="M10.3 3.86a2 2 0 0 1 3.4 0l8.57 14.7A2 2 0 0 1 20.57 21H3.43a2 2 0 0 1-1.7-2.94z" />
                    <path d="M12 9v4M12 17h.01" />
                  </svg>
                </span>
                <h2 className="m-0 text-sm font-semibold tracking-wider text-[#92400e] uppercase">
                  Point d'attention
                </h2>
              </div>
              <p className="m-0 mb-2 text-[11px] text-(--color-muted)">
                Visible sur la carte (pastille), dans le panel de sélection et au moment de créer un
                travail — y compris pour les prestataires invités. Limite-toi à 1-3 phrases
                factuelles (drainage, captage d'eau, pente, jeunes arbres, parcelle bio voisine…).
              </p>
              <textarea
                value={draft.attentionNote ?? ''}
                onChange={(e) => setField('attentionNote', e.target.value || undefined)}
                placeholder="Ex. Drainage tous les 12 m — pas de sous-solage. Captage à 30 m côté est."
                rows={3}
                className={inputClass.replace('h-10', 'min-h-[80px] py-2')}
              />
            </section>
          )}

          {/* Notes (interne, jamais affichées à un invité) */}
          {!isInvitee && (
            <section className="rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-5 lg:col-span-3">
              <h2 className="m-0 mb-4 text-sm font-semibold tracking-wider text-(--color-muted) uppercase">
                Notes
              </h2>
              <textarea
                value={draft.notes ?? ''}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Observations, contexte, voisins…"
                rows={4}
                className={inputClass.replace('h-10', 'min-h-[96px] py-2')}
              />
            </section>
          )}
        </div>
      </TabPanel>

      <TabPanel tabKey="carnet" active={activeTab}>
        <CarnetSection parcelId={draft.id} onEdit={setEditingIntervention} />
      </TabPanel>

      <TabPanel tabKey="assolement" active={activeTab}>
        <AssolementSection parcelId={draft.id} year={draft.year} />
      </TabPanel>

      <TabPanel tabKey="fumure" active={activeTab}>
        <FumurePanel parcel={draft} />
      </TabPanel>

      <TabPanel tabKey="stats" active={activeTab}>
        <ParcelleStats parcel={draft} />
      </TabPanel>

      <TabPanel tabKey="map" active={activeTab}>
        <section
          className={[
            'flex flex-col overflow-hidden rounded-(--radius) border border-(--color-border) bg-(--color-surface)',
            // Mode fullscreen : overlay sous le header (h-14 mobile) + onglets (~h-10),
            // au-dessus de tout sauf le FAB (z-[1050]).
            mapFullscreen
              ? 'fixed inset-x-0 top-[104px] bottom-0 z-[900] !rounded-none border-x-0 border-b-0'
              : 'h-[calc(100vh-220px)] min-h-[480px]',
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-2 border-b border-(--color-border) px-4 py-2">
            <h2 className="m-0 text-sm font-semibold tracking-wider text-(--color-muted) uppercase">
              Localisation
            </h2>
            <div className="flex items-center gap-2">
              <a
                href={googleMapsDirUrl(draft)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 text-xs font-medium text-(--color-text) hover:bg-[#f8f8f5]"
              >
                <GoogleMapsIcon />
                <span className="hidden sm:inline">Itinéraire</span>
                <ExternalLinkIcon />
              </a>
              <button
                type="button"
                onClick={() => setMapFullscreen((f) => !f)}
                aria-label={mapFullscreen ? 'Réduire la carte' : 'Plein écran'}
                title={mapFullscreen ? 'Réduire' : 'Plein écran'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-(--radius-sm) text-(--color-muted) hover:bg-[#f1f1ee] hover:text-(--color-text)"
              >
                {mapFullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
              </button>
            </div>
          </div>
          <div className="flex-1">
            <MapView
              parcels={[draft]}
              selectedId={draft.id}
              onSelectionChange={() => {
                /* lecture seule */
              }}
              center={computeCentroid(draft)}
              zoom={16}
              enabledTools={[]}
              showBasemapToggle
              height="100%"
              className="!rounded-none !border-0"
            />
          </div>
        </section>
      </TabPanel>

      {/* Formulaire d'intervention (modal) */}
      {editingIntervention && (
        <InterventionForm
          parcels={parcels}
          lockedParcelId={draft.id}
          initial={
            editingIntervention === 'new'
              ? { parcelId: draft.id }
              : editingIntervention === 'observation'
                ? { parcelId: draft.id, category: 'observation' }
                : editingIntervention
          }
          onSave={(intervention) => {
            if (
              editingIntervention !== 'new' &&
              editingIntervention !== 'observation' &&
              editingIntervention.id === intervention.id
            ) {
              updateIntervention(intervention.id, intervention);
            } else {
              addInterventions([intervention]);
            }
            setEditingIntervention(null);
          }}
          onCancel={() => setEditingIntervention(null)}
          onDelete={
            editingIntervention !== 'new' && editingIntervention !== 'observation'
              ? () => {
                  removeIntervention(editingIntervention.id);
                  setEditingIntervention(null);
                }
              : undefined
          }
        />
      )}

      {/* Création rapide d'un travail pour tiers — déclenché depuis le FAB
       * en mode invité (cf. extraActions ci-dessus). "Aller plus loin"
       * ouvre directement WorkOrderModal complet avec préfill. */}
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

      {editingMarker && (
        <UserMarkerModal
          key={editingMarker.id}
          marker={editingMarker}
          onClose={() => setEditingMarker(null)}
        />
      )}

      {/* Sticky footer save — visible UNIQUEMENT sur l'onglet Aperçu (seul onglet avec
       * champs éditables directs : identification, statut, notes). Les autres onglets
       * (Carnet, Assolement, Fumure, Stats, Localisation) sont des vues / éditeurs
       * spécialisés qui gèrent leur propre persistance via stores.
       * Boutons inversés : Enregistrer à gauche (action principale), Annuler juste à droite. */}
      {activeTab === 'overview' && !isInvitee && (
        <footer className="sticky bottom-0 z-[1000] mt-6 -mx-4 flex items-center gap-2 border-t border-(--color-border) bg-(--color-surface) px-4 py-3 sm:-mx-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="h-10 rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-5 text-sm font-medium text-white hover:bg-(--color-primary-hover) disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button
            type="button"
            onClick={() => setDraft(initial)}
            disabled={!dirty || saving}
            className="h-10 rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-4 text-sm font-medium hover:bg-[#f8f8f5] disabled:opacity-50"
          >
            Annuler
          </button>
          {savedAt && !dirty && (
            <span className="ml-auto text-xs text-(--color-success)">
              ✓ Enregistré {savedAt.toLocaleTimeString('fr-CH')}
            </span>
          )}
          {dirty && (
            <span className="ml-auto text-xs text-(--color-warning)">
              Modifications non enregistrées
            </span>
          )}
        </footer>
      )}
    </PageContainer>
  );
}

/* ============ Résumés Aperçu — 3 cards cliquables qui ouvrent l'onglet associé ============ */

function OverviewSummaries({
  parcel,
  onNavigate,
}: {
  parcel: ParcelDetail;
  onNavigate: (tab: string) => void;
}) {
  const allInterventions = useInterventions();
  const allSegments = useSegments();

  const interventions = useMemo(
    () => getInterventionsForParcel(parcel.id, allInterventions),
    [parcel.id, allInterventions],
  );
  const yearInterventions = useMemo(
    () => interventions.filter((i) => i.date.startsWith(String(parcel.year))),
    [interventions, parcel.year],
  );
  const lastIntervention = interventions[0];
  const activeSeg = useMemo(
    () => getActiveSegment(parcel.id, TODAY, allSegments),
    [parcel.id, allSegments],
  );
  const segments = useMemo(
    () => getSegmentsForParcelYear(parcel.id, parcel.year, allSegments),
    [parcel.id, parcel.year, allSegments],
  );

  // Bilan fumure simplifié (couverture N uniquement, le détail est dans l'onglet Fumure)
  const fumureBalance = useMemo(
    () => computeFumureBalance(activeSeg?.culture, parcel.surfaceHa, parcel.year, interventions),
    [activeSeg, parcel.surfaceHa, parcel.year, interventions],
  );

  return (
    <>
      {/* Assolement */}
      <SummaryCard title="Assolement" onOpen={() => onNavigate('assolement')}>
        {activeSeg ? (
          <>
            <div className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className="inline-block h-3 w-3 shrink-0 rounded-(--radius-pill)"
                style={{ background: cultureColor(activeSeg.culture) }}
              />
              <span className="font-medium">{activeSeg.culture}</span>
              {activeSeg.varietyName && (
                <span className="text-(--color-muted)">· {activeSeg.varietyName}</span>
              )}
            </div>
            <p className="m-0 mt-1 font-mono text-[11px] text-(--color-muted)">
              {fmtDate(activeSeg.startDate)} → {fmtDate(activeSeg.endDate)}
            </p>
            <p className="m-0 mt-2 text-[11px] text-(--color-muted)">
              {segments.length} segment{segments.length > 1 ? 's' : ''} pour la campagne{' '}
              {parcel.year}
            </p>
          </>
        ) : (
          <p className="m-0 text-sm text-(--color-muted)">Aucune culture en place aujourd'hui.</p>
        )}
      </SummaryCard>

      {/* Carnet */}
      <SummaryCard title="Carnet" onOpen={() => onNavigate('carnet')}>
        <div className="text-2xl font-semibold tabular-nums">
          {yearInterventions.length}
          <span className="ml-1 text-xs font-normal text-(--color-muted)">
            intervention{yearInterventions.length > 1 ? 's' : ''} en {parcel.year}
          </span>
        </div>
        {lastIntervention ? (
          <p className="m-0 mt-2 truncate text-[11px] text-(--color-muted)">
            Dernière : <strong>{lastIntervention.productName ?? lastIntervention.category}</strong>{' '}
            ({fmtDate(lastIntervention.date)})
          </p>
        ) : (
          <p className="m-0 mt-2 text-[11px] text-(--color-muted)">
            Aucune intervention enregistrée.
          </p>
        )}
      </SummaryCard>

      {/* Fumure */}
      <SummaryCard title="Plan de fumure" onOpen={() => onNavigate('fumure')}>
        {fumureBalance ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">
                {Math.round(fumureBalance.coverage.n)} %
              </span>
              <span className="text-[11px] text-(--color-muted)">couverture N</span>
            </div>
            <p
              className="m-0 mt-1 text-xs font-semibold capitalize"
              style={{
                color:
                  fumureBalance.status === 'équilibré'
                    ? '#16a34a'
                    : fumureBalance.status === 'sous-fertilisé'
                      ? '#f59e0b'
                      : '#ef4444',
              }}
            >
              {fumureBalance.status}
            </p>
            <p className="m-0 mt-1 text-[11px] text-(--color-muted)">
              Reste : {fumureBalance.remaining.nKg} kg N · {fumureBalance.remaining.pKg} kg P ·{' '}
              {fumureBalance.remaining.kKg} kg K
            </p>
          </>
        ) : (
          <p className="m-0 text-sm text-(--color-muted)">
            Aucun besoin documenté pour cette culture.
          </p>
        )}
      </SummaryCard>
    </>
  );
}

function SummaryCard({
  title,
  onOpen,
  children,
}: {
  title: string;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="m-0 text-[11px] font-semibold tracking-wider text-(--color-muted) uppercase">
          {title}
        </h3>
        <button
          type="button"
          onClick={onOpen}
          className="text-[11px] font-medium text-(--color-primary) hover:underline"
        >
          Voir →
        </button>
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

/* ============ Carnet section (résumé compact intégré dans onglet Carnet) ============ */

function CarnetSection({
  parcelId,
  onEdit,
}: {
  parcelId: string;
  onEdit: (i: Intervention) => void;
}) {
  const navigate = useNavigate();
  const allInterventions = useInterventions();
  const interventions = useMemo(
    () => getInterventionsForParcel(parcelId, allInterventions),
    [parcelId, allInterventions],
  );
  const recent = interventions.slice(0, 8);

  return (
    <section className="rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-5 lg:col-span-3">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-sm font-semibold tracking-wider text-(--color-muted) uppercase">
          Carnet des champs · {interventions.length} intervention
          {interventions.length > 1 ? 's' : ''}
        </h2>
        <button
          type="button"
          onClick={() => navigate(`/carnet?parcel=${parcelId}`)}
          className="inline-flex h-9 items-center gap-1.5 rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 text-xs font-medium text-(--color-text) hover:bg-[#f8f8f5]"
        >
          Voir le carnet complet
        </button>
      </div>
      <InterventionList interventions={recent} onEdit={onEdit} hideParcelColumn />
      {interventions.length > 8 && (
        <p className="m-0 mt-2 text-center text-xs text-(--color-muted)">
          {interventions.length - 8} intervention{interventions.length - 8 > 1 ? 's' : ''} plus
          ancienne{interventions.length - 8 > 1 ? 's' : ''} — voir le carnet complet
        </p>
      )}
    </section>
  );
}

function AssolementSection({ parcelId, year }: { parcelId: string; year: number }) {
  const allSegments = useSegments();
  const segments = useMemo(
    () => getSegmentsForParcelYear(parcelId, year, allSegments),
    [parcelId, year, allSegments],
  );
  const active = useMemo(
    () => getActiveSegment(parcelId, TODAY, allSegments),
    [parcelId, allSegments],
  );

  // Édition inline : pas de redirection vers /assolement, tout se passe ici.
  // Le modal réutilisable AssolementSegmentModal gère save/delete via le store.
  const [editing, setEditing] = useState<
    AssolementSegment | { draft: true; parcelId: string; year: number } | null
  >(null);

  const startNew = () => {
    setEditing({ draft: true, parcelId, year });
  };

  return (
    <section className="rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-5 lg:col-span-2">
      <div className="mb-3">
        <h2 className="m-0 text-sm font-semibold tracking-wider text-(--color-muted) uppercase">
          Assolement · campagne {year}
        </h2>
      </div>

      {/* Culture en place aujourd'hui */}
      <div className="mb-4 rounded-(--radius-sm) border border-(--color-border) bg-[#fbfbf9] p-3">
        <div className="text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
          Aujourd'hui
        </div>
        <div className="mt-1 flex items-center gap-2 text-sm font-medium">
          {active ? (
            <>
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-(--radius-pill)"
                style={{ background: cultureColor(active.culture) }}
              />
              <span>
                {active.culture}
                {active.varietyName ? ` · ${active.varietyName}` : ''}
              </span>
              <span className="ml-auto shrink-0 font-mono text-[11px] text-(--color-muted)">
                {fmtDate(active.startDate)} → {fmtDate(active.endDate)}
              </span>
            </>
          ) : (
            <span className="text-(--color-muted)">Aucun segment actif</span>
          )}
        </div>
      </div>

      {/* Timeline cliquable pour éditer chaque segment */}
      <AssolementTimeline
        segments={segments}
        year={year}
        variant="detail"
        today={TODAY}
        onSegmentClick={(s) => setEditing(s)}
        onAdd={startNew}
      />

      {/* Liste des segments éditables */}
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
                  onClick={() => setEditing(s)}
                  className="flex w-full items-center gap-2 rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-left text-sm hover:bg-[#fbfbf9]"
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

      {/* Modal d'édition de segment réutilisable */}
      {editing && <AssolementSegmentModal target={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function fmtDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Section "Travaux effectués sur cette parcelle" — affichée dans l'onglet
 * Aperçu en mode invité. Liste les bons cliquables (clic → ouvre WorkOrderModal).
 */
function InviteeWorkOrdersSection({
  parcelId,
  onOpenWorkOrder,
}: {
  parcelId: string;
  onOpenWorkOrder: (wo: WorkOrder) => void;
}) {
  const orders = useWorkOrders();
  const related = useMemo(
    () =>
      orders
        .filter((o) => (o.parcelIds ?? []).includes(parcelId))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [orders, parcelId],
  );

  return (
    <section className="rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-5 lg:col-span-3">
      <h2 className="m-0 mb-3 text-sm font-semibold tracking-wider text-(--color-muted) uppercase">
        Travaux effectués sur cette parcelle ({related.length})
      </h2>
      {related.length === 0 ? (
        <p className="m-0 text-sm text-(--color-muted)">
          Aucun travail enregistré pour cette parcelle. Créez-en un depuis le bouton flottant.
        </p>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {related.map((wo) => {
            const firstLine = wo.lines[0];
            const workTypeLabel = firstLine ? (getWorkType(firstLine.workType)?.label ?? '') : '';
            const statusLabel =
              wo.status === 'planned'
                ? 'planifié'
                : wo.status === 'done'
                  ? 'réalisé'
                  : wo.status === 'invoiced'
                    ? 'facturé'
                    : wo.status;
            return (
              <li key={wo.id}>
                <button
                  type="button"
                  onClick={() => onOpenWorkOrder(wo)}
                  className="flex w-full items-center justify-between gap-3 rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-left transition-colors hover:border-(--color-primary) hover:bg-[#fbfbf9]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {workTypeLabel ||
                        `${wo.lines.length} prestation${wo.lines.length > 1 ? 's' : ''}`}
                      {wo.lines.length > 1 && workTypeLabel && (
                        <span className="text-(--color-muted)"> +{wo.lines.length - 1}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-(--color-muted) capitalize">{statusLabel}</div>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-(--color-muted)">
                    {wo.date.split('-').reverse().join('.')}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const inputClass =
  'h-10 w-full rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 text-sm focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/15';

const readonlyClass = inputClass + ' bg-[#fbfbf9] text-(--color-muted)';

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-(--color-text)">
        {label}
      </label>
      {children}
    </div>
  );
}

function BackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={20}
      height={20}
      aria-hidden="true"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function GoogleMapsIcon() {
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
      <path d="M12 22s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={12}
      height={12}
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6M10 14 21 3" />
    </svg>
  );
}

function MaximizeIcon() {
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
      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function MinimizeIcon() {
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
      <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

interface KebabAction {
  id: string;
  label: string;
  onClick: () => void;
  variant?: 'danger';
}

function KebabMenu({ actions }: { actions: ReadonlyArray<KebabAction> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Plus d'actions"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-(--radius-sm) text-(--color-muted) hover:bg-[#f1f1ee] hover:text-(--color-text)"
      >
        <MoreVerticalGlyph />
      </button>
      {open && (
        <ul
          role="menu"
          className="absolute right-0 z-[1200] mt-1 w-[200px] rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-1 shadow-(--shadow-popup)"
        >
          {actions.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  a.onClick();
                  setOpen(false);
                }}
                className={[
                  'flex h-9 w-full items-center rounded-(--radius-sm) px-2.5 text-sm hover:bg-[#f8f8f5]',
                  a.variant === 'danger' ? 'text-(--color-error)' : 'text-(--color-text)',
                ].join(' ')}
              >
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MoreVerticalGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={18} height={18} aria-hidden="true">
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}
