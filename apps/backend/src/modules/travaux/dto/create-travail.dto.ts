import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class CreateLigneProduitDto {
  @ApiPropertyOptional({ description: "ID Produit catalogue (optionnel — sinon libellé libre)." })
  @IsOptional()
  @IsUUID()
  produitId?: string;

  @ApiProperty({ example: "Semence blé Arina" })
  @IsString()
  @MaxLength(200)
  libelle!: string;

  @ApiProperty({ example: 200 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantite!: number;

  @ApiPropertyOptional({ example: "kg" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unite?: string;

  @ApiPropertyOptional({ description: "Prix unitaire CHF HT — null = ligne non facturable." })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  prixUnitaireCHF?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateLigneHeureDto {
  @ApiProperty({ description: "ID User (employé) qui a effectué les heures." })
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({
    description:
      "Heure de début ISO (datetime). Si fournie avec heureFin, dureeMinutes est recalculée par le backend.",
  })
  @IsOptional()
  @IsDateString()
  heureDebut?: string;

  @ApiPropertyOptional({ description: "Heure de fin ISO (datetime)." })
  @IsOptional()
  @IsDateString()
  heureFin?: string;

  @ApiProperty({ description: "Durée en minutes (180 = 3h).", example: 180 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dureeMinutes!: number;

  @ApiPropertyOptional({
    description: "Taux horaire CHF HT — null = heures internes non facturables.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tauxHoraireCHF?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateTravailDto {
  @ApiProperty({ example: "Récolte champ Loup" })
  @IsString()
  @MaxLength(200)
  titre!: string;

  @ApiProperty({ description: "Date principale du travail (ISO).", example: "2026-04-30" })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ description: "Date/heure début — pour le timesheet précis." })
  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @ApiPropertyOptional({
    description:
      "ID Exploitation partenaire (= client). Null = travail interne sans facturation client.",
  })
  @IsOptional()
  @IsUUID()
  partenaireId?: string;

  @ApiPropertyOptional({ description: "ID Parcelle concernée (optionnel)." })
  @IsOptional()
  @IsUUID()
  parcelleId?: string;

  @ApiPropertyOptional({
    description:
      "ID Projet de regroupement (étiquette libre cf C2). Optionnel — typiquement utilisé pour les travaux pour tiers.",
  })
  @IsOptional()
  @IsUUID()
  projetId?: string;

  @ApiPropertyOptional({
    description:
      "Travail interne (entretien, formation, déplacement) : non facturable, non poussé vers Odoo.",
  })
  @IsOptional()
  @IsBoolean()
  interne?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ type: [CreateLigneProduitDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLigneProduitDto)
  lignesProduit?: CreateLigneProduitDto[];

  @ApiPropertyOptional({ type: [CreateLigneHeureDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLigneHeureDto)
  lignesHeure?: CreateLigneHeureDto[];
}
