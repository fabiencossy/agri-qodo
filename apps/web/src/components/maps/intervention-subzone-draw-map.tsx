"use client";

/**
 * Carte de dessin d'une sous-zone d'intervention.
 *
 * - Affiche le contour de la parcelle parente (vert pointillé) comme guide.
 * - L'utilisateur dessine un polygone, qui est **automatiquement clippé**
 *   aux limites de la parcelle via `@turf/intersect`. Pratique : on peut
 *   tracer grossièrement en débordant, le polygone final colle au bord
 *   officiel — pas de "petit bout oublié" sur la limite.
 * - Snap aux sommets de la parcelle pendant le tracé : si le curseur passe
 *   à moins de ~12 pixels d'un sommet du contour parcelle, on aimante.
 * - Surface recalculée live via @turf/area (basée sur le polygone clippé,
 *   pas sur le tracé brut).
 * - Le backend re-valide ST_Within (défense en profondeur).
 */
import area from "@turf/area";
import booleanContains from "@turf/boolean-contains";
import intersect from "@turf/intersect";
import { featureCollection, polygon as turfPolygon } from "@turf/helpers";
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

type ParcelleGeom = GeoJsonPolygon | { type: "MultiPolygon"; coordinates: number[][][][] };

interface DrawCreatedEvent {
  layer: L.Layer & { toGeoJSON: () => PolygonFeature };
}

const SWISSTOPO_PIXELKARTE =
  "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg";
const SWISSTOPO_ORTHO =
  "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg";
const SWISSTOPO_ATTRIBUTION = '&copy; <a href="https://www.swisstopo.admin.ch">swisstopo</a>';

const SUISSE_ROMANDE: L.LatLngTuple = [46.6, 6.55];

/** Distance de snap en pixels entre le curseur et un sommet de la parcelle. */
const SNAP_PIXEL_DISTANCE = 12;

/**
 * Localisation FR de leaflet-draw : tooltips des boutons et messages
 * pendant le tracé. Patché sur `L.drawLocal` au montage de la carte.
 */
const DRAW_LOCAL_FR = {
  draw: {
    toolbar: {
      actions: { title: "Annuler le tracé", text: "Annuler" },
      finish: { title: "Terminer le tracé", text: "Terminer" },
      undo: { title: "Supprimer le dernier point", text: "Effacer le dernier point" },
      buttons: { polygon: "Dessiner la zone" },
    },
    handlers: {
      polygon: {
        tooltip: {
          start: "Clique pour commencer le tracé",
          cont: "Clique pour ajouter un sommet",
          end: "Clique sur le premier point pour fermer la zone",
        },
      },
    },
  },
  edit: {
    toolbar: {
      actions: {
        save: { title: "Enregistrer les modifications", text: "Enregistrer" },
        cancel: { title: "Annuler les modifications", text: "Annuler" },
        clearAll: { title: "Tout effacer", text: "Tout effacer" },
      },
      buttons: {
        edit: "Modifier la zone tracée",
        editDisabled: "Aucune zone à modifier",
        remove: "Supprimer la zone tracée",
        removeDisabled: "Aucune zone à supprimer",
      },
    },
    handlers: {
      edit: {
        tooltip: {
          text: "Glisse les sommets pour ajuster la zone",
          subtext: "Clique sur Annuler pour rétablir",
        },
      },
      remove: { tooltip: { text: "Clique sur la zone pour la supprimer" } },
    },
  },
};

/**
 * Découpe le polygone tracé pour qu'il rentre strictement dans la
 * parcelle. Si la parcelle est un MultiPolygon, on intersecte avec
 * chaque morceau et on garde le plus grand résultat (cas où
 * l'utilisateur a tracé sur un ring particulier d'une parcelle disjointe).
 *
 * Retourne `null` si le polygone tracé est entièrement hors de la parcelle.
 */
function clipToParcelle(drawn: GeoJsonPolygon, parcelle: ParcelleGeom): GeoJsonPolygon | null {
  const drawnFeature = turfPolygon(drawn.coordinates);

  // Liste les Polygon individuels de la parcelle (1 si Polygon, N si MultiPolygon).
  const parcellePolygons: GeoJsonPolygon[] =
    parcelle.type === "Polygon"
      ? [parcelle]
      : (parcelle.coordinates as number[][][][]).map((ring) => ({
          type: "Polygon" as const,
          coordinates: ring,
        }));

  let bestClip: GeoJsonPolygon | null = null;
  let bestArea = 0;

  for (const part of parcellePolygons) {
    const partFeature = turfPolygon(part.coordinates);
    const result = intersect(featureCollection([drawnFeature, partFeature]));
    if (!result || !result.geometry) continue;
    // turf/intersect peut renvoyer un MultiPolygon si l'intersection a
    // plusieurs morceaux. On prend le plus grand pour garder un Polygon.
    if (result.geometry.type === "Polygon") {
      const a = area(result);
      if (a > bestArea) {
        bestArea = a;
        bestClip = result.geometry as GeoJsonPolygon;
      }
    } else if (result.geometry.type === "MultiPolygon") {
      for (const ring of result.geometry.coordinates) {
        const piece: GeoJsonPolygon = { type: "Polygon", coordinates: ring };
        const a = area(turfPolygon(piece.coordinates));
        if (a > bestArea) {
          bestArea = a;
          bestClip = piece;
        }
      }
    }
  }

  return bestClip;
}

/**
 * Vrai si `drawn` est entièrement contenu dans la parcelle (pas besoin
 * de clipper). Évite de retailler inutilement quand l'utilisateur a déjà
 * tracé proprement à l'intérieur.
 */
function isFullyContained(drawn: GeoJsonPolygon, parcelle: ParcelleGeom): boolean {
  const drawnFeature = turfPolygon(drawn.coordinates);
  if (parcelle.type === "Polygon") {
    return booleanContains(turfPolygon(parcelle.coordinates), drawnFeature);
  }
  return (parcelle.coordinates as number[][][][]).some((ring) =>
    booleanContains(turfPolygon(ring), drawnFeature),
  );
}

/** Récupère la liste des sommets (LatLng) de la parcelle pour le snap. */
function parcelleVertices(parcelle: ParcelleGeom): L.LatLng[] {
  const out: L.LatLng[] = [];
  const rings: number[][][][] =
    parcelle.type === "Polygon" ? [parcelle.coordinates] : parcelle.coordinates;
  for (const polygon of rings) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        if (typeof lat === "number" && typeof lng === "number") {
          out.push(L.latLng(lat, lng));
        }
      }
    }
  }
  return out;
}

export default function InterventionSubzoneDrawMap({
  parcelleGeom,
  forbiddenZones,
  maxSurfaceM2,
  initialGeom,
  onPolygonChange,
  onOverlapChange,
}: {
  /** Contour de la parcelle parente (Polygon ou MultiPolygon GeoJSON). */
  parcelleGeom: ParcelleGeom | null;
  /**
   * Sous-zones SEMIS déjà tracées sur cette parcelle (autres cultures du
   * plan d'assolement). Affichées en hachures rouges. Le tracé n'est
   * **plus interdit** dessus (sur-semis autorisé) — le caller doit
   * afficher une confirmation au submit via `onOverlapChange`.
   */
  forbiddenZones?: GeoJsonPolygon[];
  /**
   * Callback notifié quand l'aire de chevauchement avec les
   * forbiddenZones change. 0 = pas de sur-semis. > 0 = sur-semis
   * détecté, le caller doit avertir l'utilisateur.
   */
  onOverlapChange?: (overlapM2: number) => void;
  /**
   * Surface déclarée de la parcelle (autorité cadastrale). Quand la
   * géométrie de la parcelle couvre une surface différente (import
   * approximatif), on applique un ratio proportionnel à l'aire de la
   * sous-zone tracée pour respecter la déclaration. Ex : géom 5.98 ha
   * mais déclaré 2.89 → ratio 0.483, une zone tracée à 50% de la géom
   * (≈ 3 ha brut) sera affichée à 50% de 2.89 = 1.445 ha.
   */
  maxSurfaceM2?: number;
  initialGeom?: GeoJsonPolygon | null;
  onPolygonChange: (geom: GeoJsonPolygon | null, surfaceM2: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [surface, setSurface] = useState<number | null>(null);
  const [clipped, setClipped] = useState(false);

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

    // Aire géométrique réelle de la parcelle (pour calculer le ratio de
    // correction quand elle diverge de la surface déclarée).
    const parcelleGeomAreaM2 = parcelleGeom
      ? area(
          turfPolygon(
            parcelleGeom.type === "Polygon"
              ? parcelleGeom.coordinates
              : parcelleGeom.coordinates[0]!,
          ),
        )
      : 0;
    // Ratio à appliquer sur l'aire des sous-zones tracées : ratio = 1
    // quand géom matche déclaration ; ratio < 1 quand géom est trop
    // grande ; ratio > 1 quand géom est trop petite (rare). Toujours
    // respecté pour aligner front & user.
    const correctionRatio =
      maxSurfaceM2 !== undefined && maxSurfaceM2 > 0 && parcelleGeomAreaM2 > 0
        ? maxSurfaceM2 / parcelleGeomAreaM2
        : 1;

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

    // Sous-zones SEMIS déjà tracées : hachures rouges, tooltip "Déjà semé".
    if (forbiddenZones && forbiddenZones.length > 0) {
      for (const g of forbiddenZones) {
        L.geoJSON(g, {
          style: {
            color: "#B91C1C",
            weight: 2,
            fillColor: "#B91C1C",
            fillOpacity: 0.18,
            dashArray: "4 6",
          },
        })
          .bindTooltip("Zone déjà semée — tracé interdit ici", {
            sticky: true,
            direction: "center",
          })
          .addTo(map);
      }
    }

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    if (initialGeom) {
      L.geoJSON(initialGeom, {
        style: { color: "#1565C0", weight: 3, fillColor: "#1565C0", fillOpacity: 0.25 },
      }).eachLayer((layer) => drawnItems.addLayer(layer));
      const rawM2 = area({ type: "Feature", geometry: initialGeom, properties: {} });
      setSurface(rawM2 * correctionRatio);
    }

    // Localisation FR des boutons + tooltips leaflet-draw. drawLocal est
    // un singleton global, on patch avant d'instancier le control. Les
    // chaînes anglaises par défaut ("Draw a polygon", "Edit layers"...)
    // n'étaient pas explicites pour des agriculteurs FR (cf 2026-05-08).
    const drawLocal = (L as unknown as { drawLocal: typeof DRAW_LOCAL_FR }).drawLocal;
    drawLocal.draw.toolbar.actions.title = DRAW_LOCAL_FR.draw.toolbar.actions.title;
    drawLocal.draw.toolbar.actions.text = DRAW_LOCAL_FR.draw.toolbar.actions.text;
    drawLocal.draw.toolbar.finish.title = DRAW_LOCAL_FR.draw.toolbar.finish.title;
    drawLocal.draw.toolbar.finish.text = DRAW_LOCAL_FR.draw.toolbar.finish.text;
    drawLocal.draw.toolbar.undo.title = DRAW_LOCAL_FR.draw.toolbar.undo.title;
    drawLocal.draw.toolbar.undo.text = DRAW_LOCAL_FR.draw.toolbar.undo.text;
    drawLocal.draw.toolbar.buttons.polygon = DRAW_LOCAL_FR.draw.toolbar.buttons.polygon;
    drawLocal.draw.handlers.polygon.tooltip = DRAW_LOCAL_FR.draw.handlers.polygon.tooltip;
    drawLocal.edit.toolbar.actions.save = DRAW_LOCAL_FR.edit.toolbar.actions.save;
    drawLocal.edit.toolbar.actions.cancel = DRAW_LOCAL_FR.edit.toolbar.actions.cancel;
    drawLocal.edit.toolbar.actions.clearAll = DRAW_LOCAL_FR.edit.toolbar.actions.clearAll;
    drawLocal.edit.toolbar.buttons = DRAW_LOCAL_FR.edit.toolbar.buttons;
    drawLocal.edit.handlers.edit.tooltip = DRAW_LOCAL_FR.edit.handlers.edit.tooltip;
    drawLocal.edit.handlers.remove.tooltip = DRAW_LOCAL_FR.edit.handlers.remove.tooltip;

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

    // ----- Snap aux sommets de la parcelle pendant le tracé -----
    // leaflet-draw n'a pas de snap natif. On l'implémente à la main :
    // chaque mousemove projette le curseur sur le pixel, on cherche le
    // sommet de la parcelle le plus proche en pixels, si < SNAP_PIXEL_DISTANCE
    // on déplace le marker temporaire de l'outil draw vers ce sommet.
    const vertices = parcelleGeom ? parcelleVertices(parcelleGeom) : [];
    const onMouseMove = (e: L.LeafletMouseEvent) => {
      // L'API privée de leaflet-draw — `_markerGroup` contient les markers
      // de saisie pendant le draw. Pas typé, cast explicite.
      const handler = (
        drawControl as unknown as {
          _toolbars?: {
            draw?: {
              _activeMode?: {
                handler?: {
                  _markers?: L.Marker[];
                  _poly?: L.Polyline;
                  _markerGroup?: L.LayerGroup;
                };
              };
            };
          };
        }
      )._toolbars?.draw?._activeMode?.handler;
      if (!handler || !vertices.length) return;
      const cursorPx = map.latLngToLayerPoint(e.latlng);
      let best: L.LatLng | null = null;
      let bestDist = Infinity;
      for (const v of vertices) {
        const px = map.latLngToLayerPoint(v);
        const dx = px.x - cursorPx.x;
        const dy = px.y - cursorPx.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestDist) {
          bestDist = d;
          best = v;
        }
      }
      if (best && bestDist <= SNAP_PIXEL_DISTANCE) {
        // Snap : déplacer le marker temporaire (le dernier point cliqué + 1)
        // vers le sommet aimanté. On laisse leaflet-draw gérer le clic réel.
        e.latlng.lat = best.lat;
        e.latlng.lng = best.lng;
      }
    };
    map.on("mousemove", onMouseMove);

    const updateFromLayers = () => {
      const layers = drawnItems.getLayers();
      const last = layers[layers.length - 1] as { toGeoJSON: () => PolygonFeature } | undefined;
      if (!last) {
        setSurface(null);
        setClipped(false);
        onPolygonChange(null, 0);
        return;
      }
      const drawnFeature = last.toGeoJSON();
      let finalGeom: GeoJsonPolygon = drawnFeature.geometry;
      let didClip = false;

      // Clip auto si le polygone déborde de la parcelle. Les zones SEMIS
      // déjà tracées (forbiddenZones) ne sont PAS soustraites — le
      // sur-semis est autorisé, juste signalé via onOverlapChange.
      if (parcelleGeom && !isFullyContained(finalGeom, parcelleGeom)) {
        const clip = clipToParcelle(finalGeom, parcelleGeom);
        if (clip) {
          finalGeom = clip;
          didClip = true;
          // On remplace la layer par le résultat clippé pour que
          // l'utilisateur voie la zone effective.
          drawnItems.clearLayers();
          L.geoJSON(finalGeom, {
            style: { color: "#1565C0", weight: 3, fillColor: "#1565C0", fillOpacity: 0.3 },
          }).eachLayer((l) => drawnItems.addLayer(l));
        } else {
          // Tracé entièrement hors parcelle — on retire et on alerte.
          drawnItems.clearLayers();
          setSurface(null);
          setClipped(false);
          onPolygonChange(null, 0);
          return;
        }
      }

      const rawM2 = area({ type: "Feature", geometry: finalGeom, properties: {} });
      // Aire ramenée à la surface déclarée via ratio proportionnel.
      // Si la géom couvre 2× la déclaration, on divise l'aire par 2.
      const m2 = rawM2 * correctionRatio;
      setSurface(m2);
      setClipped(didClip || correctionRatio < 0.999);
      onPolygonChange(finalGeom, m2);

      // Calcule l'aire de chevauchement avec les zones déjà semées (sur-semis).
      if (onOverlapChange) {
        let overlapRawM2 = 0;
        if (forbiddenZones && forbiddenZones.length > 0) {
          try {
            const drawnTurf = turfPolygon(finalGeom.coordinates);
            for (const fz of forbiddenZones) {
              const inter = intersect(featureCollection([drawnTurf, turfPolygon(fz.coordinates)]));
              if (inter?.geometry) overlapRawM2 += area(inter);
            }
          } catch {
            // Best-effort.
          }
        }
        onOverlapChange(overlapRawM2 * correctionRatio);
      }
    };

    map.on("draw:created", (e) => {
      drawnItems.clearLayers();
      drawnItems.addLayer((e as unknown as DrawCreatedEvent).layer);
      updateFromLayers();
    });
    map.on("draw:edited", () => updateFromLayers());
    map.on("draw:deleted", () => updateFromLayers());

    return () => {
      map.off("mousemove", onMouseMove);
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
          {clipped && (
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
              recadrée à la parcelle
            </span>
          )}
        </div>
      ) : (
        <p className="text-xs text-foreground/60">
          Le contour vert pointillé délimite ta parcelle. Trace ton polygone même grossièrement — si
          tu débordes, le résultat sera automatiquement recadré aux limites officielles. Le curseur
          s'aimante aux sommets de la parcelle quand tu t'en approches.
        </p>
      )}
    </div>
  );
}
