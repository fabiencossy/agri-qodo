import { type ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { Request } from "express";
import type { JwtPayload } from "@/modules/auth/types/jwt-payload.type";

/**
 * Récupère l'utilisateur courant injecté par la stratégie JWT dans `req.user`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    if (!request.user) {
      throw new Error("CurrentUser utilisé sur une route non authentifiée");
    }
    return request.user;
  },
);
