import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ZoneAgricole } from "@prisma/client";
import { IsEnum, IsObject, IsOptional } from "class-validator";

export class ImportParcellesDto {
  @ApiProperty({
    description:
      "GeoJSON FeatureCollection exporté depuis Acorda, GELAN, Agriportal ou autre portail SIG cantonal. Chaque feature doit avoir une géométrie Polygon ou MultiPolygon en WGS84 (EPSG:4326). Les properties sont mappées intelligemment : nom/name/NUMMER pour le nom, egrid/EGRID/EGRIS_EGRID pour l'identifiant cadastral, surface_m2/FLAECHE_M2 pour la surface, zone pour la zone agricole.",
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
  errors: Array<{ index: number; nom?: string; message: string }>;
}
