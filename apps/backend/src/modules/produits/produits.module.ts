import { Module } from "@nestjs/common";
import { OdooModule } from "@/modules/odoo/odoo.module";
import { OdooSyncService } from "./odoo-sync.service";
import { ProduitsController } from "./produits.controller";
import { ProduitsService } from "./produits.service";

@Module({
  imports: [OdooModule],
  controllers: [ProduitsController],
  providers: [ProduitsService, OdooSyncService],
  exports: [ProduitsService],
})
export class ProduitsModule {}
