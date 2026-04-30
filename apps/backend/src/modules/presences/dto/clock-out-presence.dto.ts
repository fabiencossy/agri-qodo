import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

/**
 * Clock-out : ferme une présence ouverte. Si `travailId` est fourni
 * (ou déjà sur la présence), la durée est reportée automatiquement
 * en LigneTravailHeure à moins que `skipTimesheet` soit true.
 */
export class ClockOutPresenceDto {
  @ApiPropertyOptional({
    description: "Horodatage de la sortie (ISO). Default = now côté serveur.",
    example: "2026-04-30T17:30:00.000Z",
  })
  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @ApiPropertyOptional({
    description:
      "ID Travail à associer maintenant si pas saisi à l'entrée. Override le travailId existant.",
  })
  @IsOptional()
  @IsUUID()
  travailId?: string;

  @ApiPropertyOptional({
    description: "Si true, ne génère pas de LigneTravailHeure même si un travail est lié.",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  skipTimesheet?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
