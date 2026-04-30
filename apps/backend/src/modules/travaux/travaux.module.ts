import { Module } from "@nestjs/common";
import { OdooModule } from "@/modules/odoo/odoo.module";
import { OdooPushService } from "./odoo-push.service";
import { TravauxController } from "./travaux.controller";
import { TravauxService } from "./travaux.service";

@Module({
  imports: [OdooModule],
  controllers: [TravauxController],
  providers: [TravauxService, OdooPushService],
  exports: [TravauxService],
})
export class TravauxModule {}
