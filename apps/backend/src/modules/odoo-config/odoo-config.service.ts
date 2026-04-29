import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { EncryptionService } from "@/common/crypto/encryption.service";
import { PrismaService } from "@/common/prisma/prisma.service";
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
  }

  /**
   * Test de connexion — placeholder PR-A. La vraie implémentation
   * (auth XML-RPC + `common.version()` + persistance de `odooVersion`
   * et `odooConnectedAt`) arrive avec PR-B et le module backend `odoo`
   * en PR-C.
   */
  async testConnection(_tenantId: string, callerRole: UserRole): Promise<never> {
    this.assertOwner(callerRole);
    throw new NotImplementedException(
      "Test de connexion Odoo non encore implémenté — disponible avec la lib @agri-qodo/odoo-client (PR-B/PR-C M6).",
    );
  }

  private assertOwner(role: UserRole): void {
    if (role !== UserRole.OWNER) {
      throw new ForbiddenException(
        "Seul le propriétaire de l'exploitation peut modifier la configuration Odoo.",
      );
    }
  }
}
