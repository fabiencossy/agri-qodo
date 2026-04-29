import { ApiProperty } from "@nestjs/swagger";

/**
 * Vue côté client de la config Odoo d'un tenant.
 *
 * **L'API key chiffrée n'est jamais retournée.** On expose uniquement
 * `hasApiKey: true|false` pour que l'UI sache si une clé est déjà
 * stockée (et puisse afficher "•••••••• (modifier)" plutôt que vide).
 */
export class OdooConfigDto {
  @ApiProperty({ nullable: true })
  url!: string | null;

  @ApiProperty({ nullable: true })
  database!: string | null;

  @ApiProperty({ nullable: true })
  username!: string | null;

  @ApiProperty({ description: "Une API key est-elle stockée pour ce tenant ?" })
  hasApiKey!: boolean;

  @ApiProperty({
    nullable: true,
    description: "Version Odoo détectée à la dernière connexion réussie (ex '19.0+e').",
  })
  version!: string | null;

  @ApiProperty({ nullable: true, description: "Horodatage de la dernière connexion réussie." })
  connectedAt!: string | null;
}
