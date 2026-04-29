"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { GeoJsonPolygon } from "@/lib/parcelles";

const SUISSE_ROMANDE: L.LatLngTuple = [46.6, 6.55];

const SWISSTOPO_PIXELKARTE =
  "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg";
const SWISSTOPO_ORTHO =
  "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg";
const SWISSTOPO_ATTRIBUTION = '&copy; <a href="https://www.swisstopo.admin.ch">swisstopo</a>';

export default function ParcelleSingleMap({
  geom,
  couleurHex,
  height = 320,
}: {
  geom: GeoJsonPolygon | null;
  couleurHex?: string | null;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current).setView(SUISSE_ROMANDE, 11);
    const carte = L.tileLayer(SWISSTOPO_PIXELKARTE, {
      attribution: SWISSTOPO_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);
    const ortho = L.tileLayer(SWISSTOPO_ORTHO, {
      attribution: SWISSTOPO_ATTRIBUTION,
      maxZoom: 19,
    });

    L.control
      .layers({ Carte: carte, Satellite: ortho }, {}, { position: "topleft", collapsed: true })
      .addTo(map);

    if (geom) {
      const fill = couleurHex || "#4CAF50";
      const stroke = darken(fill);
      const layer = L.geoJSON(geom, {
        style: { color: stroke, weight: 3, fillColor: fill, fillOpacity: 0.35 },
      }).addTo(map);
      const bounds = layer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
    }

    return () => {
      map.remove();
    };
  }, [geom, couleurHex]);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden rounded-xl border border-border"
      style={{ height: `${height}px` }}
    />
  );
}

// Assombrit une couleur hex (#RRGGBB) de ~25% pour le contour.
function darken(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1] ?? "", 16);
  const r = Math.max(0, ((num >> 16) & 0xff) - 50);
  const g = Math.max(0, ((num >> 8) & 0xff) - 50);
  const b = Math.max(0, (num & 0xff) - 50);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
