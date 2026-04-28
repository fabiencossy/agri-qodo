import { type ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import type { JwtPayload } from "../types/jwt-payload.type";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly tenantContext: TenantContextService) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const ok = (await super.canActivate(context)) as boolean;
    if (!ok) return false;

    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const user = req.user;
    if (user) {
      // Le contexte tenant est partagé pour toute la requête (voir
      // tenant-context.middleware.ts qui pose un scope vide en début de
      // requête). Ici on y inscrit l'identité.
      this.tenantContext.set({ tenantId: user.tenantId, userId: user.sub });
    }
    return true;
  }
}
