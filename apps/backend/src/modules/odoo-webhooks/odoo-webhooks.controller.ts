import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { OdooWebhookSetupService } from "./odoo-webhook-setup.service";
import { OdooWebhooksService } from "./odoo-webhooks.service";

interface IncomingProductWebhook {
  event: "create" | "write" | "unlink";
  ids: number[];
}

@ApiTags("webhooks")
@Controller("webhooks/odoo")
export class OdooWebhooksController {
  constructor(
    private readonly webhooks: OdooWebhooksService,
    private readonly setupService: OdooWebhookSetupService,
  ) {}

  /**
   * Endpoint sans auth JWT — l'authentification se fait par token
   * partagé dans le header X-Agri-Qodo-Webhook-Token. Odoo l'envoie
   * via le code Python configuré dans ir.actions.server.
   */
  @Post("product")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Webhook entrant Odoo → AQ : reçoit un évènement product.product et met à jour le catalogue local.",
  })
  async handleProductWebhook(
    @Headers("x-agri-qodo-webhook-token") token: string | undefined,
    @Body() payload: IncomingProductWebhook,
  ): Promise<{ processed: number; skipped: number }> {
    const tenantId = await this.webhooks.authenticateByToken(token);
    if (!payload || !Array.isArray(payload.ids)) {
      throw new BadRequestException("Payload invalide : { event, ids } attendu.");
    }
    if (!["create", "write", "unlink"].includes(payload.event)) {
      throw new BadRequestException(`Event inconnu : ${payload.event}`);
    }
    return this.webhooks.handleProductWebhook(tenantId, payload.event, payload.ids);
  }

  @UseGuards(JwtAuthGuard)
  @Post("setup")
  @ApiOperation({
    summary:
      "Active la sync webhook temps réel Odoo → AQ : crée les base.automation côté Odoo (admin).",
  })
  setup() {
    return this.setupService.enable();
  }

  @UseGuards(JwtAuthGuard)
  @Post("disable")
  @ApiOperation({
    summary: "Désactive la sync webhook temps réel (les automations Odoo passent en inactives).",
  })
  disable() {
    return this.setupService.disable();
  }

  @UseGuards(JwtAuthGuard)
  @Get("status")
  @ApiOperation({ summary: "Statut de la sync webhook pour le tenant courant." })
  status() {
    return this.setupService.status();
  }
}
