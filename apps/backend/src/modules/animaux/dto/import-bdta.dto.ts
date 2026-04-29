import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

/**
 * Import d'un export CSV BDTA / Agate. Solution intermédiaire en
 * attendant le contrat d'interface AnimalTracing avec Identitas.
 */
export class ImportBdtaDto {
  @ApiProperty({
    description: "Contenu du CSV exporté depuis le portail BDTA / Agate.",
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2_000_000)
  csv!: string;
}

export interface ImportBdtaResult {
  /** Nombre de bovins créés (n° boucle inconnu en base). */
  created: number;
  /** Nombre de bovins mis à jour (n° boucle déjà présent). */
  updated: number;
  /** Nombre de bovins anonymes promus en identifiés. */
  promoted: number;
  /** Lignes ignorées (n° boucle vide ou erreur de parsing). */
  skipped: number;
  /** Détail des erreurs ligne par ligne. */
  errors: Array<{ ligne: number; raison: string }>;
}
