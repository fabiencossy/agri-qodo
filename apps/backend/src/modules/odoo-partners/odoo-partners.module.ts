/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
import { Module } from "@nestjs/common";
import { OdooModule } from "@/modules/odoo/odoo.module";
import { OdooPartnersController } from "./odoo-partners.controller";
import { OdooPartnersService } from "./odoo-partners.service";

@Module({
  imports: [OdooModule],
  controllers: [OdooPartnersController],
  providers: [OdooPartnersService],
  exports: [OdooPartnersService],
})
export class OdooPartnersModule {}
