import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ZoneAgricole } from "@prisma/client";
import { IsEnum, IsObject, IsOptional } from "class-validator";

export class ImportParcellesDto {
  @ApiProperty({
    description:
      "GeoJSON FeatureCollection exporté depuis Acorda, GELAN, Agriportal ou autre portail SIG cantonal. " +
      "Chaque feature doit avoir une géométrie Polygon ou MultiPolygon en WGS84 (EPSG:4326). " +
      "Properties mappées intelligemment :\n" +
      "  · nom/name/NUMMER → nom de la parcelle\n" +
      "  · egrid/EGRID/EGRIS_EGRID → identifiant cadastral\n" +
      "  · surface_m2/FLAECHE_M2 → surface (sinon calculée géodésiquement)\n" +
      "  · zone → zone agricole OPD\n" +
      "  · culture/kultur/crop (optionnel) → crée une Culture + Intervention SEMIS rétroactive couvrant la parcelle, l'assolement est immédiatement à jour\n" +
      "  · variete/sorte (optionnel) → variété de la culture\n" +
      "  · dateSemis/saatdatum (optionnel, ISO 8601) → date du SEMIS rétroactif (default 1er mars année courante)",
  })
  @IsObject()
  featureCollection!: unknown;

  @ApiPropertyOptional({
    enum: ZoneAgricole,
    description: "Zone agricole par défaut si absente des properties",
    default: "ZA",
  })
  @IsOptional()
  @IsEnum(ZoneAgricole)
  defaultZone?: ZoneAgricole;
}

export interface ImportResult {
  total: number;
  created: number;
  /** Nombre de parcelles pour lesquelles un SEMIS rétroactif a été créé via la property `culture` du GeoJSON. */
  cultures?: number;
  errors: Array<{ index: number; nom?: string; message: string }>;
}
