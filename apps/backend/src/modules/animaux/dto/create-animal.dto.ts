import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AnimalCategorie } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateAnimalDto {
  @ApiProperty({ enum: AnimalCategorie })
  @IsEnum(AnimalCategorie)
  categorie!: AnimalCategorie;

  @ApiPropertyOptional({
    description: "Nom de l'animal (optionnel — utile pour les bovins suivis individuellement).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nom?: string;

  @ApiPropertyOptional({
    description: "N° de boucle BDTA (Identitas) — bovins uniquement, unique sur la base.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroBoucle?: string;

  @ApiPropertyOptional({
    description: "Date de naissance ISO (YYYY-MM-DD).",
  })
  @IsOptional()
  @IsDateString()
  dateNaissance?: string;

  @ApiPropertyOptional({ description: "Identifiant du lot (optionnel)." })
  @IsOptional()
  @IsString()
  lotId?: string;
}
