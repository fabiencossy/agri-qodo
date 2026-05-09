import { ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
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

  @ApiPropertyOptional({
    description:
      "ID hr.employee Odoo lié à ce compte. Quand mappé, les timesheets poussés depuis un Travail dont l'auteur des heures est ce User remontent sur cet employé Odoo. `null` retire le mapping.",
    type: "integer",
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  odooEmployeeId?: number | null;
}
