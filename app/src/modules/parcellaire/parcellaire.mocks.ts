import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import type { Parcel } from '../../components/MapView';
import { cultureColor } from '../assolement/cultures';
import darvalGeoJSON from './darval.geojson.json';

/**
 * Parcelles réelles du Domaine Darval — chargées depuis le fichier
 * `darval.geojson.json` (export VD GELAN 2026, 27 features).
 *
 * Mapping affectation Agridéa → culture du catalogue :
 *   513 → Blé d'automne
 *   601 → Prairie temporaire
 *   613 → Prairie naturelle (Prairies perm. fauche)
 *   616 → Pâturage (attenants)
 *   617 → Prairie extensive (Pâturages extensifs - SPB)
 *   521 → Maïs ensilage
 *   901 → Forêt          (status archived)
 *   902 → Surface improductive (status archived)
 */

export interface ParcelDetail extends Parcel {
  varietyName?: string;
  sowingDate?: string;
  notes?: string;
  year: number;
  /**
   * Exploitation à laquelle la parcelle est rattachée. Permet de filtrer
   * les parcelles selon la current farm (Switcher). Si absent, la parcelle
   * est legacy (avant multi-tenancy) et reste visible sur toutes les farms.
   */
  farmId?: string;
  /**
   * Point d'attention libre (1-3 phrases) — signal visible sur la carte
   * (pastille) et affiché en bandeau dans le panneau de sélection + le
   * formulaire de création de travail. Édité par le propriétaire pour
   * prévenir équipe et entrepreneurs : présence de jeunes arbres, pente
   * dangereuse, drainages, captage d'eau, parcelle voisine bio, etc.
   */
  attentionNote?: string;
}

const AFFECTATION_TO_CULTURE: Record<string, string> = {
  '513': "Blé d'automne",
  '601': 'Prairie temporaire',
  '613': 'Prairie naturelle',
  '616': 'Pâturage',
  '617': 'Prairie extensive',
  '521': 'Maïs ensilage',
  '901': 'Forêt',
  '902': 'Surface improductive',
};

function affectationToCulture(affectation: string | undefined): string {
  if (!affectation) return 'Sol nu / Labour';
  const code = affectation.slice(0, 3);
  return AFFECTATION_TO_CULTURE[code] ?? 'Sol nu / Labour';
}

/** Surface (ha) approximée par shoelace + correction latitude. */
function estimateSurfaceHa(geom: Polygon | MultiPolygon): number {
  const polygons = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  let total = 0;
  for (const polygon of polygons) {
    const outer = polygon[0];
    if (!outer || outer.length < 4) continue;
    let area = 0;
    for (let i = 0; i < outer.length - 1; i++) {
      const [x1, y1] = outer[i]!;
      const [x2, y2] = outer[i + 1]!;
      area += x1! * y2! - x2! * y1!;
    }
    area = Math.abs(area) / 2;
    const meanLat = outer.reduce((s, p) => s + p[1]!, 0) / outer.length;
    const mPerDegLat = 111_320;
    const mPerDegLng = 111_320 * Math.cos((meanLat * Math.PI) / 180);
    total += (area * mPerDegLat * mPerDegLng) / 10_000;
  }
  return total;
}

/** Title-case les noms tout-majuscules. Conserve les autres tels quels. */
function prettifyName(name: string): string {
  const isAllCaps = name === name.toUpperCase();
  if (!isAllCaps) return name;
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

interface ParcelProperties {
  id?: string;
  parcel_nam?: string;
  affectatio?: string;
}

const VARIETIES: Record<string, string> = {
  "Blé d'automne": 'Arnold',
  'Maïs ensilage': 'Limagrain LG31.330',
};

const fc = darvalGeoJSON as unknown as FeatureCollection;

const DARVAL_PARCELS: ParcelDetail[] = fc.features
  .filter((f: Feature) =>
    Boolean(f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')),
  )
  .map((f, idx): ParcelDetail => {
    const props = (f.properties ?? {}) as ParcelProperties;
    const id = props.id ?? `DARVAL-${idx + 1}`;
    const name = prettifyName(props.parcel_nam ?? `Parcelle ${idx + 1}`);
    const culture = affectationToCulture(props.affectatio);
    const surfaceHa = Number(estimateSurfaceHa(f.geometry as Polygon | MultiPolygon).toFixed(2));
    const status: ParcelDetail['status'] =
      culture === 'Forêt' || culture === 'Surface improductive' ? 'archived' : 'active';
    return {
      id,
      name,
      surfaceHa,
      culture,
      varietyName: VARIETIES[culture],
      year: 2026,
      status,
      color: cultureColor(culture),
      geometry: f.geometry as Polygon | MultiPolygon,
      farmId: 'F-001',
    };
  });

/**
 * PRNG déterministe (Linear Congruential Generator) — la même seed donne
 * toujours la même séquence, ce qui garantit des géométries stables au
 * rechargement de l'app. Pas d'usage de Math.random qui violerait
 * react-hooks/purity dans les composants qui lisent ces mocks.
 */
function makeRng(seed: number): () => number {
  let s = (seed * 16807) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/**
 * Génère un polygone irrégulier "naturel" à partir d'un rectangle de base.
 * - 3 sommets par côté (12 sommets total) avec petit décalage perpendiculaire
 *   bruité (max ~15% de la dimension) → contour irrégulier réaliste
 * - Rotation appliquée sur l'ensemble → orientation parcellaire
 * - Conversion mètres → degrés en tenant compte de la latitude
 *
 * Bien plus proche d'une parcelle réelle qu'un rectangle, sans trace de
 * randomness non-déterministe (pure function pour le même seed).
 */
function naturalParcel(
  centerLng: number,
  centerLat: number,
  widthM: number,
  heightM: number,
  rotationDeg: number,
  seed: number,
): Polygon {
  const VERTICES_PER_SIDE = 3;
  const NOISE_AMP = 0.14;
  const rng = makeRng(seed);
  const halfW = widthM / 2;
  const halfH = heightM / 2;
  const vertices: Array<[number, number]> = [];
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < VERTICES_PER_SIDE; i++) {
      const t = i / VERTICES_PER_SIDE;
      let x = 0;
      let y = 0;
      switch (side) {
        case 0: // bottom edge L→R
          x = -halfW + t * widthM;
          y = -halfH + (rng() - 0.5) * NOISE_AMP * heightM;
          break;
        case 1: // right edge B→T
          x = halfW + (rng() - 0.5) * NOISE_AMP * widthM;
          y = -halfH + t * heightM;
          break;
        case 2: // top edge R→L
          x = halfW - t * widthM;
          y = halfH + (rng() - 0.5) * NOISE_AMP * heightM;
          break;
        case 3: // left edge T→B
          x = -halfW + (rng() - 0.5) * NOISE_AMP * widthM;
          y = halfH - t * heightM;
          break;
      }
      vertices.push([x, y]);
    }
  }
  const cos = Math.cos((rotationDeg * Math.PI) / 180);
  const sin = Math.sin((rotationDeg * Math.PI) / 180);
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((centerLat * Math.PI) / 180);
  const ring: Array<[number, number]> = vertices.map(([x, y]) => {
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    return [centerLng + rx / mPerDegLng, centerLat + ry / mPerDegLat];
  });
  ring.push(ring[0]!);
  return {
    type: 'Polygon',
    coordinates: [ring],
  };
}

interface MockParcelSpec {
  name: string;
  offsetLng: number;
  offsetLat: number;
  widthM: number;
  heightM: number;
  rotation?: number;
  culture: string;
  varietyName?: string;
  attentionNote?: string;
}

interface MockFarmSpec {
  farmId: string;
  baseId: string;
  centerLng: number;
  centerLat: number;
  parcels: ReadonlyArray<MockParcelSpec>;
}

const EXTRA_FARM_PARCELS: ReadonlyArray<MockFarmSpec> = [
  // F-002 Ferme des Crausaz — Cossonay (zone vallonnée, parcelles moyennes)
  {
    farmId: 'F-002',
    baseId: 'CRSZ',
    centerLng: 6.5081,
    centerLat: 46.6131,
    parcels: [
      {
        name: 'Champ de la Combe',
        offsetLng: 0.0022,
        offsetLat: 0.0012,
        widthM: 230,
        heightM: 130,
        rotation: -8,
        culture: "Blé d'automne",
      },
      {
        name: 'Pré du Moulin',
        offsetLng: -0.0025,
        offsetLat: 0.0018,
        widthM: 170,
        heightM: 115,
        rotation: 12,
        culture: 'Prairie temporaire',
      },
      {
        name: 'Plat sur la Bressonne',
        offsetLng: 0.0005,
        offsetLat: -0.002,
        widthM: 280,
        heightM: 150,
        rotation: 25,
        culture: 'Maïs ensilage',
        attentionNote:
          'Pente forte côté est — éviter le passage du semoir lourd après pluie. Drainage récent (2024) — labour profond interdit.',
      },
      {
        name: 'Grand Champ',
        offsetLng: -0.0018,
        offsetLat: -0.0006,
        widthM: 210,
        heightM: 140,
        rotation: -3,
        culture: 'Orge de printemps',
      },
      {
        name: 'Aux Bouleaux',
        offsetLng: 0.0014,
        offsetLat: 0.0028,
        widthM: 150,
        heightM: 95,
        rotation: 40,
        culture: 'Prairie naturelle',
      },
      {
        name: 'Sous la Vy',
        offsetLng: 0.0028,
        offsetLat: -0.001,
        widthM: 195,
        heightM: 125,
        rotation: -22,
        culture: "Colza d'automne",
      },
    ],
  },
  // F-003 Domaine du Léman — Morges (coteaux + lac, vignobles)
  {
    farmId: 'F-003',
    baseId: 'LMAN',
    centerLng: 6.4986,
    centerLat: 46.5106,
    parcels: [
      {
        name: 'Bord du Lac',
        offsetLng: 0.001,
        offsetLat: -0.0012,
        widthM: 270,
        heightM: 170,
        rotation: -15,
        culture: "Blé d'automne",
      },
      {
        name: 'Vigne du Coteau',
        offsetLng: -0.002,
        offsetLat: 0.0014,
        widthM: 150,
        heightM: 100,
        rotation: 18,
        culture: 'Vigne',
        varietyName: 'Chasselas',
        attentionNote:
          "Vigne en taille Guyot — passer uniquement avec petit tracteur enjambeur. Captage d'eau communal à 30 m.",
      },
      {
        name: 'Pré des Saules',
        offsetLng: 0.0022,
        offsetLat: 0.0008,
        widthM: 220,
        heightM: 145,
        rotation: 7,
        culture: 'Prairie temporaire',
      },
      {
        name: 'Champ Long',
        offsetLng: -0.0008,
        offsetLat: 0.0028,
        widthM: 320,
        heightM: 105,
        rotation: -28,
        culture: 'Maïs ensilage',
      },
      {
        name: 'En Bochet',
        offsetLng: 0.0025,
        offsetLat: 0.002,
        widthM: 180,
        heightM: 130,
        rotation: 32,
        culture: 'Tournesol',
      },
    ],
  },
  // F-101 Famille Pittet — Bercher (plateau, polyculture)
  {
    farmId: 'F-101',
    baseId: 'PITT',
    centerLng: 6.7065,
    centerLat: 46.716,
    parcels: [
      {
        name: 'Au Village',
        offsetLng: 0.0015,
        offsetLat: 0.001,
        widthM: 200,
        heightM: 130,
        rotation: 5,
        culture: "Blé d'automne",
      },
      {
        name: 'Sous la Forêt',
        offsetLng: -0.002,
        offsetLat: -0.0012,
        widthM: 250,
        heightM: 160,
        rotation: -18,
        culture: "Colza d'automne",
      },
      {
        name: 'Pré de la Vache',
        offsetLng: 0.0008,
        offsetLat: -0.0022,
        widthM: 180,
        heightM: 120,
        rotation: 15,
        culture: 'Prairie naturelle',
      },
      {
        name: 'Sur le Crêt',
        offsetLng: 0.0024,
        offsetLat: 0.002,
        widthM: 170,
        heightM: 110,
        rotation: -10,
        culture: 'Pâturage',
      },
    ],
  },
  // F-102 Commune d'Échallens (gérée par l'agriculteur communal)
  {
    farmId: 'F-102',
    baseId: 'COMM',
    centerLng: 6.6346,
    centerLat: 46.6437,
    parcels: [
      {
        name: 'Verger communal',
        offsetLng: 0.001,
        offsetLat: 0.0008,
        widthM: 170,
        heightM: 110,
        rotation: 8,
        culture: 'Verger',
      },
      {
        name: 'Pâturage de la Foire',
        offsetLng: -0.0016,
        offsetLat: 0.0012,
        widthM: 220,
        heightM: 140,
        rotation: -12,
        culture: 'Pâturage',
      },
      {
        name: 'Pré du Stand',
        offsetLng: 0.0005,
        offsetLat: -0.0018,
        widthM: 200,
        heightM: 130,
        rotation: 20,
        culture: 'Prairie naturelle',
      },
    ],
  },
  // F-103 Hofstetter SA — Yverdon-les-Bains (Plaine de l'Orbe, grandes parcelles)
  {
    farmId: 'F-103',
    baseId: 'HOFS',
    centerLng: 6.6411,
    centerLat: 46.7785,
    parcels: [
      {
        name: 'Plaine de l’Orbe Nord',
        offsetLng: 0.003,
        offsetLat: 0.0008,
        widthM: 400,
        heightM: 210,
        rotation: -5,
        culture: 'Maïs ensilage',
        attentionNote: 'Présence de drains tous les 12 m (cartes au bureau). Ne pas sous-soler.',
      },
      {
        name: 'Grands Vergers',
        offsetLng: -0.0018,
        offsetLat: 0.0024,
        widthM: 250,
        heightM: 175,
        rotation: 12,
        culture: "Blé d'automne",
      },
      {
        name: 'Champ du Canal',
        offsetLng: 0.0008,
        offsetLat: -0.003,
        widthM: 320,
        heightM: 135,
        rotation: -8,
        culture: 'Betterave sucrière',
      },
      {
        name: 'Près du Hameau',
        offsetLng: -0.0032,
        offsetLat: -0.001,
        widthM: 210,
        heightM: 150,
        rotation: 18,
        culture: 'Prairie naturelle',
      },
      {
        name: 'La Grande Plaine',
        offsetLng: 0.004,
        offsetLat: -0.0015,
        widthM: 460,
        heightM: 195,
        rotation: -3,
        culture: 'Tournesol',
      },
      {
        name: 'Bord du Mujon',
        offsetLng: -0.0006,
        offsetLat: 0.0036,
        widthM: 290,
        heightM: 130,
        rotation: 22,
        culture: 'Pomme de terre',
      },
    ],
  },
  // F-104 Domaine de Goumoëns — Goumoëns-la-Ville (terrain ondulé)
  {
    farmId: 'F-104',
    baseId: 'GMNS',
    centerLng: 6.6052,
    centerLat: 46.6657,
    parcels: [
      {
        name: 'Champ d’en Haut',
        offsetLng: 0.0014,
        offsetLat: 0.0012,
        widthM: 240,
        heightM: 160,
        rotation: 10,
        culture: "Blé d'automne",
      },
      {
        name: 'Pré du Bas',
        offsetLng: -0.0018,
        offsetLat: -0.0006,
        widthM: 200,
        heightM: 140,
        rotation: -22,
        culture: 'Prairie temporaire',
      },
      {
        name: 'En Vurnier',
        offsetLng: 0.0006,
        offsetLat: -0.0024,
        widthM: 270,
        heightM: 175,
        rotation: 18,
        culture: 'Maïs ensilage',
      },
      {
        name: 'La Praille',
        offsetLng: 0.0024,
        offsetLat: 0.0018,
        widthM: 180,
        heightM: 120,
        rotation: -8,
        culture: 'Trèfle',
      },
    ],
  },
  // F-105 Ferme de la Combe — Oulens-sous-Échallens (zone forestière)
  {
    farmId: 'F-105',
    baseId: 'COMB',
    centerLng: 6.6244,
    centerLat: 46.6543,
    parcels: [
      {
        name: 'Au Bois',
        offsetLng: 0.001,
        offsetLat: 0.001,
        widthM: 160,
        heightM: 105,
        rotation: 15,
        culture: 'Prairie naturelle',
      },
      {
        name: 'Clairière',
        offsetLng: -0.0015,
        offsetLat: -0.0008,
        widthM: 140,
        heightM: 95,
        rotation: -25,
        culture: 'Pâturage',
      },
      {
        name: 'Champ de la Source',
        offsetLng: 0.0015,
        offsetLat: -0.0015,
        widthM: 190,
        heightM: 120,
        rotation: 5,
        culture: 'Avoine',
      },
    ],
  },
  // F-106 GAEC du Plateau — Penthéréaz (grande exploitation)
  {
    farmId: 'F-106',
    baseId: 'GAEC',
    centerLng: 6.6644,
    centerLat: 46.6754,
    parcels: [
      {
        name: 'Pièce du Nord',
        offsetLng: 0.0028,
        offsetLat: 0.002,
        widthM: 340,
        heightM: 180,
        rotation: 8,
        culture: "Blé d'automne",
      },
      {
        name: 'Plaine Centrale',
        offsetLng: 0.0005,
        offsetLat: 0.0006,
        widthM: 380,
        heightM: 200,
        rotation: -5,
        culture: 'Maïs ensilage',
      },
      {
        name: 'En Champatey',
        offsetLng: -0.0025,
        offsetLat: -0.0015,
        widthM: 290,
        heightM: 165,
        rotation: 14,
        culture: "Colza d'automne",
      },
      {
        name: 'Sous le Chemin',
        offsetLng: 0.002,
        offsetLat: -0.0024,
        widthM: 230,
        heightM: 140,
        rotation: -10,
        culture: 'Betterave sucrière',
      },
      {
        name: 'Près des Hangars',
        offsetLng: -0.001,
        offsetLat: 0.0028,
        widthM: 200,
        heightM: 130,
        rotation: 22,
        culture: 'Prairie artificielle',
      },
    ],
  },
  // F-107 Domaine Beausite — Bottens (polyculture)
  {
    farmId: 'F-107',
    baseId: 'BSIT',
    centerLng: 6.7177,
    centerLat: 46.6072,
    parcels: [
      {
        name: 'Beausite Haut',
        offsetLng: 0.0015,
        offsetLat: 0.0012,
        widthM: 220,
        heightM: 145,
        rotation: 12,
        culture: "Blé d'automne",
      },
      {
        name: 'Beausite Bas',
        offsetLng: -0.0012,
        offsetLat: -0.0008,
        widthM: 200,
        heightM: 130,
        rotation: -18,
        culture: 'Maïs ensilage',
      },
      {
        name: 'Verger Beausite',
        offsetLng: 0.002,
        offsetLat: -0.0018,
        widthM: 150,
        heightM: 100,
        rotation: 8,
        culture: 'Verger',
      },
      {
        name: 'Pré Beausite',
        offsetLng: -0.0018,
        offsetLat: 0.002,
        widthM: 240,
        heightM: 155,
        rotation: -8,
        culture: 'Prairie temporaire',
      },
    ],
  },
  // F-108 Vignoble Cherpillod — Chexbres (Lavaux UNESCO, terrasses vignes)
  {
    farmId: 'F-108',
    baseId: 'CRPL',
    centerLng: 6.7864,
    centerLat: 46.4839,
    parcels: [
      {
        name: 'Terrasse du Haut',
        offsetLng: 0.0006,
        offsetLat: 0.0008,
        widthM: 140,
        heightM: 60,
        rotation: -28,
        culture: 'Vigne',
        varietyName: 'Chasselas',
      },
      {
        name: 'Terrasse du Milieu',
        offsetLng: -0.0002,
        offsetLat: 0.0002,
        widthM: 150,
        heightM: 55,
        rotation: -28,
        culture: 'Vigne',
        varietyName: 'Pinot Noir',
      },
      {
        name: 'Terrasse du Bas',
        offsetLng: -0.0008,
        offsetLat: -0.0006,
        widthM: 130,
        heightM: 50,
        rotation: -28,
        culture: 'Vigne',
        varietyName: 'Gamay',
      },
      {
        name: 'Clos Cherpillod',
        offsetLng: 0.001,
        offsetLat: -0.001,
        widthM: 90,
        heightM: 75,
        rotation: 12,
        culture: 'Vigne',
        varietyName: 'Pinot Gris',
      },
    ],
  },
];

const OTHER_FARM_PARCELS: ParcelDetail[] = EXTRA_FARM_PARCELS.flatMap((spec, fi) =>
  spec.parcels.map((p, idx): ParcelDetail => {
    // Seed déterministe par parcelle pour avoir des contours stables
    const seed = (fi + 1) * 1009 + (idx + 1) * 37;
    const geom = naturalParcel(
      spec.centerLng + p.offsetLng,
      spec.centerLat + p.offsetLat,
      p.widthM,
      p.heightM,
      p.rotation ?? 0,
      seed,
    );
    const surfaceHa = Number(estimateSurfaceHa(geom).toFixed(2));
    return {
      id: `${spec.baseId}-${String(idx + 1).padStart(2, '0')}`,
      name: p.name,
      surfaceHa,
      culture: p.culture,
      varietyName: p.varietyName,
      attentionNote: p.attentionNote,
      year: 2026,
      status: 'active',
      color: cultureColor(p.culture),
      geometry: geom,
      farmId: spec.farmId,
    };
  }),
);

export const PARCELLES: ParcelDetail[] = [...DARVAL_PARCELS, ...OTHER_FARM_PARCELS];
