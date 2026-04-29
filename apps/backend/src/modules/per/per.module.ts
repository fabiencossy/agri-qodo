import { Module } from "@nestjs/common";
import { PerController } from "./per.controller";
import { PerService } from "./per.service";

@Module({
  controllers: [PerController],
  providers: [PerService],
  exports: [PerService],
})
export class PerModule {}
