"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { ParcelleMapItem } from "@/lib/parcelles";

const SUISSE_ROMANDE: L.LatLngTuple = [46.6, 6.55];

export default function ParcellesMapView({ parcelles }: { parcelles: ParcelleMapItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current).setView(SUISSE_ROMANDE, 11);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const group = L.featureGroup();
    parcelles.forEach((p) => {
      if (!p.geom) return;
      const layer = L.geoJSON(p.geom, {
        style: {
          color: "#2E7D32",
          weight: 2,
          fillColor: "#4CAF50",
          fillOpacity: 0.3,
        },
      });
      layer.bindTooltip(`<strong>${p.nom}</strong><br/>${formatSurface(p.surfaceM2)} · ${p.zone}`, {
        sticky: true,
      });
      layer.addTo(group);
    });

    if (group.getLayers().length > 0) {
      group.addTo(map);
      const bounds = group.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
    }

    return () => {
      map.remove();
    };
  }, [parcelles]);

  return (
    <div
      ref={containerRef}
      className="h-[500px] w-full overflow-hidden rounded-xl border border-border"
    />
  );
}

function formatSurface(m2: string): string {
  const value = Number(m2);
  if (Number.isNaN(value)) return "—";
  if (value >= 10000) return `${(value / 10000).toFixed(2)} ha`;
  return `${value.toFixed(0)} m²`;
}
