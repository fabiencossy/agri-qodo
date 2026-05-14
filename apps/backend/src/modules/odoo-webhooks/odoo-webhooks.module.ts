import { Module } from "@nestjs/common";
import { OdooModule } from "@/modules/odoo/odoo.module";
import { OdooWebhookSetupService } from "./odoo-webhook-setup.service";
import { OdooWebhooksController } from "./odoo-webhooks.controller";
import { OdooWebhooksService } from "./odoo-webhooks.service";

@Module({
  imports: [OdooModule],
  controllers: [OdooWebhooksController],
  providers: [OdooWebhooksService, OdooWebhookSetupService],
  exports: [OdooWebhooksService],
})
export class OdooWebhooksModule {}
