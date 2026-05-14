"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { ParcelleMapItem } from "@/lib/parcelles";

const SUISSE_ROMANDE: L.LatLngTuple = [46.6, 6.55];

const SWISSTOPO_PIXELKARTE =
  "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg";
const SWISSTOPO_ORTHO =
  "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg";
const SWISSTOPO_ATTRIBUTION = '&copy; <a href="https://www.swisstopo.admin.ch">swisstopo</a>';

export default function ParcellesMapView({ parcelles }: { parcelles: ParcelleMapItem[] }) {
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
      .layers(
        { Carte: carte, "Vue satellite": ortho },
        {},
        { position: "topleft", collapsed: false },
      )
      .addTo(map);

    const group = L.featureGroup();
    parcelles.forEach((p) => {
      if (!p.geom) return;
      const fill = p.couleurHex || "#4CAF50";
      const stroke = darken(fill);
      const layer = L.geoJSON(p.geom, {
        style: {
          color: stroke,
          weight: 2,
          fillColor: fill,
          fillOpacity: 0.35,
        },
      });
      layer.bindTooltip(
        `<strong>${escapeHtml(p.nom)}</strong><br/>${formatSurface(p.surfaceM2)} · ${escapeHtml(p.zone)}`,
        {
          sticky: true,
        },
      );
      const popupHtml = `
        <div class="parcelle-popup">
          <div class="parcelle-popup__title">${escapeHtml(p.nom)}</div>
          <div class="parcelle-popup__meta">${formatSurface(p.surfaceM2)} · ${escapeHtml(p.zone)}</div>
          <div class="parcelle-popup__actions">
            <a href="/parcelles/${encodeURIComponent(p.id)}" class="parcelle-popup__btn parcelle-popup__btn--ghost">Modifier</a>
            <a href="/interventions/new?parcelleId=${encodeURIComponent(p.id)}" class="parcelle-popup__btn parcelle-popup__btn--primary">Créer intervention</a>
          </div>
        </div>
      `;
      layer.bindPopup(popupHtml, { closeButton: true, autoPan: true });
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
  if (Number.isNaN(value) || value < 0) return "—";
  if (value >= 10000) return `${(value / 10000).toFixed(2)} ha`;
  if (value >= 100) return `${(value / 100).toFixed(2)} a`;
  return `${value.toFixed(0)} m²`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function darken(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1] ?? "", 16);
  const r = Math.max(0, ((num >> 16) & 0xff) - 50);
  const g = Math.max(0, ((num >> 8) & 0xff) - 50);
  const b = Math.max(0, (num & 0xff) - 50);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
