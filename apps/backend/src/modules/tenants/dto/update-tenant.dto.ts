import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

/**
 * Édition partielle de l'exploitation par son OWNER. Le `numeroExploitant`
 * (= `code` en DB) est le numéro officiel d'exploitation OFAG/UFAM
 * préfixé par le canton, ex `VD-1234567`. Stable et utilisé pour le
 * login (résolution du tenant) + les liens partenaires.
 */
export class UpdateTenantDto {
  @ApiPropertyOptional({
    description:
      "Numéro d'exploitant : {canton}-{n° UFAM}. Format conseillé pour rester compatible avec les paiements directs OFAG.",
    example: "VD-1234567",
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[A-Z]{2}-[A-Z0-9-]{1,30}$/i, {
    message:
      "Format attendu : {canton}-{numéro}, ex VD-1234567. Lettres, chiffres et tirets autorisés.",
  })
  numeroExploitant?: string;

  @ApiPropertyOptional({ description: "Nom de l'exploitation." })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nom?: string;

  @ApiPropertyOptional({ description: "Numéro UFAM (n° d'exploitation cantonal OFAG)." })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroUfam?: string;

  @ApiPropertyOptional({ description: "Numéro BDTA / Identitas (traçabilité animale)." })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroBdta?: string;

  @ApiPropertyOptional({
    description:
      "Visibilité dans l'annuaire de recherche partenaires. Quand true, les autres exploitations peuvent te trouver via la search bar Partenaires (nom, adresse, localité).",
  })
  @IsOptional()
  @IsBoolean()
  visibleInDirectory?: boolean;

  @ApiPropertyOptional({
    description:
      "Si true, les interventions du carnet sont rattachées à un Projet plutôt qu'à une Parcelle (UI form qui s'adapte).",
  })
  @IsOptional()
  @IsBoolean()
  noterTempsParProjet?: boolean;

  @ApiPropertyOptional({
    description: "Projet pré-sélectionné dans le formulaire Travaux pour tiers (UUID Projet).",
  })
  @IsOptional()
  @IsUUID()
  defaultProjetTravauxTiersId?: string;

  @ApiPropertyOptional({
    description: "Affiche les champs heures sur le formulaire Carnet des champs (sinon masqués).",
  })
  @IsOptional()
  @IsBoolean()
  heuresVisiblesCarnet?: boolean;

  @ApiPropertyOptional({
    description: "Affiche les champs heures sur le formulaire Travail pour tiers (sinon masqués).",
  })
  @IsOptional()
  @IsBoolean()
  heuresVisiblesTravauxTiers?: boolean;

  @ApiPropertyOptional({
    description: "Affiche les champs heures sur le formulaire Travail interne (sinon masqués).",
  })
  @IsOptional()
  @IsBoolean()
  heuresVisiblesTravauxInterne?: boolean;

  @ApiPropertyOptional({
    description:
      "Projet où s'imputent les heures du Carnet (UUID). Obligatoire dès que heuresVisiblesCarnet=true.",
  })
  @IsOptional()
  @IsUUID()
  projetHeuresCarnetId?: string | null;

  @ApiPropertyOptional({
    description:
      "Projet où s'imputent les heures de Travaux pour tiers (UUID). Obligatoire dès que heuresVisiblesTravauxTiers=true.",
  })
  @IsOptional()
  @IsUUID()
  projetHeuresTravauxTiersId?: string | null;

  @ApiPropertyOptional({
    description:
      "Projet où s'imputent les heures de Travaux internes (UUID). Obligatoire dès que heuresVisiblesTravauxInterne=true.",
  })
  @IsOptional()
  @IsUUID()
  projetHeuresTravauxInterneId?: string | null;
}
