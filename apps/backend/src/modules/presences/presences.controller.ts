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
import { PresenceType } from "@prisma/client";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { ClockOutPresenceDto } from "./dto/clock-out-presence.dto";
import { CreatePresenceDto } from "./dto/create-presence.dto";
import { PresencesService } from "./presences.service";

@ApiTags("presences")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("presences")
export class PresencesController {
  constructor(private readonly service: PresencesService) {}

  @Get("current")
  @ApiOperation({ summary: "Présence ouverte du user courant (null si pas pointé)." })
  current() {
    return this.service.current();
  }

  @Get("mes")
  @ApiOperation({ summary: "Mes présences sur une fenêtre (filtres date)." })
  @ApiQuery({ name: "dateDebut", required: false, type: String })
  @ApiQuery({ name: "dateFin", required: false, type: String })
  mes(@Query("dateDebut") dateDebut?: string, @Query("dateFin") dateFin?: string) {
    return this.service.mes({
      ...(dateDebut ? { dateDebut } : {}),
      ...(dateFin ? { dateFin } : {}),
    });
  }

  @Get()
  @ApiOperation({ summary: "Toutes les présences du tenant (vue admin)." })
  list(
    @Query("userId") userId?: string,
    @Query("dateDebut") dateDebut?: string,
    @Query("dateFin") dateFin?: string,
  ) {
    return this.service.list({
      ...(userId ? { userId } : {}),
      ...(dateDebut ? { dateDebut } : {}),
      ...(dateFin ? { dateFin } : {}),
    });
  }

  @Post("clock-in")
  @ApiOperation({ summary: "Démarre une présence (clock-in)." })
  clockIn(@Body() dto: CreatePresenceDto) {
    return this.service.clockIn(dto);
  }

  @Post("clock-out")
  @ApiOperation({
    summary:
      "Ferme la présence ouverte courante (clock-out) — pas besoin d'ID. Génère une LigneTravailHeure si lié à un travail.",
  })
  clockOutCurrent(@Body() dto: ClockOutPresenceDto) {
    return this.service.clockOut("current", dto);
  }

  @Post(":id/clock-out")
  @ApiOperation({ summary: "Ferme une présence spécifique." })
  clockOut(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ClockOutPresenceDto) {
    return this.service.clockOut(id, dto);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Modifie une présence (type, travail lié, notes). N'affecte pas dateDebut/dateFin.",
  })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: { type?: PresenceType; travailId?: string; notes?: string },
  ) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
