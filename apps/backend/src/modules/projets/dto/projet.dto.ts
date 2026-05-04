/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { ProjetType } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsOptional,
  IsString,
  MaxLength,
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
}

export class UpdateProjetDto extends PartialType(CreateProjetDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  archive?: boolean;
}
