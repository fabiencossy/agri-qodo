import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { CreateInterventionDto } from "./dto/create-intervention.dto";
import { UpdateInterventionDto } from "./dto/update-intervention.dto";
import { InterventionsService } from "./interventions.service";

@ApiTags("interventions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("interventions")
export class InterventionsController {
  constructor(private readonly interventions: InterventionsService) {}

  @Get()
  @ApiOperation({
    summary: "Liste mes interventions (owner OR author — M16-aware)",
  })
  list() {
    return this.interventions.list();
  }

  @Get("pending")
  @ApiOperation({
    summary:
      "Liste les interventions PENDING saisies par un partenaire sur une de mes parcelles — à valider/refuser/modifier.",
  })
  listPending() {
    return this.interventions.listPending();
  }

  @Get("with-geom")
  @ApiOperation({
    summary:
      "Liste les interventions ayant une sous-zone géométrique (Polygon GeoJSON). Base de la vue Plan d'assolement.",
  })
  @ApiQuery({ name: "campagne", required: false, type: Number })
  @ApiQuery({ name: "parcelleId", required: false, type: String })
  listWithGeom(
    @Query("campagne", new ParseIntPipe({ optional: true })) campagne?: number,
    @Query("parcelleId") parcelleId?: string,
  ) {
    return this.interventions.listWithGeom({
      ...(campagne !== undefined ? { campagne } : {}),
      ...(parcelleId ? { parcelleId } : {}),
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Détail d'une intervention" })
  getById(@Param("id", ParseUUIDPipe) id: string) {
    return this.interventions.getById(id);
  }

  @Post()
  @ApiOperation({ summary: "Saisir une intervention" })
  create(@Body() dto: CreateInterventionDto) {
    return this.interventions.create(dto);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Modifier une intervention (propriétaire uniquement)",
  })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateInterventionDto) {
    return this.interventions.update(id, dto);
  }

  @Post(":id/validate")
  @ApiOperation({
    summary:
      "Valider une intervention PENDING reçue d'un partenaire (owner only). Passe à VALIDATED.",
  })
  validate(@Param("id", ParseUUIDPipe) id: string) {
    return this.interventions.validatePending(id);
  }

  @Post(":id/reject")
  @ApiOperation({
    summary:
      "Refuser une intervention PENDING reçue d'un partenaire (owner only). Passe à REJECTED. Le Travail prestataire est annulé.",
  })
  reject(@Param("id", ParseUUIDPipe) id: string, @Body() body: { reason?: string }) {
    return this.interventions.rejectPending(id, body.reason);
  }

  @Post(":id/complete")
  @ApiOperation({
    summary:
      "Sprint 2 — Marque une intervention planifiée comme terminée. OWNER → VALIDATED. EMPLOYE → PENDING (revue OWNER).",
  })
  complete(@Param("id", ParseUUIDPipe) id: string) {
    return this.interventions.markCompleted(id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Supprimer une intervention (propriétaire uniquement)",
  })
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.interventions.remove(id);
  }
}
