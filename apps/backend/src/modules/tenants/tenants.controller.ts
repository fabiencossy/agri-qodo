import { Body, Controller, ForbiddenException, Get, Patch, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { CurrentTenant } from "@/common/decorators/current-tenant.decorator";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import type { JwtPayload } from "@/modules/auth/types/jwt-payload.type";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { TenantsService } from "./tenants.service";

@ApiTags("tenants")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("tenants")
export class TenantsController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get("me")
  @ApiOperation({ summary: "Exploitation actuellement active (compte fédéré courant)" })
  getMine(@CurrentTenant() tenantId: string) {
    return this.tenants.getMine(tenantId);
  }

  @Get("accessible")
  @ApiOperation({
    summary:
      "Liste des tenants accessibles via compte fédéré (même email+password chez plusieurs exploitations).",
  })
  listAccessible(@Req() req: Request & { user?: JwtPayload }) {
    const tenantIds = req.user?.tenantIds ?? [];
    return this.tenants.listAccessible(tenantIds);
  }

  @Patch("me")
  @ApiOperation({
    summary:
      "Édite l'exploitation home (numéro d'exploitant, nom, n° UFAM, n° BDTA) — réservé OWNER.",
  })
  updateMine(@Body() dto: UpdateTenantDto) {
    const ctx = this.tenantContext.get();
    // Sécurité : on n'autorise l'édition que sur le tenant home, jamais
    // sur un partenaire (même DIRECT) — le owner reste maître de son
    // identité légale.
    if (ctx.tenantId !== ctx.homeTenantId) {
      throw new ForbiddenException(
        "L'édition de l'exploitation n'est permise que depuis ton propre tenant.",
      );
    }
    return this.tenants.updateMine(ctx.homeTenantId, dto);
  }
}
