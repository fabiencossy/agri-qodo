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
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { CreateTravailDto } from "./dto/create-travail.dto";
import { UpdateTravailDto } from "./dto/update-travail.dto";
import { OdooPushService } from "./odoo-push.service";
import { TravauxService } from "./travaux.service";

@ApiTags("travaux")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("travaux")
export class TravauxController {
  constructor(
    private readonly travaux: TravauxService,
    private readonly odooPush: OdooPushService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Liste les travaux du tenant courant." })
  list() {
    return this.travaux.list();
  }

  @Get("mes-heures")
  @ApiOperation({
    summary:
      "Heures saisies par l'utilisateur courant (timesheet perso, agrégées des LigneTravailHeure).",
  })
  @ApiQuery({ name: "dateDebut", required: false, description: "ISO date inclusive (>=)" })
  @ApiQuery({ name: "dateFin", required: false, description: "ISO date inclusive (<=)" })
  mesHeures(@Query("dateDebut") dateDebut?: string, @Query("dateFin") dateFin?: string) {
    return this.travaux.mesHeures({
      ...(dateDebut ? { dateDebut } : {}),
      ...(dateFin ? { dateFin } : {}),
    });
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

  @Post(":id/push-odoo")
  @ApiOperation({
    summary:
      "Pousse le travail vers Odoo en tant que sale.order brouillon. Crée le res.partner si besoin, mappe les produits via odooProductId, agrège les heures sur un produit service 'Main d'œuvre'.",
  })
  pushOdoo(@Param("id", ParseUUIDPipe) id: string) {
    return this.odooPush.pushTravail(id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Supprime un travail (interdit si déjà INVOICED)." })
  async remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.travaux.remove(id);
  }
}
