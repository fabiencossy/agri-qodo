import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { MaterielCategorie } from "@prisma/client";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { CreateMaterielDto } from "./dto/create-materiel.dto";
import { UpdateMaterielDto } from "./dto/update-materiel.dto";
import { MaterielsService } from "./materiels.service";

@ApiTags("materiels")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("materiels")
export class MaterielsController {
  constructor(private readonly service: MaterielsService) {}

  @Get()
  @ApiOperation({
    summary:
      "Liste les matériels du catalogue (globaux + perso du tenant). Filtre par catégorie optionnel.",
  })
  @ApiQuery({ name: "categorie", required: false, enum: MaterielCategorie })
  list(
    @Query("categorie", new ParseEnumPipe(MaterielCategorie, { optional: true }))
    categorie?: MaterielCategorie,
  ) {
    return this.service.list(categorie);
  }

  @Get(":id")
  getById(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Post()
  @ApiOperation({ summary: "Crée un matériel perso (tenant)." })
  create(@Body() dto: CreateMaterielDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Met à jour un matériel perso. Les matériels globaux sont read-only.",
  })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateMaterielDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
