import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  tenantId: string;
  userId: string;
}

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  /**
   * Exécute `fn` dans un contexte tenant — toutes les fonctions appelées
   * (sync ou async) à l'intérieur peuvent récupérer le contexte via `get()`.
   */
  run<T>(context: TenantContext, fn: () => T | Promise<T>): T | Promise<T> {
    return this.storage.run(context, fn);
  }

  /**
   * Renvoie le contexte courant. Throw si appelé hors d'un `run()` —
   * c'est volontaire : ça force à passer par le pipeline auth.
   */
  get(): TenantContext {
    const ctx = this.storage.getStore();
    if (!ctx) {
      throw new Error("TenantContext absent — appel hors d'une requête authentifiée ?");
    }
    return ctx;
  }

  /** Variante non-throw, utile pour les middlewares globaux (logs, etc.). */
  tryGet(): TenantContext | undefined {
    return this.storage.getStore();
  }
}
