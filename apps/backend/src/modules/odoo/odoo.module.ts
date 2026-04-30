import { Module } from "@nestjs/common";
import { OdooClientManager } from "./odoo-client-manager.service";

/**
 * Module commun pour parler à Odoo. Ne contient pas de controller : les
 * features qui ont besoin d'Odoo (sale.order, res.partner, …) injectent
 * `OdooClientManager` et appellent `.forTenant(id)`. PR #28 odoo-config
 * gère les CRUD de la config persistée ; ce module ne fait que la
 * traduction config DB → client authentifiable.
 */
@Module({
  providers: [OdooClientManager],
  exports: [OdooClientManager],
})
export class OdooModule {}
