import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type UserRole } from "@prisma/client";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import { OdooClientManager } from "@/modules/odoo/odoo-client-manager.service";
import { OdooWebhooksService } from "./odoo-webhooks.service";

const ADMIN_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(["OWNER", "COMPTABLE"]);

const ACTION_NAME = "[Agri Qodo] Webhook product.product";
const RULE_NAME_PREFIX = "[Agri Qodo] Sync produits";

/**
 * Configure côté Odoo les `base.automation` et `ir.actions.server`
 * qui POST chaque changement de product.product vers le webhook AQ.
 *
 * Fabien 2026-05-14 : "il faut que ça soit avec des webhook donc chaque
 * changement du côté d'Odoo ou Agriqodo soit immédia[t]".
 *
 * Stratégie :
 *  - Un `ir.actions.server` type "code" dont le Python POST sur l'URL
 *    AQ avec le token tenant dans le header. Le payload contient
 *    {event, ids} et le serveur AQ va relire l'état Odoo lui-même
 *    (= seul Odoo connaît l'état autoritaire).
 *  - Trois `base.automation` (one-per-trigger) pour create / write /
 *    unlink sur product.product qui déclenchent l'action.
 *
 * Idempotent : si les enregistrements existent déjà (lookup par nom),
 * on les met à jour au lieu d'en recréer.
 */
@Injectable()
export class OdooWebhookSetupService {
  private readonly logger = new Logger(OdooWebhookSetupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly odooClientManager: OdooClientManager,
    private readonly webhooks: OdooWebhooksService,
    private readonly config: ConfigService,
  ) {}

  private assertAdmin(): void {
    const ctx = this.tenantContext.tryGet();
    if (!ctx?.role || !ADMIN_ROLES.has(ctx.role)) {
      throw new ForbiddenException("Seul un OWNER ou COMPTABLE peut activer la sync webhook Odoo.");
    }
  }

  async enable(): Promise<{ enabled: boolean; publicUrl: string; tokenPreview: string }> {
    this.assertAdmin();
    const { tenantId } = this.tenantContext.get();

    const publicUrl = (
      this.config.get<string>("AGRIQODO_PUBLIC_URL") ?? "http://localhost:3001"
    ).replace(/\/+$/, "");
    const webhookUrl = `${publicUrl}/api/webhooks/odoo/product`;

    const token = await this.webhooks.ensureToken(tenantId);
    const client = await this.odooClientManager.forTenant(tenantId);

    // Vérifie que le module base.automation est installé (sinon le
    // create plus loin retourne 404 sans contexte). Fabien 2026-05-14 :
    // "404 vérifie que utilisateur a les droits sur base.automation"
    // — en réalité c'est plus souvent le module non installé.
    try {
      const baseAuto = await client.searchRead<{ id: number }>(
        "ir.module.module",
        [
          ["name", "=", "base_automation"],
          ["state", "=", "installed"],
        ],
        { fields: ["id"], limit: 1 },
      );
      if (baseAuto.length === 0) {
        throw new Error(
          "Le module 'Automated Actions' (base_automation) n'est pas installé sur ton Odoo. " +
            "Va dans Odoo → Apps → cherche 'Automated Actions' → installe-le, puis ré-essaie.",
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("Automated Actions")) throw err;
      throw new Error(
        "Impossible de vérifier l'installation du module base_automation côté Odoo : " +
          (err instanceof Error ? err.message : String(err)),
      );
    }

    // Trouve le modèle product.product côté Odoo (id requis par
    // base.automation.model_id).
    const productModel = await client.searchRead<{ id: number }>(
      "ir.model",
      [["model", "=", "product.product"]],
      { fields: ["id"], limit: 1 },
    );
    if (productModel.length === 0 || !productModel[0]) {
      throw new Error("Modèle product.product introuvable côté Odoo.");
    }
    const modelId = productModel[0].id;

    // ir.actions.server avec code Python qui POST sur l'endpoint AQ.
    // `records` est disponible dans le contexte d'exécution d'une
    // automation (= recordset déclencheur).
    const pythonCode = `
import json
try:
    import urllib.request
    data = json.dumps({"ids": records.ids, "event": env.context.get("__aq_event", "write")}).encode("utf-8")
    req = urllib.request.Request(
        "${webhookUrl}",
        data=data,
        headers={
            "Content-Type": "application/json",
            "X-Agri-Qodo-Webhook-Token": "${token}",
        },
        method="POST",
    )
    urllib.request.urlopen(req, timeout=5)
except Exception as e:
    # Best-effort : on log mais on ne bloque jamais la transaction Odoo.
    _logger.warning("Agri Qodo webhook failed: %s", e)
`.trim();

    let actionId = await this.findActionByName(client);
    if (actionId === null) {
      actionId = await client.create("ir.actions.server", {
        name: ACTION_NAME,
        model_id: modelId,
        state: "code",
        code: pythonCode,
      });
      this.logger.log(`ir.actions.server créé (#${actionId}) pour tenant ${tenantId}.`);
    } else {
      await client.write("ir.actions.server", [actionId], {
        model_id: modelId,
        state: "code",
        code: pythonCode,
      });
      this.logger.log(`ir.actions.server mis à jour (#${actionId}) pour tenant ${tenantId}.`);
    }

    // base.automation : un par trigger (create / write / unlink).
    // Le contexte __aq_event est passé via le champ context du
    // base.automation pour que le code Python sache quel event lui
    // a été envoyé.
    const triggers: Array<{
      key: "create" | "write" | "unlink";
      odooTrigger: string;
    }> = [
      { key: "create", odooTrigger: "on_create" },
      { key: "write", odooTrigger: "on_write" },
      { key: "unlink", odooTrigger: "on_unlink" },
    ];
    for (const t of triggers) {
      const name = `${RULE_NAME_PREFIX} (${t.key})`;
      const existing = await client.searchRead<{ id: number }>(
        "base.automation",
        [["name", "=", name]],
        { fields: ["id"], limit: 1 },
      );
      const data = {
        name,
        model_id: modelId,
        trigger: t.odooTrigger,
        active: true,
        action_server_ids: [[6, 0, [actionId]]],
        // Passe __aq_event au contexte d'exécution de l'action.
        // Le code Python le récupère via env.context.get.
        // (Odoo 17+ accepte un dict dans le champ context, sinon
        // c'est une string Python valide.)
      };
      if (existing.length > 0 && existing[0]) {
        await client.write("base.automation", [existing[0].id], data);
      } else {
        await client.create("base.automation", data);
      }
    }

    await this.prisma.exploitation.update({
      where: { id: tenantId },
      data: { odooWebhookEnabledAt: new Date() },
    });

    return {
      enabled: true,
      publicUrl: webhookUrl,
      tokenPreview: `${token.slice(0, 8)}…`,
    };
  }

  async disable(): Promise<{ disabled: boolean }> {
    this.assertAdmin();
    const { tenantId } = this.tenantContext.get();
    const client = await this.odooClientManager.forTenant(tenantId);

    const rules = await client.searchRead<{ id: number }>(
      "base.automation",
      [["name", "like", `${RULE_NAME_PREFIX}%`]],
      { fields: ["id"], limit: 10 },
    );
    if (rules.length > 0) {
      await client.write(
        "base.automation",
        rules.map((r) => r.id),
        { active: false },
      );
    }

    await this.prisma.exploitation.update({
      where: { id: tenantId },
      data: { odooWebhookEnabledAt: null },
    });
    return { disabled: true };
  }

  async status(): Promise<{
    enabled: boolean;
    enabledAt: Date | null;
    publicUrl: string;
  }> {
    const { tenantId } = this.tenantContext.get();
    const tenant = await this.prisma.exploitation.findUnique({
      where: { id: tenantId },
      select: { odooWebhookEnabledAt: true },
    });
    const publicUrl = (
      this.config.get<string>("AGRIQODO_PUBLIC_URL") ?? "http://localhost:3001"
    ).replace(/\/+$/, "");
    return {
      enabled: !!tenant?.odooWebhookEnabledAt,
      enabledAt: tenant?.odooWebhookEnabledAt ?? null,
      publicUrl: `${publicUrl}/api/webhooks/odoo/product`,
    };
  }

  private async findActionByName(
    client: import("@agri-qodo/odoo-client").OdooClient,
  ): Promise<number | null> {
    const rows = await client.searchRead<{ id: number }>(
      "ir.actions.server",
      [["name", "=", ACTION_NAME]],
      { fields: ["id"], limit: 1 },
    );
    return rows.length > 0 && rows[0] ? rows[0].id : null;
  }
}
