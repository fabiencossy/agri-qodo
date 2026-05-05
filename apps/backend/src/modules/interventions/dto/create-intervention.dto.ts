import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InterventionType, TechniqueEpandage } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";
import type { GeoJsonGeometry } from "@/modules/parcelles/dto/create-parcelle.dto";

/**
 * Géométrie d'une sous-zone d'intervention. Accepte uniquement Polygon
 * (un seul morceau) — pour saisir 2 zones distinctes, créer 2 interventions.
 */
export type InterventionGeoJsonGeometry = Extract<GeoJsonGeometry, { type: "Polygon" }>;

export class CreateInterventionDto {
  @ApiProperty({
    description:
      "UUID généré côté client pour garantir l'idempotence à la sync offline. Si absent, le serveur en génère un.",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  clientUuid?: string;

  @ApiProperty({ description: "ID de la parcelle concernée" })
  @IsUUID()
  parcelleId!: string;

  @ApiProperty({
    enum: InterventionType,
    description: "Type d'opération (semis, fumure, phyto, récolte, etc.)",
  })
  @IsEnum(InterventionType)
  type!: InterventionType;

  @ApiProperty({
    description: "Date de l'opération au format ISO (YYYY-MM-DD ou ISO 8601)",
    example: "2026-04-28",
  })
  @IsDateString()
  dateOperation!: string;

  @ApiPropertyOptional({
    description:
      "ID Produit du catalogue. Recommandé pour SEMIS (déclenche création de Culture), FUMURE (alimente le bilan N/P) et PHYTO (n° OSAV).",
  })
  @IsOptional()
  @IsUUID()
  produitId?: string;

  @ApiPropertyOptional({
    description: "Libellé libre du produit (utilisé si produitId absent, ou en cohabitation)",
    example: "Roundup MAX 360",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  produit?: string;

  @ApiPropertyOptional({
    description:
      "ID Matériel du catalogue (outil/machine utilisé : charrue, semoir, pulvé, ensileuse…). " +
      "En cas B (parcelle d'un partenaire), sert à générer la ligne sale.order Odoo facturée.",
  })
  @IsOptional()
  @IsUUID()
  materielId?: string;

  @ApiPropertyOptional({
    description:
      "Surface effective travaillée en hectares. Quantité facturée quand le matériel est tarifé à l'hectare. Calculée auto depuis geomGeoJson ou parcelle si absent.",
    example: 1.25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  surfaceHa?: number;

  @ApiPropertyOptional({ example: 25.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantite?: number;

  @ApiPropertyOptional({
    description:
      "Rendement à l'hectare (optionnel). Typique sur RECOLTE : 80 q/ha de blé, 12 t/ha de maïs. Unité héritée de `unite`.",
    example: 80,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  rendementParHa?: number;

  @ApiPropertyOptional({
    description:
      "Surface réellement concernée en m². Omettre ou null = toute la parcelle. Si `geomGeoJson` est fourni, cette valeur est ignorée et recalculée depuis le polygone.",
    example: 5000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  surfaceTravailleeM2?: number;

  @ApiPropertyOptional({
    description:
      "Sous-zone géométrique réellement travaillée — Polygon GeoJSON WGS84 (EPSG:4326). " +
      "Doit être inclus dans la parcelle (validation ST_Within). Si fourni, " +
      "`surfaceTravailleeM2` est recalculée automatiquement depuis le polygone. " +
      "Permet de représenter spatialement le plan d'assolement (blé sur la moitié est, orge sur la moitié ouest, …).",
    type: "object",
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  geomGeoJson?: InterventionGeoJsonGeometry;

  @ApiPropertyOptional({
    description: "Unité libre : kg, L, t, ha, doses…",
    example: "L",
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unite?: string;

  @ApiPropertyOptional({
    enum: TechniqueEpandage,
    description: "Technique d'épandage pour FUMURE_ORGANIQUE — détermine la perte NH3 (5-30%).",
  })
  @IsOptional()
  @IsEnum(TechniqueEpandage)
  techniqueEpandage?: TechniqueEpandage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    description: "Heure de début ISO (PRD fusion v0.2 §3.3 — heures sur Carnet, mono-utilisateur).",
  })
  @IsOptional()
  @IsDateString()
  heureDebut?: string;

  @ApiPropertyOptional({ description: "Heure de fin ISO." })
  @IsOptional()
  @IsDateString()
  heureFin?: string;

  @ApiPropertyOptional({
    description:
      "Durée en minutes saisie librement (alternative à heureDebut/heureFin). Si les deux sont fournis, le service recalcule depuis les heures.",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  dureeMinutes?: number;

  @ApiPropertyOptional({
    description: "Date prévue d'exécution (Sprint 2 — Planning). ISO YYYY-MM-DD.",
  })
  @IsOptional()
  @IsDateString()
  datePrevue?: string;

  @ApiPropertyOptional({ description: "User assigné au planning." })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;
}
