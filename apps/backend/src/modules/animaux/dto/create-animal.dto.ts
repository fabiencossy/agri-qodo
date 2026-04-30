import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AnimalCategorie } from "@prisma/client";
import { IsDateString, IsEnum, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

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

  @ApiPropertyOptional({ description: "Sexe : M ou F." })
  @IsOptional()
  @IsIn(["M", "F"])
  sexe?: "M" | "F";

  @ApiPropertyOptional({
    description: "Date de naissance ISO (YYYY-MM-DD).",
  })
  @IsOptional()
  @IsDateString()
  dateNaissance?: string;

  @ApiPropertyOptional({
    description: "Date de mort ISO (YYYY-MM-DD). Null = animal vivant.",
  })
  @IsOptional()
  @IsDateString()
  dateMort?: string;

  @ApiPropertyOptional({
    description: "Usage : laitiere | allaitante | engraissement | reproduction | jeune | autre.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  usage?: string;

  @ApiPropertyOptional({
    description: "Secteur / label : bio | ips | per | conventionnel | suisse-garantie | autre.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  secteurLabel?: string;

  @ApiPropertyOptional({
    description: "Statut BVD : frei | suspect | positif | vaccine | exempt.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  statutBvd?: string;

  @ApiPropertyOptional({ description: "Identifiant du lot (optionnel)." })
  @IsOptional()
  @IsString()
  lotId?: string;
}
