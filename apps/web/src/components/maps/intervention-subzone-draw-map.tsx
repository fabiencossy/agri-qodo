"use client";

/**
 * Carte de dessin d'une sous-zone d'intervention.
 *
 * - Affiche le contour de la parcelle parente en read-only (vert clair)
 *   comme guide visuel.
 * - L'utilisateur dessine un Polygon (un seul) à l'intérieur du contour.
 * - Surface recalculée localement via @turf/area pour feedback immédiat.
 * - Le backend valide `ST_Within parcelle.geom` et rejette si débordement
 *   — pas de clipping strict côté client (UX volontairement permissive,
 *   l'erreur backend est suffisamment explicite).
 */
import area from "@turf/area";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import { useEffect, useRef, useState } from "react";

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

interface PolygonFeature {
  type: "Feature";
  geometry: GeoJsonPolygon;
  properties: Record<string, unknown>;
}

interface DrawCreatedEvent {
  layer: L.Layer & { toGeoJSON: () => PolygonFeature };
}

const SWISSTOPO_PIXELKARTE =
  "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg";
const SWISSTOPO_ORTHO =
  "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg";
const SWISSTOPO_ATTRIBUTION = '&copy; <a href="https://www.swisstopo.admin.ch">swisstopo</a>';

const SUISSE_ROMANDE: L.LatLngTuple = [46.6, 6.55];

export default function InterventionSubzoneDrawMap({
  parcelleGeom,
  initialGeom,
  onPolygonChange,
}: {
  /** Contour de la parcelle parente (Polygon ou MultiPolygon GeoJSON). */
  parcelleGeom: GeoJsonPolygon | { type: "MultiPolygon"; coordinates: number[][][][] } | null;
  initialGeom?: GeoJsonPolygon | null;
  onPolygonChange: (geom: GeoJsonPolygon | null, surfaceM2: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [surface, setSurface] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current).setView(SUISSE_ROMANDE, 13);

    const carte = L.tileLayer(SWISSTOPO_PIXELKARTE, {
      attribution: SWISSTOPO_ATTRIBUTION,
      maxZoom: 19,
    });
    const ortho = L.tileLayer(SWISSTOPO_ORTHO, {
      attribution: SWISSTOPO_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    L.control
      .layers(
        { "Vue satellite": ortho, Carte: carte },
        {},
        { position: "topleft", collapsed: false },
      )
      .addTo(map);

    // Contour de la parcelle parente : non éditable, juste pour repère.
    if (parcelleGeom) {
      const parcelleLayer = L.geoJSON(parcelleGeom, {
        style: {
          color: "#2E7D32",
          weight: 2,
          fillColor: "#2E7D32",
          fillOpacity: 0.08,
          dashArray: "6 4",
        },
      }).addTo(map);
      const bounds = parcelleLayer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
    }

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    if (initialGeom) {
      L.geoJSON(initialGeom, {
        style: { color: "#1565C0", weight: 3, fillColor: "#1565C0", fillOpacity: 0.25 },
      }).eachLayer((layer) => drawnItems.addLayer(layer));
      const m2 = area({ type: "Feature", geometry: initialGeom, properties: {} });
      setSurface(m2);
    }

    const drawControl = new (
      L.Control as unknown as { Draw: new (options: unknown) => L.Control }
    ).Draw({
      position: "topright",
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: { color: "#1565C0", weight: 3, fillOpacity: 0.25 },
        },
        rectangle: false,
        circle: false,
        marker: false,
        polyline: false,
        circlemarker: false,
      },
      edit: { featureGroup: drawnItems, remove: true },
    });
    map.addControl(drawControl);

    const updateFromLayers = () => {
      const layers = drawnItems.getLayers();
      const last = layers[layers.length - 1] as { toGeoJSON: () => PolygonFeature } | undefined;
      if (!last) {
        setSurface(null);
        onPolygonChange(null, 0);
        return;
      }
      const feature = last.toGeoJSON();
      const m2 = area(feature);
      setSurface(m2);
      onPolygonChange(feature.geometry, m2);
    };

    map.on("draw:created", (e) => {
      drawnItems.clearLayers();
      drawnItems.addLayer((e as unknown as DrawCreatedEvent).layer);
      updateFromLayers();
    });
    map.on("draw:edited", () => updateFromLayers());
    map.on("draw:deleted", () => updateFromLayers());

    return () => {
      map.remove();
    };
    // dépendances volontairement vides : on monte la carte une fois ;
    // les events Leaflet ferment toujours sur la dernière `onPolygonChange`.
  }, []);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="h-[400px] w-full overflow-hidden rounded-xl border border-border"
      />
      {surface !== null ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-900">
          <span className="font-semibold">Sous-zone tracée :</span>
          <span className="text-base font-bold">
            {surface >= 10000
              ? `${(surface / 10000).toFixed(2)} ha`
              : surface >= 100
                ? `${(surface / 100).toFixed(2)} ares`
                : `${surface.toFixed(0)} m²`}
          </span>
        </div>
      ) : (
        <p className="text-xs text-foreground/60">
          Le contour vert pointillé délimite ta parcelle. Utilise l'outil polygone (en haut à
          droite) pour tracer la zone réellement travaillée. Reste à l'intérieur du contour, sinon
          le serveur refusera la sauvegarde.
        </p>
      )}
    </div>
  );
}
