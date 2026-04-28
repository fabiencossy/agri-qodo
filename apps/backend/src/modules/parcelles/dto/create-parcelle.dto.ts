import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ZoneAgricole } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min } from "class-validator";

/**
 * Type minimal d'une géométrie GeoJSON acceptée par le backend.
 * Validation détaillée du format faite côté Postgres via ST_GeomFromGeoJSON.
 */
export interface GeoJsonGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}

export class CreateParcelleDto {
  @ApiProperty({ example: "Champ du Loup", maxLength: 120 })
  @IsString()
  @MaxLength(120)
  nom!: string;

  @ApiProperty({
    example: 12500,
    description: "Surface en m² (1 ha = 10000 m²)",
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  surfaceM2!: number;

  @ApiProperty({
    enum: ZoneAgricole,
    description: "Zone agricole selon l'OPD : ZA / ZP / ZM1-4 / ZE",
  })
  @IsEnum(ZoneAgricole)
  zone!: ZoneAgricole;

  @ApiPropertyOptional({ description: "Identifiant cadastral cantonal" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  identifiantCadastral?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    description:
      "Géométrie GeoJSON (Polygon ou MultiPolygon) en WGS84 (EPSG:4326). Convertie en geometry(MultiPolygon, 4326) côté Postgres via ST_GeomFromGeoJSON.",
  })
  @IsOptional()
  @IsObject()
  geomGeoJson?: GeoJsonGeometry;
}
