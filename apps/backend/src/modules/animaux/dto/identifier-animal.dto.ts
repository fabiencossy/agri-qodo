import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AnimalCategorie } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/**
 * Identifie un bovin par son n° de boucle BDTA — promeut un animal
 * anonyme de la même catégorie en row identifiée plutôt que d'en créer
 * un nouveau, pour préserver l'effectif total saisi par l'utilisateur.
 * Si aucun anonyme dispo dans la catégorie, un nouveau row est créé.
 */
export class IdentifierAnimalDto {
  @ApiProperty({ enum: AnimalCategorie })
  @IsEnum(AnimalCategorie)
  categorie!: AnimalCategorie;

  @ApiProperty({
    description: "N° de boucle BDTA (Identitas) — bovins uniquement, unique sur la base.",
    example: "CH 12.345.6789.0",
  })
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  numeroBoucle!: string;

  @ApiPropertyOptional({ description: "Nom de l'animal (optionnel)." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nom?: string;

  @ApiPropertyOptional({ description: "Date de naissance ISO (YYYY-MM-DD)." })
  @IsOptional()
  @IsDateString()
  dateNaissance?: string;
}
