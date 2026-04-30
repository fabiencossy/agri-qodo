import { Module } from "@nestjs/common";
import { OdooModule } from "@/modules/odoo/odoo.module";
import { OdooConfigController } from "./odoo-config.controller";
import { OdooConfigService } from "./odoo-config.service";

@Module({
  imports: [OdooModule],
  controllers: [OdooConfigController],
  providers: [OdooConfigService],
  exports: [OdooConfigService],
})
export class OdooConfigModule {}
