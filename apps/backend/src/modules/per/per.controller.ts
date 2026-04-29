import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { PerService } from "./per.service";

@ApiTags("per")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("per")
export class PerController {
  constructor(private readonly service: PerService) {}

  @Get("check-fumure-organique")
  @ApiOperation({
    summary:
      "Vérifie si une fumure organique est autorisée à la date donnée pour la parcelle (calendrier ORRChim).",
  })
  async checkFumureOrganique(@Query("parcelleId") parcelleId: string, @Query("date") date: string) {
    if (!parcelleId || !date) {
      throw new BadRequestException("parcelleId et date sont obligatoires");
    }
    return this.service.checkFumureOrganique(parcelleId, date);
  }
}
