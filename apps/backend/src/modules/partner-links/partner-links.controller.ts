import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { CurrentTenant } from "@/common/decorators/current-tenant.decorator";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { CreatePartnerLinkDto } from "./dto/create-partner-link.dto";
import { PartnerLinksService } from "./partner-links.service";

@ApiTags("partner-links")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("partner-links")
export class PartnerLinksController {
  constructor(private readonly links: PartnerLinksService) {}

  @Get()
  @ApiOperation({ summary: "Mes liens partenaires (rôle owner et partner confondus)" })
  list(@CurrentTenant() tenantId: string) {
    return this.links.listForTenant(tenantId);
  }

  @Get("lookup")
  @ApiOperation({
    summary: "Résout un code Agri Qodo en infos publiques d'exploitation (avant invitation).",
  })
  lookup(@Query("code") code: string, @CurrentTenant() tenantId: string) {
    return this.links.lookupByCode(code, tenantId);
  }

  @Get("directory/search")
  @ApiOperation({
    summary:
      "Annuaire — cherche une exploitation par nom, adresse ou localité (opt-in visibilité).",
  })
  @ApiQuery({ name: "q", required: true, description: "≥ 2 caractères" })
  @ApiQuery({ name: "canton", required: false, description: "Filtre canton (ex VD)" })
  searchDirectory(
    @Query("q") q: string,
    @CurrentTenant() tenantId: string,
    @Query("canton") canton?: string,
  ) {
    return this.links.searchDirectory(q, tenantId, canton);
  }

  @Post()
  @ApiOperation({
    summary: "Invite une exploitation partenaire par son code Agri Qodo — crée un lien PENDING.",
  })
  invite(@Body() dto: CreatePartnerLinkDto, @CurrentTenant() tenantId: string) {
    return this.links.invite(tenantId, dto);
  }

  @Post(":id/accept")
  @ApiOperation({ summary: "Accepte un lien PENDING (côté partenaire invité)." })
  accept(@Param("id", ParseUUIDPipe) id: string, @CurrentTenant() tenantId: string) {
    return this.links.accept(id, tenantId);
  }

  @Post(":id/revoke")
  @ApiOperation({
    summary: "Refuse un PENDING ou révoque un ACTIVE — accessible aux deux parties prenantes.",
  })
  revoke(@Param("id", ParseUUIDPipe) id: string, @CurrentTenant() tenantId: string) {
    return this.links.revoke(id, tenantId);
  }
}
