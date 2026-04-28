import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentTenant } from "@/common/decorators/current-tenant.decorator";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { PartnerLinksService } from "./partner-links.service";

@ApiTags("partner-links")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("partner-links")
export class PartnerLinksController {
  constructor(private readonly links: PartnerLinksService) {}

  @Get()
  @ApiOperation({
    summary: "Mes liens partenaires (workflow complet à l'étape 6 — M16)",
  })
  list(@CurrentTenant() tenantId: string) {
    return this.links.listForTenant(tenantId);
  }
}
