import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentTenant } from "@/common/decorators/current-tenant.decorator";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
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
  @ApiOperation({ summary: "Exploitation actuellement active (home ou partenaire)" })
  getMine(@CurrentTenant() tenantId: string) {
    return this.tenants.getMine(tenantId);
  }

  @Get("accessible")
  @ApiOperation({
    summary: "Liste des tenants accessibles à l'utilisateur (home + partenariats actifs).",
  })
  listAccessible() {
    const ctx = this.tenantContext.get();
    return this.tenants.listAccessible(ctx.homeTenantId);
  }
}
