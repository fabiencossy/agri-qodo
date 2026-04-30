import { ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  prenom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nom?: string;

  @ApiPropertyOptional({ description: "Téléphone (format libre, validation côté frontend)." })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  telephone?: string;

  @ApiPropertyOptional({
    description: "Préférences UI : { langue, theme, formatDate }. Stockage JSONB libre.",
    type: "object",
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ description: "Désactive l'accès sans supprimer." })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: "Réinitialise le mot de passe." })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(120)
  password?: string;
}
