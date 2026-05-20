import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { MapIcon, type IconName } from './icons';
import {
  MAP_VIEW_DEFAULTS,
  MARKER_COLORS,
  TOOL_LABELS,
  TOOL_SHORTCUTS,
  type Basemap,
  type MapTool,
  type MapViewProps,
} from './MapView.types';

const TOOL_ICONS: Record<MapTool, IconName> = {
  select: 'select',
  'draw-parcel': 'drawParcel',
  'add-marker': 'pin',
  measure: 'ruler',
  group: 'group',
  layers: 'layers',
};

/* ============ Sources de tuiles (Swisstopo WMTS) ============ */
const TILE_URLS: Record<Basemap, string> = {
  satellite:
    'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg',
  street:
    'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
  topo: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
};

const TILE_ATTRIBUTION = '© <a href="https://www.swisstopo.admin.ch" target="_blank">swisstopo</a>';

const BASEMAP_LABELS: Record<Basemap, string> = {
  street: 'Carte',
  satellite: 'Satellite',
  topo: 'Topo',
};

export function MapView({
  parcels,
  markers = [],
  selectedId,
  selectedIds,
  onSelectionChange,
  activeTool: activeToolProp = MAP_VIEW_DEFAULTS.activeTool,
  onToolChange,
  enabledTools = MAP_VIEW_DEFAULTS.enabledTools,
  onCreateGroup,
  onDrawComplete,
  center = MAP_VIEW_DEFAULTS.defaultCenter,
  zoom = MAP_VIEW_DEFAULTS.zoom,
  zoomRange = MAP_VIEW_DEFAULTS.zoomRange,
  basemap: basemapProp,
  showBasemapToggle = MAP_VIEW_DEFAULTS.showBasemapToggle,
  showLegend = MAP_VIEW_DEFAULTS.showLegend,
  height = MAP_VIEW_DEFAULTS.height,
  interactive = MAP_VIEW_DEFAULTS.interactive,
  className,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const parcelLayerRef = useRef<L.GeoJSON | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const drawnLayerRef = useRef<L.LayerGroup | null>(null);
  const draftLayerRef = useRef<L.LayerGroup | null>(null);
  const hasFittedRef = useRef(false);
  const isDesktop = useIsDesktop();
  const [basemap, setBasemap] = useState<Basemap>(basemapProp ?? 'satellite');
  const [basemapPickerOpen, setBasemapPickerOpen] = useState(false);
  // Mode mixte : `activeTool` est piloté localement par défaut, le parent peut
  // aussi le contrôler via la prop. Quand la prop change, on synchronise.
  const [activeTool, setActiveTool] = useState<MapTool>(activeToolProp);
  const [prevActiveToolProp, setPrevActiveToolProp] = useState(activeToolProp);
  if (activeToolProp !== prevActiveToolProp) {
    setPrevActiveToolProp(activeToolProp);
    setActiveTool(activeToolProp);
  }

  // Éléments dessinés via les outils (markers / polygones) — state local, MVP.
  const [drawnMarkers, setDrawnMarkers] = useState<
    Array<{ id: string; lat: number; lng: number; kind: 'pin' | 'measure' }>
  >([]);
  const [drawnPolygons, setDrawnPolygons] = useState<
    Array<{ id: string; coords: Array<[number, number]> }>
  >([]);
  const [hint, setHint] = useState<string | null>(null);

  const effectiveSelectedIds = useMemo(
    () => [...(selectedIds ?? []), ...(selectedId ? [selectedId] : [])].filter(Boolean),
    [selectedIds, selectedId],
  );

  /* ---------- Init carte Leaflet ---------- */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      // Leaflet utilise [lat, lng] et non [lng, lat] !
      center: [center[1], center[0]],
      zoom,
      minZoom: zoomRange[0],
      maxZoom: zoomRange[1],
      zoomControl: false, // on ajoute en bas-gauche manuellement
      attributionControl: true,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      touchZoom: interactive,
    });

    // Boutons +/- zoom : uniquement sur desktop. Sur mobile, le pinch-to-zoom
    // natif suffit et les boutons prennent inutilement de la place visible.
    if (interactive && isDesktop) {
      L.control.zoom({ position: 'bottomleft' }).addTo(map);
    }

    // Première couche de tuiles
    const tileLayer = L.tileLayer(TILE_URLS[basemap], {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 22,
    });
    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    // Groupes vides pour les markers et parcelles (mis à jour dans effets séparés)
    markersLayerRef.current = L.layerGroup().addTo(map);
    drawnLayerRef.current = L.layerGroup().addTo(map);
    draftLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      parcelLayerRef.current = null;
      markersLayerRef.current = null;
      drawnLayerRef.current = null;
      draftLayerRef.current = null;
      hasFittedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  /* ---------- Switch basemap ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileLayerRef.current) return;
    map.removeLayer(tileLayerRef.current);
    const newLayer = L.tileLayer(TILE_URLS[basemap], {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 22,
    });
    newLayer.addTo(map);
    tileLayerRef.current = newLayer;
  }, [basemap]);

  /* ---------- Layer parcelles (GeoJSON) — créé une seule fois par jeu de parcelles
       pour éviter de détruire/reconstruire (et faire trembler les labels) à chaque
       changement de sélection. La sélection est ré-appliquée dans un effet séparé. ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Retirer l'ancien layer si présent
    if (parcelLayerRef.current) {
      map.removeLayer(parcelLayerRef.current);
      parcelLayerRef.current = null;
    }

    if (parcels.length === 0) return;

    const featureCollection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: parcels.map((p) => ({
        type: 'Feature',
        properties: { id: p.id, name: p.name, surface: p.surfaceHa, color: p.color },
        geometry: p.geometry,
      })),
    };

    const layer = L.geoJSON(featureCollection, {
      style: (feature) => {
        const baseColor = (feature?.properties?.color as string | undefined) ?? '#f4a261';
        return {
          color: baseColor,
          weight: 3,
          opacity: 1,
          fillColor: baseColor,
          fillOpacity: 0.6,
        };
      },
      onEachFeature: (feature, layerInstance) => {
        const id = feature.properties?.id as string;
        const name = feature.properties?.name as string;
        layerInstance.bindTooltip(name, {
          permanent: true,
          direction: 'center',
          className: 'qodo-parcel-label',
        });
        layerInstance.on('click', (e) => {
          const orig = e.originalEvent as MouseEvent;
          const multi = orig.shiftKey || orig.metaKey;
          const ref = selectionRef.current;
          if (multi) {
            const next = ref.includes(id) ? ref.filter((s) => s !== id) : [...ref, id];
            onSelectionRef.current(next);
          } else {
            onSelectionRef.current([id]);
          }
        });
      },
    });
    layer.addTo(map);
    parcelLayerRef.current = layer;
  }, [parcels]);

  /* ---------- Refs : selection courante + callback (évite recréer le layer) ---------- */
  // Refs synchronisées via effet pour donner aux handlers Leaflet (closures
  // attachées une seule fois au layer GeoJSON) l'accès aux valeurs fraîches,
  // sans recréer le layer (qui ferait trembler les labels permanents).
  const selectionRef = useRef<string[]>([]);
  const onSelectionRef = useRef(onSelectionChange);
  const parcelsRef = useRef(parcels);
  const onDrawCompleteRef = useRef(onDrawComplete);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    selectionRef.current = effectiveSelectedIds;
    // eslint-disable-next-line react-hooks/immutability
    onSelectionRef.current = onSelectionChange;
    parcelsRef.current = parcels;
    onDrawCompleteRef.current = onDrawComplete;
  });

  /* ---------- Restyle au changement de sélection (sans recréer le layer) ---------- */
  useEffect(() => {
    const layer = parcelLayerRef.current;
    if (!layer) return;
    layer.eachLayer((sub) => {
      const feature = (sub as L.GeoJSON & { feature?: GeoJSON.Feature }).feature;
      if (!feature) return;
      const id = feature.properties?.id as string;
      const baseColor = (feature.properties?.color as string | undefined) ?? '#f4a261';
      const isSelected = effectiveSelectedIds.includes(id);
      (sub as L.Path).setStyle({
        color: isSelected ? '#ffffff' : baseColor,
        weight: isSelected ? 4 : 3,
        opacity: 1,
        fillColor: isSelected ? '#2d5016' : baseColor,
        fillOpacity: isSelected ? 0.7 : 0.6,
      });
    });
  }, [effectiveSelectedIds]);

  /* ---------- Labels : font-size selon zoom, masqués si dézoomé trop fort ---------- */
  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;

    const HIDE_BELOW_ZOOM = 15;
    const update = () => {
      const z = map.getZoom();
      // 14 → 0px (masqué), 15 → 11px, 16 → 13px, 17 → 15px, 18 → 17px, 19 → 19px, 20+ → 21px
      const size = z < HIDE_BELOW_ZOOM ? 0 : Math.min(21, 9 + (z - HIDE_BELOW_ZOOM) * 2);
      container.style.setProperty('--qodo-label-size', `${size}px`);
      container.classList.toggle('qodo-labels-hidden', z < HIDE_BELOW_ZOOM);
    };
    update();
    map.on('zoomend', update);
    return () => {
      map.off('zoomend', update);
    };
  }, [parcels]);

  /* ---------- Auto-fit aux parcelles ----------
   * Re-fit à chaque changement d'exploitation (signature = farmId du 1er
   * parcel). 1ère ouverture : pas d'animation. Switch d'exploitation :
   * animation fluide vers les nouvelles parcelles.
   */
  const lastFitFarmIdRef = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || parcels.length === 0) return;
    if (!parcelLayerRef.current) return;
    const firstFarmId = parcels[0]?.farmId ?? '__no-farm__';
    if (hasFittedRef.current && lastFitFarmIdRef.current === firstFarmId) return;
    const bounds = parcelLayerRef.current.getBounds();
    if (bounds.isValid()) {
      const animate = hasFittedRef.current; // anime au switch, pas au 1er fit
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17, animate });
      hasFittedRef.current = true;
      lastFitFarmIdRef.current = firstFarmId;
    }
  }, [parcels]);

  /* ---------- Markers ---------- */
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    for (const m of markers) {
      const color = m.color ?? MARKER_COLORS[m.kind];
      const icon = L.divIcon({
        html: `<span style="display:inline-block;width:16px;height:16px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,0.3);"></span>`,
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      const marker = L.marker([m.position[1], m.position[0]], { icon });
      if (m.label) marker.bindPopup(m.label);
      marker.addTo(layer);
    }
  }, [markers]);

  /* ---------- Re-render des éléments dessinés (markers utilisateur + polygons) ---------- */
  useEffect(() => {
    const layer = drawnLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const m of drawnMarkers) {
      const color = m.kind === 'pin' ? '#ec4899' : '#06b6d4';
      const icon = L.divIcon({
        html: `<span style="display:inline-block;width:14px;height:14px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,0.35);"></span>`,
        className: '',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([m.lat, m.lng], { icon }).addTo(layer);
    }
    for (const p of drawnPolygons) {
      L.polygon(p.coords, {
        color: '#f4a02c',
        weight: 3,
        fillColor: '#f4a02c',
        fillOpacity: 0.25,
      }).addTo(layer);
    }
  }, [drawnMarkers, drawnPolygons]);

  /* ---------- Outils carte (add-marker, measure, draw-parcel, lasso) ----------
   *
   * Les setState dans les handlers Leaflet ci-dessous sont déclenchés sur
   * des events utilisateur (click / mouseup), pas synchrones dans l'effet :
   * pas de cascade de renders. La règle ESLint ne sait pas distinguer.
   */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const map = mapRef.current;
    const draftLayer = draftLayerRef.current;
    if (!map || !draftLayer) return;
    draftLayer.clearLayers();

    if (activeTool === 'add-marker') {
      setHint('Cliquez sur la carte pour poser un point.');
      const onClick = (e: L.LeafletMouseEvent) => {
        setDrawnMarkers((curr) => [
          ...curr,
          { id: `m-${Date.now()}`, lat: e.latlng.lat, lng: e.latlng.lng, kind: 'pin' },
        ]);
      };
      map.on('click', onClick);
      return () => {
        map.off('click', onClick);
        setHint(null);
      };
    }

    if (activeTool === 'measure') {
      setHint('Cliquez deux points pour mesurer la distance.');
      let points: L.LatLng[] = [];
      const onClick = (e: L.LeafletMouseEvent) => {
        points.push(e.latlng);
        L.circleMarker(e.latlng, {
          radius: 5,
          color: '#06b6d4',
          fillColor: '#06b6d4',
          fillOpacity: 1,
        }).addTo(draftLayer);
        if (points.length === 2) {
          const dist = points[0]!.distanceTo(points[1]!);
          const label = dist > 1000 ? `${(dist / 1000).toFixed(2)} km` : `${Math.round(dist)} m`;
          const line = L.polyline(points, { color: '#06b6d4', weight: 3, dashArray: '6 4' });
          line.bindTooltip(label, {
            permanent: true,
            direction: 'center',
            className: 'qodo-measure-label',
          });
          line.addTo(draftLayer);
          points = [];
        }
      };
      map.on('click', onClick);
      return () => {
        map.off('click', onClick);
        draftLayer.clearLayers();
        setHint(null);
      };
    }

    if (activeTool === 'draw-parcel') {
      setHint(
        'Cliquez pour ajouter des sommets. Faites glisser un point pour le repositionner. Revenez sur le 1er point pour fermer.',
      );
      let vertices: L.LatLng[] = [];
      // Marker draggable par sommet, parallèle à `vertices` (même index).
      let vertexMarkers: L.Marker[] = [];
      let previewLine: L.Polyline | null = null;
      let firstVertexHalo: L.CircleMarker | null = null;
      // Seuil de snap au 1er sommet — en pixels écran (indépendant du zoom).
      const SNAP_THRESHOLD_PX = 18;
      map.doubleClickZoom.disable();

      const renderPreview = () => {
        if (previewLine) draftLayer.removeLayer(previewLine);
        if (vertices.length >= 2) {
          previewLine = L.polyline(vertices, {
            color: '#f4a02c',
            weight: 3,
            dashArray: '6 4',
          });
          previewLine.addTo(draftLayer);
        }
      };

      const renderFirstVertexHalo = () => {
        if (firstVertexHalo) {
          draftLayer.removeLayer(firstVertexHalo);
          firstVertexHalo = null;
        }
        // Halo "clic ici pour fermer" sur le 1er sommet, dès qu'on en a 3+.
        const first = vertices[0];
        if (vertices.length >= 3 && first) {
          firstVertexHalo = L.circleMarker(first, {
            radius: 10,
            color: '#f4a02c',
            fillColor: '#ffffff',
            fillOpacity: 0.6,
            weight: 2.5,
            interactive: false, // ne capte pas les events — laisse le marker dessous draggable
          });
          firstVertexHalo.addTo(draftLayer);
        }
      };

      const closePolygon = () => {
        if (vertices.length < 3) return;
        const ring: Array<[number, number]> = vertices.map((v) => [v.lng, v.lat]);
        ring.push(ring[0]!);
        const polygon: GeoJSON.Polygon = { type: 'Polygon', coordinates: [ring] };
        if (onDrawCompleteRef.current) {
          onDrawCompleteRef.current({ tool: 'draw-parcel', geometry: polygon });
        } else {
          const coordsLatLng: Array<[number, number]> = vertices.map((v) => [v.lat, v.lng]);
          coordsLatLng.push(coordsLatLng[0]!);
          setDrawnPolygons((curr) => [...curr, { id: `poly-${Date.now()}`, coords: coordsLatLng }]);
        }
        vertices = [];
        vertexMarkers = [];
        draftLayer.clearLayers();
        previewLine = null;
        firstVertexHalo = null;
      };

      /** Icône divIcon — cercle violet plein (8px) avec liseré blanc. */
      const vertexIcon = L.divIcon({
        className: 'qodo-vertex-marker',
        html: '<span style="display:block;width:12px;height:12px;border-radius:50%;background:#f4a02c;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);"></span>',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      /** Ajoute un sommet à la fin et crée le marker draggable associé. */
      const addVertex = (latlng: L.LatLng) => {
        const idx = vertices.length;
        vertices.push(latlng);
        const marker = L.marker(latlng, { icon: vertexIcon, draggable: true });
        marker.addTo(draftLayer);
        // Drag → met à jour le sommet correspondant et redessine la preview.
        marker.on('drag', (ev) => {
          const m = ev.target as L.Marker;
          vertices[idx] = m.getLatLng();
          renderPreview();
          renderFirstVertexHalo();
        });
        // Empêcher la propagation du click sur le marker (sinon clic ajoute
        // un nouveau sommet par-dessus, ou ferme le polygon).
        marker.on('click', (ev) => {
          L.DomEvent.stop(ev as unknown as L.LeafletEvent);
          // Si on a ≥ 3 sommets et qu'on clique sur le 1er marker → ferme.
          if (idx === 0 && vertices.length >= 3) closePolygon();
        });
        vertexMarkers.push(marker);
      };

      const onClick = (e: L.LeafletMouseEvent) => {
        // Si on a déjà ≥ 3 sommets et que le clic est proche du 1er → ferme auto.
        const first = vertices[0];
        if (vertices.length >= 3 && first) {
          const clickPx = map.latLngToContainerPoint(e.latlng);
          const firstPx = map.latLngToContainerPoint(first);
          const dist = clickPx.distanceTo(firstPx);
          if (dist <= SNAP_THRESHOLD_PX) {
            L.DomEvent.stop(e as unknown as L.LeafletEvent);
            closePolygon();
            return;
          }
        }
        addVertex(e.latlng);
        renderPreview();
        renderFirstVertexHalo();
      };

      // Dblclick reste accepté comme alternative (utile si snap pas évident).
      const onDblClick = (e: L.LeafletMouseEvent) => {
        L.DomEvent.stop(e as unknown as L.LeafletEvent);
        closePolygon();
      };

      map.on('click', onClick);
      map.on('dblclick', onDblClick);
      return () => {
        map.off('click', onClick);
        map.off('dblclick', onDblClick);
        map.doubleClickZoom.enable();
        draftLayer.clearLayers();
        setHint(null);
      };
    }

    return undefined;
    // On ne dépend QUE de activeTool : `parcels` est lu via parcelsRef pour
    // ne pas remonter l'effet pendant qu'on dessine un polygon (sinon les
    // sommets en cours seraient effacés à chaque changement de filtre).
  }, [activeTool]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* ---------- Raccourcis clavier outils ---------- */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const tool = (Object.entries(TOOL_SHORTCUTS) as [MapTool, string][]).find(
        ([, k]) => k === key,
      );
      if (tool && enabledTools.includes(tool[0])) {
        setActiveTool(tool[0]);
        onToolChange?.(tool[0]);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onToolChange, enabledTools]);

  const handleToolClick = useCallback(
    (tool: MapTool) => {
      if (tool === 'group' && effectiveSelectedIds.length > 0) {
        onCreateGroup?.(effectiveSelectedIds.slice());
        return;
      }
      if (tool === 'layers') {
        setBasemapPickerOpen((v) => !v);
        return;
      }
      setActiveTool(tool);
      onToolChange?.(tool);
    },
    [onToolChange, onCreateGroup, effectiveSelectedIds],
  );

  /* ---------- Render ---------- */
  return (
    <div
      className={[
        'relative overflow-hidden rounded-(--radius) border border-(--color-border) bg-(--color-surface)',
        className ?? '',
      ].join(' ')}
      style={{ height }}
    >
      <div ref={containerRef} className="absolute inset-0" style={{ background: '#e5e3df' }} />

      {/* Toolbar latérale gauche — desktop uniquement (trop complexe sur mobile). */}
      {enabledTools.length > 0 && isDesktop && (
        <div
          role="toolbar"
          aria-label="Outils carte"
          className="absolute top-3 left-3 z-[400] flex flex-col overflow-hidden rounded-(--radius) border border-(--color-border) bg-(--color-surface) shadow-(--shadow-card)"
        >
          {enabledTools.map((tool, idx) => {
            const isActive = tool === activeTool;
            const isGroupAction = tool === 'group';
            const groupDisabled = isGroupAction && effectiveSelectedIds.length === 0;
            return (
              <button
                key={tool}
                type="button"
                aria-pressed={isActive}
                aria-label={`${TOOL_LABELS[tool]} (${TOOL_SHORTCUTS[tool].toUpperCase()})`}
                title={`${TOOL_LABELS[tool]} (${TOOL_SHORTCUTS[tool].toUpperCase()})`}
                disabled={groupDisabled}
                onClick={() => handleToolClick(tool)}
                className={[
                  'inline-flex h-10 w-10 items-center justify-center transition-colors',
                  idx > 0 ? 'border-t border-(--color-border)' : '',
                  isActive
                    ? 'bg-(--color-accent) text-white'
                    : 'text-(--color-text) hover:bg-[#f5f5f0]',
                  groupDisabled ? 'cursor-not-allowed opacity-40' : '',
                ].join(' ')}
              >
                <MapIcon name={TOOL_ICONS[tool]} />
              </button>
            );
          })}
        </div>
      )}

      {/* Sélection badge (multi) */}
      {effectiveSelectedIds.length > 1 && (
        <div className="absolute bottom-4 left-1/2 z-[500] -translate-x-1/2 transform">
          <div className="inline-flex items-center gap-3 rounded-(--radius-pill) bg-(--color-accent) px-4 py-2 text-sm font-medium text-white shadow-(--shadow-fab)">
            <span>
              <strong className="font-semibold">{effectiveSelectedIds.length}</strong> parcelles
              sélectionnées
            </span>
            {onCreateGroup && (
              <button
                type="button"
                onClick={() => onCreateGroup(effectiveSelectedIds.slice())}
                className="rounded-(--radius-sm) bg-white/20 px-2.5 py-0.5 text-xs hover:bg-white/30"
              >
                Grouper
              </button>
            )}
            <button
              type="button"
              onClick={() => onSelectionChange([])}
              className="rounded-(--radius-sm) bg-white/20 px-2.5 py-0.5 text-xs hover:bg-white/30"
            >
              Désélectionner
            </button>
          </div>
        </div>
      )}

      {/* Légende markers */}
      {showLegend && markers.length > 0 && (
        <div className="absolute right-3 bottom-3 z-[400] rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-xs shadow-(--shadow-card)">
          <LegendDot color={MARKER_COLORS.intervention} label="Intervention" />
          <LegendDot color={MARKER_COLORS.observation} label="Observation" />
          <LegendDot color={MARKER_COLORS.problem} label="Problème" />
          {markers.some((m) => m.kind === 'note') && (
            <LegendDot color={MARKER_COLORS.note} label="Note" />
          )}
        </div>
      )}

      {/* Toggle basemap */}
      {showBasemapToggle && (
        <BasemapPicker
          basemap={basemap}
          onChange={setBasemap}
          open={basemapPickerOpen}
          onOpenChange={setBasemapPickerOpen}
        />
      )}

      {/* Hint outil actif */}
      {hint && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-[450] -translate-x-1/2 transform">
          <div className="rounded-(--radius-pill) bg-(--color-surface) px-3 py-1.5 text-xs font-medium text-(--color-text) shadow-(--shadow-card)">
            {hint}
          </div>
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span
        className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-(--radius-pill) border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.2)]"
        style={{ background: color }}
      />
      <span>{label}</span>
    </div>
  );
}

/* ============ BasemapPicker ============ */
const PICKER_OPTIONS: Basemap[] = ['satellite', 'topo'];

function BasemapPicker({
  basemap,
  onChange,
  open,
  onOpenChange,
}: {
  basemap: Basemap;
  onChange: (b: Basemap) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapperRef.current?.contains(e.target as Node)) return;
      onOpenChange(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onOpenChange]);

  return (
    <div ref={wrapperRef} className="absolute top-3 right-3 z-[400]">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Fond de carte"
        onClick={() => onOpenChange(!open)}
        className="inline-flex h-9 items-center gap-2 rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 text-xs font-medium shadow-(--shadow-card) hover:bg-[#f5f5f0]"
      >
        <LayersGlyph />
        <span>{BASEMAP_LABELS[basemap]}</span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 mt-1 w-[140px] overflow-hidden rounded-(--radius) border border-(--color-border) bg-(--color-surface) shadow-(--shadow-popup)"
        >
          {PICKER_OPTIONS.map((b) => {
            const isActive = b === basemap;
            return (
              <li key={b}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    onChange(b);
                    onOpenChange(false);
                  }}
                  className={[
                    'flex h-9 w-full items-center gap-2 px-3 text-xs',
                    isActive
                      ? 'bg-(--color-primary)/10 font-medium text-(--color-primary)'
                      : 'text-(--color-text) hover:bg-[#f5f5f0]',
                  ].join(' ')}
                >
                  {BASEMAP_LABELS[b]}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function LayersGlyph() {
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
      <path d="m12 2 10 6-10 6L2 8z" />
      <path d="m2 14 10 6 10-6" />
    </svg>
  );
}
