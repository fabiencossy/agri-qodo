import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { CreateTravailDto } from "./dto/create-travail.dto";
import { UpdateTravailDto } from "./dto/update-travail.dto";
import { TravauxService } from "./travaux.service";

@ApiTags("travaux")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("travaux")
export class TravauxController {
  constructor(private readonly travaux: TravauxService) {}

  @Get()
  @ApiOperation({ summary: "Liste les travaux du tenant courant." })
  list() {
    return this.travaux.list();
  }

  @Get(":id")
  @ApiOperation({ summary: "Détail d'un travail (avec lignes produits + heures)." })
  getById(@Param("id", ParseUUIDPipe) id: string) {
    return this.travaux.getById(id);
  }

  @Post()
  @ApiOperation({ summary: "Crée un travail (DRAFT par défaut)." })
  create(@Body() dto: CreateTravailDto) {
    return this.travaux.create(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Met à jour un travail (remplace les lignes si fournies)." })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateTravailDto) {
    return this.travaux.update(id, dto);
  }

  @Post(":id/validate")
  @ApiOperation({ summary: "DRAFT → VALIDATED. Prêt à pousser vers Odoo (PR-E)." })
  validate(@Param("id", ParseUUIDPipe) id: string) {
    return this.travaux.validate(id);
  }

  @Post(":id/cancel")
  @ApiOperation({ summary: "Annule un travail (interdit si déjà INVOICED)." })
  cancel(@Param("id", ParseUUIDPipe) id: string) {
    return this.travaux.cancel(id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Supprime un travail (interdit si déjà INVOICED)." })
  async remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.travaux.remove(id);
  }
}
