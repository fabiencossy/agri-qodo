import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import MapView, { type LatLng, Polygon, PROVIDER_DEFAULT, UrlTile } from "react-native-maps";
import type { ParcelleMapItem } from "@/lib/parcelles";

/** geo.admin.ch (Swisstopo) — carte officielle suisse, sans clé API. */
const SWISSTOPO_TILE_URL =
  "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg";

const SUISSE_ROMANDE = {
  latitude: 46.6,
  longitude: 6.55,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

/** Convertit GeoJSON [lng, lat] → react-native-maps {latitude, longitude}. */
function toLatLngs(coords: number[][]): LatLng[] {
  return coords.map(([lng, lat]) => {
    const lng_ = lng ?? 0;
    const lat_ = lat ?? 0;
    return { latitude: lat_, longitude: lng_ };
  });
}

export function ParcellesMap({ parcelles }: { parcelles: ParcelleMapItem[] }) {
  const [selected, setSelected] = useState<ParcelleMapItem | null>(null);

  const region = useMemo(() => {
    const coords: { lat: number; lng: number }[] = [];
    parcelles.forEach((p) => {
      if (!p.geom) return;
      p.geom.coordinates.forEach((ring) => {
        const r = ring as number[][];
        r.forEach(([lng, lat]) => {
          if (lng !== undefined && lat !== undefined) {
            coords.push({ lng, lat });
          }
        });
      });
    });
    if (coords.length === 0) return SUISSE_ROMANDE;
    const lats = coords.map((c) => c.lat);
    const lngs = coords.map((c) => c.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.01),
      longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.01),
    };
  }, [parcelles]);

  return (
    <View className="flex-1">
      <MapView
        style={{ flex: 1 }}
        provider={PROVIDER_DEFAULT}
        initialRegion={region}
        mapType="none"
      >
        <UrlTile urlTemplate={SWISSTOPO_TILE_URL} maximumZ={19} minimumZ={1} tileSize={256} />
        {parcelles.map((p) => {
          if (!p.geom) return null;
          const ring = p.geom.coordinates[0] as number[][] | undefined;
          if (!ring) return null;
          return (
            <Polygon
              key={p.id}
              coordinates={toLatLngs(ring)}
              strokeColor="#2E7D32"
              strokeWidth={2}
              fillColor="rgba(76, 175, 80, 0.3)"
              tappable
              onPress={() => setSelected(p)}
            />
          );
        })}
      </MapView>

      {selected && (
        <View className="absolute bottom-4 left-4 right-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="text-base font-semibold">{selected.nom}</Text>
              <Text className="text-sm text-gray-500">
                {formatSurface(selected.surfaceM2)} · {selected.zone}
              </Text>
            </View>
            <Pressable onPress={() => setSelected(null)} hitSlop={8} accessibilityLabel="Fermer">
              <Text className="text-2xl text-gray-400">×</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function formatSurface(m2: string): string {
  const value = Number(m2);
  if (Number.isNaN(value)) return "—";
  if (value >= 10000) return `${(value / 10000).toFixed(2)} ha`;
  return `${value.toFixed(0)} m²`;
}
