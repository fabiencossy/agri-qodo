/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
import { Module } from "@nestjs/common";
import { OdooModule } from "@/modules/odoo/odoo.module";
import { OdooSyncService } from "./odoo-sync.service";

@Module({
  imports: [OdooModule],
  providers: [OdooSyncService],
  exports: [OdooSyncService],
})
export class OdooSyncModule {}
