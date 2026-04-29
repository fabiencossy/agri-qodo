import { Module } from "@nestjs/common";
import { OdooConfigController } from "./odoo-config.controller";
import { OdooConfigService } from "./odoo-config.service";

@Module({
  controllers: [OdooConfigController],
  providers: [OdooConfigService],
  exports: [OdooConfigService],
})
export class OdooConfigModule {}
