import { ApiProperty } from "@nestjs/swagger";
import { AnimalCategorie } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, Max, Min } from "class-validator";

export class CreateAnimauxBatchDto {
  @ApiProperty({ enum: AnimalCategorie })
  @IsEnum(AnimalCategorie)
  categorie!: AnimalCategorie;

  @ApiProperty({
    description:
      "Nombre d'animaux à créer en une fois. Saisie rapide pour cheptel non identifié individuellement (porcs, poulets…).",
    minimum: 1,
    maximum: 10000,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  nombre!: number;
}
