import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Stocké dans l'AsyncLocalStorage. Mutable volontairement : la requête
 * démarre avec un objet vide, le `JwtAuthGuard` y inscrit `tenantId` et
 * `userId` après authentification réussie.
 */
interface TenantStore {
  tenantId?: string;
  userId?: string;
}

export interface TenantContext {
  tenantId: string;
  userId: string;
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
    return this.storage.run({ tenantId: ctx.tenantId, userId: ctx.userId }, fn);
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
  }

  /**
   * Renvoie le contexte courant. Throw si `tenantId` n'est pas posé —
   * c'est volontaire : ça force à passer par le pipeline auth.
   */
  get(): TenantContext {
    const store = this.storage.getStore();
    if (!store?.tenantId || !store.userId) {
      throw new Error("TenantContext absent — appel hors d'une requête authentifiée ?");
    }
    return { tenantId: store.tenantId, userId: store.userId };
  }

  /** Variante non-throw, utile pour les middlewares globaux (logs, Prisma). */
  tryGet(): TenantContext | undefined {
    const store = this.storage.getStore();
    if (!store?.tenantId || !store.userId) return undefined;
    return { tenantId: store.tenantId, userId: store.userId };
  }
}
