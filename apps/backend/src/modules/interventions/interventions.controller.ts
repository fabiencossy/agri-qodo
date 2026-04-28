import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentTenant } from "@/common/decorators/current-tenant.decorator";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { InterventionsService } from "./interventions.service";

@ApiTags("interventions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("interventions")
export class InterventionsController {
  constructor(private readonly interventions: InterventionsService) {}

  @Get()
  @ApiOperation({
    summary: "Mes interventions (CRUD complet à l'étape 6 — M2)",
  })
  list(@CurrentTenant() tenantId: string) {
    return this.interventions.list(tenantId);
  }
}
