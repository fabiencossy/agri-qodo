import { Injectable } from "@nestjs/common";
import type { PartnerLinkLevel, UserRole } from "@prisma/client";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Stocké dans l'AsyncLocalStorage. Mutable volontairement : la requête
 * démarre avec un objet vide, le `JwtAuthGuard` y inscrit `tenantId` et
 * `userId` après authentification réussie.
 *
 * `homeTenantId` = le tenant du JWT (mon exploitation).
 * `tenantId` = le tenant actif pour cette requête (peut être un partenaire
 * via header `X-Active-Tenant-Id`).
 * `partnerNiveau` = niveau d'autorisation si on travaille sur un partenaire.
 * `role` = rôle de l'utilisateur sur son home tenant (issu du JWT).
 */
interface TenantStore {
  tenantId?: string;
  userId?: string;
  homeTenantId?: string;
  role?: UserRole;
  partnerNiveau?: PartnerLinkLevel;
}

export interface TenantContext {
  /** Tenant actif pour les requêtes Prisma (peut être un partenaire). */
  tenantId: string;
  userId: string;
  /** Tenant d'origine de l'utilisateur (issu du JWT). */
  homeTenantId: string;
  /** Rôle de l'utilisateur (OWNER / EMPLOYE / COMPTABLE / CONSULTANT). */
  role?: UserRole;
  /** Si défini, on travaille sur le tenant d'un partenaire avec ce niveau. */
  partnerNiveau?: PartnerLinkLevel;
}

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantStore>();

  /**
   * Démarre un contexte vide pour toute la durée de la requête HTTP.
   * À appeler depuis un middleware Express global (voir main.ts).
   * `set()` viendra le compléter après le JwtAuthGuard.
   */
  runEmpty<T>(fn: () => T | Promise<T>): T | Promise<T> {
    return this.storage.run({}, fn);
  }

  /**
   * Pratique pour les tests et le seed : exécute `fn` avec un contexte
   * complet déjà posé.
   */
  run<T>(ctx: TenantContext, fn: () => T | Promise<T>): T | Promise<T> {
    const store: TenantStore = {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      homeTenantId: ctx.homeTenantId,
    };
    if (ctx.role !== undefined) store.role = ctx.role;
    if (ctx.partnerNiveau !== undefined) store.partnerNiveau = ctx.partnerNiveau;
    return this.storage.run(store, fn);
  }

  /**
   * Définit le tenant courant. Appelé par le `JwtAuthGuard` après auth.
   * Throw si la requête n'a pas été wrappée dans `runEmpty()` (oubli de
   * middleware), pour éviter que des guards posent silencieusement le
   * contexte hors d'un scope.
   */
  set(ctx: TenantContext): void {
    const store = this.storage.getStore();
    if (!store) {
      throw new Error(
        "TenantContextService.set() hors d'un scope async — le middleware tenant n'est pas installé ?",
      );
    }
    store.tenantId = ctx.tenantId;
    store.userId = ctx.userId;
    store.homeTenantId = ctx.homeTenantId;
    if (ctx.role !== undefined) store.role = ctx.role;
    else delete store.role;
    if (ctx.partnerNiveau !== undefined) {
      store.partnerNiveau = ctx.partnerNiveau;
    } else {
      delete store.partnerNiveau;
    }
  }

  /**
   * Renvoie le contexte courant. Throw si `tenantId` n'est pas posé —
   * c'est volontaire : ça force à passer par le pipeline auth.
   */
  get(): TenantContext {
    const store = this.storage.getStore();
    if (!store?.tenantId || !store.userId || !store.homeTenantId) {
      throw new Error("TenantContext absent — appel hors d'une requête authentifiée ?");
    }
    const out: TenantContext = {
      tenantId: store.tenantId,
      userId: store.userId,
      homeTenantId: store.homeTenantId,
    };
    if (store.role !== undefined) out.role = store.role;
    if (store.partnerNiveau !== undefined) out.partnerNiveau = store.partnerNiveau;
    return out;
  }

  /** Variante non-throw, utile pour les middlewares globaux (logs, Prisma). */
  tryGet(): TenantContext | undefined {
    const store = this.storage.getStore();
    if (!store?.tenantId || !store.userId || !store.homeTenantId) return undefined;
    const out: TenantContext = {
      tenantId: store.tenantId,
      userId: store.userId,
      homeTenantId: store.homeTenantId,
    };
    if (store.role !== undefined) out.role = store.role;
    if (store.partnerNiveau !== undefined) out.partnerNiveau = store.partnerNiveau;
    return out;
  }
}
