import { Module } from "@nestjs/common";
import { TravauxModule } from "@/modules/travaux/travaux.module";
import { InterventionsController } from "./interventions.controller";
import { InterventionsService } from "./interventions.service";

@Module({
  imports: [TravauxModule],
  controllers: [InterventionsController],
  providers: [InterventionsService],
  exports: [InterventionsService],
})
export class InterventionsModule {}
