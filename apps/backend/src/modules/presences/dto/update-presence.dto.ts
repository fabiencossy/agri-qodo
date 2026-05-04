/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
import { ApiPropertyOptional } from "@nestjs/swagger";
import { PresenceType } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

/**
 * Modification d'une présence existante. Tous les champs optionnels :
 * on n'envoie que ce qu'on veut changer. Si dateDebut OU dateFin
 * change, le service recalcule dureeMinutes automatiquement.
 */
export class UpdatePresenceDto {
  @ApiPropertyOptional({ enum: PresenceType })
  @IsOptional()
  @IsEnum(PresenceType)
  type?: PresenceType;

  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @ApiPropertyOptional({ type: String, format: "uuid", nullable: true })
  @IsOptional()
  @IsUUID()
  travailId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
