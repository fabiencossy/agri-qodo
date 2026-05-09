/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
import { Module } from "@nestjs/common";
import { OdooModule } from "@/modules/odoo/odoo.module";
import { OdooProjetsSyncService } from "./odoo-projets-sync.service";
import { ProjetsController } from "./projets.controller";
import { ProjetsService } from "./projets.service";

@Module({
  imports: [OdooModule],
  controllers: [ProjetsController],
  providers: [ProjetsService, OdooProjetsSyncService],
  exports: [ProjetsService, OdooProjetsSyncService],
})
export class ProjetsModule {}
