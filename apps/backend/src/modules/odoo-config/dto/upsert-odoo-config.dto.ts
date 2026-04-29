import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";

/**
 * Configuration Odoo Enterprise pour une exploitation.
 *
 * `apiKey` est en clair sur le câble (HTTPS) puis chiffrée AES-256-GCM
 * avant insertion DB. Si non fournie en upsert, on conserve la clé
 * actuelle (utile pour modifier l'URL/DB sans devoir re-saisir la clé).
 */
export class UpsertOdooConfigDto {
  @ApiProperty({
    description: "URL de base Odoo (Odoo.sh ou online.odoo.com), sans trailing slash.",
    example: "https://ferme-rolet.odoo.com",
  })
  @IsUrl({ require_protocol: true, protocols: ["https"] })
  @MaxLength(255)
  url!: string;

  @ApiProperty({
    description: "Nom de la base de données Odoo (visible dans l'URL admin Odoo).",
    example: "ferme-rolet",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  database!: string;

  @ApiProperty({
    description: "Login Odoo du compte de service (email recommandé).",
    example: "agri-qodo@ferme-rolet.test",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  username!: string;

  @ApiPropertyOptional({
    description:
      "API key Odoo (générée dans Odoo > Préférences > Compte > Clés API). " +
      "Optionnelle en update : si absente, on conserve la clé actuelle.",
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  apiKey?: string;
}
