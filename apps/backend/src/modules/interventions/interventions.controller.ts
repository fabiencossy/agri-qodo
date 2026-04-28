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

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Supprimer une intervention (propriétaire uniquement)",
  })
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.interventions.remove(id);
  }
}
