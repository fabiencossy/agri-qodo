import { Module } from "@nestjs/common";
import { OdooModule } from "@/modules/odoo/odoo.module";
import { HrController } from "./hr.controller";
import { HrService } from "./hr.service";

@Module({
  imports: [OdooModule],
  controllers: [HrController],
  providers: [HrService],
  exports: [HrService],
})
export class HrModule {}
