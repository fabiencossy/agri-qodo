import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InterventionType } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

export class CreateInterventionDto {
  @ApiProperty({
    description:
      "UUID généré côté client pour garantir l'idempotence à la sync offline. Si absent, le serveur en génère un.",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  clientUuid?: string;

  @ApiProperty({ description: "ID de la parcelle concernée" })
  @IsUUID()
  parcelleId!: string;

  @ApiProperty({
    enum: InterventionType,
    description: "Type d'opération (semis, fumure, phyto, récolte, etc.)",
  })
  @IsEnum(InterventionType)
  type!: InterventionType;

  @ApiProperty({
    description: "Date de l'opération au format ISO (YYYY-MM-DD ou ISO 8601)",
    example: "2026-04-28",
  })
  @IsDateString()
  dateOperation!: string;

  @ApiPropertyOptional({
    description: "Libellé du produit ou code OPPh (pour phyto)",
    example: "Roundup MAX 360",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  produit?: string;

  @ApiPropertyOptional({ example: 25.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantite?: number;

  @ApiPropertyOptional({
    description: "Unité libre : kg, L, t, ha, doses…",
    example: "L",
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
