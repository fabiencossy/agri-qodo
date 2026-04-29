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
import { CreatePlanApportDto } from "./dto/create-plan-apport.dto";
import { UpdatePlanApportDto } from "./dto/update-plan-apport.dto";
import { PlanFumureService } from "./plan-fumure.service";

@ApiTags("plan-fumure")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("plan-fumure")
export class PlanFumureController {
  constructor(private readonly service: PlanFumureService) {}

  @Get()
  @ApiOperation({ summary: "Liste les apports prévus (filtre campagne / parcelle)." })
  @ApiQuery({ name: "campagne", required: false, type: Number })
  @ApiQuery({ name: "parcelleId", required: false })
  list(
    @Query("campagne", new ParseIntPipe({ optional: true })) campagne?: number,
    @Query("parcelleId") parcelleId?: string,
  ) {
    return this.service.list({
      ...(campagne !== undefined ? { campagne } : {}),
      ...(parcelleId !== undefined ? { parcelleId } : {}),
    });
  }

  @Get(":id")
  getById(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Post()
  @ApiOperation({ summary: "Ajoute un apport au plan de fumure." })
  create(@Body() dto: CreatePlanApportDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdatePlanApportDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }

  @Post(":id/realiser")
  @ApiOperation({
    summary:
      "Crée une Intervention FUMURE depuis ce plan et lie l'apport prévu à l'intervention réalisée.",
  })
  realiser(@Param("id", ParseUUIDPipe) id: string, @Body() body: { dateOperation?: string } = {}) {
    return this.service.realiser(id, body.dateOperation);
  }
}
