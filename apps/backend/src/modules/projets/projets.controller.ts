/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
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
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { CreateProjetDto, UpdateProjetDto } from "./dto/projet.dto";
import { ProjetsService } from "./projets.service";

@ApiTags("projets")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("projets")
export class ProjetsController {
  constructor(private readonly service: ProjetsService) {}

  @Get()
  @ApiOperation({ summary: "Liste les projets du tenant courant." })
  @ApiQuery({ name: "includeArchived", required: false, type: Boolean })
  @ApiQuery({ name: "type", required: false })
  list(@Query("includeArchived") includeArchived?: string, @Query("type") type?: string) {
    return this.service.list({
      includeArchived: includeArchived === "true",
      ...(type ? { type } : {}),
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Détail d'un projet." })
  getById(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Post()
  @ApiOperation({ summary: "Crée un projet." })
  create(@Body() dto: CreateProjetDto) {
    return this.service.create(dto);
  }

  @Post("sync")
  @ApiOperation({
    summary:
      "Pull les `project.project` Odoo et upsert les Projets AQ. Bidirectionnel : les push sont automatiques au create/update local.",
  })
  syncFromOdoo() {
    return this.service.syncFromOdoo();
  }

  @Patch(":id")
  @ApiOperation({ summary: "Modifie un projet (nom, description, type, archive…)" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateProjetDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Supprime un projet (rétrocession sur les références)." })
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
