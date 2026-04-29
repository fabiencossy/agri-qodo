import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ZoneAgricole } from "@prisma/client";
import area from "@turf/area";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import type { CreateParcelleDto, GeoJsonGeometry } from "./dto/create-parcelle.dto";
import type { ImportParcellesDto, ImportResult } from "./dto/import-parcelles.dto";
import type { UpdateParcelleDto } from "./dto/update-parcelle.dto";

const MAX_FEATURES_PER_IMPORT = 1000;
const ZONE_VALUES = new Set<string>(Object.values(ZoneAgricole));

interface ParcelleMapRow {
  id: string;
  nom: string;
  surfaceM2: string;
  zone: string;
  couleurHex: string | null;
  geom: string | null; // GeoJSON sérialisé par ST_AsGeoJSON
}

export interface ParcelleMapItem {
  id: string;
  nom: string;
  surfaceM2: string;
  zone: string;
  couleurHex: string | null;
  geom: GeoJsonGeometry | null;
}

@Injectable()
export class ParcellesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  list() {
    return this.prisma.tenantAware.parcelle.findMany({
      orderBy: { nom: "asc" },
    });
  }

  /**
   * Variante carte : retourne id, nom, surface, zone et géométrie
   * sérialisée en GeoJSON. Filtre tenant manuel via tenantContext (le
   * raw query ne passe pas par l'extension Prisma).
   */
  async listForMap(): Promise<ParcelleMapItem[]> {
    const { tenantId } = this.tenantContext.get();
    // NOTE Prisma + Postgres prepared statements : caster le paramètre
    // avec `$N::uuid` ne fonctionne pas (Postgres garde le type text et
    // génère "operator does not exist: text = uuid"). On caste donc la
    // colonne `tenant_id` en text et on compare avec le param text.
    // Sécurisé : les paramètres sont bindés ($queryRawUnsafe avec args).
    const rows = await this.prisma.$queryRawUnsafe<ParcelleMapRow[]>(
      `SELECT
         id,
         nom,
         surface_m2::text AS "surfaceM2",
         zone::text AS zone,
         couleur_hex AS "couleurHex",
         ST_AsGeoJSON(geom) AS geom
       FROM parcelles
       WHERE tenant_id::text = $1
       ORDER BY nom ASC`,
      tenantId,
    );
    return rows.map((r) => ({
      id: r.id,
      nom: r.nom,
      surfaceM2: r.surfaceM2,
      zone: r.zone,
      couleurHex: r.couleurHex,
      geom: r.geom ? (JSON.parse(r.geom) as GeoJsonGeometry) : null,
    }));
  }

  async getById(id: string) {
    const parcelle = await this.prisma.tenantAware.parcelle.findFirst({
      where: { id },
    });
    if (!parcelle) {
      throw new NotFoundException("Parcelle introuvable");
    }
    // Récupère la geom en GeoJSON via PostGIS (Prisma ne supporte pas le
    // type geometry). Filtre tenant déjà appliqué par le findFirst au-dessus,
    // mais on le ré-applique côté raw pour la défense en profondeur.
    const { tenantId } = this.tenantContext.get();
    const rows = await this.prisma.$queryRawUnsafe<{ geom: string | null }[]>(
      `SELECT ST_AsGeoJSON(geom) AS geom
       FROM parcelles
       WHERE id::text = $1 AND tenant_id::text = $2`,
      id,
      tenantId,
    );
    const geom = rows[0]?.geom ? (JSON.parse(rows[0].geom) as GeoJsonGeometry) : null;
    return { ...parcelle, geom };
  }

  /**
   * Création en 2 étapes : d'abord Prisma create (avec tenantId injecté
   * par l'extension), puis $executeRaw UPDATE pour poser la géométrie
   * PostGIS si fournie.
   */
  async create(data: CreateParcelleDto) {
    const { geomGeoJson, ...rest } = data;
    const parcelle = await this.prisma.tenantAware.parcelle.create({
      data: rest as unknown as Prisma.ParcelleUncheckedCreateInput,
    });

    if (geomGeoJson) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE parcelles
         SET geom = ST_Multi(ST_GeomFromGeoJSON($1))::geometry(MultiPolygon, 4326)
         WHERE id::text = $2`,
        JSON.stringify(geomGeoJson),
        parcelle.id,
      );
    }

    return parcelle;
  }

  async update(id: string, data: UpdateParcelleDto) {
    const { geomGeoJson, ...rest } = data;
    const result = await this.prisma.tenantAware.parcelle.updateMany({
      where: { id },
      data: rest,
    });
    if (result.count === 0) {
      throw new NotFoundException("Parcelle introuvable");
    }
    if (geomGeoJson !== undefined) {
      const { tenantId } = this.tenantContext.get();
      await this.prisma.$executeRawUnsafe(
        `UPDATE parcelles
         SET geom = ST_Multi(ST_GeomFromGeoJSON($1))::geometry(MultiPolygon, 4326)
         WHERE id::text = $2 AND tenant_id::text = $3`,
        JSON.stringify(geomGeoJson),
        id,
        tenantId,
      );
    }
    return this.getById(id);
  }

  async remove(id: string) {
    const result = await this.prisma.tenantAware.parcelle.deleteMany({
      where: { id },
    });
    if (result.count === 0) {
      throw new NotFoundException("Parcelle introuvable");
    }
  }

  /**
   * Import en masse depuis un GeoJSON FeatureCollection (typiquement
   * un export Acorda/GELAN/Agriportal).
   *
   * Chaque feature crée une parcelle avec un mapping intelligent des
   * properties (voir extractFromFeature). Les erreurs sur features
   * individuelles n'arrêtent pas l'import — on continue et on retourne
   * un résumé.
   */
  async importGeoJson(dto: ImportParcellesDto): Promise<ImportResult> {
    const fc = dto.featureCollection as { type?: string; features?: unknown[] };
    if (!fc || fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) {
      throw new BadRequestException("Le fichier n'est pas un GeoJSON FeatureCollection valide");
    }
    if (fc.features.length === 0) {
      throw new BadRequestException("Aucune parcelle à importer");
    }
    if (fc.features.length > MAX_FEATURES_PER_IMPORT) {
      throw new BadRequestException(
        `Trop de parcelles : maximum ${MAX_FEATURES_PER_IMPORT} par import`,
      );
    }

    const defaultZone = dto.defaultZone ?? ZoneAgricole.ZA;
    const result: ImportResult = {
      total: fc.features.length,
      created: 0,
      errors: [],
    };

    for (let i = 0; i < fc.features.length; i++) {
      const feature = fc.features[i] as ParsedFeature | undefined;
      try {
        const data = extractFromFeature(feature, defaultZone, i);
        await this.create(data);
        result.created++;
      } catch (err) {
        const props = feature?.properties as Record<string, unknown> | undefined;
        const nom = props?.["nom"]?.toString() ?? props?.["name"]?.toString();
        result.errors.push({
          index: i,
          ...(nom ? { nom } : {}),
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return result;
  }
}

interface ParsedFeature {
  type?: string;
  properties?: Record<string, unknown>;
  geometry?: { type?: string; coordinates?: unknown };
}

/**
 * Extrait un CreateParcelleDto depuis une feature GeoJSON en testant
 * plusieurs noms de properties usuels (Acorda, GELAN, OFAG, etc.).
 */
function extractFromFeature(
  feature: ParsedFeature | undefined,
  defaultZone: ZoneAgricole,
  index: number,
): CreateParcelleDto {
  if (!feature || feature.type !== "Feature") {
    throw new Error(`Feature #${index + 1} : format invalide`);
  }
  const geom = feature.geometry as GeoJsonGeometry | undefined;
  if (!geom || (geom.type !== "Polygon" && geom.type !== "MultiPolygon")) {
    throw new Error(`Feature #${index + 1} : géométrie absente ou non Polygon/MultiPolygon`);
  }
  const props = (feature.properties ?? {}) as Record<string, unknown>;

  const nom =
    pickString(props, ["nom", "name", "PARCEL_NAME", "NUMMER", "NUM_PARC"]) ??
    `Parcelle ${index + 1}`;
  const identifiantCadastral = pickString(props, [
    "identifiantCadastral",
    "egrid",
    "EGRID",
    "EGRIS_EGRID",
    "numero_cadastral",
    "NUMMER",
  ]);
  const zoneRaw = pickString(props, ["zone", "ZONE", "zone_agricole"]);
  const zone =
    zoneRaw && ZONE_VALUES.has(zoneRaw.toUpperCase())
      ? (zoneRaw.toUpperCase() as ZoneAgricole)
      : defaultZone;

  let surfaceM2 = pickNumber(props, [
    "surfaceM2",
    "surface_m2",
    "FLAECHE_M2",
    "SURFACE_M2",
    "AREA_M2",
  ]);
  if (surfaceM2 === undefined) {
    // Calcul géodésique si surface absente
    surfaceM2 = area({ type: "Feature", geometry: geom, properties: {} });
  }
  if (!Number.isFinite(surfaceM2) || surfaceM2 <= 0) {
    throw new Error(`Feature #${index + 1} : surface invalide`);
  }

  const data: CreateParcelleDto = {
    nom: nom.slice(0, 120),
    surfaceM2: Math.round(surfaceM2 * 100) / 100,
    zone,
    geomGeoJson: geom,
  };
  if (identifiantCadastral) {
    data.identifiantCadastral = identifiantCadastral.slice(0, 50);
  }
  return data;
}

function pickString(props: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = props[key];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

function pickNumber(props: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const v = props[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}
