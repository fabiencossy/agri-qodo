import { Module } from "@nestjs/common";
import { OdooModule } from "@/modules/odoo/odoo.module";
import { MaterielsController } from "./materiels.controller";
import { MaterielsService } from "./materiels.service";
import { MaterielsOdooSyncService } from "./odoo-sync.service";

@Module({
  imports: [OdooModule],
  controllers: [MaterielsController],
  providers: [MaterielsService, MaterielsOdooSyncService],
  exports: [MaterielsService, MaterielsOdooSyncService],
})
export class MaterielsModule {}
