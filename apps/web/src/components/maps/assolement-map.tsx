"use client";

/**
 * Carte du plan d'assolement.
 *
 * Affiche les parcelles de l'exploitation en contour neutre, surimprime
 * les sous-zones d'interventions SEMIS coloriées par espèce de culture.
 * Une parcelle non couverte apparaît en gris (= pas de SEMIS spatialisé
 * pour cette campagne).
 *
 * Lib : Leaflet + Swisstopo orthophoto. Pas de dessin (read-only).
 */
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { InterventionWithGeom } from "@/lib/interventions";
import type { ParcelleMapItem } from "@/lib/parcelles";

const SWISSTOPO_PIXELKARTE =
  "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg";
const SWISSTOPO_ORTHO =
  "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg";
const SWISSTOPO_ATTRIBUTION = '&copy; <a href="https://www.swisstopo.admin.ch">swisstopo</a>';
const SUISSE_ROMANDE: L.LatLngTuple = [46.6, 6.55];

export default function AssolementMap({
  parcelles,
  interventions,
  colorByEspece,
}: {
  parcelles: ParcelleMapItem[];
  interventions: InterventionWithGeom[];
  colorByEspece: Record<string, string>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current).setView(SUISSE_ROMANDE, 13);

    const ortho = L.tileLayer(SWISSTOPO_ORTHO, {
      attribution: SWISSTOPO_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);
    const carte = L.tileLayer(SWISSTOPO_PIXELKARTE, {
      attribution: SWISSTOPO_ATTRIBUTION,
      maxZoom: 19,
    });
    L.control
      .layers(
        { "Vue satellite": ortho, Carte: carte },
        {},
        { position: "topleft", collapsed: false },
      )
      .addTo(map);

    const allLayers = L.featureGroup();

    // 1) Contour des parcelles en gris (toile de fond).
    for (const p of parcelles) {
      if (!p.geom) continue;
      const layer = L.geoJSON(p.geom, {
        style: {
          color: "#525252",
          weight: 1.5,
          fillColor: "#9CA3AF",
          fillOpacity: 0.18,
          dashArray: "4 4",
        },
      })
        .bindTooltip(p.nom, { sticky: true, direction: "center" })
        .addTo(map);
      allLayers.addLayer(layer);
    }

    // 2) Sous-zones SEMIS coloriées par espèce, avec tooltip enrichi.
    for (const i of interventions) {
      if (!i.geom || i.type !== "SEMIS") continue;
      const espece = i.culture?.espece ?? "Inconnu";
      const couleur = colorByEspece[espece] ?? "#1565C0";
      const surface = i.surfaceTravailleeM2 ? Number(i.surfaceTravailleeM2) : 0;
      const surfaceLabel =
        surface >= 10000
          ? `${(surface / 10000).toFixed(2)} ha`
          : surface >= 100
            ? `${(surface / 100).toFixed(1)} ares`
            : `${surface.toFixed(0)} m²`;
      const layer = L.geoJSON(i.geom, {
        style: { color: couleur, weight: 2, fillColor: couleur, fillOpacity: 0.55 },
      })
        .bindTooltip(
          `<div style="font-weight:600">${espece}</div>` +
            `<div style="font-size:11px;opacity:0.85">${i.parcelleNom} — ${surfaceLabel}</div>` +
            (i.culture?.variete
              ? `<div style="font-size:11px;opacity:0.7">${i.culture.variete}</div>`
              : ""),
          { sticky: true, direction: "top" },
        )
        .addTo(map);
      allLayers.addLayer(layer);
    }

    // 3) Cadrage auto sur l'ensemble.
    const bounds = allLayers.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });

    return () => {
      map.remove();
    };
  }, [parcelles, interventions, colorByEspece]);

  return (
    <div
      ref={containerRef}
      className="h-[600px] w-full overflow-hidden rounded-xl border border-border"
    />
  );
}
