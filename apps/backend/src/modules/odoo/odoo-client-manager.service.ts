import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { createOdooClient, type OdooClient } from "@agri-qodo/odoo-client";
import { EncryptionService } from "@/common/crypto/encryption.service";
import { PrismaService } from "@/common/prisma/prisma.service";

interface CachedClient {
  client: OdooClient;
  /** Timestamp ms d'expiration du cache. */
  expiresAt: number;
  /** URL/db/user de la config qui a généré ce client (pour invalidation auto). */
  signature: string;
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min — cohérent avec le JWT access TTL.

/**
 * Manager de clients Odoo par tenant.
 *
 * - Lit la config Odoo (chiffrée) du tenant via Prisma.
 * - Déchiffre l'API key avec EncryptionService.
 * - Instancie un OdooClient par tenant et le met en cache 15 min.
 * - Invalide automatiquement le cache si la config (url/db/user) a
 *   changé entre deux appels (signature différente).
 *
 * Pas de cache positif sur les erreurs : si une auth échoue, le client
 * n'est pas mis en cache, l'appelant doit gérer.
 */
@Injectable()
export class OdooClientManager {
  private readonly logger = new Logger(OdooClientManager.name);
  private readonly cache = new Map<string, CachedClient>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Renvoie un client Odoo prêt à l'emploi pour le tenant donné.
   * Throw si aucune config Odoo n'est enregistrée.
   *
   * Le client n'est PAS pré-authentifié — la lib le fait au premier
   * appel `searchRead`/`create`/etc. Si tu veux forcer l'auth tout de
   * suite (par ex pour healthcheck), appelle `client.authenticate()`.
   */
  async forTenant(tenantId: string): Promise<OdooClient> {
    const cached = this.cache.get(tenantId);
    const now = Date.now();

    const config = await this.loadConfig(tenantId);
    const signature = `${config.url}|${config.database}|${config.username}`;

    if (cached && cached.expiresAt > now && cached.signature === signature) {
      return cached.client;
    }

    const client = createOdooClient({
      url: config.url,
      database: config.database,
      username: config.username,
      apiKey: config.apiKey,
    });
    this.cache.set(tenantId, {
      client,
      signature,
      expiresAt: now + CACHE_TTL_MS,
    });
    return client;
  }

  /** Invalide le cache d'un tenant (à appeler après upsert/remove de config). */
  invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  /**
   * Lecture + déchiffrement de la config Odoo persistée. Throw si
   * incomplète (l'OWNER n'a pas encore enregistré sa config Odoo).
   */
  private async loadConfig(tenantId: string): Promise<{
    url: string;
    database: string;
    username: string;
    apiKey: string;
  }> {
    const tenant = await this.prisma.exploitation.findUnique({
      where: { id: tenantId },
      select: {
        odooUrl: true,
        odooDb: true,
        odooUsername: true,
        odooApiKeyEncrypted: true,
      },
    });
    if (!tenant) {
      throw new NotFoundException("Exploitation introuvable");
    }
    if (!tenant.odooUrl || !tenant.odooDb || !tenant.odooUsername || !tenant.odooApiKeyEncrypted) {
      throw new NotFoundException(
        "Configuration Odoo absente — l'OWNER doit la renseigner via /exploitation/odoo.",
      );
    }
    let apiKey: string;
    try {
      apiKey = this.encryption.decrypt(tenant.odooApiKeyEncrypted);
    } catch (err) {
      this.logger.error(
        `Déchiffrement de l'API key Odoo échoué pour tenant ${tenantId}. ` +
          `ODOO_CREDENTIALS_KEY a-t-elle été modifiée depuis l'enregistrement ? ${
            err instanceof Error ? err.message : err
          }`,
      );
      throw new Error(
        "L'API key Odoo stockée ne peut pas être déchiffrée. Demande à l'OWNER de la re-saisir.",
      );
    }
    return {
      url: tenant.odooUrl,
      database: tenant.odooDb,
      username: tenant.odooUsername,
      apiKey,
    };
  }
}
