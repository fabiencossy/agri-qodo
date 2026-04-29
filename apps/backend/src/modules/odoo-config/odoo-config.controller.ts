import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import type { JwtPayload } from "@/modules/auth/types/jwt-payload.type";
import { UpsertOdooConfigDto } from "./dto/upsert-odoo-config.dto";
import { OdooConfigService } from "./odoo-config.service";

/**
 * Configuration Odoo Enterprise du tenant courant.
 *
 * Toutes les écritures sont restreintes au tenant **home** (pas un
 * partenariat actif via X-Active-Tenant-Id) et au rôle OWNER. La donnée
 * est sensible — c'est ce qui permet à Agri Qodo de pousser dans la
 * compta du client.
 */
@ApiTags("odoo-config")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("tenants/me/odoo-config")
export class OdooConfigController {
  constructor(
    private readonly service: OdooConfigService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Lit la config Odoo du tenant home (sans l'API key)." })
  get() {
    return this.service.get(this.requireHomeTenantId());
  }

  @Put()
  @ApiOperation({ summary: "Crée ou met à jour la config Odoo du tenant home (OWNER)." })
  upsert(@Body() dto: UpsertOdooConfigDto, @Req() req: Request & { user?: JwtPayload }) {
    return this.service.upsert(this.requireHomeTenantId(), this.requireRole(req), dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Supprime la config Odoo du tenant home (OWNER)." })
  async remove(@Req() req: Request & { user?: JwtPayload }) {
    await this.service.remove(this.requireHomeTenantId(), this.requireRole(req));
  }

  @Post("test")
  @ApiOperation({
    summary:
      "Tente une connexion Odoo (auth + common.version()). Implémentation réelle en PR-B/PR-C.",
  })
  test(@Req() req: Request & { user?: JwtPayload }) {
    return this.service.testConnection(this.requireHomeTenantId(), this.requireRole(req));
  }

  private requireHomeTenantId(): string {
    const ctx = this.tenantContext.get();
    if (ctx.tenantId !== ctx.homeTenantId) {
      throw new ForbiddenException(
        "La config Odoo se modifie uniquement depuis ta propre exploitation, " +
          "pas depuis un partenariat actif.",
      );
    }
    return ctx.homeTenantId;
  }

  private requireRole(req: Request & { user?: JwtPayload }) {
    if (!req.user) {
      throw new ForbiddenException("Utilisateur non authentifié");
    }
    return req.user.role;
  }
}
