import { Module } from "@nestjs/common";
import { ParcellesController } from "./parcelles.controller";
import { ParcellesService } from "./parcelles.service";

@Module({
  controllers: [ParcellesController],
  providers: [ParcellesService],
  exports: [ParcellesService],
})
export class ParcellesModule {}
