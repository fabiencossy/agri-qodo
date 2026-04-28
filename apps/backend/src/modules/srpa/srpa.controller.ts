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
import { CreateSortieSrpaDto } from "./dto/create-sortie.dto";
import { UpdateSortieSrpaDto } from "./dto/update-sortie.dto";
import { SrpaService } from "./srpa.service";

@ApiTags("srpa")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("srpa")
export class SrpaController {
  constructor(private readonly srpa: SrpaService) {}

  @Get()
  @ApiOperation({ summary: "Liste des sorties au pâturage (1 an glissant)" })
  list() {
    return this.srpa.list();
  }

  @Get(":id")
  getById(@Param("id", ParseUUIDPipe) id: string) {
    return this.srpa.getById(id);
  }

  @Post()
  @ApiOperation({ summary: "Enregistrer une sortie" })
  create(@Body() dto: CreateSortieSrpaDto) {
    return this.srpa.create(dto);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateSortieSrpaDto) {
    return this.srpa.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.srpa.remove(id);
  }
}
