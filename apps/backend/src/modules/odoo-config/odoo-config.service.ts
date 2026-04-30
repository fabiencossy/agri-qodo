import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { OdooAuthError, OdooError } from "@agri-qodo/odoo-client";
import { EncryptionService } from "@/common/crypto/encryption.service";
import { PrismaService } from "@/common/prisma/prisma.service";
import { OdooClientManager } from "@/modules/odoo/odoo-client-manager.service";
import type { OdooConfigDto } from "./dto/odoo-config.dto";
import type { UpsertOdooConfigDto } from "./dto/upsert-odoo-config.dto";

/**
 * Gestion de la configuration Odoo par tenant. La connexion réelle (lib
 * `@agri-qodo/odoo-client`) est livrée en PR-B ; ce service ne fait que
 * persister/lire la config et chiffrer l'API key.
 *
 * Toutes les écritures sont restreintes au rôle OWNER de l'exploitation
 * **home** (pas un partenariat actif). Cf §22 spec.
 */
@Injectable()
export class OdooConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly odooManager: OdooClientManager,
  ) {}

  async get(tenantId: string): Promise<OdooConfigDto> {
    const tenant = await this.prisma.exploitation.findUnique({
      where: { id: tenantId },
      select: {
        odooUrl: true,
        odooDb: true,
        odooUsername: true,
        odooApiKeyEncrypted: true,
        odooVersion: true,
        odooConnectedAt: true,
      },
    });
    if (!tenant) {
      throw new NotFoundException("Exploitation introuvable");
    }
    return {
      url: tenant.odooUrl,
      database: tenant.odooDb,
      username: tenant.odooUsername,
      hasApiKey: tenant.odooApiKeyEncrypted !== null,
      version: tenant.odooVersion,
      connectedAt: tenant.odooConnectedAt?.toISOString() ?? null,
    };
  }

  async upsert(
    tenantId: string,
    callerRole: UserRole,
    dto: UpsertOdooConfigDto,
  ): Promise<OdooConfigDto> {
    this.assertOwner(callerRole);

    const data: {
      odooUrl: string;
      odooDb: string;
      odooUsername: string;
      odooApiKeyEncrypted?: string;
      odooVersion: null;
      odooConnectedAt: null;
    } = {
      odooUrl: dto.url.replace(/\/+$/, ""),
      odooDb: dto.database,
      odooUsername: dto.username,
      // L'URL/DB/user changeant invalide la version détectée et la
      // dernière connexion réussie : on les reset, le prochain test
      // de connexion les repeuplera.
      odooVersion: null,
      odooConnectedAt: null,
    };
    if (dto.apiKey !== undefined) {
      data.odooApiKeyEncrypted = this.encryption.encrypt(dto.apiKey);
    }

    await this.prisma.exploitation.update({ where: { id: tenantId }, data });
    // Toute modif de config invalide le client en cache.
    this.odooManager.invalidate(tenantId);
    return this.get(tenantId);
  }

  async remove(tenantId: string, callerRole: UserRole): Promise<void> {
    this.assertOwner(callerRole);
    await this.prisma.exploitation.update({
      where: { id: tenantId },
      data: {
        odooUrl: null,
        odooDb: null,
        odooUsername: null,
        odooApiKeyEncrypted: null,
        odooVersion: null,
        odooConnectedAt: null,
      },
    });
    this.odooManager.invalidate(tenantId);
  }

  /**
   * Vrai test de connexion : authentifie réellement contre Odoo via la
   * lib @agri-qodo/odoo-client, persiste la version détectée et le
   * timestamp de la connexion réussie. Renvoie les infos rafraîchies.
   *
   * Erreurs renvoyées en HTTP :
   * - 400 BadRequest si auth échoue (URL/DB/login/key invalide).
   * - 502 BadGateway implicite via OdooError pour les erreurs réseau /
   *   serveur Odoo down (le filtre exception NestJS le mappe par défaut
   *   en 500, ce qui est acceptable pour un test manuel).
   */
  async testConnection(tenantId: string, callerRole: UserRole): Promise<OdooConfigDto> {
    this.assertOwner(callerRole);
    const client = await this.odooManager.forTenant(tenantId);
    try {
      const session = await client.authenticate();
      await this.prisma.exploitation.update({
        where: { id: tenantId },
        data: {
          odooVersion: session.version.serverVersion,
          odooConnectedAt: new Date(),
        },
      });
      return this.get(tenantId);
    } catch (err) {
      if (err instanceof OdooAuthError) {
        throw new BadRequestException(
          `Authentification Odoo refusée — vérifie URL, base de données, login et clé API. ${err.message}`,
        );
      }
      if (err instanceof OdooError) {
        throw new BadRequestException(`Connexion Odoo impossible (${err.status}) : ${err.message}`);
      }
      throw err;
    }
  }

  private assertOwner(role: UserRole): void {
    if (role !== UserRole.OWNER) {
      throw new ForbiddenException(
        "Seul le propriétaire de l'exploitation peut modifier la configuration Odoo.",
      );
    }
  }
}
