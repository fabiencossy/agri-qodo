import { Module } from "@nestjs/common";
import { SuisseBilanzController } from "./suisse-bilanz.controller";
import { SuisseBilanzService } from "./suisse-bilanz.service";

@Module({
  controllers: [SuisseBilanzController],
  providers: [SuisseBilanzService],
})
export class SuisseBilanzModule {}
