import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PresenceType } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

/**
 * Clock-in : démarre une présence. dateDebut = now côté backend si non
 * fourni (cas mobile online). En offline, le client envoie l'horodatage
 * réel pour préserver l'historique pendant la sync.
 */
export class CreatePresenceDto {
  @ApiPropertyOptional({
    description: "Horodatage de l'entrée (ISO). Default = now côté serveur.",
    example: "2026-04-30T07:30:00.000Z",
  })
  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @ApiProperty({ enum: PresenceType, default: PresenceType.CHANTIER })
  @IsEnum(PresenceType)
  type!: PresenceType;

  @ApiPropertyOptional({
    description:
      "ID Travail facturable lié — la durée sera reportée en LigneTravailHeure à la sortie.",
  })
  @IsOptional()
  @IsUUID()
  travailId?: string;

  @ApiPropertyOptional({ description: "Latitude WGS84 au clock-in.", example: 46.521 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitudeDebut?: number;

  @ApiPropertyOptional({ description: "Longitude WGS84 au clock-in.", example: 6.633 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitudeDebut?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
