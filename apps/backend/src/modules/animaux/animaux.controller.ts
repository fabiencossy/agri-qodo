import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AnimalCategorie } from "@prisma/client";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { AnimauxService } from "./animaux.service";
import { CreateAnimalDto } from "./dto/create-animal.dto";
import { CreateAnimauxBatchDto } from "./dto/create-animaux-batch.dto";
import { UpdateAnimalDto } from "./dto/update-animal.dto";

@ApiTags("animaux")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("animaux")
export class AnimauxController {
  constructor(private readonly service: AnimauxService) {}

  @Get()
  @ApiOperation({ summary: "Liste des animaux du tenant." })
  list() {
    return this.service.list();
  }

  @Get("summary")
  @ApiOperation({ summary: "Effectif groupé par catégorie (animaux actifs)." })
  summary() {
    return this.service.summary();
  }

  @Get("categories-actives")
  @ApiOperation({
    summary: "Catégories animales présentes sur l'exploitation (≥ 1 animal actif).",
  })
  categoriesActives() {
    return this.service.categoriesActives();
  }

  @Get(":id")
  getById(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Post()
  @ApiOperation({ summary: "Crée un animal individuel." })
  create(@Body() dto: CreateAnimalDto) {
    return this.service.create(dto);
  }

  @Post("batch")
  @ApiOperation({
    summary: "Saisie rapide : crée N animaux d'une catégorie (compteur).",
  })
  createBatch(@Body() dto: CreateAnimauxBatchDto) {
    return this.service.createBatch(dto);
  }

  @Put("effectif")
  @ApiOperation({
    summary:
      "Définit l'effectif total d'une catégorie (ajuste automatiquement vs l'effectif actuel).",
  })
  setEffectif(
    @Body("categorie", new ParseEnumPipe(AnimalCategorie)) categorie: AnimalCategorie,
    @Body("total", ParseIntPipe) total: number,
  ) {
    return this.service.setEffectif(categorie, total);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateAnimalDto) {
    return this.service.update(id, dto);
  }

  @Delete("batch")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Retire N animaux d'une catégorie (les plus récents d'abord).",
  })
  removeBatch(
    @Query("categorie", new ParseEnumPipe(AnimalCategorie)) categorie: AnimalCategorie,
    @Query("nombre", ParseIntPipe) nombre: number,
  ) {
    return this.service.removeBatch(categorie, nombre);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
