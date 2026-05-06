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
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Min,
} from "class-validator";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { CreateParcelleDto } from "./dto/create-parcelle.dto";
import { ImportParcellesDto } from "./dto/import-parcelles.dto";
import { UpdateParcelleDto } from "./dto/update-parcelle.dto";
import { ParcellesService } from "./parcelles.service";

class QuickParcelleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nom!: string;

  @IsNumber()
  @Min(1)
  surfaceM2!: number;

  @ApiPropertyOptional({ description: "Latitude WGS84 du centre (-90 à 90)." })
  @IsOptional()
  @IsLatitude()
  centreLat?: number;

  @ApiPropertyOptional({ description: "Longitude WGS84 du centre (-180 à 180)." })
  @IsOptional()
  @IsLongitude()
  centreLng?: number;

  @ApiPropertyOptional({
    description:
      "ID res.partner Odoo si la parcelle est rattachée à un client Odoo non-partenaire. Sert à refiltrer la liste quand l'utilisateur resélectionne le même client.",
  })
  @IsOptional()
  @IsInt()
  odooPartnerId?: number;
}

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

  @Post("quick")
  @ApiOperation({
    summary:
      "Création rapide d'une parcelle (nom + surface + point GPS), sans polygone. Utilisé depuis le sélecteur de parcelle dans /interventions/new pour les clients Odoo non-partenaires.",
  })
  createQuick(@Body() dto: QuickParcelleDto) {
    return this.parcelles.createQuick(dto);
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
