import { BadRequestException, Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { type ClientType, ClientsService } from "./clients.service";

const VALID_TYPES = new Set(["tenant", "odoo"]);

@ApiTags("clients")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("clients")
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  @ApiOperation({
    summary: "Liste agrégée de tous les clients (partenaires AQ + clients Odoo seuls).",
  })
  list() {
    return this.clients.list();
  }

  @Get(":type/:id")
  @ApiOperation({
    summary:
      "Détail d'un client — infos + parcelles + travaux. type ∈ tenant|odoo, id = UUID Exploitation ou id Odoo selon le type.",
  })
  get(@Param("type") type: string, @Param("id") id: string) {
    if (!VALID_TYPES.has(type)) {
      throw new BadRequestException("type doit être 'tenant' ou 'odoo'");
    }
    return this.clients.get(type as ClientType, id);
  }
}
