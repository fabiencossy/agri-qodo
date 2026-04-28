import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentTenant } from "@/common/decorators/current-tenant.decorator";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { ParcellesService } from "./parcelles.service";

@ApiTags("parcelles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("parcelles")
export class ParcellesController {
  constructor(private readonly parcelles: ParcellesService) {}

  @Get()
  @ApiOperation({
    summary: "Liste mes parcelles (CRUD complet à l'étape 5 — M1)",
  })
  list(@CurrentTenant() tenantId: string) {
    return this.parcelles.list(tenantId);
  }
}
