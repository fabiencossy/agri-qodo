import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InterventionType, TechniqueEpandage } from "@prisma/client";
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
    description:
      "ID Produit du catalogue. Recommandé pour SEMIS (déclenche création de Culture), FUMURE (alimente le bilan N/P) et PHYTO (n° OSAV).",
  })
  @IsOptional()
  @IsUUID()
  produitId?: string;

  @ApiPropertyOptional({
    description: "Libellé libre du produit (utilisé si produitId absent, ou en cohabitation)",
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
    description:
      "Surface réellement concernée en m². Omettre ou null = toute la parcelle. Utile pour TRAVAIL_DU_SOL, SEMIS, RECOLTE quand seule une portion est travaillée.",
    example: 5000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  surfaceTravailleeM2?: number;

  @ApiPropertyOptional({
    description: "Unité libre : kg, L, t, ha, doses…",
    example: "L",
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unite?: string;

  @ApiPropertyOptional({
    enum: TechniqueEpandage,
    description: "Technique d'épandage pour FUMURE_ORGANIQUE — détermine la perte NH3 (5-30%).",
  })
  @IsOptional()
  @IsEnum(TechniqueEpandage)
  techniqueEpandage?: TechniqueEpandage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
