import { type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PartnerLinkLevel, PartnerLinkStatus } from "@prisma/client";
import type { Request } from "express";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import type { JwtPayload } from "../types/jwt-payload.type";

const ACTIVE_TENANT_HEADER = "x-active-tenant-id";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
  ) {
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

    // Cas standard : pas d'override → on travaille sur son propre tenant.
    if (!activeTenantHeader || activeTenantHeader === homeTenantId) {
      this.tenantContext.set({
        tenantId: homeTenantId,
        userId: user.sub,
        homeTenantId,
      });
      return true;
    }

    // Override demandé : valide qu'un PartnerLink ACTIF existe.
    const link = await this.prisma.partnerLink.findFirst({
      where: {
        partnerTenantId: homeTenantId,
        ownerTenantId: activeTenantHeader,
        status: PartnerLinkStatus.ACTIVE,
      },
      select: { niveau: true },
    });
    if (!link) {
      throw new ForbiddenException(
        "Aucun lien partenaire actif avec cette exploitation — accès refusé.",
      );
    }

    // Niveau LECTURE : on bloque les écritures (POST/PATCH/PUT/DELETE).
    const method = req.method.toUpperCase();
    if (
      link.niveau === PartnerLinkLevel.LECTURE &&
      (method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE")
    ) {
      throw new ForbiddenException("Lien partenaire en lecture seule — modification refusée.");
    }

    this.tenantContext.set({
      tenantId: activeTenantHeader,
      userId: user.sub,
      homeTenantId,
      partnerNiveau: link.niveau,
    });
    return true;
  }
}
