import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentTenant } from "@/common/decorators/current-tenant.decorator";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { TenantsService } from "./tenants.service";

@ApiTags("tenants")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get("me")
  @ApiOperation({ summary: "Mon exploitation (déduite du JWT)" })
  getMine(@CurrentTenant() tenantId: string) {
    return this.tenants.getMine(tenantId);
  }
}
