import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ProduitCategorie, ProduitUnite } from "@prisma/client";
import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateProduitDto {
  @ApiProperty({ enum: ProduitCategorie })
  @IsEnum(ProduitCategorie)
  categorie!: ProduitCategorie;

  @ApiProperty({ description: "Libellé affiché (ex: 'Blé panifiable Arnold')." })
  @IsString()
  @MaxLength(120)
  libelle!: string;

  @ApiPropertyOptional({ description: "Fournisseur (UFA, Landor, Lonza, …)." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  fournisseur?: string;

  @ApiPropertyOptional({ description: "Marque ou variété spécifique." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  marque?: string;

  @ApiPropertyOptional({
    description:
      "Code espèce pour SEMENCE (ex: ble_panifiable, mais_grain). Doit matcher les clés du rule engine pour que la culture soit reconnue par Suisse-Bilanz.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  especeCode?: string;

  @ApiPropertyOptional({ description: "Teneur azote (kg N / 100 unité)." })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  tauxN?: number;

  @ApiPropertyOptional({ description: "Teneur phosphore (kg P / 100 unité)." })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  tauxP?: number;

  @ApiPropertyOptional({ description: "Teneur potassium (kg K / 100 unité)." })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  tauxK?: number;

  @ApiPropertyOptional({ enum: ProduitUnite, default: ProduitUnite.KG })
  @IsOptional()
  @IsEnum(ProduitUnite)
  unite?: ProduitUnite;

  @ApiPropertyOptional({
    description:
      "Prix de vente catalogue CHF HT par unité. Visible/éditable uniquement par OWNER ou COMPTABLE.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  prixVenteCHF?: number;

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
