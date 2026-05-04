/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
import { Module } from "@nestjs/common";
import { ProjetsController } from "./projets.controller";
import { ProjetsService } from "./projets.service";

@Module({
  controllers: [ProjetsController],
  providers: [ProjetsService],
  exports: [ProjetsService],
})
export class ProjetsModule {}
