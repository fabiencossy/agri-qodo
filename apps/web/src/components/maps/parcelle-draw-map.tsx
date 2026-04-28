"use client";

/**
 * Carte de dessin de parcelle.
 * - Fond OpenStreetMap (gratuit, attribution requise).
 * - L'utilisateur dessine un polygone, la surface est calculée
 *   automatiquement (formule géodésique sur WGS84) via @turf/area.
 * - Renvoie via onPolygonDrawn la géométrie GeoJSON et la surface en m².
 *
 * NOTE Next.js : ce composant doit être chargé via `dynamic({ ssr: false })`
 * car Leaflet dépend de `window`.
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
  layer: L.Layer & {
    toGeoJSON: () => PolygonFeature;
  };
}

interface DrawEditedEvent {
  layers: L.LayerGroup;
}

const SUISSE_ROMANDE: L.LatLngTuple = [46.6, 6.55];

export default function ParcelleDrawMap({
  onPolygonChange,
  initialGeom,
}: {
  onPolygonChange: (geom: GeoJsonPolygon | null, surfaceM2: number) => void;
  initialGeom?: GeoJsonPolygon;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [surface, setSurface] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current).setView(SUISSE_ROMANDE, 13);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    if (initialGeom) {
      const layer = L.geoJSON(initialGeom).addTo(drawnItems);
      const bounds = layer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
    }

    // leaflet-draw n'est pas typé proprement → cast
    const drawControl = new (
      L.Control as unknown as {
        Draw: new (options: unknown) => L.Control;
      }
    ).Draw({
      position: "topright",
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: { color: "#2E7D32", weight: 3 },
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
    map.on("draw:edited", (e) => {
      void (e as unknown as DrawEditedEvent);
      updateFromLayers();
    });
    map.on("draw:deleted", () => updateFromLayers());

    return () => {
      map.remove();
    };
    // initialGeom et onPolygonChange volontairement omis des deps : on
    // monte la carte une seule fois ; les events leaflet capturent
    // toujours la dernière référence via closure.
  }, []);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="h-[450px] w-full overflow-hidden rounded-xl border border-border"
      />
      {surface !== null && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-green/10 px-4 py-2 text-sm text-green-dark">
          <span className="font-semibold">Surface calculée :</span>
          <span className="text-base font-bold">
            {surface >= 10000
              ? `${(surface / 10000).toFixed(2)} ha`
              : surface >= 100
                ? `${(surface / 100).toFixed(2)} ares`
                : `${surface.toFixed(0)} m²`}
          </span>
          <span className="text-xs text-foreground/50">soit {surface.toFixed(0)} m²</span>
        </div>
      )}
      {surface === null && (
        <p className="text-xs text-foreground/50">
          Cliquez sur l'icône polygone (en haut à droite) pour commencer à tracer le contour de
          votre parcelle. Double-cliquez sur le dernier point pour fermer.
        </p>
      )}
    </div>
  );
}
