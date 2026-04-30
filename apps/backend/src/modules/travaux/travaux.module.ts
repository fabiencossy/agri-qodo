import { Module } from "@nestjs/common";
import { TravauxController } from "./travaux.controller";
import { TravauxService } from "./travaux.service";

@Module({
  controllers: [TravauxController],
  providers: [TravauxService],
  exports: [TravauxService],
})
export class TravauxModule {}
