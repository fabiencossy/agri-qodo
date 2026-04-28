import { type ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { Request } from "express";
import type { JwtPayload } from "@/modules/auth/types/jwt-payload.type";

/**
 * Récupère l'identifiant du tenant (exploitation) à partir du JWT.
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    if (!request.user) {
      throw new Error("CurrentTenant utilisé sur une route non authentifiée");
    }
    return request.user.tenantId;
  },
);
