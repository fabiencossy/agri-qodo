import { type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import type { JwtPayload } from "../types/jwt-payload.type";

const ACTIVE_TENANT_HEADER = "x-active-tenant-id";

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
    if (!user) return false;

    const homeTenantId = user.tenantId;
    const activeTenantHeader = req.header(ACTIVE_TENANT_HEADER)?.trim();

    // Cas standard : pas d'override → on travaille sur son tenant courant.
    if (!activeTenantHeader || activeTenantHeader === homeTenantId) {
      this.tenantContext.set({
        tenantId: homeTenantId,
        userId: user.sub,
        homeTenantId,
        role: user.role,
      });
      return true;
    }

    // Override demandé : doit être un tenant où l'utilisateur a un
    // compte fédéré (même email/password). La liste est figée dans le
    // JWT au moment du login. Pas de bascule via PartnerLink ici — un
    // partenariat ne donne PAS accès à toute la base du client.
    const accessible = user.tenantIds ?? [homeTenantId];
    if (!accessible.includes(activeTenantHeader)) {
      throw new ForbiddenException(
        "Tenant non accessible avec ce compte. Pour travailler chez un client partenaire, utilise la sélection client à la saisie d'intervention.",
      );
    }

    this.tenantContext.set({
      tenantId: activeTenantHeader,
      userId: user.sub,
      homeTenantId,
      role: user.role,
    });
    return true;
  }
}
