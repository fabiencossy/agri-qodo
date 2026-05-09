/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { ProjetType } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateProjetDto {
  @ApiProperty({ example: "Récolte 2026" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nom!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: ProjetType, default: ProjetType.AUTRE })
  @IsOptional()
  @IsEnum(ProjetType)
  type?: ProjetType;

  @ApiPropertyOptional({ example: "#4CAF50" })
  @IsOptional()
  @IsHexColor()
  couleurHex?: string;

  @ApiPropertyOptional({ description: "Date de début ISO (Odoo date_start)." })
  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @ApiPropertyOptional({ description: "Date d'échéance ISO (Odoo date deadline)." })
  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @ApiPropertyOptional({
    description:
      "Permet le rattachement à un sale.order facturable (Odoo `allow_billable`). Recommandé true pour TRAVAUX_TIERS.",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  allowBillable?: boolean;

  @ApiPropertyOptional({
    description: "ID `res.partner` Odoo (client lié au projet, Odoo `partner_id`).",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  odooPartnerId?: number;
}

export class UpdateProjetDto extends PartialType(CreateProjetDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  archive?: boolean;
}
