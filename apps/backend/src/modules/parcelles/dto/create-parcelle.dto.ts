import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ZoneAgricole } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from "class-validator";

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

  @ApiPropertyOptional({
    description: "Couleur de surbrillance sur les cartes (#RRGGBB)",
    example: "#4CAF50",
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: "couleurHex doit être au format hex #RRGGBB",
  })
  couleurHex?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    description:
      "Géométrie GeoJSON (Polygon ou MultiPolygon) en WGS84 (EPSG:4326). Convertie en geometry(MultiPolygon, 4326) côté Postgres via ST_GeomFromGeoJSON.",
    type: "object",
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  geomGeoJson?: GeoJsonGeometry;
}
