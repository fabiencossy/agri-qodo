import { Controller, Get, Param, ParseIntPipe, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { SuisseBilanzService } from "./suisse-bilanz.service";

@ApiTags("suisse-bilanz")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("suisse-bilanz")
export class SuisseBilanzController {
  constructor(private readonly service: SuisseBilanzService) {}

  @Get(":annee")
  @ApiOperation({ summary: "Bilan Suisse-Bilanz simplifié pour une année (campagne)." })
  getForAnnee(@Param("annee", ParseIntPipe) annee: number) {
    return this.service.getForAnnee(annee);
  }
}
