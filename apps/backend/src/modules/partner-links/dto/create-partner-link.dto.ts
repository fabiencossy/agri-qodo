import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PartnerLinkLevel } from "@prisma/client";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * Scope d'un lien partenaire — quelles parcelles, à quel niveau.
 * Voir spec §11. MVP : `parcelles: 'all'` ou liste d'UUIDs.
 */
export class PartnerLinkScopeDto {
  @ApiProperty({
    description: "'all' (toutes parcelles) OU liste explicite d'UUIDs de parcelles",
    oneOf: [
      { type: "string", enum: ["all"] },
      { type: "array", items: { type: "string" } },
    ],
  })
  @ValidateIf((o: PartnerLinkScopeDto) => Array.isArray(o.parcelles))
  @IsArray()
  @ArrayMaxSize(2000)
  @IsUUID(undefined, { each: true })
  @ValidateIf((o: PartnerLinkScopeDto) => typeof o.parcelles === "string")
  @IsString()
  @Matches(/^all$/)
  parcelles!: "all" | string[];

  @ApiProperty({ enum: PartnerLinkLevel })
  @IsEnum(PartnerLinkLevel)
  niveau!: PartnerLinkLevel;
}

export class CreatePartnerLinkDto {
  @ApiProperty({
    description: "Code Agri Qodo de l'exploitation partenaire (format AQ-{canton}-{ufam}-{token})",
    example: "AQ-VD-1234-A1B2",
  })
  @IsString()
  @MaxLength(40)
  @Matches(/^AQ-[A-Z]{2}-[A-Z0-9]{2,8}-[A-Z0-9]{4}$/, {
    message: "Code partenaire invalide (format attendu : AQ-{canton}-{ufam}-{token})",
  })
  partnerCode!: string;

  @ApiPropertyOptional({ type: PartnerLinkScopeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PartnerLinkScopeDto)
  scope?: PartnerLinkScopeDto;
}
