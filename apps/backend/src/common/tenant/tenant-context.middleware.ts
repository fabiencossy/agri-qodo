/**
 * Middleware Express global : wrappe chaque requête HTTP dans un scope
 * AsyncLocalStorage. Le `JwtAuthGuard` viendra ensuite y inscrire le
 * tenantId via `TenantContextService.set()`.
 *
 * Sans ce middleware, `set()` throw — c'est volontaire (fail loud plutôt
 * que silencieusement perdre l'isolation).
 */
import type { NextFunction, Request, Response } from "express";
import type { TenantContextService } from "./tenant-context.service";

export function tenantContextMiddleware(
  tenantContext: TenantContextService,
): (req: Request, res: Response, next: NextFunction) => void {
  return (_req, _res, next) => {
    tenantContext.runEmpty(() => next());
  };
}
