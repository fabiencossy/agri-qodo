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
import { CreateParcelleDto } from "./dto/create-parcelle.dto";
import { ImportParcellesDto } from "./dto/import-parcelles.dto";
import { UpdateParcelleDto } from "./dto/update-parcelle.dto";
import { ParcellesService } from "./parcelles.service";

@ApiTags("parcelles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("parcelles")
export class ParcellesController {
  constructor(private readonly parcelles: ParcellesService) {}

  @Get()
  @ApiOperation({ summary: "Liste toutes mes parcelles" })
  list() {
    return this.parcelles.list();
  }

  @Get("map")
  @ApiOperation({
    summary: "Liste des parcelles avec leur géométrie GeoJSON (pour affichage carte)",
  })
  listForMap() {
    return this.parcelles.listForMap();
  }

  @Get("accessibles")
  @ApiOperation({
    summary:
      "Liste les parcelles accessibles : les miennes + celles des partenaires liés (PartnerLink ACTIVE). Sert à la saisie d'interventions/travaux 'chez un client'.",
  })
  listAccessibles() {
    return this.parcelles.listAccessibles();
  }

  @Get(":id")
  @ApiOperation({ summary: "Détail d'une parcelle par id" })
  getById(@Param("id", ParseUUIDPipe) id: string) {
    return this.parcelles.getById(id);
  }

  @Post()
  @ApiOperation({ summary: "Créer une nouvelle parcelle" })
  create(@Body() dto: CreateParcelleDto) {
    return this.parcelles.create(dto);
  }

  @Post("import")
  @ApiOperation({
    summary: "Import en masse depuis un GeoJSON FeatureCollection (export Acorda/GELAN/Agriportal)",
  })
  importGeoJson(@Body() dto: ImportParcellesDto) {
    return this.parcelles.importGeoJson(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Modifier une parcelle existante" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateParcelleDto) {
    return this.parcelles.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Supprimer une parcelle" })
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.parcelles.remove(id);
  }
}
