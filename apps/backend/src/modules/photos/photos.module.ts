import { Module } from "@nestjs/common";
import { OdooModule } from "@/modules/odoo/odoo.module";
import { PhotosController } from "./photos.controller";
import { PhotosService } from "./photos.service";

@Module({
  imports: [OdooModule],
  controllers: [PhotosController],
  providers: [PhotosService],
  exports: [PhotosService],
})
export class PhotosModule {}
