import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ZoneAgricole } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateParcelleDto {
  @ApiProperty({ example: "Champ du Loup", maxLength: 120 })
  @IsString()
  @MaxLength(120)
  nom!: string;

  @ApiProperty({
    example: 12500,
    description: "Surface en m² (1 ha = 10000 m²)",
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  surfaceM2!: number;

  @ApiProperty({
    enum: ZoneAgricole,
    description: "Zone agricole selon l'OPD : ZA / ZP / ZM1-4 / ZE",
  })
  @IsEnum(ZoneAgricole)
  zone!: ZoneAgricole;

  @ApiPropertyOptional({ description: "Identifiant cadastral cantonal" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  identifiantCadastral?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
