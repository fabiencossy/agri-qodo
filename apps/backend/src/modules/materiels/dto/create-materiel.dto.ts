import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MaterielCategorie, MaterielUnite } from "@prisma/client";
import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateMaterielDto {
  @ApiProperty({ description: "Libellé affiché (ex: 'Labour à la charrue')." })
  @IsString()
  @MaxLength(120)
  libelle!: string;

  @ApiProperty({ enum: MaterielCategorie })
  @IsEnum(MaterielCategorie)
  categorie!: MaterielCategorie;

  @ApiPropertyOptional({ enum: MaterielUnite, default: MaterielUnite.HA })
  @IsOptional()
  @IsEnum(MaterielUnite)
  unite?: MaterielUnite;

  @ApiPropertyOptional({
    description:
      "Tarif par défaut CHF HT par unité (HA / M3 / T / H / FORFAIT). Modifiable ligne par ligne sur le Travail/Intervention.",
  })
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

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
