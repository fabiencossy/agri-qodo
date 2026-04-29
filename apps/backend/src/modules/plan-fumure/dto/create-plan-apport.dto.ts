import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TechniqueEpandage } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreatePlanApportDto {
  @ApiProperty({ description: "ID de la parcelle concernée" })
  @IsUUID()
  parcelleId!: string;

  @ApiProperty({
    description: "Année de campagne (année de récolte)",
    example: 2026,
  })
  @IsInt()
  @Min(2020)
  @Max(2100)
  campagne!: number;

  @ApiPropertyOptional({
    description: "Date prévue de l'épandage (ISO YYYY-MM-DD)",
    example: "2026-03-15",
  })
  @IsOptional()
  @IsDateString()
  datePrevue?: string;

  @ApiPropertyOptional({
    description:
      "ID Produit du catalogue. Si présent, kgN/kgP sont calculés automatiquement depuis tauxN/tauxP.",
  })
  @IsOptional()
  @IsUUID()
  produitId?: string;

  @ApiPropertyOptional({
    description: "Libellé libre si pas de produit catalogue",
    example: "Lisier ferme voisine",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  produitLibre?: string;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantitePrevue?: number;

  @ApiPropertyOptional({ example: "L" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unite?: string;

  @ApiPropertyOptional({
    description: "kg N estimés (si produitId, calculé auto ; sinon saisie manuelle)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  kgNPrevu?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  kgPPrevu?: number;

  @ApiPropertyOptional({ enum: TechniqueEpandage })
  @IsOptional()
  @IsEnum(TechniqueEpandage)
  technique?: TechniqueEpandage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
