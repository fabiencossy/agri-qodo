import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AnimalCategorie } from "@prisma/client";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateSortieSrpaDto {
  @ApiProperty({
    description: "Date de la sortie au format ISO (YYYY-MM-DD)",
    example: "2026-04-28",
  })
  @IsDateString()
  date!: string;

  @ApiProperty({
    enum: AnimalCategorie,
    description: "Catégorie d'animaux concernée",
  })
  @IsEnum(AnimalCategorie)
  categorie!: AnimalCategorie;

  @ApiPropertyOptional({
    description: "Nombre d'animaux sortis (laisser vide = tout le lot)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  nombreAnimaux?: number;

  @ApiPropertyOptional({
    description: "Durée de la sortie en minutes (par défaut journée entière)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  dureeMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
