"use client";

/**
 * Sélecteur de point GPS sur une carte plein écran. Conçu pour la
 * création rapide de parcelle (sélecteur Parcelle → bouton "📍 Sur
 * la carte"). On clique sur la carte ou on utilise sa géolocalisation,
 * un marqueur s'affiche puis on confirme avec "Valider ce point".
 *
 * Tuiles swisstopo (pixelkarte + orthophoto) — cohérent avec les autres
 * cartes de l'app.
 */
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const SUISSE_ROMANDE: L.LatLngTuple = [46.6, 6.55];

const SWISSTOPO_PIXELKARTE =
  "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg";
const SWISSTOPO_ORTHO =
  "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg";
const SWISSTOPO_ATTRIBUTION = '&copy; <a href="https://www.swisstopo.admin.ch">swisstopo</a>';

export interface PointPickerMapProps {
  /** Point initial (si on rouvre le picker pour ajuster). */
  initial?: { lat: number; lng: number } | null;
  onCancel: () => void;
  onConfirm: (point: { lat: number; lng: number }) => void;
}

export default function PointPickerMap({ initial, onCancel, onConfirm }: PointPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(initial ?? null);
  const [geoLoading, setGeoLoading] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(
      initial ? [initial.lat, initial.lng] : SUISSE_ROMANDE,
      initial ? 17 : 11,
    );
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
    mapRef.current = map;

    if (initial) {
      placeMarker(initial.lat, initial.lng);
    }

    map.on("click", (e) => {
      placeMarker(e.latlng.lat, e.latlng.lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  function placeMarker(lat: number, lng: number) {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const ll = markerRef.current?.getLatLng();
        if (ll) setPoint({ lat: ll.lat, lng: ll.lng });
      });
    }
    setPoint({ lat, lng });
  }

  function locate() {
    if (!navigator.geolocation) {
      alert("Géolocalisation indisponible sur ce navigateur.");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        const { latitude, longitude } = pos.coords;
        placeMarker(latitude, longitude);
        mapRef.current?.setView([latitude, longitude], 17);
      },
      () => {
        setGeoLoading(false);
        alert("Impossible de récupérer ta position.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div
      className="fixed inset-0 z-[9000] flex flex-col bg-background"
      role="dialog"
      aria-label="Choisir un point sur la carte"
    >
      <header className="flex items-center justify-between border-b border-border bg-background px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Annuler"
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="truncate text-sm font-semibold">
          {point ? `Point : ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : "Tape sur la carte"}
        </span>
        <button
          type="button"
          onClick={locate}
          disabled={geoLoading}
          aria-label="Utiliser ma position GPS"
          title="Utiliser ma position GPS"
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted disabled:opacity-50"
        >
          {geoLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Crosshair className="h-5 w-5" />
          )}
        </button>
      </header>

      <div ref={containerRef} className="flex-1" />

      <footer className="flex gap-2 border-t border-border bg-background p-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-semibold text-foreground/70 hover:bg-muted"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={() => point && onConfirm(point)}
          disabled={!point}
          className="flex-1 rounded-lg bg-green px-3 py-2.5 text-sm font-semibold text-white hover:bg-green-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Valider ce point
        </button>
      </footer>
    </div>
  );
}
