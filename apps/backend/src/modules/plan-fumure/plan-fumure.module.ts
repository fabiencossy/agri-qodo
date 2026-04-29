import { Module } from "@nestjs/common";
import { PlanFumureController } from "./plan-fumure.controller";
import { PlanFumureService } from "./plan-fumure.service";

@Module({
  controllers: [PlanFumureController],
  providers: [PlanFumureService],
  exports: [PlanFumureService],
})
export class PlanFumureModule {}
