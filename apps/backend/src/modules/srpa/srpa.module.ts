import { Module } from "@nestjs/common";
import { SrpaController } from "./srpa.controller";
import { SrpaService } from "./srpa.service";

@Module({
  controllers: [SrpaController],
  providers: [SrpaService],
  exports: [SrpaService],
})
export class SrpaModule {}
