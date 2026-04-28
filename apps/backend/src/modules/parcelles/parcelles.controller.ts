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
