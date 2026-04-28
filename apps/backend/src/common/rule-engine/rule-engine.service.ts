import { Injectable, Logger } from "@nestjs/common";
import { RuleSetScope } from "@prisma/client";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * Moteur de règles configurables.
 *
 * Résolution hiérarchique (le premier qui répond gagne) :
 *   1. RuleSet TENANT actif du tenant courant (override par exploitation)
 *   2. RuleSet CANTON actif du canton de l'exploitation (variante cantonale)
 *   3. RuleSet GLOBAL actif (template OPD-CH-2026, etc.)
 *   4. defaultValue passée par l'appelant (ultime fallback hardcoded)
 *
 * Cache en mémoire avec TTL de 5 minutes. Invalide via `invalidate(scope)`
 * lors d'une écriture admin.
 *
 * Voir docs/adr/ADR-003-rule-engine.md.
 */
@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Récupère la valeur d'une règle, ou `defaultValue` si aucune règle ne
   * la définit. La valeur stockée est du JSON, donc le type T est sous
   * la responsabilité de l'appelant (cohérence du seed + lecture).
   */
  async get<T>(key: string, defaultValue: T): Promise<T> {
    const ctx = this.tenantContext.tryGet();
    const cacheKey = `${ctx?.tenantId ?? "global"}:${key}`;

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    const value = await this.resolve<T>(key, ctx?.tenantId);
    const finalValue = value !== undefined ? value : defaultValue;
    this.cache.set(cacheKey, {
      value: finalValue,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return finalValue;
  }

  /**
   * Récupère plusieurs règles d'un coup. Utile quand un module métier
   * a besoin d'un objet de configuration complet (ex: AssolementConfig).
   */
  async getMany<T extends Record<string, unknown>>(defaults: T): Promise<T> {
    const entries = await Promise.all(
      Object.entries(defaults).map(async ([k, def]) => {
        const v = await this.get(k, def);
        return [k, v] as const;
      }),
    );
    return Object.fromEntries(entries) as T;
  }

  /** Invalide tout le cache. À appeler après écriture admin sur les règles. */
  invalidateAll(): void {
    this.cache.clear();
    this.logger.log("Rule cache flushed");
  }

  /** Invalide les entrées du cache pour un tenant donné. */
  invalidateTenant(tenantId: string): void {
    const prefix = `${tenantId}:`;
    let count = 0;
    for (const k of this.cache.keys()) {
      if (k.startsWith(prefix)) {
        this.cache.delete(k);
        count++;
      }
    }
    if (count > 0) {
      this.logger.log(`Invalidated ${count} cached rules for tenant ${tenantId}`);
    }
  }

  private async resolve<T>(key: string, tenantId: string | undefined): Promise<T | undefined> {
    // 1. Override tenant
    if (tenantId) {
      const tenantRule = await this.prisma.rule.findFirst({
        where: {
          key,
          ruleSet: {
            scope: RuleSetScope.TENANT,
            tenantId,
            isActive: true,
          },
        },
        select: { valueJson: true },
      });
      if (tenantRule) return tenantRule.valueJson as T;
    }

    // 2. Variante canton — TODO V2 (nécessite de connaître le canton du
    // tenant ; pas critique pour le bootstrap).

    // 3. Template global actif
    const globalRule = await this.prisma.rule.findFirst({
      where: {
        key,
        ruleSet: {
          scope: RuleSetScope.GLOBAL,
          isActive: true,
        },
      },
      select: { valueJson: true },
    });
    if (globalRule) return globalRule.valueJson as T;

    return undefined;
  }
}
